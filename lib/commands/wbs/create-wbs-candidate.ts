/**
 * Phase 3: CreateWbsCandidate Command
 *
 * Creates a WBS candidate version from AI generation output.
 * - Requires confirmed intelligence version (gate check)
 * - Runs deterministic validation
 * - Creates wbs_versions, wbs_tasks, staffing_assignments in transaction
 * - NEVER touches the active version
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { requireConfirmedIntelligence } from '../intelligence/guards'
import {
  loadIntelligenceContext,
  validateWbsCandidate,
  formatValidationErrors,
} from './validate-wbs-candidate'
import { getNextVersionNumber } from './guards'
import type {
  CreateWbsCandidateInput,
  CreateWbsCandidateResult,
  WbsStatus,
} from './types'

// =============================================================================
// ERROR TYPES
// =============================================================================

export class WbsValidationError extends Error {
  constructor(
    public readonly violations: CreateWbsCandidateResult['validation']['violations']
  ) {
    super(formatValidationErrors({ valid: false, violations }))
    this.name = 'WbsValidationError'
  }
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createCreateWbsCandidateCommand(
  supabase: SupabaseClient
): Command<CreateWbsCandidateInput, CreateWbsCandidateResult> {
  return {
    name: 'CreateWbsCandidate',
    aggregateType: 'wbs_version',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: CreateWbsCandidateInput
    ): Promise<CommandResult<CreateWbsCandidateResult>> {
      // 1. Get tenant ID from context
      const tenantId = context.tenant.tenant.id

      // 2. Verify intelligence version is confirmed (structural gate)
      await requireConfirmedIntelligence(
        supabase,
        input.proposalId,
        input.intelligenceVersionId,
        tenantId
      )

      // 3. Load intelligence context for validation
      const intelContext = await loadIntelligenceContext(
        supabase,
        input.intelligenceVersionId
      )

      // 4. Run deterministic validation
      const validation = validateWbsCandidate(input.tasks, intelContext)

      if (!validation.valid) {
        throw new WbsValidationError(validation.violations)
      }

      // 5. Get next version number
      const versionNumber = await getNextVersionNumber(supabase, input.proposalId)

      // 6. Create WBS version
      const { data: versionData, error: versionError } = await supabase
        .from('wbs_versions')
        .insert({
          tenant_id: tenantId,
          proposal_id: input.proposalId,
          intelligence_version_id: input.intelligenceVersionId,
          version_number: versionNumber,
          status: 'generated_candidate' as WbsStatus,
          generation_job_note: input.generationJobNote ?? null,
        })
        .select('id')
        .single()

      if (versionError || !versionData) {
        throw new Error(`Failed to create WBS version: ${versionError?.message}`)
      }

      const candidateVersionId = versionData.id
      let taskCount = 0
      let assignmentCount = 0

      // 7. Create tasks and assignments
      for (let sortOrder = 0; sortOrder < input.tasks.length; sortOrder++) {
        const taskInput = input.tasks[sortOrder]

        // Insert task
        const { data: taskData, error: taskError } = await supabase
          .from('wbs_tasks')
          .insert({
            tenant_id: tenantId,
            wbs_version_id: candidateVersionId,
            wbs_code: taskInput.wbsCode,
            title: taskInput.title,
            description: taskInput.description ?? null,
            deliverable: taskInput.deliverable ?? null,
            sow_reference: taskInput.sowReference ?? null,
            start_month: taskInput.startMonth ?? null,
            end_month: taskInput.endMonth ?? null,
            parent_task_id: taskInput.parentTaskId ?? null,
            sort_order: sortOrder,
            source: 'generated',
            user_modified: false,
          })
          .select('id')
          .single()

        if (taskError || !taskData) {
          throw new Error(`Failed to create task ${taskInput.wbsCode}: ${taskError?.message}`)
        }

        taskCount++

        // Insert staffing assignments for this task
        for (const staffing of taskInput.staffing) {
          const { error: assignmentError } = await supabase
            .from('staffing_assignments')
            .insert({
              tenant_id: tenantId,
              wbs_task_id: taskData.id,
              role_title: staffing.roleTitle,
              discipline: staffing.discipline,
              prime_or_sub: staffing.primeOrSub,
              subcontractor_name: staffing.subcontractorName ?? null,
              period_label: staffing.periodLabel,
              hours: staffing.hours,
              hours_per_month: staffing.hoursPerMonth ?? null,
              rationale: staffing.rationale ?? null,
              source: 'generated',
              user_modified: false,
            })

          if (assignmentError) {
            throw new Error(
              `Failed to create assignment for task ${taskInput.wbsCode}: ${assignmentError.message}`
            )
          }

          assignmentCount++
        }
      }

      return {
        success: true,
        data: {
          candidateVersionId,
          versionNumber,
          taskCount,
          assignmentCount,
          validation,
        },
      }
    },
  }
}

/**
 * Execute CreateWbsCandidate command with audit logging
 */
export async function createWbsCandidate(
  supabase: SupabaseClient,
  input: CreateWbsCandidateInput
): Promise<CreateWbsCandidateResult> {
  const command = createCreateWbsCandidateCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
