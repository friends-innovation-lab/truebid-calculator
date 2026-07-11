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
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  TaskInput,
  ValidationResult,
  ValidationViolation,
} from './types'

interface IntelligenceContext {
  disciplines: string[]
  periodLabels: string[]
}

/**
 * Load intelligence context (disciplines and periods) for validation
 */
export async function loadIntelligenceContext(
  supabase: SupabaseClient,
  intelligenceVersionId: string
): Promise<IntelligenceContext> {
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

  return {
    disciplines: (disciplines || []).map(d => d.discipline),
    periodLabels: (periods || []).map(p => p.name),
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
    }
  }

  return {
    valid: violations.length === 0,
    violations,
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
