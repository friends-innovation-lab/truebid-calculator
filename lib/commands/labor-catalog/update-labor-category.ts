/**
 * Phase 5: UpdateLaborCategory Command
 *
 * Updates an existing labor category with optimistic concurrency.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import { StaleVersionError } from '../errors'
import type {
  UpdateLaborCategoryInput,
  UpdateLaborCategoryResult,
  LaborCategory,
} from './types'

// =============================================================================
// ERROR TYPES
// =============================================================================

export class LaborCategoryNotFoundError extends Error {
  constructor(categoryId: string) {
    super(`Labor category ${categoryId} not found`)
    this.name = 'LaborCategoryNotFoundError'
  }
}

export class InvalidDisciplineError extends Error {
  constructor(disciplineKey: string) {
    super(`Discipline '${disciplineKey}' is not valid or not active`)
    this.name = 'InvalidDisciplineError'
  }
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createUpdateLaborCategoryCommand(
  supabase: SupabaseClient
): Command<UpdateLaborCategoryInput, UpdateLaborCategoryResult> {
  return {
    name: 'UpdateLaborCategory',
    aggregateType: 'labor_category',
    allowedRoles: ['owner', 'admin'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: UpdateLaborCategoryInput
    ): Promise<CommandResult<UpdateLaborCategoryResult>> {
      const tenantId = context.tenant.tenant.id

      // 1. Load current category
      const { data: current, error: loadError } = await supabase
        .from('tenant_labor_categories')
        .select('*')
        .eq('id', input.categoryId)
        .eq('tenant_id', tenantId)
        .single()

      if (loadError || !current) {
        throw new LaborCategoryNotFoundError(input.categoryId)
      }

      // 2. Check row version for optimistic concurrency
      if (current.row_version !== input.expectedRowVersion) {
        throw new StaleVersionError({
          aggregateId: input.categoryId,
          currentVersion: current.row_version,
          submittedVersion: input.expectedRowVersion,
        })
      }

      // 3. Validate new discipline if changing
      if (input.disciplineKey && input.disciplineKey !== current.discipline_key) {
        const { data: discipline, error: disciplineError } = await supabase
          .from('tenant_disciplines')
          .select('id, active')
          .eq('tenant_id', tenantId)
          .eq('key', input.disciplineKey)
          .single()

        if (disciplineError || !discipline || !discipline.active) {
          throw new InvalidDisciplineError(input.disciplineKey)
        }
      }

      // 4. Build update object
      const updates: Record<string, unknown> = {}

      if (input.title !== undefined) updates.title = input.title
      if (input.disciplineKey !== undefined) updates.discipline_key = input.disciplineKey
      if (input.description !== undefined) updates.description = input.description
      if (input.socCode !== undefined) updates.soc_code = input.socCode
      if (input.education !== undefined) updates.education = input.education
      if (input.levels !== undefined) updates.levels = input.levels
      if (input.defaultHoursPerMonth !== undefined) updates.default_hours_per_month = input.defaultHoursPerMonth
      if (input.active !== undefined) updates.active = input.active
      if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder

      // 5. Apply update
      const { data: updated, error: updateError } = await supabase
        .from('tenant_labor_categories')
        .update(updates)
        .eq('id', input.categoryId)
        .eq('row_version', input.expectedRowVersion) // Double-check version
        .select('*')
        .single()

      if (updateError) {
        // Could be a race condition
        throw new Error(`Failed to update labor category: ${updateError.message}`)
      }

      if (!updated) {
        // Version changed between load and update
        throw new StaleVersionError({
          aggregateId: input.categoryId,
          currentVersion: current.row_version + 1, // Probably incremented
          submittedVersion: input.expectedRowVersion,
        })
      }

      return {
        success: true,
        data: {
          category: mapToLaborCategory(updated),
          previousRowVersion: input.expectedRowVersion,
        },
      }
    },
  }
}

/**
 * Map database row to LaborCategory type.
 */
function mapToLaborCategory(row: Record<string, unknown>): LaborCategory {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    key: row.key as string,
    title: row.title as string,
    disciplineKey: row.discipline_key as string,
    description: row.description as string | null,
    socCode: row.soc_code as string | null,
    education: row.education as string | null,
    levels: row.levels as LaborCategory['levels'],
    defaultHoursPerMonth: parseFloat(row.default_hours_per_month as string),
    active: row.active as boolean,
    sortOrder: row.sort_order as number,
    rowVersion: row.row_version as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

/**
 * Execute UpdateLaborCategory command.
 */
export async function updateLaborCategory(
  supabase: SupabaseClient,
  input: UpdateLaborCategoryInput
): Promise<UpdateLaborCategoryResult> {
  const command = createUpdateLaborCategoryCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
