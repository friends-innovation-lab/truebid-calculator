/**
 * Phase 3: AddStaffingAssignment Command
 *
 * Adds a new user-created staffing assignment to a task.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import type { AddStaffingAssignmentInput, StaffingAssignment } from './types'

// =============================================================================
// ERROR TYPES
// =============================================================================

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`WBS task ${taskId} not found`)
    this.name = 'TaskNotFoundError'
  }
}

export class TaskImmutableError extends Error {
  constructor(taskId: string, status: string) {
    super(`Cannot add assignment to task ${taskId} on ${status} WBS version`)
    this.name = 'TaskImmutableError'
  }
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createAddStaffingAssignmentCommand(
  supabase: SupabaseClient
): Command<AddStaffingAssignmentInput, StaffingAssignment> {
  return {
    name: 'AddStaffingAssignment',
    aggregateType: 'staffing_assignment',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      _context: CommandContext,
      input: AddStaffingAssignmentInput
    ): Promise<CommandResult<StaffingAssignment>> {
      // 1. Load task
      const { data: taskData, error: loadError } = await supabase
        .from('wbs_tasks')
        .select('tenant_id, wbs_version_id')
        .eq('id', input.wbsTaskId)
        .single()

      if (loadError || !taskData) {
        throw new TaskNotFoundError(input.wbsTaskId)
      }

      // 2. Load version status via explicit query (type-safe)
      const { data: versionData, error: versionError } = await supabase
        .from('wbs_versions')
        .select('status')
        .eq('id', taskData.wbs_version_id)
        .single()

      if (versionError || !versionData) {
        throw new Error(`Failed to load WBS version: ${versionError?.message}`)
      }

      if (versionData.status === 'superseded') {
        throw new TaskImmutableError(input.wbsTaskId, versionData.status)
      }

      // 3. Insert assignment
      const { data: assignment, error } = await supabase
        .from('staffing_assignments')
        .insert({
          tenant_id: taskData.tenant_id,
          wbs_task_id: input.wbsTaskId,
          role_title: input.roleTitle,
          discipline: input.discipline,
          prime_or_sub: input.primeOrSub,
          subcontractor_name: input.subcontractorName ?? null,
          period_label: input.periodLabel,
          hours: input.hours,
          hours_per_month: input.hoursPerMonth ?? null,
          rationale: input.rationale ?? null,
          source: 'user_added',
          user_modified: false,
        })
        .select('*')
        .single()

      if (error || !assignment) {
        throw new Error(`Failed to add assignment: ${error?.message}`)
      }

      return {
        success: true,
        data: {
          id: assignment.id,
          tenantId: assignment.tenant_id,
          wbsTaskId: assignment.wbs_task_id,
          roleTitle: assignment.role_title,
          discipline: assignment.discipline,
          primeOrSub: assignment.prime_or_sub,
          subcontractorName: assignment.subcontractor_name,
          periodLabel: assignment.period_label,
          hours: parseFloat(assignment.hours),
          hoursPerMonth: assignment.hours_per_month ? parseFloat(assignment.hours_per_month) : null,
          rationale: assignment.rationale,
          source: assignment.source,
          userModified: assignment.user_modified,
          createdAt: assignment.created_at,
          updatedAt: assignment.updated_at,
          rowVersion: assignment.row_version,
        },
      }
    },
  }
}

/**
 * Execute AddStaffingAssignment command with audit logging
 */
export async function addStaffingAssignment(
  supabase: SupabaseClient,
  input: AddStaffingAssignmentInput
): Promise<StaffingAssignment> {
  const command = createAddStaffingAssignmentCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
