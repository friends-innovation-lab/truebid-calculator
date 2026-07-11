/**
 * Extraction Metrics
 *
 * Computes precision, recall, and F1 for extracted intelligence fields.
 */

export interface FieldScore {
  precision: number
  recall: number
  f1: number
}

export interface ExtractionMetrics {
  fieldScores: Record<string, FieldScore>
  overall: {
    precision: number
    recall: number
    f1: number
  }
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
 * Compute extraction metrics by comparing actual vs expected.
 */
export function computeExtractionMetrics(
  actual: ExpectedJson,
  expected: ExpectedJson
): ExtractionMetrics {
  const fieldScores: Record<string, FieldScore> = {}

  // Contract Type (exact match)
  fieldScores['contractType'] = computeExactMatch(
    actual.intelligence.contractType.expected,
    expected.intelligence.contractType.expected
  )

  // Vehicle (exact match, nullable)
  fieldScores['vehicle'] = computeExactMatch(
    actual.intelligence.vehicle.expected,
    expected.intelligence.vehicle.expected
  )

  // Set-Aside (exact match, nullable)
  fieldScores['setAside'] = computeExactMatch(
    actual.intelligence.setAside.expected,
    expected.intelligence.setAside.expected
  )

  // Periods (count match)
  fieldScores['periods'] = computeCountMatch(
    actual.intelligence.periods.count,
    expected.intelligence.periods.count
  )

  // Disciplines (set overlap)
  fieldScores['disciplines'] = computeSetOverlap(
    actual.intelligence.disciplines.expected,
    expected.intelligence.disciplines.expected
  )

  // Labor Requirements (set overlap by title)
  fieldScores['laborRequirements'] = computeSetOverlap(
    actual.intelligence.laborRequirements.titles,
    expected.intelligence.laborRequirements.titles
  )

  // Compute overall
  const scores = Object.values(fieldScores)
  const avgPrecision = scores.reduce((sum, s) => sum + s.precision, 0) / scores.length
  const avgRecall = scores.reduce((sum, s) => sum + s.recall, 0) / scores.length
  const avgF1 = scores.reduce((sum, s) => sum + s.f1, 0) / scores.length

  return {
    fieldScores,
    overall: {
      precision: avgPrecision,
      recall: avgRecall,
      f1: avgF1,
    },
  }
}

function computeExactMatch(actual: string | null, expected: string | null): FieldScore {
  if (actual === expected) {
    return { precision: 1, recall: 1, f1: 1 }
  }

  // If expected is null and actual is not, precision is 0 (false positive)
  // If expected is not null and actual is null, recall is 0 (false negative)
  if (expected === null && actual !== null) {
    return { precision: 0, recall: 1, f1: 0 }
  }
  if (expected !== null && actual === null) {
    return { precision: 1, recall: 0, f1: 0 }
  }

  return { precision: 0, recall: 0, f1: 0 }
}

function computeCountMatch(actual: number, expected: number): FieldScore {
  if (actual === expected) {
    return { precision: 1, recall: 1, f1: 1 }
  }

  // Partial credit based on how close
  const ratio = Math.min(actual, expected) / Math.max(actual, expected)
  return { precision: ratio, recall: ratio, f1: ratio }
}

function computeSetOverlap(actual: string[], expected: string[]): FieldScore {
  const actualSet = new Set(actual.map(s => s.toLowerCase()))
  const expectedSet = new Set(expected.map(s => s.toLowerCase()))

  let truePositives = 0
  for (const item of actualSet) {
    if (expectedSet.has(item)) {
      truePositives++
    }
  }

  const precision = actualSet.size > 0 ? truePositives / actualSet.size : 1
  const recall = expectedSet.size > 0 ? truePositives / expectedSet.size : 1
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

  return { precision, recall, f1 }
}
