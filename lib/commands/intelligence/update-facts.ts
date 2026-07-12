/**
 * UpdateIntelligenceFacts Command
 *
 * Updates facts on a draft intelligence version.
 * Cannot be used on confirmed or superseded versions (enforced by DB trigger).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent, detectChanges } from '../runner'
import { NotFoundError, StaleVersionError, InvalidStateError } from '../errors'
import type {
  UpdateIntelligenceFactsInput,
  UpdateIntelligenceFactsOutput,
  IntelligenceVersionRow,
} from './types'

/**
 * Create the command instance.
 */
export function createUpdateIntelligenceFactsCommand(
  supabase: SupabaseClient
): Command<UpdateIntelligenceFactsInput, UpdateIntelligenceFactsOutput> {
  return {
    name: 'UpdateIntelligenceFacts',
    aggregateType: 'intelligence_version',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: UpdateIntelligenceFactsInput
    ): Promise<CommandResult<UpdateIntelligenceFactsOutput>> {
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
          `Intelligence version ${input.versionId} must be in draft status`,
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

      // Build update payload for version
      const versionUpdate: Record<string, unknown> = {}
      if (input.factsJson !== undefined) {
        versionUpdate.facts_json = input.factsJson
      }
      if (input.contractType !== undefined) {
        versionUpdate.contract_type = input.contractType
      }

      // Update version if there are changes
      if (Object.keys(versionUpdate).length > 0) {
        const { error: updateError } = await supabase
          .from('intelligence_versions')
          .update(versionUpdate)
          .eq('id', input.versionId)
          .eq('row_version', versionRow.row_version) // Optimistic lock

        if (updateError) {
          if (updateError.message.includes('integrity_constraint_violation')) {
            throw new InvalidStateError(
              `Intelligence version ${input.versionId} must be in draft status`,
              versionRow.status,
              'draft'
            )
          }
          console.error('[UpdateIntelligenceFacts] Update error:', updateError)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: updateError.message,
            },
          }
        }
      }

      // Replace periods if provided
      if (input.periods !== undefined) {
        // Delete existing periods
        const { error: deletePeriodsError } = await supabase
          .from('intelligence_periods')
          .delete()
          .eq('version_id', input.versionId)

        if (deletePeriodsError) {
          if (deletePeriodsError.message.includes('integrity_constraint_violation')) {
            throw new InvalidStateError(
              `Intelligence version ${input.versionId} must be in draft status`,
              versionRow.status,
              'draft'
            )
          }
          console.error('[UpdateIntelligenceFacts] Delete periods error:', deletePeriodsError)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: deletePeriodsError.message,
            },
          }
        }

        // Insert new periods
        if (input.periods.length > 0) {
          const periodsToInsert = input.periods.map((p, idx) => ({
            version_id: input.versionId,
            name: p.name,
            months: p.months,
            cumulative_months_end: p.cumulativeMonthsEnd,
            gsa_rate_year: p.gsaRateYear,
            sort_order: p.sortOrder ?? idx,
          }))

          const { error: insertPeriodsError } = await supabase
            .from('intelligence_periods')
            .insert(periodsToInsert)

          if (insertPeriodsError) {
            console.error('[UpdateIntelligenceFacts] Insert periods error:', insertPeriodsError)
            return {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: insertPeriodsError.message,
              },
            }
          }
        }
      }

      // Replace disciplines if provided
      if (input.disciplines !== undefined) {
        // Delete existing disciplines
        const { error: deleteDisciplinesError } = await supabase
          .from('intelligence_disciplines')
          .delete()
          .eq('version_id', input.versionId)

        if (deleteDisciplinesError) {
          if (deleteDisciplinesError.message.includes('integrity_constraint_violation')) {
            throw new InvalidStateError(
              `Intelligence version ${input.versionId} must be in draft status`,
              versionRow.status,
              'draft'
            )
          }
          console.error('[UpdateIntelligenceFacts] Delete disciplines error:', deleteDisciplinesError)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: deleteDisciplinesError.message,
            },
          }
        }

        // Insert new disciplines
        if (input.disciplines.length > 0) {
          const disciplinesToInsert = input.disciplines.map((d) => ({
            version_id: input.versionId,
            discipline: d.discipline,
            confidence: d.confidence,
            source_text: d.sourceText ?? null,
          }))

          const { error: insertDisciplinesError } = await supabase
            .from('intelligence_disciplines')
            .insert(disciplinesToInsert)

          if (insertDisciplinesError) {
            console.error('[UpdateIntelligenceFacts] Insert disciplines error:', insertDisciplinesError)
            return {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: insertDisciplinesError.message,
              },
            }
          }
        }
      }

      // Replace labor requirements if provided
      if (input.laborRequirements !== undefined) {
        // Delete existing labor requirements
        const { error: deleteLaborReqsError } = await supabase
          .from('intelligence_labor_requirements')
          .delete()
          .eq('version_id', input.versionId)

        if (deleteLaborReqsError) {
          if (deleteLaborReqsError.message.includes('integrity_constraint_violation')) {
            throw new InvalidStateError(
              `Intelligence version ${input.versionId} must be in draft status`,
              versionRow.status,
              'draft'
            )
          }
          console.error('[UpdateIntelligenceFacts] Delete labor reqs error:', deleteLaborReqsError)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: deleteLaborReqsError.message,
            },
          }
        }

        // Insert new labor requirements
        if (input.laborRequirements.length > 0) {
          const laborReqsToInsert = input.laborRequirements.map((l) => ({
            version_id: input.versionId,
            title: l.title,
            labor_category: l.laborCategory ?? null,
            hours_per_month: l.hoursPerMonth ?? null,
            utilization_pct: l.utilizationPct ?? null,
            appears_in_periods: l.appearsInPeriods ?? [],
            confidence: l.confidence,
            source_text: l.sourceText ?? null,
            // Phase 5: Catalog match fields
            labor_category_id: l.laborCategoryId ?? null,
            match_type: l.matchType ?? null,
            match_confidence: l.matchConfidence ?? null,
          }))

          const { error: insertLaborReqsError } = await supabase
            .from('intelligence_labor_requirements')
            .insert(laborReqsToInsert)

          if (insertLaborReqsError) {
            console.error('[UpdateIntelligenceFacts] Insert labor reqs error:', insertLaborReqsError)
            return {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: insertLaborReqsError.message,
              },
            }
          }
        }
      }

      // Get updated row version
      const { data: updatedVersion } = await supabase
        .from('intelligence_versions')
        .select('row_version')
        .eq('id', input.versionId)
        .single()

      const newRowVersion = updatedVersion?.row_version ?? versionRow.row_version + 1

      // Write audit event
      const changedFields = detectChanges(
        {
          factsJson: versionRow.facts_json,
          contractType: versionRow.contract_type,
        },
        {
          factsJson: input.factsJson ?? versionRow.facts_json,
          contractType: input.contractType ?? versionRow.contract_type,
        },
        ['factsJson', 'contractType']
      )

      const auditEventId = await writeAuditEvent(supabase, {
        tenantId,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'UpdateIntelligenceFacts',
        aggregateType: 'intelligence_version',
        aggregateId: input.versionId,
        beforeVersion: versionRow.row_version,
        afterVersion: newRowVersion,
        changedFields,
        commandInput: {
          periodsUpdated: input.periods !== undefined,
          disciplinesUpdated: input.disciplines !== undefined,
          laborRequirementsUpdated: input.laborRequirements !== undefined,
        },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          versionId: input.versionId,
          rowVersion: newRowVersion,
        },
        auditEventId: auditEventId ?? undefined,
      }
    },
  }
}
