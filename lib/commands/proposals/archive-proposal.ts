/**
 * ArchiveProposal Command
 *
 * Archives (soft-deletes) a proposal.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult, VersionedInput } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent, detectChanges } from '../runner'
import { NotFoundError, StaleVersionError, ValidationError } from '../errors'

/**
 * Input for archiving a proposal.
 */
export interface ArchiveProposalInput extends VersionedInput {
  proposalId: string
}

/**
 * Output from archiving a proposal.
 */
export interface ArchiveProposalOutput {
  id: string
  archived: boolean
  rowVersion: number
}

/**
 * Create the command instance.
 */
export function createArchiveProposalCommand(
  supabase: SupabaseClient
): Command<ArchiveProposalInput, ArchiveProposalOutput> {
  return {
    name: 'ArchiveProposal',
    aggregateType: 'proposal',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: ArchiveProposalInput
    ): Promise<CommandResult<ArchiveProposalOutput>> {
      // Validate input
      if (!input.proposalId) {
        throw new ValidationError('Proposal ID is required', { proposalId: 'Required field' })
      }

      const companyId = context.tenant.tenant.companyId
      if (!companyId) {
        throw new ValidationError('Tenant has no associated company', {
          tenant: 'No company linked',
        })
      }

      // Load current proposal
      const { data: current, error: loadError } = await supabase
        .from('proposals')
        .select('id, archived, row_version, company_id')
        .eq('id', input.proposalId)
        .single()

      if (loadError || !current) {
        throw new NotFoundError('proposal', input.proposalId)
      }

      // Verify ownership
      if (current.company_id !== companyId) {
        throw new NotFoundError('proposal', input.proposalId)
      }

      // Check version if provided
      if (input.expectedVersion !== undefined && current.row_version !== input.expectedVersion) {
        throw new StaleVersionError({
          aggregateId: input.proposalId,
          currentVersion: current.row_version,
          submittedVersion: input.expectedVersion,
          changedFields: ['archived', 'row_version'],
        })
      }

      // Already archived? No-op
      if (current.archived) {
        return {
          success: true,
          data: {
            id: current.id,
            archived: true,
            rowVersion: current.row_version,
          },
        }
      }

      // Update proposal
      const { data: updated, error: updateError } = await supabase
        .from('proposals')
        .update({ archived: true })
        .eq('id', input.proposalId)
        .eq('row_version', current.row_version) // Optimistic lock
        .select('id, archived, row_version')
        .single()

      if (updateError) {
        // Could be concurrent modification
        if (updateError.code === 'PGRST116') {
          // Re-fetch to get current version
          const { data: refetched } = await supabase
            .from('proposals')
            .select('row_version')
            .eq('id', input.proposalId)
            .single()

          throw new StaleVersionError({
            aggregateId: input.proposalId,
            currentVersion: refetched?.row_version ?? current.row_version + 1,
            submittedVersion: current.row_version,
            changedFields: ['row_version'],
          })
        }

        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: updateError.message,
          },
        }
      }

      // Write audit event
      const auditEventId = await writeAuditEvent(supabase, {
        tenantId: context.tenant.tenant.id,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'ArchiveProposal',
        aggregateType: 'proposal',
        aggregateId: input.proposalId,
        beforeVersion: current.row_version,
        afterVersion: updated.row_version,
        changedFields: detectChanges(
          { archived: current.archived },
          { archived: updated.archived },
          ['archived']
        ),
        commandInput: { proposalId: input.proposalId },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          id: updated.id,
          archived: updated.archived,
          rowVersion: updated.row_version,
        },
        auditEventId: auditEventId ?? undefined,
      }
    },
  }
}
