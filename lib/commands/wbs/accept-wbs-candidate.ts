/**
 * Phase 3: AcceptWbsCandidate Command
 *
 * Accepts a WBS candidate, making it the active version.
 * - Marks candidate as active
 * - Supersedes prior active version (if any)
 * - Handles user_modified conflicts (default: keep user's version)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import {
  requireWbsVersionWithRowVersion,
  getActiveWbsVersion,
} from './guards'
import type {
  AcceptWbsCandidateInput,
  AcceptWbsCandidateResult,
  ConflictResolution,
  WbsTaskWithAssignments,
} from './types'

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Load tasks with assignments for a WBS version
 */
async function loadTasksWithAssignments(
  supabase: SupabaseClient,
  versionId: string
): Promise<WbsTaskWithAssignments[]> {
  const { data: tasks, error: taskError } = await supabase
    .from('wbs_tasks')
    .select('*')
    .eq('wbs_version_id', versionId)
    .order('sort_order')

  if (taskError) {
    throw new Error(`Failed to load tasks: ${taskError.message}`)
  }

  const result: WbsTaskWithAssignments[] = []

  for (const task of tasks || []) {
    const { data: assignments, error: assignError } = await supabase
      .from('staffing_assignments')
      .select('*')
      .eq('wbs_task_id', task.id)

    if (assignError) {
      throw new Error(`Failed to load assignments: ${assignError.message}`)
    }

    result.push({
      id: task.id,
      tenantId: task.tenant_id,
      wbsVersionId: task.wbs_version_id,
      parentTaskId: task.parent_task_id,
      wbsCode: task.wbs_code,
      title: task.title,
      description: task.description,
      deliverable: task.deliverable,
      sowReference: task.sow_reference,
      startMonth: task.start_month,
      endMonth: task.end_month,
      sortOrder: task.sort_order,
      source: task.source,
      userModified: task.user_modified,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      rowVersion: task.row_version,
      assignments: (assignments || []).map(a => ({
        id: a.id,
        tenantId: a.tenant_id,
        wbsTaskId: a.wbs_task_id,
        roleTitle: a.role_title,
        discipline: a.discipline,
        primeOrSub: a.prime_or_sub,
        subcontractorName: a.subcontractor_name,
        periodLabel: a.period_label,
        hours: a.hours,
        hoursPerMonth: a.hours_per_month,
        rationale: a.rationale,
        source: a.source,
        userModified: a.user_modified,
        // Phase 5: Labor catalog fields
        laborCategoryId: a.labor_category_id ?? null,
        levelKey: a.level_key ?? null,
        stepIndex: a.step_index ?? null,
        salaryOverrideCents: a.salary_override_cents ?? null,
        billRateOverrideCents: a.bill_rate_override_cents ?? null,
        profitMarginOverride: a.profit_margin_override ?? null,
        rateSource: a.rate_source ?? null,
        // Timestamps
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        rowVersion: a.row_version,
      })),
    })
  }

  return result
}

/**
 * Check if a conflict resolution exists for a task/assignment
 */
function getResolution(
  resolutions: ConflictResolution[] | undefined,
  taskId: string,
  assignmentId?: string
): 'keep_user' | 'accept_candidate' {
  if (!resolutions) return 'keep_user'

  const match = resolutions.find(
    r => r.taskId === taskId && r.assignmentId === assignmentId
  )

  return match?.resolution ?? 'keep_user'
}

/**
 * Find matching task by wbs_code + title
 */
function findMatchingTask(
  tasks: WbsTaskWithAssignments[],
  wbsCode: string,
  title: string
): WbsTaskWithAssignments | undefined {
  return tasks.find(t => t.wbsCode === wbsCode && t.title === title)
}

/**
 * Find matching assignment by role_title + period_label
 */
function findMatchingAssignment(
  task: WbsTaskWithAssignments,
  roleTitle: string,
  periodLabel: string
) {
  return task.assignments.find(
    a => a.roleTitle === roleTitle && a.periodLabel === periodLabel
  )
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createAcceptWbsCandidateCommand(
  supabase: SupabaseClient
): Command<AcceptWbsCandidateInput, AcceptWbsCandidateResult> {
  return {
    name: 'AcceptWbsCandidate',
    aggregateType: 'wbs_version',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      _context: CommandContext,
      input: AcceptWbsCandidateInput
    ): Promise<CommandResult<AcceptWbsCandidateResult>> {
      // 1. Verify candidate exists and is in acceptable status
      const { version: candidate } = await requireWbsVersionWithRowVersion(
        supabase,
        input.candidateVersionId,
        input.expectedRowVersion,
        ['generated_candidate', 'draft']
      )

      // 2. Get current active version (if any)
      const activeVersion = await getActiveWbsVersion(supabase, candidate.proposalId)

      let conflictsResolved = 0

      // 3. Handle conflicts if there's an active version
      if (activeVersion) {
        const activeTasks = await loadTasksWithAssignments(supabase, activeVersion.id)
        const candidateTasks = await loadTasksWithAssignments(supabase, candidate.id)

        // For each candidate task, check if active has user_modified version
        for (const candidateTask of candidateTasks) {
          const matchingActiveTask = findMatchingTask(
            activeTasks,
            candidateTask.wbsCode,
            candidateTask.title
          )

          if (matchingActiveTask?.userModified) {
            // Task-level conflict
            const resolution = getResolution(
              input.conflictResolutions,
              candidateTask.id
            )

            if (resolution === 'keep_user') {
              // Copy user's task data to candidate
              await supabase
                .from('wbs_tasks')
                .update({
                  description: matchingActiveTask.description,
                  deliverable: matchingActiveTask.deliverable,
                  sow_reference: matchingActiveTask.sowReference,
                  start_month: matchingActiveTask.startMonth,
                  end_month: matchingActiveTask.endMonth,
                  user_modified: true,
                })
                .eq('id', candidateTask.id)

              conflictsResolved++
            }
          }

          // Check assignment-level conflicts
          for (const candidateAssignment of candidateTask.assignments) {
            if (!matchingActiveTask) continue

            const matchingActiveAssignment = findMatchingAssignment(
              matchingActiveTask,
              candidateAssignment.roleTitle,
              candidateAssignment.periodLabel
            )

            if (matchingActiveAssignment?.userModified) {
              const resolution = getResolution(
                input.conflictResolutions,
                candidateTask.id,
                candidateAssignment.id
              )

              if (resolution === 'keep_user') {
                // Copy user's assignment data to candidate
                await supabase
                  .from('staffing_assignments')
                  .update({
                    hours: matchingActiveAssignment.hours,
                    hours_per_month: matchingActiveAssignment.hoursPerMonth,
                    rationale: matchingActiveAssignment.rationale,
                    prime_or_sub: matchingActiveAssignment.primeOrSub,
                    subcontractor_name: matchingActiveAssignment.subcontractorName,
                    user_modified: true,
                  })
                  .eq('id', candidateAssignment.id)

                conflictsResolved++
              }
            }
          }
        }

        // 4. Supersede the active version
        const { error: supersedError } = await supabase
          .from('wbs_versions')
          .update({
            status: 'superseded',
            superseded_at: new Date().toISOString(),
          })
          .eq('id', activeVersion.id)

        if (supersedError) {
          throw new Error(`Failed to supersede active version: ${supersedError.message}`)
        }
      }

      // 5. Activate the candidate
      const { error: activateError } = await supabase
        .from('wbs_versions')
        .update({
          status: 'active',
          activated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id)

      if (activateError) {
        throw new Error(`Failed to activate candidate: ${activateError.message}`)
      }

      return {
        success: true,
        data: {
          activeVersionId: candidate.id,
          supersededVersionId: activeVersion?.id ?? null,
          conflictsResolved,
        },
      }
    },
  }
}

/**
 * Execute AcceptWbsCandidate command with audit logging
 */
export async function acceptWbsCandidate(
  supabase: SupabaseClient,
  input: AcceptWbsCandidateInput
): Promise<AcceptWbsCandidateResult> {
  const command = createAcceptWbsCandidateCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
