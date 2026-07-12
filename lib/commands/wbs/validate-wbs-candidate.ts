/**
 * Phase 3: ValidateWbsCandidate
 *
 * Deterministic post-generation validation. Runs inside CreateWbsCandidate.
 * Rejects candidates with violations - no partial acceptance.
 *
 * Checks:
 * 1. Every assignment's discipline IN intelligence_disciplines for this version
 * 2. Every assignment has prime_or_sub set
 * 3. Every assignment's period_label IN intelligence_periods for this version
 * 4. If sub, subcontractor_name is provided
 * 5. If staffingModel === 'prescribed', role must be in prescribed vocabulary
 * 6. Phase 5: Catalog resolution for offeror_proposed model (informational, not blocking)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  TaskInput,
  ValidationResult,
  ValidationViolation,
  CatalogResolutionInfo,
  CatalogResolutionSummary,
} from './types'
import type { StaffingModel } from '../intelligence/types'
import { bulkResolveLaborCategories } from '../labor-catalog'
import type { LaborCategoryMatch } from '../labor-catalog/types'

/**
 * Normalize role title for comparison.
 * Handles common variations: case, spacing, abbreviations, senior/lead prefixes.
 */
function normalizeRoleTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // Normalize common separators
    .replace(/[-_]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Remove common prefixes that don't change the role
    .replace(/^(senior|sr\.?|lead|principal|staff)\s+/i, '')
    // Normalize common abbreviations
    .replace(/\bpm\b/gi, 'product manager')
    .replace(/\bhcd\b/gi, 'human centered design')
    .replace(/\bux\b/gi, 'user experience')
    .replace(/\bui\b/gi, 'user interface')
    .replace(/\bdev\b/gi, 'developer')
    .replace(/\bengr?\b/gi, 'engineer')
}

interface IntelligenceContext {
  tenantId: string
  disciplines: string[]
  periodLabels: string[]
  staffingModel: StaffingModel
  prescribedRoles: string[] // Role titles when staffingModel === 'prescribed'
}

/**
 * Load intelligence context (disciplines, periods, staffing model, prescribed roles) for validation
 */
export async function loadIntelligenceContext(
  supabase: SupabaseClient,
  intelligenceVersionId: string
): Promise<IntelligenceContext> {
  // Load version to get staffing model and tenant
  const { data: version, error: versionError } = await supabase
    .from('intelligence_versions')
    .select('staffing_model, tenant_id')
    .eq('id', intelligenceVersionId)
    .single()

  if (versionError) {
    throw new Error(`Failed to load intelligence version: ${versionError.message}`)
  }

  // Load disciplines
  const { data: disciplines, error: discError } = await supabase
    .from('intelligence_disciplines')
    .select('discipline')
    .eq('version_id', intelligenceVersionId)

  if (discError) {
    throw new Error(`Failed to load disciplines: ${discError.message}`)
  }

  // Load periods
  const { data: periods, error: perError } = await supabase
    .from('intelligence_periods')
    .select('name')
    .eq('version_id', intelligenceVersionId)

  if (perError) {
    throw new Error(`Failed to load periods: ${perError.message}`)
  }

  // Load prescribed roles (only those with is_prescribed = true)
  const { data: laborReqs, error: laborError } = await supabase
    .from('intelligence_labor_requirements')
    .select('title')
    .eq('version_id', intelligenceVersionId)
    .eq('is_prescribed', true)

  if (laborError) {
    throw new Error(`Failed to load labor requirements: ${laborError.message}`)
  }

  return {
    tenantId: version?.tenant_id as string,
    disciplines: (disciplines || []).map(d => d.discipline),
    periodLabels: (periods || []).map(p => p.name),
    staffingModel: (version?.staffing_model as StaffingModel) ?? 'unclear',
    prescribedRoles: (laborReqs || []).map(l => l.title),
  }
}

/**
 * Validate WBS candidate tasks and assignments against intelligence context
 */
export function validateWbsCandidate(
  tasks: TaskInput[],
  context: IntelligenceContext
): ValidationResult {
  const violations: ValidationViolation[] = []

  for (const task of tasks) {
    for (let i = 0; i < task.staffing.length; i++) {
      const assignment = task.staffing[i]

      // Check 1: Discipline must be in intelligence disciplines
      if (!context.disciplines.includes(assignment.discipline)) {
        violations.push({
          type: 'invalid_discipline',
          taskWbsCode: task.wbsCode,
          taskTitle: task.title,
          assignmentIndex: i,
          roleTitle: assignment.roleTitle,
          details: `Discipline "${assignment.discipline}" is not in confirmed intelligence. Valid disciplines: ${context.disciplines.join(', ') || 'none'}`,
        })
      }

      // Check 2: prime_or_sub must be set (TypeScript enforces this, but double-check)
      if (!assignment.primeOrSub || !['prime', 'sub'].includes(assignment.primeOrSub)) {
        violations.push({
          type: 'missing_prime_or_sub',
          taskWbsCode: task.wbsCode,
          taskTitle: task.title,
          assignmentIndex: i,
          roleTitle: assignment.roleTitle,
          details: `Assignment must specify prime_or_sub as "prime" or "sub"`,
        })
      }

      // Check 3: Period label must be in intelligence periods
      if (!context.periodLabels.includes(assignment.periodLabel)) {
        violations.push({
          type: 'invalid_period',
          taskWbsCode: task.wbsCode,
          taskTitle: task.title,
          assignmentIndex: i,
          roleTitle: assignment.roleTitle,
          details: `Period "${assignment.periodLabel}" is not in confirmed intelligence. Valid periods: ${context.periodLabels.join(', ') || 'none'}`,
        })
      }

      // Check 4: If sub, subcontractor_name is required
      if (assignment.primeOrSub === 'sub' && !assignment.subcontractorName?.trim()) {
        violations.push({
          type: 'sub_missing_name',
          taskWbsCode: task.wbsCode,
          taskTitle: task.title,
          assignmentIndex: i,
          roleTitle: assignment.roleTitle,
          details: `Subcontractor assignments require subcontractor_name`,
        })
      }

      // Check 5: If prescribed staffing, role must be in prescribed vocabulary
      if (context.staffingModel === 'prescribed' && context.prescribedRoles.length > 0) {
        const roleMatches = context.prescribedRoles.some(pr =>
          normalizeRoleTitle(pr) === normalizeRoleTitle(assignment.roleTitle)
        )
        if (!roleMatches) {
          violations.push({
            type: 'invalid_role_prescribed',
            taskWbsCode: task.wbsCode,
            taskTitle: task.title,
            assignmentIndex: i,
            roleTitle: assignment.roleTitle,
            details: `Role "${assignment.roleTitle}" not in prescribed vocabulary. This RFP specifies exact roles: ${context.prescribedRoles.join(', ')}`,
          })
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  }
}

/**
 * Phase 5: Resolve all unique role titles against tenant labor catalog.
 *
 * Returns catalog resolution summary with match info per role.
 * This is informational - unmapped roles are allowed for offeror_proposed,
 * they render as review prompts ("did you mean X?") based on match type.
 */
export async function resolveRolesAgainstCatalog(
  supabase: SupabaseClient,
  tenantId: string,
  tasks: TaskInput[]
): Promise<CatalogResolutionSummary> {
  // Collect unique role titles
  const roleTitles = new Set<string>()
  for (const task of tasks) {
    for (const staffing of task.staffing) {
      roleTitles.add(staffing.roleTitle)
    }
  }

  const roleTitlesArray = Array.from(roleTitles)

  if (roleTitlesArray.length === 0) {
    return {
      totalRoles: 0,
      exactMatches: 0,
      aliasMatches: 0,
      fuzzyMatches: 0,
      unmappedCount: 0,
      roles: [],
    }
  }

  // Bulk resolve against catalog
  const resolution = await bulkResolveLaborCategories(supabase, {
    tenantId,
    roleTitles: roleTitlesArray,
  })

  // Build resolution info array
  const roles: CatalogResolutionInfo[] = []
  let exactMatches = 0
  let aliasMatches = 0
  let fuzzyMatches = 0
  let unmappedCount = 0

  for (const roleTitle of roleTitlesArray) {
    const match = resolution.matches.get(roleTitle) as LaborCategoryMatch | undefined

    const info: CatalogResolutionInfo = {
      roleTitle,
      matchType: match?.matchType ?? 'unmapped',
      confidence: match?.confidence ?? 0,
      categoryId: match?.categoryId ?? null,
      categoryKey: match?.category?.key ?? null,
      aliasUsed: match?.aliasUsed,
      contextNote: match?.contextNote,
    }

    roles.push(info)

    switch (info.matchType) {
      case 'exact': exactMatches++; break
      case 'alias': aliasMatches++; break
      case 'fuzzy': fuzzyMatches++; break
      case 'unmapped': unmappedCount++; break
    }
  }

  return {
    totalRoles: roleTitlesArray.length,
    exactMatches,
    aliasMatches,
    fuzzyMatches,
    unmappedCount,
    roles,
  }
}

/**
 * Format validation violations for error message
 */
export function formatValidationErrors(validation: ValidationResult): string {
  if (validation.valid) {
    return 'Validation passed'
  }

  const lines = ['WBS candidate validation failed:']
  for (const v of validation.violations) {
    lines.push(`  - [${v.type}] Task ${v.taskWbsCode} "${v.taskTitle}"${v.roleTitle ? ` / ${v.roleTitle}` : ''}: ${v.details}`)
  }
  return lines.join('\n')
}
