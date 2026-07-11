/**
 * Phase 3: UpdateStaffingAssignment Command
 *
 * Updates a staffing assignment on a draft or active version.
 * - Sets user_modified = true
 * - Uses optimistic concurrency via row_version
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import type { UpdateStaffingAssignmentInput, StaffingAssignment } from './types'

// =============================================================================
// ERROR TYPES
// =============================================================================

export class StaffingAssignmentNotFoundError extends Error {
  constructor(assignmentId: string) {
    super(`Staffing assignment ${assignmentId} not found`)
    this.name = 'StaffingAssignmentNotFoundError'
  }
}

export class StaffingAssignmentStaleError extends Error {
  constructor(assignmentId: string, expected: number, actual: number) {
    super(`Staffing assignment ${assignmentId} has been modified. Expected row_version ${expected}, got ${actual}`)
    this.name = 'StaffingAssignmentStaleError'
  }
}

export class StaffingAssignmentImmutableError extends Error {
  constructor(assignmentId: string, status: string) {
    super(`Cannot modify assignment ${assignmentId} on ${status} WBS version`)
    this.name = 'StaffingAssignmentImmutableError'
  }
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createUpdateStaffingAssignmentCommand(
  supabase: SupabaseClient
): Command<UpdateStaffingAssignmentInput, StaffingAssignment> {
  return {
    name: 'UpdateStaffingAssignment',
    aggregateType: 'staffing_assignment',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      _context: CommandContext,
      input: UpdateStaffingAssignmentInput
    ): Promise<CommandResult<StaffingAssignment>> {
      // 1. Load the assignment
      const { data: assignmentData, error: loadError } = await supabase
        .from('staffing_assignments')
        .select('*')
        .eq('id', input.assignmentId)
        .single()

      if (loadError || !assignmentData) {
        throw new StaffingAssignmentNotFoundError(input.assignmentId)
      }

      // 2. Check row_version for optimistic concurrency
      if (assignmentData.row_version !== input.expectedRowVersion) {
        throw new StaffingAssignmentStaleError(
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
        throw new StaffingAssignmentImmutableError(input.assignmentId, versionData.status)
      }

      // 4. Build update object
      const updates: Record<string, unknown> = {
        user_modified: true,
      }

      if (input.roleTitle !== undefined) updates.role_title = input.roleTitle
      if (input.discipline !== undefined) updates.discipline = input.discipline
      if (input.primeOrSub !== undefined) updates.prime_or_sub = input.primeOrSub
      if (input.subcontractorName !== undefined) updates.subcontractor_name = input.subcontractorName
      if (input.periodLabel !== undefined) updates.period_label = input.periodLabel
      if (input.hours !== undefined) updates.hours = input.hours
      if (input.hoursPerMonth !== undefined) updates.hours_per_month = input.hoursPerMonth
      if (input.rationale !== undefined) updates.rationale = input.rationale

      // 5. Perform update
      const { data: updated, error: updateError } = await supabase
        .from('staffing_assignments')
        .update(updates)
        .eq('id', input.assignmentId)
        .eq('row_version', input.expectedRowVersion)
        .select('*')
        .single()

      if (updateError || !updated) {
        throw new Error(`Failed to update assignment: ${updateError?.message ?? 'Unknown error'}`)
      }

      return {
        success: true,
        data: {
          id: updated.id,
          tenantId: updated.tenant_id,
          wbsTaskId: updated.wbs_task_id,
          roleTitle: updated.role_title,
          discipline: updated.discipline,
          primeOrSub: updated.prime_or_sub,
          subcontractorName: updated.subcontractor_name,
          periodLabel: updated.period_label,
          hours: parseFloat(updated.hours),
          hoursPerMonth: updated.hours_per_month ? parseFloat(updated.hours_per_month) : null,
          rationale: updated.rationale,
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
 * Execute UpdateStaffingAssignment command with audit logging
 */
export async function updateStaffingAssignment(
  supabase: SupabaseClient,
  input: UpdateStaffingAssignmentInput
): Promise<StaffingAssignment> {
  const command = createUpdateStaffingAssignmentCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
