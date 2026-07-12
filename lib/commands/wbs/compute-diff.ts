/**
 * Phase 3: Compute WBS Diff
 *
 * Computes the difference between a WBS candidate and the active version.
 * Used by the candidate review UI to show what will change.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  WbsDiff,
  TaskDiff,
  AssignmentDiff,
  DiffStatus,
  WbsTaskWithAssignments,
} from './types'

// =============================================================================
// TYPES
// =============================================================================

interface WbsVersionRow {
  id: string
  proposal_id: string
  version_number: number
  status: string
  row_version: number
}

// =============================================================================
// HELPERS
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
 * Find matching task by wbs_code (primary key for matching)
 */
function findMatchingTask(
  tasks: WbsTaskWithAssignments[],
  wbsCode: string
): WbsTaskWithAssignments | undefined {
  return tasks.find(t => t.wbsCode === wbsCode)
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

/**
 * Determine task diff status
 */
function determineTaskStatus(
  candidateTask: WbsTaskWithAssignments | null,
  activeTask: WbsTaskWithAssignments | null
): DiffStatus {
  if (!candidateTask && activeTask) return 'removed'
  if (candidateTask && !activeTask) return 'added'
  if (!candidateTask || !activeTask) return 'unchanged'

  // Check if active task was user-modified
  if (activeTask.userModified) {
    // Check if candidate differs from active
    const titleChanged = candidateTask.title !== activeTask.title
    const descChanged = candidateTask.description !== activeTask.description

    if (titleChanged || descChanged) {
      return 'conflict' // User modified AND candidate has different data
    }
  }

  // Regular change detection
  const changed =
    candidateTask.title !== activeTask.title ||
    candidateTask.description !== activeTask.description ||
    candidateTask.deliverable !== activeTask.deliverable

  return changed ? 'changed' : 'unchanged'
}

/**
 * Determine assignment diff status
 */
function determineAssignmentStatus(
  candidateAssign: WbsTaskWithAssignments['assignments'][0] | null,
  activeAssign: WbsTaskWithAssignments['assignments'][0] | null
): DiffStatus {
  if (!candidateAssign && activeAssign) return 'removed'
  if (candidateAssign && !activeAssign) return 'added'
  if (!candidateAssign || !activeAssign) return 'unchanged'

  // Check if active assignment was user-modified
  if (activeAssign.userModified) {
    // Check if hours differ (the main conflicting field)
    if (candidateAssign.hours !== activeAssign.hours) {
      return 'conflict'
    }
  }

  // Regular change detection
  const changed = candidateAssign.hours !== activeAssign.hours

  return changed ? 'changed' : 'unchanged'
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Compute diff between candidate and active WBS versions
 */
export async function computeWbsDiff(
  supabase: SupabaseClient,
  candidateVersionId: string
): Promise<WbsDiff> {
  // 1. Load candidate version
  const { data: candidate, error: candError } = await supabase
    .from('wbs_versions')
    .select('id, proposal_id, version_number, status, row_version')
    .eq('id', candidateVersionId)
    .single()

  if (candError || !candidate) {
    throw new Error(`Candidate not found: ${candError?.message}`)
  }

  const candidateVersion = candidate as WbsVersionRow

  if (!['generated_candidate', 'draft'].includes(candidateVersion.status)) {
    throw new Error(`Version ${candidateVersion.id} is not a candidate (status: ${candidateVersion.status})`)
  }

  // 2. Load active version (if any)
  const { data: active } = await supabase
    .from('wbs_versions')
    .select('id')
    .eq('proposal_id', candidateVersion.proposal_id)
    .eq('status', 'active')
    .single()

  const activeVersionId = active?.id ?? null

  // 3. Load tasks for both versions
  const candidateTasks = await loadTasksWithAssignments(supabase, candidateVersionId)
  const activeTasks = activeVersionId
    ? await loadTasksWithAssignments(supabase, activeVersionId)
    : []

  // 4. Compute task diffs
  const taskDiffs: TaskDiff[] = []
  let totalConflicts = 0

  // Process candidate tasks
  const processedActiveTaskCodes = new Set<string>()

  for (const candidateTask of candidateTasks) {
    const activeTask = findMatchingTask(activeTasks, candidateTask.wbsCode)
    if (activeTask) {
      processedActiveTaskCodes.add(activeTask.wbsCode)
    }

    const status = determineTaskStatus(candidateTask, activeTask ?? null)
    const hasUserModifiedConflict = status === 'conflict'
    if (hasUserModifiedConflict) totalConflicts++

    // Compute assignment diffs
    const assignmentDiffs: AssignmentDiff[] = []
    const processedActiveAssignments = new Set<string>()

    for (const candAssign of candidateTask.assignments) {
      const activeAssign = activeTask
        ? findMatchingAssignment(activeTask, candAssign.roleTitle, candAssign.periodLabel)
        : null

      if (activeAssign) {
        processedActiveAssignments.add(`${activeAssign.roleTitle}|${activeAssign.periodLabel}`)
      }

      const assignStatus = determineAssignmentStatus(candAssign, activeAssign ?? null)
      const assignConflict = assignStatus === 'conflict'
      if (assignConflict) totalConflicts++

      assignmentDiffs.push({
        status: assignStatus,
        candidateAssignment: candAssign,
        activeAssignment: activeAssign ?? null,
        hasUserModifiedConflict: assignConflict,
      })
    }

    // Add removed assignments (in active but not in candidate)
    if (activeTask) {
      for (const activeAssign of activeTask.assignments) {
        const key = `${activeAssign.roleTitle}|${activeAssign.periodLabel}`
        if (!processedActiveAssignments.has(key)) {
          const removedConflict = activeAssign.userModified
          if (removedConflict) totalConflicts++

          assignmentDiffs.push({
            status: 'removed',
            candidateAssignment: null,
            activeAssignment: activeAssign,
            hasUserModifiedConflict: removedConflict,
          })
        }
      }
    }

    taskDiffs.push({
      status,
      candidateTask,
      activeTask: activeTask ?? null,
      assignmentDiffs,
      hasUserModifiedConflict,
    })
  }

  // Add removed tasks (in active but not in candidate)
  for (const activeTask of activeTasks) {
    if (!processedActiveTaskCodes.has(activeTask.wbsCode)) {
      const removedConflict = activeTask.userModified
      if (removedConflict) totalConflicts++

      // All assignments are removed too
      const assignmentDiffs: AssignmentDiff[] = activeTask.assignments.map(a => ({
        status: 'removed' as DiffStatus,
        candidateAssignment: null,
        activeAssignment: a,
        hasUserModifiedConflict: a.userModified,
      }))

      taskDiffs.push({
        status: 'removed',
        candidateTask: null,
        activeTask,
        assignmentDiffs,
        hasUserModifiedConflict: removedConflict,
      })
    }
  }

  return {
    candidateVersionId,
    activeVersionId,
    taskDiffs,
    totalConflicts,
  }
}
