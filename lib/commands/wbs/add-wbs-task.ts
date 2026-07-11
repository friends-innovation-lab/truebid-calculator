/**
 * Phase 3: AddWbsTask Command
 *
 * Adds a new user-created task to a WBS version.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { requireWbsVersion } from './guards'
import type { AddWbsTaskInput, WbsTask } from './types'

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createAddWbsTaskCommand(
  supabase: SupabaseClient
): Command<AddWbsTaskInput, WbsTask> {
  return {
    name: 'AddWbsTask',
    aggregateType: 'wbs_task',
    allowedRoles: ['owner', 'admin', 'estimator'] as TenantRole[],

    async execute(
      _context: CommandContext,
      input: AddWbsTaskInput
    ): Promise<CommandResult<WbsTask>> {
      // 1. Verify version exists and is mutable
      const { version } = await requireWbsVersion(
        supabase,
        input.wbsVersionId,
        ['generated_candidate', 'draft', 'active']
      )

      // 2. Get max sort_order for new task
      const sortOrder = input.sortOrder ?? await (async () => {
        const { data } = await supabase
          .from('wbs_tasks')
          .select('sort_order')
          .eq('wbs_version_id', input.wbsVersionId)
          .order('sort_order', { ascending: false })
          .limit(1)
          .single()
        return (data?.sort_order ?? -1) + 1
      })()

      // 3. Insert task
      const { data: task, error } = await supabase
        .from('wbs_tasks')
        .insert({
          tenant_id: version.tenantId,
          wbs_version_id: input.wbsVersionId,
          wbs_code: input.wbsCode,
          title: input.title,
          description: input.description ?? null,
          deliverable: input.deliverable ?? null,
          sow_reference: input.sowReference ?? null,
          start_month: input.startMonth ?? null,
          end_month: input.endMonth ?? null,
          parent_task_id: input.parentTaskId ?? null,
          sort_order: sortOrder,
          source: 'user_added',
          user_modified: false,
        })
        .select('*')
        .single()

      if (error || !task) {
        throw new Error(`Failed to add task: ${error?.message}`)
      }

      return {
        success: true,
        data: {
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
        },
      }
    },
  }
}

/**
 * Execute AddWbsTask command with audit logging
 */
export async function addWbsTask(
  supabase: SupabaseClient,
  input: AddWbsTaskInput
): Promise<WbsTask> {
  const command = createAddWbsTaskCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
