/**
 * Phase 5: ResolveLaborCategory Command (Query)
 *
 * Resolves a role title to a labor category within a tenant.
 * This is a query operation (read-only) but follows command patterns for consistency.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ResolveLaborCategoryInput,
  ResolveLaborCategoryResult,
  BulkResolveLaborCategoriesInput,
  BulkResolveLaborCategoriesResult,
  LaborCategoryMatch,
  LaborCategory,
  LaborCategoryMatchType,
} from './types'

// =============================================================================
// RESOLUTION LOGIC
// =============================================================================

/**
 * Resolve a role title to a labor category.
 *
 * Resolution order:
 * 1. Exact title match (confidence: 1.0)
 * 2. Alias match (confidence: 0.95)
 * 3. Fuzzy match (confidence: 0.70)
 * 4. Unmapped (confidence: 0.0)
 */
export async function resolveLaborCategory(
  supabase: SupabaseClient,
  input: ResolveLaborCategoryInput
): Promise<ResolveLaborCategoryResult> {
  const normalizedTitle = input.roleTitle.toLowerCase().trim()

  // 1. Try exact title match
  const exactMatch = await tryExactMatch(supabase, input.tenantId, normalizedTitle)
  if (exactMatch) {
    return { match: exactMatch }
  }

  // 2. Try alias match
  const aliasMatch = await tryAliasMatch(supabase, input.tenantId, normalizedTitle)
  if (aliasMatch) {
    return { match: aliasMatch }
  }

  // 3. Try fuzzy match
  const fuzzyMatch = await tryFuzzyMatch(supabase, input.tenantId, normalizedTitle)
  if (fuzzyMatch) {
    return { match: fuzzyMatch }
  }

  // 4. Unmapped
  return {
    match: {
      categoryId: null,
      matchType: 'unmapped',
      confidence: 0,
    },
  }
}

/**
 * Bulk resolve multiple role titles.
 */
export async function bulkResolveLaborCategories(
  supabase: SupabaseClient,
  input: BulkResolveLaborCategoriesInput
): Promise<BulkResolveLaborCategoriesResult> {
  const matches = new Map<string, LaborCategoryMatch>()
  let unmappedCount = 0

  // Could be optimized with batch queries, but for now resolve each
  for (const roleTitle of input.roleTitles) {
    const result = await resolveLaborCategory(supabase, {
      tenantId: input.tenantId,
      roleTitle,
    })

    matches.set(roleTitle, result.match)

    if (result.match.matchType === 'unmapped') {
      unmappedCount++
    }
  }

  return {
    matches,
    unmappedCount,
    totalCount: input.roleTitles.length,
  }
}

// =============================================================================
// MATCH HELPERS
// =============================================================================

async function tryExactMatch(
  supabase: SupabaseClient,
  tenantId: string,
  normalizedTitle: string
): Promise<LaborCategoryMatch | null> {
  const { data, error } = await supabase
    .from('tenant_labor_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .ilike('title', normalizedTitle)
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return {
    categoryId: data.id,
    matchType: 'exact' as LaborCategoryMatchType,
    confidence: 1.0,
    category: mapToLaborCategory(data),
  }
}

async function tryAliasMatch(
  supabase: SupabaseClient,
  tenantId: string,
  normalizedTitle: string
): Promise<LaborCategoryMatch | null> {
  // Join aliases with categories to filter by tenant
  const { data, error } = await supabase
    .from('labor_category_aliases')
    .select(`
      id,
      alias,
      context_note,
      labor_category:tenant_labor_categories!inner(*)
    `)
    .ilike('alias', normalizedTitle)
    .limit(10) // Get all matches for potential disambiguation

  if (error || !data || data.length === 0) {
    return null
  }

  // Filter by tenant and active status
  // Supabase returns nested objects, but with !inner it's an object not array
  const tenantMatches = data.filter(row => {
     
    const category = row.labor_category as any
    if (!category) return false
    return category.tenant_id === tenantId && category.active === true
  })

  if (tenantMatches.length === 0) {
    return null
  }

  // For umbrella aliases (multiple matches), return the first with context note
  // In production, UI would show disambiguation options
  const match = tenantMatches[0]
   
  const category = match.labor_category as any as Record<string, unknown>

  return {
    categoryId: category.id as string,
    matchType: 'alias' as LaborCategoryMatchType,
    confidence: 0.95,
    category: mapToLaborCategory(category),
    aliasUsed: match.alias,
    contextNote: match.context_note ?? undefined,
  }
}

async function tryFuzzyMatch(
  supabase: SupabaseClient,
  tenantId: string,
  normalizedTitle: string
): Promise<LaborCategoryMatch | null> {
  // Fuzzy matching: title contains input OR input contains title
  // Using ILIKE with wildcards

  // First try: input contains category title
  const { data: containsData, error: containsError } = await supabase
    .from('tenant_labor_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .or(`title.ilike.%${escapeLike(normalizedTitle)}%`)
    .order('title', { ascending: true })
    .limit(5)

  if (!containsError && containsData && containsData.length > 0) {
    // Prefer longer title matches (more specific)
    const sorted = containsData.sort((a, b) =>
      (b.title as string).length - (a.title as string).length
    )
    return {
      categoryId: sorted[0].id,
      matchType: 'fuzzy' as LaborCategoryMatchType,
      confidence: 0.70,
      category: mapToLaborCategory(sorted[0]),
    }
  }

  // Second try: category title contains input
  const { data: inData, error: inError } = await supabase
    .from('tenant_labor_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .limit(100) // Need to fetch all for reverse matching

  if (inError || !inData) {
    return null
  }

  const reverseMatches = inData.filter(row =>
    normalizedTitle.includes((row.title as string).toLowerCase())
  )

  if (reverseMatches.length > 0) {
    // Prefer longer title matches
    const sorted = reverseMatches.sort((a, b) =>
      (b.title as string).length - (a.title as string).length
    )
    return {
      categoryId: sorted[0].id,
      matchType: 'fuzzy' as LaborCategoryMatchType,
      confidence: 0.70,
      category: mapToLaborCategory(sorted[0]),
    }
  }

  return null
}

/**
 * Escape special characters for ILIKE patterns.
 */
function escapeLike(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
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
    defaultHoursPerMonth: parseFloat(row.default_hours_per_month as string) || 160,
    active: row.active as boolean,
    sortOrder: row.sort_order as number,
    rowVersion: row.row_version as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// =============================================================================
// SALARY LOOKUP
// =============================================================================

/**
 * Get salary for a specific level/step from a labor category.
 * Returns null if category needs setup (levels is null) or level/step not found.
 */
export function getSalaryFromCategory(
  category: LaborCategory,
  levelKey: string,
  stepIndex: number = 0
): number | null {
  if (!category.levels) {
    return null // Needs setup
  }

  const level = category.levels.levels.find(l => l.level === levelKey)
  if (!level) {
    return null
  }

  if (stepIndex < 0 || stepIndex >= level.steps.length) {
    return null
  }

  return level.steps[stepIndex]
}

/**
 * Check if a labor category needs salary configuration.
 */
export function categoryNeedsSetup(category: LaborCategory): boolean {
  return category.levels === null
}

/**
 * Get available levels for a category.
 * Returns empty array if category needs setup.
 */
export function getAvailableLevels(category: LaborCategory): string[] {
  if (!category.levels) {
    return []
  }

  return category.levels.levels.map(l => l.level)
}

/**
 * Get populated steps for a level (excludes NULL steps per provenance rule).
 * Returns empty array if level not found or category needs setup.
 */
export function getPopulatedSteps(
  category: LaborCategory,
  levelKey: string
): { index: number; salary: number }[] {
  if (!category.levels) {
    return []
  }

  const level = category.levels.levels.find(l => l.level === levelKey)
  if (!level) {
    return []
  }

  return level.steps
    .map((salary, index) => ({ index, salary }))
    .filter((step): step is { index: number; salary: number } =>
      step.salary !== null
    )
}
