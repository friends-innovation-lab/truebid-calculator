/**
 * Phase 5: Labor Catalog Command Types
 *
 * Type definitions for tenant labor catalog management commands.
 */

// =============================================================================
// DATABASE TYPES (matching Postgres schema)
// =============================================================================

export type RateSourceType = 'catalog' | 'manual' | 'gsa_schedule' | 'subcontractor'

export type LaborCategoryMatchType = 'exact' | 'alias' | 'fuzzy' | 'unmapped'

/**
 * Salary level within a labor category.
 * Matches fftc-roles-v2.json structure.
 */
export interface SalaryLevel {
  level: string          // 'IC1', 'IC2', etc.
  level_title: string    // 'Associate', 'Intermediate', etc.
  steps: (number | null)[]  // Salary amounts; NULL for unpopulated steps
}

/**
 * Levels JSONB structure as stored in database.
 */
export interface LevelsJsonb {
  levels: SalaryLevel[]
}

/**
 * Tenant discipline from tenant_disciplines table.
 */
export interface TenantDiscipline {
  id: string
  tenantId: string
  key: string
  displayName: string
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Labor category from tenant_labor_categories table.
 */
export interface LaborCategory {
  id: string
  tenantId: string
  key: string
  title: string
  disciplineKey: string
  description: string | null
  socCode: string | null
  education: string | null
  levels: LevelsJsonb | null  // NULL = needs-setup
  defaultHoursPerMonth: number
  active: boolean
  sortOrder: number
  rowVersion: number
  createdAt: string
  updatedAt: string
}

/**
 * Labor category alias from labor_category_aliases table.
 */
export interface LaborCategoryAlias {
  id: string
  laborCategoryId: string
  alias: string
  contextNote: string | null
  createdAt: string
}

/**
 * Result of resolving a role title to a labor category.
 */
export interface LaborCategoryMatch {
  categoryId: string | null
  matchType: LaborCategoryMatchType
  confidence: number  // 0.0 - 1.0
  category?: LaborCategory  // Populated when matched
  aliasUsed?: string  // The alias that matched, if applicable
  contextNote?: string  // Context note for umbrella aliases
}

// =============================================================================
// COMMAND INPUT TYPES
// =============================================================================

/**
 * Input for creating a new labor category.
 */
export interface CreateLaborCategoryInput {
  title: string
  disciplineKey: string
  description?: string
  socCode?: string
  education?: string
  levels?: LevelsJsonb  // NULL = needs-setup
  defaultHoursPerMonth?: number
  sortOrder?: number
}

/**
 * Input for updating a labor category.
 */
export interface UpdateLaborCategoryInput {
  categoryId: string
  title?: string
  disciplineKey?: string
  description?: string | null
  socCode?: string | null
  education?: string | null
  levels?: LevelsJsonb | null
  defaultHoursPerMonth?: number
  active?: boolean
  sortOrder?: number
  expectedRowVersion: number
}

/**
 * Input for adding an alias to a labor category.
 */
export interface AddCategoryAliasInput {
  categoryId: string
  alias: string
  contextNote?: string
}

/**
 * Input for removing an alias from a labor category.
 */
export interface RemoveCategoryAliasInput {
  aliasId: string
}

/**
 * Input for resolving a role title to a labor category.
 */
export interface ResolveLaborCategoryInput {
  tenantId: string
  roleTitle: string
}

/**
 * Input for bulk resolving multiple role titles.
 */
export interface BulkResolveLaborCategoriesInput {
  tenantId: string
  roleTitles: string[]
}

// =============================================================================
// COMMAND RESULT TYPES
// =============================================================================

/**
 * Result of creating a labor category.
 */
export interface CreateLaborCategoryResult {
  category: LaborCategory
}

/**
 * Result of updating a labor category.
 */
export interface UpdateLaborCategoryResult {
  category: LaborCategory
  previousRowVersion: number
}

/**
 * Result of adding an alias.
 */
export interface AddCategoryAliasResult {
  alias: LaborCategoryAlias
}

/**
 * Result of resolving a role title.
 */
export interface ResolveLaborCategoryResult {
  match: LaborCategoryMatch
}

/**
 * Result of bulk resolution.
 */
export interface BulkResolveLaborCategoriesResult {
  matches: Map<string, LaborCategoryMatch>  // roleTitle -> match
  unmappedCount: number
  totalCount: number
}

// =============================================================================
// STAFFING CATALOG FIELDS (for StaffingInput extension)
// =============================================================================

/**
 * Catalog-related fields for staffing assignments.
 * Extends the base StaffingInput from wbs/types.ts
 */
export interface StaffingCatalogFields {
  laborCategoryId?: string
  levelKey?: string
  stepIndex?: number
  salaryOverrideCents?: number
  billRateOverrideCents?: number
  profitMarginOverride?: number
  rateSource?: RateSourceType
}
