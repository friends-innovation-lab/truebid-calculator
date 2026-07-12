/**
 * Catalog Mapping Metrics Unit Tests
 *
 * Tests the catalog mapping accuracy metrics computation,
 * including HCD Lead umbrella alias resolution.
 */

import {
  computeCatalogMappingMetrics,
  formatCatalogMappingMetrics,
  type CatalogMappingResult,
  type CatalogMatchExpectation,
} from '@/evals/metrics/catalog-mapping'

describe('Catalog Mapping Metrics', () => {
  describe('computeCatalogMappingMetrics', () => {
    it('counts match types correctly', () => {
      const actual: CatalogMappingResult[] = [
        { title: 'Product Manager', matchType: 'exact', categoryId: 'cat-1', confidence: 1.0 },
        { title: 'HCD Lead', matchType: 'alias', categoryId: 'cat-2', confidence: 0.95 },
        { title: 'Technical Lead', matchType: 'fuzzy', categoryId: 'cat-3', confidence: 0.70 },
        { title: 'DoS SME', matchType: 'unmapped', categoryId: null, confidence: 0 },
        { title: 'Training Specialist', matchType: null, categoryId: null, confidence: null },
      ]

      const metrics = computeCatalogMappingMetrics(actual, undefined)

      expect(metrics.totalRoles).toBe(5)
      expect(metrics.exactMatches).toBe(1)
      expect(metrics.aliasMatches).toBe(1)
      expect(metrics.fuzzyMatches).toBe(1)
      expect(metrics.unmapped).toBe(2) // 'unmapped' + null
    })

    it('computes accuracy against expected matches', () => {
      const actual: CatalogMappingResult[] = [
        { title: 'Product Manager', matchType: 'exact', categoryId: 'cat-1', confidence: 1.0 },
        { title: 'Human-Centered Design Lead', matchType: 'alias', categoryId: 'cat-2', confidence: 0.95 },
        { title: 'UX Researcher', matchType: 'exact', categoryId: 'cat-3', confidence: 1.0 },
      ]

      const expected: Record<string, CatalogMatchExpectation> = {
        'Product Manager': {
          expectedMatchType: 'exact',
          expectedCategoryKey: 'product_manager',
        },
        'Human-Centered Design Lead': {
          expectedMatchType: 'alias',
          expectedCategoryKey: 'ux_researcher',
          aliasUsed: 'HCD Lead',
        },
        'UX Researcher': {
          expectedMatchType: 'exact',
          expectedCategoryKey: 'ux_researcher',
        },
      }

      const metrics = computeCatalogMappingMetrics(actual, expected)

      expect(metrics.expectedMatchesTotal).toBe(3)
      expect(metrics.expectedMatchesCorrect).toBe(3)
      expect(metrics.matchAccuracy).toBe(1.0)
    })

    it('accepts exact match when alias expected (stricter is acceptable)', () => {
      const actual: CatalogMappingResult[] = [
        { title: 'HCD Lead', matchType: 'exact', categoryId: 'cat-1', confidence: 1.0 },
      ]

      const expected: Record<string, CatalogMatchExpectation> = {
        'HCD Lead': {
          expectedMatchType: 'alias',
          expectedCategoryKey: 'ux_researcher',
        },
      }

      const metrics = computeCatalogMappingMetrics(actual, expected)

      expect(metrics.expectedMatchesCorrect).toBe(1)
      expect(metrics.matchAccuracy).toBe(1.0)
    })

    it('detects incorrect matches', () => {
      const actual: CatalogMappingResult[] = [
        { title: 'Product Manager', matchType: 'unmapped', categoryId: null, confidence: 0 },
      ]

      const expected: Record<string, CatalogMatchExpectation> = {
        'Product Manager': {
          expectedMatchType: 'exact',
          expectedCategoryKey: 'product_manager',
        },
      }

      const metrics = computeCatalogMappingMetrics(actual, expected)

      expect(metrics.expectedMatchesCorrect).toBe(0)
      expect(metrics.matchAccuracy).toBe(0)
      expect(metrics.details[0].correct).toBe(false)
    })

    describe('HCD Lead umbrella alias resolution', () => {
      it('validates HCD Lead maps to ux_researcher via alias', () => {
        // This test validates the pm-hcd corpus expected.json expectation
        const actual: CatalogMappingResult[] = [
          {
            title: 'Human-Centered Design Lead',
            matchType: 'alias',
            categoryId: 'ux-researcher-uuid',
            confidence: 0.95,
          },
        ]

        const expected: Record<string, CatalogMatchExpectation> = {
          'Human-Centered Design Lead': {
            expectedMatchType: 'alias',
            expectedCategoryKey: 'ux_researcher',
            aliasUsed: 'HCD Lead',
            note: 'Work is user research, usability studies',
          },
        }

        const metrics = computeCatalogMappingMetrics(actual, expected)

        expect(metrics.expectedMatchesCorrect).toBe(1)
        expect(metrics.matchAccuracy).toBe(1.0)
        expect(metrics.details[0].correct).toBe(true)
        expect(metrics.details[0].actualMatchType).toBe('alias')
      })

      it('validates unmapped roles are tracked', () => {
        // DoS SME and IT Training Specialist are expected unmapped in CAMP corpus
        const actual: CatalogMappingResult[] = [
          { title: 'DoS Subject Matter Expert', matchType: 'unmapped', categoryId: null, confidence: 0 },
          { title: 'IT Training Specialist', matchType: 'unmapped', categoryId: null, confidence: 0 },
        ]

        const expected: Record<string, CatalogMatchExpectation> = {
          'DoS Subject Matter Expert': {
            expectedMatchType: 'unmapped',
            expectedCategoryKey: 'none',
            note: 'Domain SME not in standard catalog - needs tenant configuration',
          },
          'IT Training Specialist': {
            expectedMatchType: 'unmapped',
            expectedCategoryKey: 'none',
            note: 'Training role not in standard catalog - needs tenant configuration',
          },
        }

        const metrics = computeCatalogMappingMetrics(actual, expected)

        expect(metrics.unmapped).toBe(2)
        expect(metrics.expectedMatchesCorrect).toBe(2)
        expect(metrics.matchAccuracy).toBe(1.0)
      })
    })
  })

  describe('formatCatalogMappingMetrics', () => {
    it('formats metrics for console output', () => {
      const metrics = computeCatalogMappingMetrics(
        [
          { title: 'PM', matchType: 'exact', categoryId: 'cat-1', confidence: 1.0 },
          { title: 'Dev', matchType: 'alias', categoryId: 'cat-2', confidence: 0.95 },
        ],
        {
          'PM': { expectedMatchType: 'exact', expectedCategoryKey: 'product_manager' },
        }
      )

      const output = formatCatalogMappingMetrics(metrics)

      expect(output).toContain('Total roles: 2')
      expect(output).toContain('Exact: 1')
      expect(output).toContain('Alias: 1')
      expect(output).toContain('Match Accuracy: 1/1 (100%)')
      expect(output).toContain('✓ "PM"')
    })

    it('shows failure marker for incorrect matches', () => {
      const metrics = computeCatalogMappingMetrics(
        [{ title: 'Missing Role', matchType: 'unmapped', categoryId: null, confidence: 0 }],
        {
          'Missing Role': { expectedMatchType: 'exact', expectedCategoryKey: 'some_role' },
        }
      )

      const output = formatCatalogMappingMetrics(metrics)

      expect(output).toContain('✗ "Missing Role"')
    })
  })
})
