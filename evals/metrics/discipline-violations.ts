/**
 * Discipline Violation Metrics
 *
 * Measures how many roles in the raw WBS generation output
 * violate the discipline constraints (BEFORE the validator runs).
 *
 * Target: Zero violations at generation time.
 */

import { getDisciplineForRole, type Discipline } from '../../lib/ai/knowledge/disciplines'

export interface DisciplineViolationMetrics {
  rawGenerationViolations: number
  violatingRoles: string[]
  allowedDisciplines: string[]
  targetZero: boolean
}

/**
 * Count how many generated roles violate discipline constraints.
 *
 * @param allowedDisciplines - Canonical discipline IDs from confirmed intelligence
 * @param generatedRoles - Role titles from AI-generated WBS output
 */
export function computeDisciplineViolations(
  allowedDisciplines: string[],
  generatedRoles: string[]
): DisciplineViolationMetrics {
  const allowedSet = new Set(allowedDisciplines.map(d => d.toLowerCase()))
  const violatingRoles: string[] = []

  for (const role of generatedRoles) {
    const discipline = getDisciplineForRole(role)

    // If we can't determine the discipline, it's not a violation
    // (could be a valid role we don't have mapped)
    if (!discipline) continue

    // If the role's discipline is not in the allowed set, it's a violation
    if (!allowedSet.has(discipline)) {
      violatingRoles.push(role)
    }
  }

  return {
    rawGenerationViolations: violatingRoles.length,
    violatingRoles,
    allowedDisciplines,
    targetZero: violatingRoles.length === 0,
  }
}

/**
 * Check if a specific role would violate discipline constraints.
 */
export function isRoleViolation(
  roleTitle: string,
  allowedDisciplines: Discipline[]
): boolean {
  const discipline = getDisciplineForRole(roleTitle)
  if (!discipline) return false
  return !allowedDisciplines.includes(discipline)
}
