/**
 * ApprovePricingScenario Command
 *
 * Approves a draft pricing scenario. Supersedes any existing approved
 * scenario for the same proposal (partial unique constraint).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult, VersionedInput } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent } from '../runner'
import { NotFoundError, InvalidStateError, StaleVersionError } from '../errors'

/**
 * Input for approving a pricing scenario.
 */
export interface ApprovePricingScenarioInput extends VersionedInput {
  scenarioId: string
}

/**
 * Output from approving a pricing scenario.
 */
export interface ApprovePricingScenarioOutput {
  approved: boolean
  scenarioId: string
  supersededId: string | null
  newRowVersion: number
}

/**
 * Create the ApprovePricingScenario command instance.
 */
export function createApprovePricingScenarioCommand(
  supabase: SupabaseClient
): Command<ApprovePricingScenarioInput, ApprovePricingScenarioOutput> {
  return {
    name: 'ApprovePricingScenario',
    aggregateType: 'pricing_scenario',
    allowedRoles: ['owner', 'admin', 'accountant'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: ApprovePricingScenarioInput
    ): Promise<CommandResult<ApprovePricingScenarioOutput>> {
      const { scenarioId, expectedVersion } = input
      const tenantId = context.tenant.tenant.id

      // 1. Load the scenario
      const { data: scenario, error: loadError } = await supabase
        .from('pricing_scenarios')
        .select('id, proposal_id, status, row_version')
        .eq('id', scenarioId)
        .eq('tenant_id', tenantId)
        .single()

      if (loadError || !scenario) {
        throw new NotFoundError('pricing_scenario', scenarioId)
      }

      // 2. Check optimistic concurrency
      if (expectedVersion !== undefined && scenario.row_version !== expectedVersion) {
        throw new StaleVersionError({
          aggregateId: scenarioId,
          currentVersion: scenario.row_version,
          submittedVersion: expectedVersion,
        })
      }

      // 3. Validate state
      if (scenario.status !== 'draft') {
        throw new InvalidStateError(
          'Only draft scenarios can be approved',
          scenario.status,
          'draft'
        )
      }

      // 4. Find and supersede any existing approved scenario
      let supersededId: string | null = null

      const { data: existingApproved } = await supabase
        .from('pricing_scenarios')
        .select('id')
        .eq('proposal_id', scenario.proposal_id)
        .eq('tenant_id', tenantId)
        .eq('status', 'approved')
        .single()

      if (existingApproved) {
        const { error: supersededError } = await supabase
          .from('pricing_scenarios')
          .update({ status: 'superseded' })
          .eq('id', existingApproved.id)

        if (supersededError) {
          console.error('[ApprovePricingScenario] Failed to supersede:', supersededError)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to supersede existing approved scenario',
            },
          }
        }

        supersededId = existingApproved.id
      }

      // 5. Approve the scenario
      const { data: updated, error: updateError } = await supabase
        .from('pricing_scenarios')
        .update({ status: 'approved' })
        .eq('id', scenarioId)
        .select('row_version')
        .single()

      if (updateError || !updated) {
        console.error('[ApprovePricingScenario] Failed to approve:', updateError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: updateError?.message || 'Failed to approve scenario',
          },
        }
      }

      // 6. Write audit event
      await writeAuditEvent(supabase, {
        tenantId,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'ApprovePricingScenario',
        aggregateType: 'pricing_scenario',
        aggregateId: scenarioId,
        beforeVersion: scenario.row_version,
        afterVersion: updated.row_version,
        changedFields: {
          status: { old: 'draft', new: 'approved' },
        },
        commandInput: { scenarioId, supersededId },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          approved: true,
          scenarioId,
          supersededId,
          newRowVersion: updated.row_version,
        },
      }
    },
  }
}
