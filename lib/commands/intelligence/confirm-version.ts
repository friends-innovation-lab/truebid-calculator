/**
 * ConfirmIntelligenceVersion Command
 *
 * Confirms a draft intelligence version by:
 * 1. Writing facts to DB (already done via UpdateIntelligenceFacts)
 * 2. Reading back fresh from DB
 * 3. Computing SHA-256 hash from DB-loaded data
 * 4. Setting status to confirmed, storing hash
 * 5. Setting this version as active on the proposal
 *
 * CRITICAL: Hash is computed from fresh DB read-back, NOT in-memory data.
 * This ensures confirm-time and guard-time use the same load-and-coerce code path.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent } from '../runner'
import { NotFoundError, StaleVersionError, InvalidStateError } from '../errors'
import { loadAndHashIntelligence } from './hash-utils'
import type {
  ConfirmIntelligenceVersionInput,
  ConfirmIntelligenceVersionOutput,
  IntelligenceVersionRow,
} from './types'

/**
 * Create the command instance.
 */
export function createConfirmIntelligenceVersionCommand(
  supabase: SupabaseClient
): Command<ConfirmIntelligenceVersionInput, ConfirmIntelligenceVersionOutput> {
  return {
    name: 'ConfirmIntelligenceVersion',
    aggregateType: 'intelligence_version',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: ConfirmIntelligenceVersionInput
    ): Promise<CommandResult<ConfirmIntelligenceVersionOutput>> {
      const tenantId = context.tenant.tenant.id

      // Load existing version
      const { data: version, error: versionError } = await supabase
        .from('intelligence_versions')
        .select('*')
        .eq('id', input.versionId)
        .single()

      if (versionError || !version) {
        throw new NotFoundError('intelligence_version', input.versionId)
      }

      const versionRow = version as IntelligenceVersionRow

      // Verify tenant
      if (versionRow.tenant_id !== tenantId) {
        throw new NotFoundError('intelligence_version', input.versionId)
      }

      // Verify status is draft
      if (versionRow.status !== 'draft') {
        throw new InvalidStateError(
          `Intelligence version ${input.versionId} must be in draft status to confirm`,
          versionRow.status,
          'draft'
        )
      }

      // Check optimistic concurrency if version provided
      if (input.expectedVersion !== undefined && versionRow.row_version !== input.expectedVersion) {
        throw new StaleVersionError({
          aggregateId: input.versionId,
          currentVersion: versionRow.row_version,
          submittedVersion: input.expectedVersion,
        })
      }

      // PILLAR 2: Block confirmation if staffing model is unclear
      // This requires user resolution before proceeding
      if (versionRow.staffing_model === 'unclear') {
        return {
          success: false,
          error: {
            code: 'STAFFING_MODEL_UNCLEAR',
            message: 'Cannot confirm: staffing model needs clarification',
            details: {
              reason: 'STAFFING_MODEL_UNCLEAR',
              explanation: 'The AI could not determine whether this RFP prescribes exact roles (Key Personnel) or allows offeror-proposed staffing. Please review the extracted roles and select the correct staffing model before confirming.',
              actionRequired: 'SELECT_STAFFING_MODEL',
              options: [
                {
                  value: 'prescribed',
                  label: 'Prescribed (RFP specifies exact roles)',
                  description: 'The RFP names specific Key Personnel or required positions. WBS generation will use only these roles.',
                },
                {
                  value: 'offeror_proposed',
                  label: 'Offeror Proposed (we choose team composition)',
                  description: 'The RFP allows the offeror to propose team structure. WBS generation will suggest appropriate roles.',
                },
              ],
            },
          },
        }
      }

      // CRITICAL: Load fresh from DB and compute hash
      // This ensures we hash the same data that will be verified by the guard
      const hashResult = await loadAndHashIntelligence(supabase, input.versionId)

      if (!hashResult) {
        console.error('[ConfirmIntelligenceVersion] Failed to load and hash')
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to compute confirmation hash',
          },
        }
      }

      const confirmedAt = new Date().toISOString()

      // Update version to confirmed status with hash
      const { error: updateError } = await supabase
        .from('intelligence_versions')
        .update({
          status: 'confirmed',
          confirmation_hash: hashResult.hash,
          confirmed_at: confirmedAt,
        })
        .eq('id', input.versionId)
        .eq('row_version', versionRow.row_version) // Optimistic lock

      if (updateError) {
        if (updateError.message.includes('integrity_constraint_violation')) {
          throw new InvalidStateError(
            `Intelligence version ${input.versionId} must be in draft status to confirm`,
            versionRow.status,
            'draft'
          )
        }
        console.error('[ConfirmIntelligenceVersion] Update error:', updateError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: updateError.message,
          },
        }
      }

      // Set this version as active on the proposal
      const { error: proposalUpdateError } = await supabase
        .from('proposals')
        .update({
          active_intelligence_version_id: input.versionId,
        })
        .eq('id', versionRow.proposal_id)

      if (proposalUpdateError) {
        console.error('[ConfirmIntelligenceVersion] Proposal update error:', proposalUpdateError)
        // Don't fail the command, just log - the version is confirmed
      }

      // Get updated row version
      const { data: updatedVersion } = await supabase
        .from('intelligence_versions')
        .select('row_version')
        .eq('id', input.versionId)
        .single()

      const newRowVersion = updatedVersion?.row_version ?? versionRow.row_version + 1

      // Write audit event
      const auditEventId = await writeAuditEvent(supabase, {
        tenantId,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'ConfirmIntelligenceVersion',
        aggregateType: 'intelligence_version',
        aggregateId: input.versionId,
        beforeVersion: versionRow.row_version,
        afterVersion: newRowVersion,
        changedFields: {
          status: { old: 'draft', new: 'confirmed' },
          confirmation_hash: { old: null, new: hashResult.hash },
          confirmed_at: { old: null, new: confirmedAt },
        },
        commandInput: {
          proposalId: versionRow.proposal_id,
          versionNumber: versionRow.version_number,
        },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          versionId: input.versionId,
          confirmationHash: hashResult.hash,
          confirmedAt,
          rowVersion: newRowVersion,
        },
        auditEventId: auditEventId ?? undefined,
      }
    },
  }
}
