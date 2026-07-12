/**
 * Phase 5: AddCategoryAlias Command
 *
 * Adds an alias to a labor category for role title matching.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runCommand } from '../runner'
import type { Command, CommandContext, CommandResult } from '../types'
import type { TenantRole } from '@/lib/tenancy'
import type {
  AddCategoryAliasInput,
  AddCategoryAliasResult,
  LaborCategoryAlias,
} from './types'

// =============================================================================
// ERROR TYPES
// =============================================================================

export class CategoryNotFoundError extends Error {
  constructor(categoryId: string) {
    super(`Labor category ${categoryId} not found`)
    this.name = 'CategoryNotFoundError'
  }
}

export class DuplicateAliasError extends Error {
  constructor(alias: string, categoryId: string) {
    super(`Alias '${alias}' already exists for category ${categoryId}`)
    this.name = 'DuplicateAliasError'
  }
}

export class AliasConflictError extends Error {
  constructor(alias: string, existingCategoryTitle: string) {
    super(`Alias '${alias}' already assigned to category '${existingCategoryTitle}'`)
    this.name = 'AliasConflictError'
  }
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

export function createAddCategoryAliasCommand(
  supabase: SupabaseClient
): Command<AddCategoryAliasInput, AddCategoryAliasResult> {
  return {
    name: 'AddCategoryAlias',
    aggregateType: 'labor_category_alias',
    allowedRoles: ['owner', 'admin'] as TenantRole[],

    async execute(
      context: CommandContext,
      input: AddCategoryAliasInput
    ): Promise<CommandResult<AddCategoryAliasResult>> {
      const tenantId = context.tenant.tenant.id

      // 1. Verify category exists and belongs to tenant
      const { data: category, error: categoryError } = await supabase
        .from('tenant_labor_categories')
        .select('id, tenant_id, title')
        .eq('id', input.categoryId)
        .single()

      if (categoryError || !category) {
        throw new CategoryNotFoundError(input.categoryId)
      }

      if (category.tenant_id !== tenantId) {
        throw new CategoryNotFoundError(input.categoryId)
      }

      // 2. Check if alias already exists for this category
      const { data: existingOnCategory } = await supabase
        .from('labor_category_aliases')
        .select('id')
        .eq('labor_category_id', input.categoryId)
        .ilike('alias', input.alias)
        .single()

      if (existingOnCategory) {
        throw new DuplicateAliasError(input.alias, input.categoryId)
      }

      // 3. Note: We allow the same alias on different categories (umbrella aliases like "HCD Lead")
      // The context_note field disambiguates them

      // 4. Insert alias
      const { data: alias, error } = await supabase
        .from('labor_category_aliases')
        .insert({
          labor_category_id: input.categoryId,
          alias: input.alias,
          context_note: input.contextNote ?? null,
        })
        .select('*')
        .single()

      if (error || !alias) {
        throw new Error(`Failed to add alias: ${error?.message}`)
      }

      return {
        success: true,
        data: {
          alias: mapToLaborCategoryAlias(alias),
        },
      }
    },
  }
}

/**
 * Map database row to LaborCategoryAlias type.
 */
function mapToLaborCategoryAlias(row: Record<string, unknown>): LaborCategoryAlias {
  return {
    id: row.id as string,
    laborCategoryId: row.labor_category_id as string,
    alias: row.alias as string,
    contextNote: row.context_note as string | null,
    createdAt: row.created_at as string,
  }
}

/**
 * Execute AddCategoryAlias command.
 */
export async function addCategoryAlias(
  supabase: SupabaseClient,
  input: AddCategoryAliasInput
): Promise<AddCategoryAliasResult> {
  const command = createAddCategoryAliasCommand(supabase)
  const result = await runCommand(supabase, command, input)

  if (!result.success) {
    throw result.error
  }

  return result.data!
}
