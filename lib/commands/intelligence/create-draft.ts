/**
 * CreateIntelligenceDraft Command
 *
 * Creates a new draft intelligence version for a proposal.
 * Used both for initial extraction and for superseding an existing confirmed version.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent } from '../runner'
import { ValidationError, NotFoundError } from '../errors'
import type {
  CreateIntelligenceDraftInput,
  CreateIntelligenceDraftOutput,
} from './types'

/**
 * Create the command instance.
 */
export function createCreateIntelligenceDraftCommand(
  supabase: SupabaseClient
): Command<CreateIntelligenceDraftInput, CreateIntelligenceDraftOutput> {
  return {
    name: 'CreateIntelligenceDraft',
    aggregateType: 'intelligence_version',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: CreateIntelligenceDraftInput
    ): Promise<CommandResult<CreateIntelligenceDraftOutput>> {
      const tenantId = context.tenant.tenant.id

      // Validate proposal exists and belongs to tenant
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('id, company_id')
        .eq('id', input.proposalId)
        .single()

      if (proposalError || !proposal) {
        throw new NotFoundError('proposal', input.proposalId)
      }

      // Verify proposal belongs to tenant's company
      if (proposal.company_id !== context.tenant.tenant.companyId) {
        throw new ValidationError('Proposal does not belong to tenant', {
          proposalId: input.proposalId,
        })
      }

      // Get next version number
      const { data: maxVersion } = await supabase
        .from('intelligence_versions')
        .select('version_number')
        .eq('proposal_id', input.proposalId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()

      const nextVersionNumber = (maxVersion?.version_number ?? 0) + 1

      // Create intelligence version
      const { data: version, error: versionError } = await supabase
        .from('intelligence_versions')
        .insert({
          tenant_id: tenantId,
          proposal_id: input.proposalId,
          version_number: nextVersionNumber,
          status: 'draft',
          facts_json: input.factsJson ?? {},
          contract_type: input.contractType ?? null,
          staffing_model: input.staffingModel ?? 'unclear',
          row_version: 1,
        })
        .select('id, version_number, status')
        .single()

      if (versionError || !version) {
        console.error('[CreateIntelligenceDraft] Insert error:', versionError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: versionError?.message ?? 'Failed to create intelligence version',
          },
        }
      }

      // Insert periods if provided
      if (input.periods && input.periods.length > 0) {
        const periodsToInsert = input.periods.map((p, idx) => ({
          version_id: version.id,
          name: p.name,
          months: p.months,
          cumulative_months_end: p.cumulativeMonthsEnd,
          gsa_rate_year: p.gsaRateYear,
          sort_order: p.sortOrder ?? idx,
        }))

        const { error: periodsError } = await supabase
          .from('intelligence_periods')
          .insert(periodsToInsert)

        if (periodsError) {
          console.error('[CreateIntelligenceDraft] Periods insert error:', periodsError)
          // Clean up the version we just created
          await supabase.from('intelligence_versions').delete().eq('id', version.id)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: periodsError.message,
            },
          }
        }
      }

      // Insert disciplines if provided
      if (input.disciplines && input.disciplines.length > 0) {
        const disciplinesToInsert = input.disciplines.map((d) => ({
          version_id: version.id,
          discipline: d.discipline,
          confidence: d.confidence,
          source_text: d.sourceText ?? null,
        }))

        const { error: disciplinesError } = await supabase
          .from('intelligence_disciplines')
          .insert(disciplinesToInsert)

        if (disciplinesError) {
          console.error('[CreateIntelligenceDraft] Disciplines insert error:', disciplinesError)
          await supabase.from('intelligence_versions').delete().eq('id', version.id)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: disciplinesError.message,
            },
          }
        }
      }

      // Insert labor requirements if provided
      if (input.laborRequirements && input.laborRequirements.length > 0) {
        const laborReqsToInsert = input.laborRequirements.map((l) => ({
          version_id: version.id,
          title: l.title,
          labor_category: l.laborCategory ?? null,
          hours_per_month: l.hoursPerMonth ?? null,
          utilization_pct: l.utilizationPct ?? null,
          appears_in_periods: l.appearsInPeriods ?? [],
          is_prescribed: l.isPrescribed ?? false,
          confidence: l.confidence,
          source_text: l.sourceText ?? null,
          // Phase 5: Catalog match fields
          labor_category_id: l.laborCategoryId ?? null,
          match_type: l.matchType ?? null,
          match_confidence: l.matchConfidence ?? null,
        }))

        const { error: laborReqsError } = await supabase
          .from('intelligence_labor_requirements')
          .insert(laborReqsToInsert)

        if (laborReqsError) {
          console.error('[CreateIntelligenceDraft] Labor reqs insert error:', laborReqsError)
          await supabase.from('intelligence_versions').delete().eq('id', version.id)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: laborReqsError.message,
            },
          }
        }
      }

      // Write audit event
      const auditEventId = await writeAuditEvent(supabase, {
        tenantId,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'CreateIntelligenceDraft',
        aggregateType: 'intelligence_version',
        aggregateId: version.id,
        beforeVersion: null,
        afterVersion: 1,
        changedFields: null,
        commandInput: {
          proposalId: input.proposalId,
          versionNumber: nextVersionNumber,
          periodsCount: input.periods?.length ?? 0,
          disciplinesCount: input.disciplines?.length ?? 0,
          laborRequirementsCount: input.laborRequirements?.length ?? 0,
        },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          versionId: version.id,
          versionNumber: version.version_number,
          status: version.status,
        },
        auditEventId: auditEventId ?? undefined,
      }
    },
  }
}
