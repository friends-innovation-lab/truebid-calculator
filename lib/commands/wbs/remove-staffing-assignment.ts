/**
 * Phase 3: RemoveStaffingAssignment Command
 *
 * Removes a staffing assignment (hard delete with audit).
 * - Uses optimistic concurrency
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import type { RemoveStaffingAssignmentInput } from './types'

// =============================================================================
// ERROR TYPES
// =============================================================================

export class RemoveAssignmentNotFoundError extends Error {
  constructor(assignmentId: string) {
    super(`Staffing assignment ${assignmentId} not found`)
    this.name = 'RemoveAssignmentNotFoundError'
  }
}

export class RemoveAssignmentStaleError extends Error {
  constructor(assignmentId: string, expected: number, actual: number) {
    super(`Staffing assignment ${assignmentId} has been modified. Expected row_version ${expected}, got ${actual}`)
    this.name = 'RemoveAssignmentStaleError'
  }
}

export class RemoveAssignmentImmutableError extends Error {
  constructor(assignmentId: string, status: string) {
    super(`Cannot remove assignment ${assignmentId} from ${status} WBS version`)
    this.name = 'RemoveAssignmentImmutableError'
  }
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

interface RemoveStaffingAssignmentResult {
  removed: true
  assignmentId: string
}

export function createRemoveStaffingAssignmentCommand(
  supabase: SupabaseClient
): Command<RemoveStaffingAssignmentInput, RemoveStaffingAssignmentResult> {
  return {
    name: 'RemoveStaffingAssignment',
    aggregateType: 'staffing_assignment',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      _context: CommandContext,
      input: RemoveStaffingAssignmentInput
    ): Promise<CommandResult<RemoveStaffingAssignmentResult>> {
      // 1. Load assignment
      const { data: assignmentData, error: loadError } = await supabase
        .from('staffing_assignments')
        .select('id, row_version, wbs_task_id')
        .eq('id', input.assignmentId)
        .single()

      if (loadError || !assignmentData) {
        throw new RemoveAssignmentNotFoundError(input.assignmentId)
      }

      // 2. Check row_version
      if (assignmentData.row_version !== input.expectedRowVersion) {
        throw new RemoveAssignmentStaleError(
          input.assignmentId,
          input.expectedRowVersion,
          assignmentData.row_version
        )
      }

      // 3. Load task to get version ID
      const { data: taskData, error: taskError } = await supabase
        .from('wbs_tasks')
        .select('wbs_version_id')
        .eq('id', assignmentData.wbs_task_id)
        .single()

      if (taskError || !taskData) {
        throw new Error(`Failed to load task: ${taskError?.message}`)
      }

      // 4. Load version status via explicit query (type-safe)
      const { data: versionData, error: versionError } = await supabase
        .from('wbs_versions')
        .select('status')
        .eq('id', taskData.wbs_version_id)
        .single()

      if (versionError || !versionData) {
        throw new Error(`Failed to load WBS version: ${versionError?.message}`)
      }

      if (versionData.status === 'superseded') {
        throw new RemoveAssignmentImmutableError(input.assignmentId, versionData.status)
      }

      // 4. Delete assignment
      const { error: deleteError } = await supabase
        .from('staffing_assignments')
        .delete()
        .eq('id', input.assignmentId)
        .eq('row_version', input.expectedRowVersion)

      if (deleteError) {
        throw new Error(`Failed to remove assignment: ${deleteError.message}`)
      }

      return {
        success: true,
        data: {
          removed: true,
          assignmentId: input.assignmentId,
        },
      }
    },
  }
}

/**
 * Execute RemoveStaffingAssignment command with audit logging
 */
export async function removeStaffingAssignment(
  supabase: SupabaseClient,
  input: RemoveStaffingAssignmentInput
): Promise<RemoveStaffingAssignmentResult> {
  const command = createRemoveStaffingAssignmentCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
