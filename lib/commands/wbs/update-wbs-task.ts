/**
 * Phase 3: UpdateWbsTask Command
 *
 * Updates a WBS task on a draft or active version.
 * - Sets user_modified = true
 * - Uses optimistic concurrency via row_version
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import type { UpdateWbsTaskInput, WbsTask } from './types'

// =============================================================================
// ERROR TYPES
// =============================================================================

export class WbsTaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`WBS task ${taskId} not found`)
    this.name = 'WbsTaskNotFoundError'
  }
}

export class WbsTaskStaleError extends Error {
  constructor(taskId: string, expected: number, actual: number) {
    super(`WBS task ${taskId} has been modified. Expected row_version ${expected}, got ${actual}`)
    this.name = 'WbsTaskStaleError'
  }
}

export class WbsTaskImmutableError extends Error {
  constructor(taskId: string, status: string) {
    super(`Cannot modify task ${taskId} on ${status} WBS version`)
    this.name = 'WbsTaskImmutableError'
  }
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createUpdateWbsTaskCommand(
  supabase: SupabaseClient
): Command<UpdateWbsTaskInput, WbsTask> {
  return {
    name: 'UpdateWbsTask',
    aggregateType: 'wbs_task',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      _context: CommandContext,
      input: UpdateWbsTaskInput
    ): Promise<CommandResult<WbsTask>> {
      // 1. Load the task
      const { data: taskData, error: loadError } = await supabase
        .from('wbs_tasks')
        .select('*')
        .eq('id', input.taskId)
        .single()

      if (loadError || !taskData) {
        throw new WbsTaskNotFoundError(input.taskId)
      }

      // 2. Check row_version for optimistic concurrency
      if (taskData.row_version !== input.expectedRowVersion) {
        throw new WbsTaskStaleError(
          input.taskId,
          input.expectedRowVersion,
          taskData.row_version
        )
      }

      // 3. Load version status via explicit follow-up query (type-safe)
      const { data: versionData, error: versionError } = await supabase
        .from('wbs_versions')
        .select('status')
        .eq('id', taskData.wbs_version_id)
        .single()

      if (versionError || !versionData) {
        throw new Error(`Failed to load WBS version: ${versionError?.message}`)
      }

      if (versionData.status === 'superseded') {
        throw new WbsTaskImmutableError(input.taskId, versionData.status)
      }

      // 4. Build update object
      const updates: Record<string, unknown> = {
        user_modified: true,
      }

      if (input.title !== undefined) updates.title = input.title
      if (input.description !== undefined) updates.description = input.description
      if (input.deliverable !== undefined) updates.deliverable = input.deliverable
      if (input.sowReference !== undefined) updates.sow_reference = input.sowReference
      if (input.startMonth !== undefined) updates.start_month = input.startMonth
      if (input.endMonth !== undefined) updates.end_month = input.endMonth

      // 5. Perform update
      const { data: updated, error: updateError } = await supabase
        .from('wbs_tasks')
        .update(updates)
        .eq('id', input.taskId)
        .eq('row_version', input.expectedRowVersion)
        .select('*')
        .single()

      if (updateError || !updated) {
        // Could be a race condition
        throw new Error(`Failed to update task: ${updateError?.message ?? 'Unknown error'}`)
      }

      return {
        success: true,
        data: {
          id: updated.id,
          tenantId: updated.tenant_id,
          wbsVersionId: updated.wbs_version_id,
          parentTaskId: updated.parent_task_id,
          wbsCode: updated.wbs_code,
          title: updated.title,
          description: updated.description,
          deliverable: updated.deliverable,
          sowReference: updated.sow_reference,
          startMonth: updated.start_month,
          endMonth: updated.end_month,
          sortOrder: updated.sort_order,
          source: updated.source,
          userModified: updated.user_modified,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
          rowVersion: updated.row_version,
        },
      }
    },
  }
}

/**
 * Execute UpdateWbsTask command with audit logging
 */
export async function updateWbsTask(
  supabase: SupabaseClient,
  input: UpdateWbsTaskInput
): Promise<WbsTask> {
  const command = createUpdateWbsTaskCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
