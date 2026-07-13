/**
 * CreateProposalSnapshot Command
 *
 * Creates an immutable snapshot pinning exact versions for submission.
 */

import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent } from '../runner'
import { ValidationError, NotFoundError, InvalidStateError } from '../errors'
import type {
  CreateProposalSnapshotInput,
  CreateProposalSnapshotOutput,
} from './types'

/**
 * Artifact row for validation.
 */
interface ArtifactRow {
  id: string
  proposal_id: string
  intelligence_version_id: string
  status: 'generated' | 'superseded'
  content_hash: string
}

/**
 * Create the CreateProposalSnapshot command instance.
 */
export function createCreateProposalSnapshotCommand(
  supabase: SupabaseClient
): Command<CreateProposalSnapshotInput, CreateProposalSnapshotOutput> {
  return {
    name: 'CreateProposalSnapshot',
    aggregateType: 'proposal_snapshot',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: CreateProposalSnapshotInput
    ): Promise<CommandResult<CreateProposalSnapshotOutput>> {
      const { proposalId, artifactIds, label = 'Submission' } = input
      const tenantId = context.tenant.tenant.id

      if (artifactIds.length === 0) {
        throw new ValidationError('At least one artifact is required', {
          artifactIds: 'Cannot be empty',
        })
      }

      // 1. Load all artifacts
      const { data: artifacts, error: artifactsError } = await supabase
        .from('boe_artifacts')
        .select('id, proposal_id, intelligence_version_id, status, content_hash')
        .in('id', artifactIds)

      if (artifactsError) {
        console.error('[CreateProposalSnapshot] Failed to load artifacts:', artifactsError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to load artifacts',
          },
        }
      }

      const loadedArtifacts = (artifacts || []) as ArtifactRow[]

      // 2. Validate all artifacts exist
      if (loadedArtifacts.length !== artifactIds.length) {
        const foundIds = new Set(loadedArtifacts.map(a => a.id))
        const missingIds = artifactIds.filter(id => !foundIds.has(id))
        throw new NotFoundError('boe_artifact', missingIds.join(', '))
      }

      // 3. Validate all artifacts belong to the same proposal
      for (const artifact of loadedArtifacts) {
        if (artifact.proposal_id !== proposalId) {
          throw new InvalidStateError(
            `Artifact ${artifact.id} belongs to different proposal`,
            artifact.proposal_id,
            proposalId
          )
        }
      }

      // 4. Validate all artifacts have status='generated'
      for (const artifact of loadedArtifacts) {
        if (artifact.status !== 'generated') {
          throw new InvalidStateError(
            `Artifact ${artifact.id} must have status=generated, got: ${artifact.status}`,
            artifact.status,
            'generated'
          )
        }
      }

      // 5. Validate all artifacts reference the same intelligence version
      const intelVersionIds = [...new Set(loadedArtifacts.map(a => a.intelligence_version_id))]
      if (intelVersionIds.length > 1) {
        throw new InvalidStateError(
          'All artifacts must reference the same intelligence version',
          `${intelVersionIds.length} different versions`,
          '1 version'
        )
      }

      const intelligenceVersionId = intelVersionIds[0]

      // 6. Validate intelligence version is confirmed (not superseded)
      const { data: intelVersion, error: intelError } = await supabase
        .from('intelligence_versions')
        .select('id, status, confirmation_hash')
        .eq('id', intelligenceVersionId)
        .single()

      if (intelError || !intelVersion) {
        throw new NotFoundError('intelligence_version', intelligenceVersionId)
      }

      if (intelVersion.status !== 'confirmed') {
        throw new InvalidStateError(
          `Intelligence version must be confirmed, got: ${intelVersion.status}`,
          intelVersion.status,
          'confirmed'
        )
      }

      // 7. Get WBS version and pricing scenario from first artifact
      // (All artifacts should reference the same scenario for a proper snapshot)
      const { data: firstArtifact } = await supabase
        .from('boe_artifacts')
        .select('wbs_version_id, pricing_scenario_id')
        .eq('id', artifactIds[0])
        .single()

      if (!firstArtifact) {
        throw new NotFoundError('boe_artifact', artifactIds[0])
      }

      // 8. Compute composite hash
      // SHA-256(intel.confirmation_hash || artifact1.content_hash || artifact2.content_hash || ...)
      const sortedArtifacts = loadedArtifacts.sort((a, b) => a.id.localeCompare(b.id))
      const hashInput = intelVersion.confirmation_hash + sortedArtifacts.map(a => a.content_hash).join('')
      const compositeHash = createHash('sha256').update(hashInput).digest('hex')

      const submittedAt = new Date().toISOString()

      // 9. Insert snapshot
      const { data: snapshot, error: snapshotError } = await supabase
        .from('proposal_snapshots')
        .insert({
          tenant_id: tenantId,
          proposal_id: proposalId,
          intelligence_version_id: intelligenceVersionId,
          wbs_version_id: firstArtifact.wbs_version_id,
          pricing_scenario_id: firstArtifact.pricing_scenario_id,
          artifact_ids: artifactIds,
          composite_hash: compositeHash,
          label,
          submitted_at: submittedAt,
          submitted_by: context.actorId,
        })
        .select('id')
        .single()

      if (snapshotError || !snapshot) {
        console.error('[CreateProposalSnapshot] Failed to insert snapshot:', snapshotError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: snapshotError?.message || 'Failed to create snapshot',
          },
        }
      }

      // 10. Write audit event
      await writeAuditEvent(supabase, {
        tenantId,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'CreateProposalSnapshot',
        aggregateType: 'proposal_snapshot',
        aggregateId: snapshot.id,
        beforeVersion: null,
        afterVersion: 1,
        changedFields: null,
        commandInput: { proposalId, artifactIds, label },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          snapshotId: snapshot.id,
          compositeHash,
          artifactCount: artifactIds.length,
          submittedAt,
        },
      }
    },
  }
}
