/**
 * Profit Resolver Tests
 *
 * Tests for the centralized profit rate resolution.
 */

import {
  resolveProfitRate,
  resolveProfitRateWithFallback,
  DEFAULT_PROFIT_TARGETS,
  type ProfitResolverInput,
} from '@/lib/pricing/profit-resolver'
import { PricingValidationError } from '@/lib/pricing/types'

describe('Profit Resolver', () => {
  describe('resolveProfitRate', () => {
    /**
     * Test 1: Explicit profit rate takes precedence.
     */
    it('returns explicit profit rate when provided', () => {
      const input: ProfitResolverInput = {
        explicitProfitRate: 0.15,
        contractType: 'tm',
      }

      const result = resolveProfitRate(input)

      expect(result.profitRate).toBe(0.15)
      expect(result.source).toBe('explicit')
      expect(result.contractType).toBeUndefined()
    })

    /**
     * Test 2: Falls back to contract type default when no explicit rate.
     */
    it('returns contract type default when no explicit rate', () => {
      const input: ProfitResolverInput = {
        contractType: 'tm',
      }

      const result = resolveProfitRate(input)

      expect(result.profitRate).toBe(DEFAULT_PROFIT_TARGETS.tm)
      expect(result.source).toBe('contract_default')
      expect(result.contractType).toBe('tm')
    })

    /**
     * Test 3: Uses custom profit targets when provided.
     */
    it('uses custom profit targets over defaults', () => {
      const input: ProfitResolverInput = {
        contractType: 'tm',
        profitTargets: {
          tm: 0.12, // Custom override
        },
      }

      const result = resolveProfitRate(input)

      expect(result.profitRate).toBe(0.12)
      expect(result.source).toBe('contract_default')
    })

    /**
     * Test 4: Throws error when neither explicit nor contract type provided.
     */
    it('throws error when no rate can be resolved', () => {
      const input: ProfitResolverInput = {}

      expect(() => resolveProfitRate(input)).toThrow(PricingValidationError)
    })

    /**
     * Test 5: Throws error for negative explicit rate.
     */
    it('throws error for negative explicit rate', () => {
      const input: ProfitResolverInput = {
        explicitProfitRate: -0.05,
      }

      expect(() => resolveProfitRate(input)).toThrow(PricingValidationError)
      expect(() => resolveProfitRate(input)).toThrow('cannot be negative')
    })

    /**
     * Test 6: Throws error for explicit rate >= 100%.
     */
    it('throws error for explicit rate >= 100%', () => {
      const input100: ProfitResolverInput = {
        explicitProfitRate: 1.0,
      }
      const input150: ProfitResolverInput = {
        explicitProfitRate: 1.5,
      }

      expect(() => resolveProfitRate(input100)).toThrow(PricingValidationError)
      expect(() => resolveProfitRate(input100)).toThrow('less than 100%')
      expect(() => resolveProfitRate(input150)).toThrow(PricingValidationError)
    })

    /**
     * Test 7: Explicit rate of zero is valid.
     */
    it('accepts explicit rate of zero', () => {
      const input: ProfitResolverInput = {
        explicitProfitRate: 0,
        contractType: 'tm',
      }

      const result = resolveProfitRate(input)

      expect(result.profitRate).toBe(0)
      expect(result.source).toBe('explicit')
    })

    /**
     * Test 8: All contract types have defaults.
     */
    it('resolves all contract types with defaults', () => {
      const contractTypes = ['tm', 'ffp', 'cpff', 'cpif', 'hybrid', 'gsa'] as const

      contractTypes.forEach((ct) => {
        const result = resolveProfitRate({ contractType: ct })
        expect(result.profitRate).toBe(DEFAULT_PROFIT_TARGETS[ct])
        expect(result.source).toBe('contract_default')
        expect(result.contractType).toBe(ct)
      })
    })
  })

  describe('resolveProfitRateWithFallback', () => {
    /**
     * Test 9: Returns resolved rate when resolution succeeds.
     */
    it('returns resolved rate when resolution succeeds', () => {
      const input: ProfitResolverInput = {
        contractType: 'gsa',
      }

      const result = resolveProfitRateWithFallback(input, 0.10)

      expect(result.profitRate).toBe(DEFAULT_PROFIT_TARGETS.gsa)
      expect(result.source).toBe('contract_default')
    })

    /**
     * Test 10: Returns fallback rate when resolution fails.
     */
    it('returns fallback rate when resolution fails', () => {
      const input: ProfitResolverInput = {}

      const result = resolveProfitRateWithFallback(input, 0.10)

      expect(result.profitRate).toBe(0.10)
      expect(result.source).toBe('fallback')
    })

    /**
     * Test 11: Returns fallback for invalid explicit rates.
     */
    it('returns fallback for invalid explicit rates', () => {
      const input: ProfitResolverInput = {
        explicitProfitRate: 1.5, // Invalid: >= 100%
      }

      const result = resolveProfitRateWithFallback(input, 0.08)

      expect(result.profitRate).toBe(0.08)
      expect(result.source).toBe('fallback')
    })
  })

  describe('DEFAULT_PROFIT_TARGETS', () => {
    /**
     * Test 12: Default targets match expected values.
     */
    it('has correct default values', () => {
      expect(DEFAULT_PROFIT_TARGETS.tm).toBe(0.08)    // T&M: 8%
      expect(DEFAULT_PROFIT_TARGETS.ffp).toBe(0.12)   // FFP: 12%
      expect(DEFAULT_PROFIT_TARGETS.cpff).toBe(0.08)  // CPFF: 8%
      expect(DEFAULT_PROFIT_TARGETS.cpif).toBe(0.10)  // CPIF: 10%
      expect(DEFAULT_PROFIT_TARGETS.hybrid).toBe(0.10) // Hybrid: 10%
      expect(DEFAULT_PROFIT_TARGETS.gsa).toBe(0.08)   // GSA: 8%
    })
  })
})
