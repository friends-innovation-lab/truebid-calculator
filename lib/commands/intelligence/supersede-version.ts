/**
 * SupersedeIntelligenceVersion Command
 *
 * Creates a new draft version from an existing confirmed version.
 * Marks the old version as superseded.
 * Used when users want to edit confirmed intelligence.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent } from '../runner'
import { ValidationError, NotFoundError, InvalidStateError } from '../errors'
import type {
  SupersedeIntelligenceVersionInput,
  SupersedeIntelligenceVersionOutput,
  IntelligenceVersionRow,
  IntelligencePeriodRow,
  IntelligenceDisciplineRow,
  IntelligenceLaborRequirementRow,
} from './types'

/**
 * Create the command instance.
 */
export function createSupersedeIntelligenceVersionCommand(
  supabase: SupabaseClient
): Command<SupersedeIntelligenceVersionInput, SupersedeIntelligenceVersionOutput> {
  return {
    name: 'SupersedeIntelligenceVersion',
    aggregateType: 'intelligence_version',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: SupersedeIntelligenceVersionInput
    ): Promise<CommandResult<SupersedeIntelligenceVersionOutput>> {
      const tenantId = context.tenant.tenant.id

      // Validate proposal exists and get active version
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('id, company_id, active_intelligence_version_id')
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

      // Must have an active confirmed version to supersede
      if (!proposal.active_intelligence_version_id) {
        throw new InvalidStateError(
          `Proposal ${input.proposalId} has no active intelligence version to supersede`,
          'no active version',
          'has active intelligence version'
        )
      }

      // Load the active version
      const { data: activeVersion, error: activeVersionError } = await supabase
        .from('intelligence_versions')
        .select('*')
        .eq('id', proposal.active_intelligence_version_id)
        .single()

      if (activeVersionError || !activeVersion) {
        throw new NotFoundError('intelligence_version', proposal.active_intelligence_version_id)
      }

      const activeVersionRow = activeVersion as IntelligenceVersionRow

      // Must be confirmed
      if (activeVersionRow.status !== 'confirmed') {
        throw new InvalidStateError(
          `Intelligence version ${activeVersionRow.id} must be confirmed to supersede`,
          activeVersionRow.status,
          'confirmed'
        )
      }

      // Load periods from active version
      const { data: periods } = await supabase
        .from('intelligence_periods')
        .select('*')
        .eq('version_id', activeVersionRow.id)
        .order('sort_order')

      // Load disciplines from active version
      const { data: disciplines } = await supabase
        .from('intelligence_disciplines')
        .select('*')
        .eq('version_id', activeVersionRow.id)

      // Load labor requirements from active version
      const { data: laborReqs } = await supabase
        .from('intelligence_labor_requirements')
        .select('*')
        .eq('version_id', activeVersionRow.id)

      // Create new draft version
      const nextVersionNumber = activeVersionRow.version_number + 1

      // Copy ALL fields from active version to new draft
      // Enumerated copy list (against intelligence_versions schema):
      // - facts_json: JSONB containing documentType, vehicle, contractType, setAside, rateSource
      // - contract_type: denormalized contract type
      // - staffing_model: 'prescribed' | 'offeror_proposed' | 'unclear'
      const { data: newVersion, error: newVersionError } = await supabase
        .from('intelligence_versions')
        .insert({
          tenant_id: tenantId,
          proposal_id: input.proposalId,
          version_number: nextVersionNumber,
          status: 'draft',
          facts_json: activeVersionRow.facts_json,
          contract_type: activeVersionRow.contract_type,
          staffing_model: activeVersionRow.staffing_model, // BUG #2 FIX: was missing
          row_version: 1,
        })
        .select('id, version_number, status')
        .single()

      if (newVersionError || !newVersion) {
        console.error('[SupersedeIntelligenceVersion] Create error:', newVersionError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: newVersionError?.message ?? 'Failed to create new version',
          },
        }
      }

      // Copy periods to new version
      if (periods && periods.length > 0) {
        const periodsToInsert = (periods as IntelligencePeriodRow[]).map((p) => ({
          version_id: newVersion.id,
          name: p.name,
          months: p.months,
          cumulative_months_end: p.cumulative_months_end,
          gsa_rate_year: p.gsa_rate_year,
          sort_order: p.sort_order,
        }))

        const { error: periodsError } = await supabase
          .from('intelligence_periods')
          .insert(periodsToInsert)

        if (periodsError) {
          console.error('[SupersedeIntelligenceVersion] Periods copy error:', periodsError)
          await supabase.from('intelligence_versions').delete().eq('id', newVersion.id)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: periodsError.message,
            },
          }
        }
      }

      // Copy disciplines to new version
      if (disciplines && disciplines.length > 0) {
        const disciplinesToInsert = (disciplines as IntelligenceDisciplineRow[]).map((d) => ({
          version_id: newVersion.id,
          discipline: d.discipline,
          confidence: d.confidence,
          source_text: d.source_text,
        }))

        const { error: disciplinesError } = await supabase
          .from('intelligence_disciplines')
          .insert(disciplinesToInsert)

        if (disciplinesError) {
          console.error('[SupersedeIntelligenceVersion] Disciplines copy error:', disciplinesError)
          await supabase.from('intelligence_versions').delete().eq('id', newVersion.id)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: disciplinesError.message,
            },
          }
        }
      }

      // Copy labor requirements to new version
      // Enumerated copy list (against intelligence_labor_requirements schema):
      // - title, labor_category, hours_per_month, utilization_pct
      // - appears_in_periods, confidence, source_text
      // - is_prescribed: Phase 4B prescribed staffing flag
      // - labor_category_id, match_type, match_confidence: Phase 5 catalog match fields
      if (laborReqs && laborReqs.length > 0) {
        const laborReqsToInsert = (laborReqs as IntelligenceLaborRequirementRow[]).map((l) => ({
          version_id: newVersion.id,
          title: l.title,
          labor_category: l.labor_category,
          hours_per_month: l.hours_per_month,
          utilization_pct: l.utilization_pct,
          appears_in_periods: l.appears_in_periods,
          confidence: l.confidence,
          source_text: l.source_text,
          // BUG #2 FIX: Phase 4B/5 fields were missing
          is_prescribed: l.is_prescribed,
          labor_category_id: l.labor_category_id,
          match_type: l.match_type,
          match_confidence: l.match_confidence,
        }))

        const { error: laborReqsError } = await supabase
          .from('intelligence_labor_requirements')
          .insert(laborReqsToInsert)

        if (laborReqsError) {
          console.error('[SupersedeIntelligenceVersion] Labor reqs copy error:', laborReqsError)
          await supabase.from('intelligence_versions').delete().eq('id', newVersion.id)
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: laborReqsError.message,
            },
          }
        }
      }

      // Mark old version as superseded
      const { error: supersededError } = await supabase
        .from('intelligence_versions')
        .update({
          status: 'superseded',
          superseded_at: new Date().toISOString(),
        })
        .eq('id', activeVersionRow.id)

      if (supersededError) {
        console.error('[SupersedeIntelligenceVersion] Supersede error:', supersededError)
        // Don't fail - the new draft was created successfully
      }

      // Clear active version on proposal (new draft is not confirmed yet)
      const { error: clearActiveError } = await supabase
        .from('proposals')
        .update({
          active_intelligence_version_id: null,
        })
        .eq('id', input.proposalId)

      if (clearActiveError) {
        console.error('[SupersedeIntelligenceVersion] Clear active error:', clearActiveError)
        // Don't fail - this is a consistency issue but the main operation succeeded
      }

      // Write audit event
      const auditEventId = await writeAuditEvent(supabase, {
        tenantId,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'SupersedeIntelligenceVersion',
        aggregateType: 'intelligence_version',
        aggregateId: newVersion.id,
        beforeVersion: null, // New version
        afterVersion: 1,
        changedFields: null,
        commandInput: {
          proposalId: input.proposalId,
          supersededVersionId: activeVersionRow.id,
          supersededVersionNumber: activeVersionRow.version_number,
          newVersionNumber: nextVersionNumber,
        },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          newVersionId: newVersion.id,
          newVersionNumber: newVersion.version_number,
          supersededVersionId: activeVersionRow.id,
        },
        auditEventId: auditEventId ?? undefined,
      }
    },
  }
}
