/**
 * GenerateBOEArtifact Command
 *
 * Creates an immutable BOE artifact from an approved pricing scenario.
 * Enforces citation completeness for wbs_estimate lines.
 */

import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { writeAuditEvent } from '../runner'
import { NotFoundError, InvalidStateError } from '../errors'
import { FORMULA_VERSION } from '@/lib/pricing'
import type {
  GenerateBOEArtifactInput,
  GenerateBOEArtifactOutput,
  UncitedLineDetail,
} from './types'
import type {
  BOEArtifactContent,
  ArtifactEstimateLine,
  ArtifactSection,
  ArtifactRateConfig,
} from '@/lib/schemas/boe-artifact'

/**
 * Pricing line row from database.
 */
interface PricingLineRow {
  id: string
  line_type: 'wbs_estimate' | 'labor_loading'
  staffing_assignment_id: string | null
  intelligence_labor_requirement_id: string | null
  intelligence_period_id: string | null
  period_label: string
  hours: number
  resolved_salary_cents: number
  salary_source: 'catalog' | 'override'
  level_key: string | null
  step_index: number | null
  base_hourly: number
  fringe_amount: number
  overhead_base: number
  overhead_amount: number
  ga_amount: number
  cost_before_profit: number
  profit_rate: number
  profit_source: 'explicit' | 'contract_default'
  profit_amount: number
  fully_burdened: number
  escalation_rate_applied: number | null
  escalation_year_index: number | null
  extended_cost: number
}

/**
 * Staffing assignment with WBS task info.
 */
interface StaffingAssignmentRow {
  id: string
  role_title: string
  wbs_task_id: string
  wbs_task: {
    id: string
    wbs_code: string
    title: string
  } | null  // Supabase returns object for many-to-one joins
}

/**
 * Requirement link row.
 */
interface RequirementLinkRow {
  id: string
  wbs_task_id: string
}

/**
 * Compute SHA-256 hash of content.
 */
function computeContentHash(content: BOEArtifactContent): string {
  const canonical = JSON.stringify(content, Object.keys(content).sort())
  return createHash('sha256').update(canonical).digest('hex')
}

/**
 * Round to 2 decimal places.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Create the GenerateBOEArtifact command instance.
 */
export function createGenerateBOEArtifactCommand(
  supabase: SupabaseClient
): Command<GenerateBOEArtifactInput, GenerateBOEArtifactOutput> {
  return {
    name: 'GenerateBOEArtifact',
    aggregateType: 'boe_artifact',
    allowedRoles: ['owner', 'admin', 'estimator', 'accountant'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: GenerateBOEArtifactInput
    ): Promise<CommandResult<GenerateBOEArtifactOutput>> {
      const { proposalId, pricingScenarioId } = input
      const tenantId = context.tenant.tenant.id

      // 1. Load pricing scenario
      const { data: scenario, error: scenarioError } = await supabase
        .from('pricing_scenarios')
        .select('id, status, wbs_version_id, rate_config_snapshot, engine_version')
        .eq('id', pricingScenarioId)
        .single()

      if (scenarioError || !scenario) {
        throw new NotFoundError('pricing_scenario', pricingScenarioId)
      }

      if (scenario.status !== 'approved') {
        throw new InvalidStateError(
          `Pricing scenario must be approved, got: ${scenario.status}`,
          scenario.status,
          'approved'
        )
      }

      // 2. Load WBS version
      const { data: wbsVersion, error: wbsError } = await supabase
        .from('wbs_versions')
        .select('id, status, intelligence_version_id')
        .eq('id', scenario.wbs_version_id)
        .single()

      if (wbsError || !wbsVersion) {
        throw new NotFoundError('wbs_version', scenario.wbs_version_id)
      }

      if (wbsVersion.status !== 'active') {
        throw new InvalidStateError(
          `WBS version must be active, got: ${wbsVersion.status}`,
          wbsVersion.status,
          'active'
        )
      }

      // 3. Load and verify intelligence version
      const { data: intelVersion, error: intelError } = await supabase
        .from('intelligence_versions')
        .select('id, status, confirmation_hash')
        .eq('id', wbsVersion.intelligence_version_id)
        .single()

      if (intelError || !intelVersion) {
        throw new NotFoundError('intelligence_version', wbsVersion.intelligence_version_id)
      }

      if (intelVersion.status !== 'confirmed') {
        throw new InvalidStateError(
          `Intelligence version must be confirmed, got: ${intelVersion.status}`,
          intelVersion.status,
          'confirmed'
        )
      }

      // 4. Load proposal metadata
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('id, title, solicitation_number, agency, contract_type')
        .eq('id', proposalId)
        .single()

      if (proposalError || !proposal) {
        throw new NotFoundError('proposal', proposalId)
      }

      // 5. Load all pricing lines for the scenario
      const { data: pricingLines, error: linesError } = await supabase
        .from('pricing_lines')
        .select('*')
        .eq('pricing_scenario_id', pricingScenarioId)
        .order('period_label')

      if (linesError) {
        console.error('[GenerateBOEArtifact] Failed to load pricing lines:', linesError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to load pricing lines',
          },
        }
      }

      const lines = (pricingLines || []) as PricingLineRow[]

      // 6. For wbs_estimate lines, load staffing assignments and WBS tasks
      const wbsEstimateLines = lines.filter(l => l.line_type === 'wbs_estimate')
      const assignmentIds = wbsEstimateLines
        .map(l => l.staffing_assignment_id)
        .filter((id): id is string => id !== null)

      const assignmentMap = new Map<string, StaffingAssignmentRow>()
      if (assignmentIds.length > 0) {
        const { data: assignments } = await supabase
          .from('staffing_assignments')
          .select(`
            id,
            role_title,
            wbs_task_id,
            wbs_task:wbs_tasks(id, wbs_code, title)
          `)
          .in('id', assignmentIds)

        if (assignments) {
          for (const a of assignments) {
            assignmentMap.set(a.id, a as unknown as StaffingAssignmentRow)
          }
        }
      }

      // 7. Load requirement links for WBS tasks
      const taskIds = [...new Set(
        [...assignmentMap.values()]
          .map(a => a.wbs_task_id)
          .filter((id): id is string => id !== null)
      )]

      const taskToLinksMap = new Map<string, RequirementLinkRow[]>()
      if (taskIds.length > 0) {
        const { data: reqLinks } = await supabase
          .from('requirement_links')
          .select('id, wbs_task_id')
          .in('wbs_task_id', taskIds)

        if (reqLinks) {
          for (const link of reqLinks as RequirementLinkRow[]) {
            const existing = taskToLinksMap.get(link.wbs_task_id) || []
            existing.push(link)
            taskToLinksMap.set(link.wbs_task_id, existing)
          }
        }
      }

      // 8. Check citation completeness for wbs_estimate lines
      const uncitedLines: UncitedLineDetail[] = []

      for (const line of wbsEstimateLines) {
        if (!line.staffing_assignment_id) {
          uncitedLines.push({
            lineId: line.id,
            lineType: 'wbs_estimate',
            wbsCode: null,
            taskTitle: null,
            roleTitle: 'Unknown',
            periodLabel: line.period_label,
            missingLinkage: 'no_wbs_task',
          })
          continue
        }

        const assignment = assignmentMap.get(line.staffing_assignment_id)
        const wbsTask = assignment?.wbs_task ?? null

        if (!assignment || !wbsTask) {
          uncitedLines.push({
            lineId: line.id,
            lineType: 'wbs_estimate',
            wbsCode: null,
            taskTitle: null,
            roleTitle: assignment?.role_title || 'Unknown',
            periodLabel: line.period_label,
            missingLinkage: 'no_wbs_task',
          })
          continue
        }

        const links = taskToLinksMap.get(assignment.wbs_task_id) || []
        if (links.length === 0) {
          uncitedLines.push({
            lineId: line.id,
            lineType: 'wbs_estimate',
            wbsCode: wbsTask.wbs_code,
            taskTitle: wbsTask.title,
            roleTitle: assignment.role_title,
            periodLabel: line.period_label,
            missingLinkage: 'no_requirement_links',
          })
        }
      }

      if (uncitedLines.length > 0) {
        return {
          success: false,
          error: {
            code: 'CITATION_INCOMPLETE' as const,
            message: `${uncitedLines.length} wbs_estimate line(s) lack requirement citations`,
            details: { uncitedLines },
          },
        }
      }

      // 9. Build artifact content
      const rateConfig = scenario.rate_config_snapshot as ArtifactRateConfig

      // Build estimate lines with fee decomposition
      const artifactLines: ArtifactEstimateLine[] = []
      let wbsEstimateHours = 0
      let wbsEstimateCost = 0
      let wbsEstimateFee = 0
      let wbsEstimateTotal = 0
      let laborLoadingHours = 0
      let laborLoadingCost = 0
      let laborLoadingFee = 0
      let laborLoadingTotal = 0

      // Collect citations to insert
      const citationsToInsert: {
        artifact_line_id: string
        citation_target_type: 'requirement_link'
        requirement_link_id: string
      }[] = []

      for (const line of lines) {
        const assignment = line.staffing_assignment_id
          ? assignmentMap.get(line.staffing_assignment_id)
          : null
        const wbsTask = assignment?.wbs_task ?? null
        const links = wbsTask ? (taskToLinksMap.get(wbsTask.id) || []) : []

        // Fee decomposition (penny-conserved)
        const costComponent = round2(line.hours * line.cost_before_profit)
        const feeComponent = round2(line.extended_cost - costComponent)

        const artifactLine: ArtifactEstimateLine = {
          lineId: line.id,
          lineType: line.line_type,
          wbsCode: wbsTask?.wbs_code || null,
          taskTitle: wbsTask?.title || null,
          roleTitle: assignment?.role_title || 'Unknown',
          periodLabel: line.period_label,
          hours: line.hours,
          hoursRationale: null,
          calcTrace: {
            resolvedSalaryCents: line.resolved_salary_cents,
            salarySource: line.salary_source,
            levelKey: line.level_key,
            stepIndex: line.step_index,
            baseHourly: line.base_hourly,
            fringeAmount: line.fringe_amount,
            overheadBase: line.overhead_base,
            overheadAmount: line.overhead_amount,
            gaAmount: line.ga_amount,
            costBeforeProfit: line.cost_before_profit,
            profitRate: line.profit_rate,
            profitSource: line.profit_source,
            profitAmount: line.profit_amount,
            fullyBurdenedRate: line.fully_burdened,
            escalationRateApplied: line.escalation_rate_applied,
            escalationYearIndex: line.escalation_year_index,
          },
          costComponent,
          feeComponent,
          extendedTotal: line.extended_cost,
          requirementLinkIds: links.map(l => l.id),
        }

        artifactLines.push(artifactLine)

        // Accumulate totals
        if (line.line_type === 'wbs_estimate') {
          wbsEstimateHours += line.hours
          wbsEstimateCost += costComponent
          wbsEstimateFee += feeComponent
          wbsEstimateTotal += line.extended_cost
        } else {
          laborLoadingHours += line.hours
          laborLoadingCost += costComponent
          laborLoadingFee += feeComponent
          laborLoadingTotal += line.extended_cost
        }

        // Collect citations
        for (const link of links) {
          citationsToInsert.push({
            artifact_line_id: line.id,
            citation_target_type: 'requirement_link',
            requirement_link_id: link.id,
          })
        }
      }

      // Round totals
      wbsEstimateCost = round2(wbsEstimateCost)
      wbsEstimateFee = round2(wbsEstimateFee)
      wbsEstimateTotal = round2(wbsEstimateTotal)
      laborLoadingCost = round2(laborLoadingCost)
      laborLoadingFee = round2(laborLoadingFee)
      laborLoadingTotal = round2(laborLoadingTotal)

      // Conservation checks
      const wbsConserved = Math.abs(wbsEstimateCost + wbsEstimateFee - wbsEstimateTotal) < 0.01
      const laborConserved = Math.abs(laborLoadingCost + laborLoadingFee - laborLoadingTotal) < 0.01
      const allConserved = wbsConserved && laborConserved

      // Build sections
      const sections: ArtifactSection[] = [
        {
          sectionId: 'wbs_estimates',
          sectionType: 'wbs_estimates',
          title: 'WBS Estimates',
          lines: artifactLines.filter(l => l.lineType === 'wbs_estimate'),
        },
        {
          sectionId: 'labor_loading',
          sectionType: 'labor_loading_summary',
          title: 'Labor Loading Summary',
          lines: artifactLines.filter(l => l.lineType === 'labor_loading'),
        },
        {
          sectionId: 'totals',
          sectionType: 'totals',
          title: 'Totals',
          summary: {
            totalHours: round2(wbsEstimateHours + laborLoadingHours),
            totalCost: round2(wbsEstimateCost + laborLoadingCost),
            totalFee: round2(wbsEstimateFee + laborLoadingFee),
            grandTotal: round2(wbsEstimateTotal + laborLoadingTotal),
          },
        },
      ]

      // Build content
      const content: BOEArtifactContent = {
        schemaVersion: '1.0.0',
        proposal: {
          id: proposal.id,
          title: proposal.title,
          solicitationNumber: proposal.solicitation_number,
          agency: proposal.agency,
          contractType: proposal.contract_type,
        },
        rateConfig,
        sections,
        totals: {
          wbsEstimateHours: round2(wbsEstimateHours),
          wbsEstimateCost,
          wbsEstimateFee,
          wbsEstimateTotal,
          laborLoadingHours: round2(laborLoadingHours),
          laborLoadingCost,
          laborLoadingFee,
          laborLoadingTotal,
          grandTotalHours: round2(wbsEstimateHours + laborLoadingHours),
          grandTotalCost: round2(wbsEstimateCost + laborLoadingCost),
          grandTotalFee: round2(wbsEstimateFee + laborLoadingFee),
          grandTotal: round2(wbsEstimateTotal + laborLoadingTotal),
        },
        conservation: {
          wbsEstimateCostPlusFee: round2(wbsEstimateCost + wbsEstimateFee),
          wbsEstimateTotal,
          wbsEstimateConserved: wbsConserved,
          laborLoadingCostPlusFee: round2(laborLoadingCost + laborLoadingFee),
          laborLoadingTotal,
          laborLoadingConserved: laborConserved,
          allConserved,
        },
      }

      // 10. Compute content hash
      const contentHash = computeContentHash(content)
      const generatedAt = new Date().toISOString()

      // 11. Insert artifact
      const { data: artifact, error: artifactError } = await supabase
        .from('boe_artifacts')
        .insert({
          tenant_id: tenantId,
          proposal_id: proposalId,
          intelligence_version_id: intelVersion.id,
          wbs_version_id: wbsVersion.id,
          pricing_scenario_id: pricingScenarioId,
          status: 'generated',
          content,
          content_hash: contentHash,
          engine_version: scenario.engine_version || FORMULA_VERSION,
          generated_at: generatedAt,
          generated_by: context.actorId,
          row_version: 1,
        })
        .select('id')
        .single()

      if (artifactError || !artifact) {
        console.error('[GenerateBOEArtifact] Failed to insert artifact:', artifactError)
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: artifactError?.message || 'Failed to create artifact',
          },
        }
      }

      // 12. Insert citations
      if (citationsToInsert.length > 0) {
        const citationsWithArtifact = citationsToInsert.map(c => ({
          artifact_id: artifact.id,
          ...c,
        }))

        const { error: citationsError } = await supabase
          .from('boe_citations')
          .insert(citationsWithArtifact)

        if (citationsError) {
          console.error('[GenerateBOEArtifact] Failed to insert citations:', citationsError)
          // Note: artifact was created but citations failed
          return {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to create citations',
            },
          }
        }
      }

      // 13. Write audit event
      await writeAuditEvent(supabase, {
        tenantId,
        actorType: context.actorType,
        actorId: context.actorId,
        commandName: 'GenerateBOEArtifact',
        aggregateType: 'boe_artifact',
        aggregateId: artifact.id,
        beforeVersion: null,
        afterVersion: 1,
        changedFields: null,
        commandInput: { proposalId, pricingScenarioId },
        correlationId: context.correlationId,
      })

      return {
        success: true,
        data: {
          artifactId: artifact.id,
          contentHash,
          engineVersion: scenario.engine_version || FORMULA_VERSION,
          lineCount: lines.length,
          citationCount: citationsToInsert.length,
          totals: {
            wbsEstimateTotal,
            laborLoadingTotal,
            grandTotal: round2(wbsEstimateTotal + laborLoadingTotal),
          },
          conservation: {
            allConserved,
          },
          generatedAt,
        },
      }
    },
  }
}
