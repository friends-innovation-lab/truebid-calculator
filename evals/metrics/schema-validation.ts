/**
 * Schema Validation Metrics
 *
 * Measures whether AI outputs pass schema validation.
 */

export interface SchemaValidationMetrics {
  passed: boolean
  errors: string[]
  repairAttempted: boolean
  repairSucceeded: boolean
}

interface ExpectedJson {
  intelligence: {
    contractType: { expected: string; required: boolean }
    vehicle: { expected: string | null; required: boolean }
    setAside: { expected: string | null; required: boolean }
    periods: {
      count: number
      details: Array<{ name: string; months: number }>
    }
    disciplines: {
      expected: string[]
      forbidden: string[]
    }
    laborRequirements: {
      count: number
      titles: string[]
    }
  }
}

/**
 * Validate that extracted data matches expected schema structure.
 *
 * In the real eval, this would validate actual AI output against Zod schemas.
 * For baseline, we validate the expected.json structure itself.
 */
export function computeSchemaValidation(data: ExpectedJson): SchemaValidationMetrics {
  const errors: string[] = []

  // Validate required fields
  if (!data.intelligence) {
    errors.push('Missing intelligence field')
  }

  if (!data.intelligence?.contractType?.expected) {
    errors.push('Missing contractType.expected')
  }

  if (typeof data.intelligence?.periods?.count !== 'number') {
    errors.push('periods.count must be a number')
  }

  if (!Array.isArray(data.intelligence?.disciplines?.expected)) {
    errors.push('disciplines.expected must be an array')
  }

  if (!Array.isArray(data.intelligence?.laborRequirements?.titles)) {
    errors.push('laborRequirements.titles must be an array')
  }

  return {
    passed: errors.length === 0,
    errors,
    repairAttempted: false,
    repairSucceeded: false,
  }
}

/**
 * Validate WBS generation output against schema.
 */
export interface WbsSchemaValidationMetrics extends SchemaValidationMetrics {
  taskCount: number
  invalidTasks: number
}

export function computeWbsSchemaValidation(
  tasks: Array<{
    ref?: string
    name?: string
    tasks?: unknown[]
  }>
): WbsSchemaValidationMetrics {
  const errors: string[] = []
  let invalidTasks = 0

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]

    if (!task.ref) {
      errors.push(`Task ${i}: missing ref`)
      invalidTasks++
    }

    if (!task.name) {
      errors.push(`Task ${i}: missing name`)
      invalidTasks++
    }

    if (!Array.isArray(task.tasks)) {
      errors.push(`Task ${i}: tasks must be an array`)
      invalidTasks++
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    repairAttempted: false,
    repairSucceeded: false,
    taskCount: tasks.length,
    invalidTasks,
  }
}
