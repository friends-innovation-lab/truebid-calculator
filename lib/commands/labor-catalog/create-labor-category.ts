/**
 * Phase 5: CreateLaborCategory Command
 *
 * Creates a new labor category in the tenant's catalog.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import type {
  CreateLaborCategoryInput,
  CreateLaborCategoryResult,
  LaborCategory,
} from './types'

// =============================================================================
// ERROR TYPES
// =============================================================================

export class DisciplineNotFoundError extends Error {
  constructor(disciplineKey: string, tenantId: string) {
    super(`Discipline '${disciplineKey}' not found for tenant ${tenantId}`)
    this.name = 'DisciplineNotFoundError'
  }
}

export class DuplicateCategoryKeyError extends Error {
  constructor(key: string, tenantId: string) {
    super(`Labor category with key '${key}' already exists for tenant ${tenantId}`)
    this.name = 'DuplicateCategoryKeyError'
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a key from a title (kebab-case with underscores).
 */
function generateKeyFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, '_')        // Spaces to underscores
    .replace(/_+/g, '_')         // Collapse multiple underscores
    .replace(/^_|_$/g, '')       // Trim leading/trailing underscores
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createCreateLaborCategoryCommand(
  supabase: SupabaseClient
): Command<CreateLaborCategoryInput, CreateLaborCategoryResult> {
  return {
    name: 'CreateLaborCategory',
    aggregateType: 'labor_category',
    allowedRoles: ['owner', 'admin'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: CreateLaborCategoryInput
    ): Promise<CommandResult<CreateLaborCategoryResult>> {
      const tenantId = context.tenant.tenant.id

      // 1. Validate discipline exists and is active
      const { data: discipline, error: disciplineError } = await supabase
        .from('tenant_disciplines')
        .select('id, key, active')
        .eq('tenant_id', tenantId)
        .eq('key', input.disciplineKey)
        .single()

      if (disciplineError || !discipline) {
        throw new DisciplineNotFoundError(input.disciplineKey, tenantId)
      }

      if (!discipline.active) {
        throw new DisciplineNotFoundError(input.disciplineKey, tenantId)
      }

      // 2. Generate key from title
      const key = generateKeyFromTitle(input.title)

      // 3. Check for duplicate key
      const { data: existing } = await supabase
        .from('tenant_labor_categories')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('key', key)
        .single()

      if (existing) {
        throw new DuplicateCategoryKeyError(key, tenantId)
      }

      // 4. Insert the category
      const { data: category, error } = await supabase
        .from('tenant_labor_categories')
        .insert({
          tenant_id: tenantId,
          key,
          title: input.title,
          discipline_key: input.disciplineKey,
          description: input.description ?? null,
          soc_code: input.socCode ?? null,
          education: input.education ?? null,
          levels: input.levels ?? null,
          default_hours_per_month: input.defaultHoursPerMonth ?? 160,
          sort_order: input.sortOrder ?? 0,
          active: true,
        })
        .select('*')
        .single()

      if (error || !category) {
        throw new Error(`Failed to create labor category: ${error?.message}`)
      }

      return {
        success: true,
        data: {
          category: mapToLaborCategory(category),
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
 * Execute CreateLaborCategory command.
 */
export async function createLaborCategory(
  supabase: SupabaseClient,
  input: CreateLaborCategoryInput
): Promise<CreateLaborCategoryResult> {
  const command = createCreateLaborCategoryCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
