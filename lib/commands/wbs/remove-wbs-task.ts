/**
 * Phase 3: RemoveWbsTask Command
 *
 * Removes a WBS task (hard delete with audit).
 * - Cascades to staffing_assignments
 * - Uses optimistic concurrency
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import type { RemoveWbsTaskInput } from './types'

// =============================================================================
// ERROR TYPES
// =============================================================================

export class RemoveTaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`WBS task ${taskId} not found`)
    this.name = 'RemoveTaskNotFoundError'
  }
}

export class RemoveTaskStaleError extends Error {
  constructor(taskId: string, expected: number, actual: number) {
    super(`WBS task ${taskId} has been modified. Expected row_version ${expected}, got ${actual}`)
    this.name = 'RemoveTaskStaleError'
  }
}

export class RemoveTaskImmutableError extends Error {
  constructor(taskId: string, status: string) {
    super(`Cannot remove task ${taskId} from ${status} WBS version`)
    this.name = 'RemoveTaskImmutableError'
  }
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

interface RemoveWbsTaskResult {
  removed: true
  taskId: string
  assignmentsRemoved: number
}

export function createRemoveWbsTaskCommand(
  supabase: SupabaseClient
): Command<RemoveWbsTaskInput, RemoveWbsTaskResult> {
  return {
    name: 'RemoveWbsTask',
    aggregateType: 'wbs_task',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      _context: CommandContext,
      input: RemoveWbsTaskInput
    ): Promise<CommandResult<RemoveWbsTaskResult>> {
      // 1. Load task
      const { data: taskData, error: loadError } = await supabase
        .from('wbs_tasks')
        .select('id, row_version, wbs_version_id')
        .eq('id', input.taskId)
        .single()

      if (loadError || !taskData) {
        throw new RemoveTaskNotFoundError(input.taskId)
      }

      // 2. Check row_version
      if (taskData.row_version !== input.expectedRowVersion) {
        throw new RemoveTaskStaleError(
          input.taskId,
          input.expectedRowVersion,
          taskData.row_version
        )
      }

      // 3. Load version status via explicit query (type-safe)
      const { data: versionData, error: versionError } = await supabase
        .from('wbs_versions')
        .select('status')
        .eq('id', taskData.wbs_version_id)
        .single()

      if (versionError || !versionData) {
        throw new Error(`Failed to load WBS version: ${versionError?.message}`)
      }

      if (versionData.status === 'superseded') {
        throw new RemoveTaskImmutableError(input.taskId, versionData.status)
      }

      // 4. Count assignments that will be removed
      const { count } = await supabase
        .from('staffing_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('wbs_task_id', input.taskId)

      // 5. Delete task (cascades to assignments)
      const { error: deleteError } = await supabase
        .from('wbs_tasks')
        .delete()
        .eq('id', input.taskId)
        .eq('row_version', input.expectedRowVersion)

      if (deleteError) {
        throw new Error(`Failed to remove task: ${deleteError.message}`)
      }

      return {
        success: true,
        data: {
          removed: true,
          taskId: input.taskId,
          assignmentsRemoved: count ?? 0,
        },
      }
    },
  }
}

/**
 * Execute RemoveWbsTask command with audit logging
 */
export async function removeWbsTask(
  supabase: SupabaseClient,
  input: RemoveWbsTaskInput
): Promise<RemoveWbsTaskResult> {
  const command = createRemoveWbsTaskCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
