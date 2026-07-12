/**
 * Phase 5: Catalog Mapping Accuracy Metrics
 *
 * Evaluates the accuracy of role title to labor catalog matching.
 * Key test: HCD Lead umbrella alias resolution.
 */

export interface CatalogMatchExpectation {
  expectedMatchType: 'exact' | 'alias' | 'fuzzy' | 'unmapped'
  expectedCategoryKey: string
  aliasUsed?: string
  note?: string
}

export interface CatalogMappingResult {
  title: string
  matchType: string | null
  categoryId: string | null
  confidence: number | null
}

export interface CatalogMappingMetrics {
  totalRoles: number
  exactMatches: number
  aliasMatches: number
  fuzzyMatches: number
  unmapped: number
  expectedMatchesCorrect: number
  expectedMatchesTotal: number
  matchAccuracy: number
  details: Array<{
    title: string
    actualMatchType: string | null
    expectedMatchType: string
    expectedCategoryKey: string
    correct: boolean
    note?: string
  }>
}

/**
 * Compute catalog mapping accuracy metrics.
 *
 * @param actual - Array of labor requirements with catalog match data from extraction
 * @param expected - Map of role titles to expected catalog matches from expected.json
 */
export function computeCatalogMappingMetrics(
  actual: CatalogMappingResult[],
  expected: Record<string, CatalogMatchExpectation> | undefined
): CatalogMappingMetrics {
  const metrics: CatalogMappingMetrics = {
    totalRoles: actual.length,
    exactMatches: 0,
    aliasMatches: 0,
    fuzzyMatches: 0,
    unmapped: 0,
    expectedMatchesCorrect: 0,
    expectedMatchesTotal: 0,
    matchAccuracy: 0,
    details: [],
  }

  // Count match types
  for (const role of actual) {
    switch (role.matchType) {
      case 'exact': metrics.exactMatches++; break
      case 'alias': metrics.aliasMatches++; break
      case 'fuzzy': metrics.fuzzyMatches++; break
      case 'unmapped':
      case null:
        metrics.unmapped++; break
    }
  }

  // If we have expected matches, compute accuracy
  if (expected && Object.keys(expected).length > 0) {
    metrics.expectedMatchesTotal = Object.keys(expected).length

    for (const [title, expectation] of Object.entries(expected)) {
      const actualRole = actual.find(r =>
        r.title.toLowerCase() === title.toLowerCase() ||
        r.title.toLowerCase().includes(title.toLowerCase()) ||
        title.toLowerCase().includes(r.title.toLowerCase())
      )

      const actualMatchType = actualRole?.matchType ?? null

      // Match type must be correct for this to count
      // For alias matches, we accept exact or alias (both are good)
      const isCorrect =
        actualMatchType === expectation.expectedMatchType ||
        (expectation.expectedMatchType === 'alias' && actualMatchType === 'exact') ||
        (expectation.expectedMatchType === 'fuzzy' && (actualMatchType === 'exact' || actualMatchType === 'alias'))

      if (isCorrect) {
        metrics.expectedMatchesCorrect++
      }

      metrics.details.push({
        title,
        actualMatchType,
        expectedMatchType: expectation.expectedMatchType,
        expectedCategoryKey: expectation.expectedCategoryKey,
        correct: isCorrect,
        note: expectation.note,
      })
    }

    metrics.matchAccuracy = metrics.expectedMatchesTotal > 0
      ? metrics.expectedMatchesCorrect / metrics.expectedMatchesTotal
      : 0
  }

  return metrics
}

/**
 * Format catalog mapping metrics for console output.
 */
export function formatCatalogMappingMetrics(metrics: CatalogMappingMetrics): string {
  const lines: string[] = []

  lines.push(`Total roles: ${metrics.totalRoles}`)
  lines.push(`  Exact: ${metrics.exactMatches}`)
  lines.push(`  Alias: ${metrics.aliasMatches}`)
  lines.push(`  Fuzzy: ${metrics.fuzzyMatches}`)
  lines.push(`  Unmapped: ${metrics.unmapped}`)

  if (metrics.expectedMatchesTotal > 0) {
    lines.push('')
    lines.push(`Match Accuracy: ${metrics.expectedMatchesCorrect}/${metrics.expectedMatchesTotal} (${(metrics.matchAccuracy * 100).toFixed(0)}%)`)
    lines.push('')
    lines.push('Expected Match Details:')
    for (const detail of metrics.details) {
      const status = detail.correct ? '✓' : '✗'
      lines.push(`  ${status} "${detail.title}"`)
      lines.push(`      Expected: ${detail.expectedMatchType} → ${detail.expectedCategoryKey}`)
      lines.push(`      Actual: ${detail.actualMatchType ?? 'not resolved'}`)
      if (detail.note) {
        lines.push(`      Note: ${detail.note}`)
      }
    }
  }

  return lines.join('\n')
}
