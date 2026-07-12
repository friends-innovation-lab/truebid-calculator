/**
 * UpdateChargeCodes Command
 *
 * Creates, updates, or deletes charge codes for a proposal.
 * Supports bulk operations for the charge codes panel.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent } from '../runner'
import { ValidationError, NotFoundError } from '../errors'

/**
 * A charge code entry.
 */
export interface ChargeCodeEntry {
  id?: string // If provided, update; if not, create
  code: string
  description?: string
  wbsTaskId?: string | null
}

/**
 * Input for updating charge codes.
 */
export interface UpdateChargeCodesInput {
  proposalId: string
  /** Charge codes to upsert */
  codes: ChargeCodeEntry[]
  /** Charge code IDs to delete */
  deleteIds?: string[]
}

/**
 * Output from updating charge codes.
 */
export interface UpdateChargeCodesOutput {
  created: number
  updated: number
  deleted: number
  codes: Array<{
    id: string
    code: string
    description: string | null
    wbsTaskId: string | null
  }>
}

/**
 * Create the UpdateChargeCodes command instance.
 */
export function createUpdateChargeCodesCommand(
  supabase: SupabaseClient
): Command<UpdateChargeCodesInput, UpdateChargeCodesOutput> {
  return {
    name: 'UpdateChargeCodes',
    aggregateType: 'proposal_charge_codes',
    allowedRoles: ['owner', 'admin', 'estimator', 'accountant'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: UpdateChargeCodesInput
    ): Promise<CommandResult<UpdateChargeCodesOutput>> {
      const { proposalId, codes, deleteIds = [] } = input
      const tenantId = context.tenant.tenant.id

      // 1. Verify proposal exists and belongs to tenant
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('id, company_id')
        .eq('id', proposalId)
        .single()

      if (proposalError || !proposal) {
        throw new NotFoundError('proposal', proposalId)
      }

      // Verify tenant ownership
      if (proposal.company_id !== tenantId) {
        throw new ValidationError('Proposal does not belong to tenant', {
          proposalId,
          tenantId,
        })
      }

      let createdCount = 0
      let updatedCount = 0
      let deletedCount = 0
      const resultCodes: Array<{
        id: string
        code: string
        description: string | null
        wbsTaskId: string | null
      }> = []

      // 2. Delete specified codes
      if (deleteIds.length > 0) {
        const { error: deleteError, count } = await supabase
          .from('proposal_charge_codes')
          .delete()
          .eq('proposal_id', proposalId)
          .eq('tenant_id', tenantId)
          .in('id', deleteIds)

        if (deleteError) {
          console.error('[UpdateChargeCodes] Delete error:', deleteError)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to delete charge codes',
            },
          }
        }

        deletedCount = count ?? 0
      }

      // 3. Upsert codes
      for (const entry of codes) {
        if (!entry.code || entry.code.trim().length === 0) {
          continue // Skip empty codes
        }

        const codeData = {
          tenant_id: tenantId,
          proposal_id: proposalId,
          code: entry.code.trim().toUpperCase(),
          description: entry.description?.trim() || null,
          wbs_task_id: entry.wbsTaskId || null,
        }

        if (entry.id) {
          // Update existing
          const { data: updated, error: updateError } = await supabase
            .from('proposal_charge_codes')
            .update({
              code: codeData.code,
              description: codeData.description,
              wbs_task_id: codeData.wbs_task_id,
            })
            .eq('id', entry.id)
            .eq('tenant_id', tenantId)
            .select('id, code, description, wbs_task_id')
            .single()

          if (updateError) {
            // Might be a duplicate code conflict
            if (updateError.code === '23505') {
              return {
                success: false,
                error: {
                  code: 'VALIDATION_FAILED',
                  message: `Duplicate charge code: ${codeData.code}`,
                  details: { code: codeData.code },
                },
              }
            }
            console.error('[UpdateChargeCodes] Update error:', updateError)
            continue
          }

          if (updated) {
            updatedCount++
            resultCodes.push({
              id: updated.id,
              code: updated.code,
              description: updated.description,
              wbsTaskId: updated.wbs_task_id,
            })
          }
        } else {
          // Create new
          const { data: created, error: createError } = await supabase
            .from('proposal_charge_codes')
            .insert(codeData)
            .select('id, code, description, wbs_task_id')
            .single()

          if (createError) {
            // Might be a duplicate code conflict
            if (createError.code === '23505') {
              return {
                success: false,
                error: {
                  code: 'VALIDATION_FAILED',
                  message: `Duplicate charge code: ${codeData.code}`,
                  details: { code: codeData.code },
                },
              }
            }
            console.error('[UpdateChargeCodes] Create error:', createError)
            continue
          }

          if (created) {
            createdCount++
            resultCodes.push({
              id: created.id,
              code: created.code,
              description: created.description,
              wbsTaskId: created.wbs_task_id,
            })
          }
        }
      }

      // 4. Write audit event
      await writeAuditEvent(supabase, {
        tenantId,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'UpdateChargeCodes',
        aggregateType: 'proposal_charge_codes',
        aggregateId: proposalId,
        beforeVersion: null,
        afterVersion: 1,
        changedFields: null,
        commandInput: {
          proposalId,
          codesCount: codes.length,
          deleteIdsCount: deleteIds.length,
        },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          created: createdCount,
          updated: updatedCount,
          deleted: deletedCount,
          codes: resultCodes,
        },
      }
    },
  }
}
