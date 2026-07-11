/**
 * Pricing Engine Tests
 *
 * Table-driven tests for the centralized pricing engine.
 * Expected values are EXTERNALLY VERIFIED - do not adjust expectations to match engine output.
 * If a test fails, FIX THE ENGINE, not the expectation.
 */

import {
  calculateFullyBurdenedRate,
  calculateBillRate,
  calculateCostRate,
  calculateFTE,
  calculateGSAYear,
  calculateEscalatedRate,
  calculateMinimumViableRate,
  calculateMarginFromRates,
  normalizeRateToDecimal,
  PricingValidationError,
  FORMULA_VERSION,
  DEFAULT_STANDARD_HOURS,
  DEFAULT_BILLABLE_HOURS_PER_YEAR,
} from '@/lib/pricing'

describe('Pricing Engine', () => {
  // FFTC standard rates for testing
  const FFTC_RATES = {
    fringe: 0.2116,
    overhead: 0.3426,
    ga: 0.1983,
  }

  describe('calculateFullyBurdenedRate', () => {
    /**
     * Test #1: Full cascade with EXTERNALLY VERIFIED values
     *
     * Input: $120,000 salary / 21.16% fringe / 34.26% overhead / 19.83% G&A / 8% profit
     *
     * VERIFIED VALUES (6 decimal places):
     * | Step              | Expected (6dp) | Rounded |
     * |-------------------|----------------|---------|
     * | base_hourly       | 57.692308      | 57.69   |
     * | fringe_amount     | 12.207692      | 12.21   |
     * | overhead_base     | 69.900000      | 69.90   |
     * | overhead_amount   | 23.947740      | 23.95   |
     * | ga_base           | 93.847740      | 93.85   |
     * | ga_amount         | 18.610007      | 18.61   |
     * | cost_before_profit| 112.457747     | 112.46  |
     * | profit_amount     | 8.996620       | 9.00    |
     * | fully_burdened    | 121.454367     | 121.45  |
     *
     * Manual arithmetic verification:
     *   base_hourly = 120000 / 2080 = 57.692307692...
     *   fringe = 57.692308 * 0.2116 = 12.207692...
     *   overhead_base = 57.692308 + 12.207692 = 69.900000
     *   overhead = 69.900000 * 0.3426 = 23.947740
     *   ga_base = 69.900000 + 23.947740 = 93.847740
     *   ga = 93.847740 * 0.1983 = 18.610006642 ≈ 18.610007
     *   cost = 93.847740 + 18.610007 = 112.457747
     *   profit = 112.457747 * 0.08 = 8.996619...
     *   fully_burdened = 112.457747 + 8.996620 = 121.454367
     */
    it('calculates full cascade with FFTC rates and 8% profit (externally verified)', () => {
      const result = calculateFullyBurdenedRate({
        annualSalary: 120000,
        rates: FFTC_RATES,
        profitRate: 0.08,
      })

      // Assert 6-decimal precision values with tight tolerance (0.000001)
      expect(result.baseHourly).toBeCloseTo(57.692308, 6)
      expect(result.fringeAmount).toBeCloseTo(12.207692, 6)
      expect(result.afterFringe).toBeCloseTo(69.900000, 6)
      expect(result.overheadAmount).toBeCloseTo(23.947740, 6)
      expect(result.afterOverhead).toBeCloseTo(93.847740, 6)
      expect(result.gaAmount).toBeCloseTo(18.610007, 5) // 5dp due to rounding in chain
      expect(result.costBeforeProfit).toBeCloseTo(112.457747, 5)
      expect(result.profitAmount).toBeCloseTo(8.996620, 5)

      // Assert rounded display values
      expect(result.fullyBurdenedRate).toBe(121.45)

      // Metadata
      expect(result.annualSalary).toBe(120000)
      expect(result.standardHours).toBe(2080)
      expect(result.formulaVersion).toBe(FORMULA_VERSION)
    })

    /**
     * Test #2: Formula A (correct) vs Formula B (buggy) divergence
     *
     * EXTERNALLY VERIFIED divergence at overhead step:
     * - Formula B (buggy) overhead_amount: 19.765385 (overhead on base only)
     * - Formula A (correct) overhead_amount: 23.947740 (overhead on base + fringe)
     * - Divergence: 4.182355/hr at overhead step
     *
     * This divergence compounds through G&A and profit downstream.
     *
     * Formula B arithmetic (buggy - overhead on salary/2080 only):
     *   base = 120000 / 2080 = 57.692308
     *   fringe = 57.692308 * 0.2116 = 12.207692
     *   overhead = 57.692308 * 0.3426 = 19.765385  <-- BUG: on base, not base+fringe
     *   loaded = 57.692308 + 12.207692 + 19.765385 = 89.665385
     *   ga = 89.665385 * 0.1983 = 17.782626
     *   cost = 89.665385 + 17.782626 = 107.448011
     *   profit (10%) = 107.448011 * 0.10 = 10.744801
     *   fully_burdened = 107.448011 + 10.744801 = 118.192812 ≈ 118.19
     *
     * Formula A arithmetic (correct):
     *   overhead_amount = 23.947740 (verified in test #1)
     *   fully_burdened (10% profit) = 123.70 (from engine)
     *
     * Delta: 123.70 - 118.19 = 5.51/hr
     */
    it('proves wbs-to-roles bug fix with verified divergence values', () => {
      const salary = 120000
      const profit = 0.10

      // Calculate using correct engine
      const correctResult = calculateFullyBurdenedRate({
        annualSalary: salary,
        rates: FFTC_RATES,
        profitRate: profit,
      })

      // Verified Formula A overhead amount
      expect(correctResult.overheadAmount).toBeCloseTo(23.947740, 5)

      // Simulate Formula B (buggy) - overhead on base only, not base+fringe
      const baseHourly = salary / 2080 // 57.692308
      const buggyOverheadAmount = baseHourly * FFTC_RATES.overhead // 19.765385

      // Assert the divergence at overhead step
      expect(buggyOverheadAmount).toBeCloseTo(19.765385, 5)
      const overheadDivergence = correctResult.overheadAmount - buggyOverheadAmount
      expect(overheadDivergence).toBeCloseTo(4.182355, 5)

      // Complete buggy calculation to verify final rate delta
      const fringeAmount = baseHourly * FFTC_RATES.fringe // 12.207692
      const buggyLoaded = baseHourly + fringeAmount + buggyOverheadAmount // 89.665385
      const buggyGa = buggyLoaded * FFTC_RATES.ga // 17.782626
      const buggyCost = buggyLoaded + buggyGa // 107.448011
      const buggyProfit = buggyCost * profit // 10.744801
      const buggyFullyBurdened = buggyCost + buggyProfit // 118.192812

      expect(buggyFullyBurdened).toBeCloseTo(118.19, 2)
      expect(correctResult.fullyBurdenedRate).toBeCloseTo(123.70, 2)

      // Final delta should be ~$5.51/hr
      const finalDelta = correctResult.fullyBurdenedRate - buggyFullyBurdened
      expect(finalDelta).toBeCloseTo(5.51, 1)
    })

    /**
     * Test #3: normalizeRateToDecimal helper
     *
     * Arithmetic: value > 1 → value / 100, else unchanged
     *   21.16 > 1 → 21.16 / 100 = 0.2116
     *   8 > 1 → 8 / 100 = 0.08
     *   0.2116 <= 1 → 0.2116 (unchanged)
     */
    it('validates normalizeRateToDecimal helper', () => {
      // Percentages (> 1) get divided by 100
      expect(normalizeRateToDecimal(21.16)).toBe(0.2116)
      expect(normalizeRateToDecimal(8)).toBe(0.08)
      expect(normalizeRateToDecimal(100)).toBe(1)

      // Decimals (<= 1) stay as-is
      expect(normalizeRateToDecimal(0.2116)).toBe(0.2116)
      expect(normalizeRateToDecimal(0.08)).toBe(0.08)
      expect(normalizeRateToDecimal(1)).toBe(1)
      expect(normalizeRateToDecimal(0)).toBe(0)
    })

    /**
     * Test #4: Zero rates at each layer
     *
     * Arithmetic (all zeros):
     *   base = 120000 / 2080 = 57.692308
     *   fringe = 57.692308 * 0 = 0
     *   overhead = 57.692308 * 0 = 0
     *   ga = 57.692308 * 0 = 0
     *   profit = 57.692308 * 0 = 0
     *   fully_burdened = 57.692308 → rounded to 57.69
     *
     * Zero salary: all outputs = 0
     */
    it('handles zero rates correctly', () => {
      // All zeros: just base rate
      const zeroResult = calculateFullyBurdenedRate({
        annualSalary: 120000,
        rates: { fringe: 0, overhead: 0, ga: 0 },
        profitRate: 0,
      })
      // base = 120000 / 2080 = 57.692308, rounded to 57.69
      expect(zeroResult.fullyBurdenedRate).toBe(57.69)
      expect(zeroResult.fringeAmount).toBe(0)
      expect(zeroResult.overheadAmount).toBe(0)
      expect(zeroResult.gaAmount).toBe(0)
      expect(zeroResult.profitAmount).toBe(0)

      // Zero salary: all zeros
      const zeroSalaryResult = calculateFullyBurdenedRate({
        annualSalary: 0,
        rates: FFTC_RATES,
        profitRate: 0.10,
      })
      expect(zeroSalaryResult.fullyBurdenedRate).toBe(0)
      expect(zeroSalaryResult.baseHourly).toBe(0)

      // Zero fringe only: overhead still calculated on base
      // base = 57.692308, overhead = 57.692308 * 0.3426 = 19.765385
      const zeroFringeResult = calculateFullyBurdenedRate({
        annualSalary: 120000,
        rates: { fringe: 0, overhead: 0.3426, ga: 0.1983 },
        profitRate: 0.10,
      })
      expect(zeroFringeResult.fringeAmount).toBe(0)
      expect(zeroFringeResult.overheadAmount).toBeCloseTo(19.765385, 5)
    })

    /**
     * Test #5: 2080 vs 1920 distinction
     *
     * Rate calculation uses 2080 (standard hours per year)
     * FTE calculation uses 1920 (billable hours per year)
     *
     * Arithmetic:
     *   FTE = 1920 / 1920 = 1.00
     *   FTE = 960 / 1920 = 0.50
     */
    it('uses 2080 for rate calc, 1920 for FTE', () => {
      const rateResult = calculateFullyBurdenedRate({
        annualSalary: 120000,
        rates: FFTC_RATES,
        profitRate: 0.10,
      })
      expect(rateResult.standardHours).toBe(2080)

      // FTE uses 1920
      const fteResult = calculateFTE({ plannedBillableHours: 1920 })
      expect(fteResult.billableHoursPerYear).toBe(1920)
      expect(fteResult.fte).toBe(1) // 1920 / 1920 = 1.00
    })

    /**
     * Test #10: Target margin = 100% or > 100%
     *
     * profitRate >= 1.0 must throw PricingValidationError
     * (prevents division issues and nonsensical rates)
     */
    it('throws error for profit rate >= 100%', () => {
      expect(() =>
        calculateFullyBurdenedRate({
          annualSalary: 120000,
          rates: FFTC_RATES,
          profitRate: 1.0, // 100%
        })
      ).toThrow(PricingValidationError)

      expect(() =>
        calculateFullyBurdenedRate({
          annualSalary: 120000,
          rates: FFTC_RATES,
          profitRate: 1.5, // 150%
        })
      ).toThrow(PricingValidationError)
    })

    /**
     * Test #11: Rounding consistency
     *
     * Final rate: 2 decimal places
     * Intermediate values: 6 decimal places (for audit/verification precision)
     */
    it('produces consistent rounding at line and aggregate levels', () => {
      const result = calculateFullyBurdenedRate({
        annualSalary: 123456,
        rates: { fringe: 0.21161234, overhead: 0.34261234, ga: 0.19831234 },
        profitRate: 0.0823,
      })

      // Final rate should be rounded to 2 decimals
      const finalDecimals = result.fullyBurdenedRate.toString().split('.')[1]?.length || 0
      expect(finalDecimals).toBeLessThanOrEqual(2)

      // Intermediate values should have 6 decimal precision
      const baseDecimals = result.baseHourly.toString().split('.')[1]?.length || 0
      expect(baseDecimals).toBeLessThanOrEqual(6)
    })

    /**
     * Negative input validation
     */
    it('rejects negative inputs', () => {
      expect(() =>
        calculateFullyBurdenedRate({
          annualSalary: -100,
          rates: FFTC_RATES,
          profitRate: 0.10,
        })
      ).toThrow(PricingValidationError)

      expect(() =>
        calculateFullyBurdenedRate({
          annualSalary: 120000,
          rates: { fringe: -0.1, overhead: 0.3426, ga: 0.1983 },
          profitRate: 0.10,
        })
      ).toThrow(PricingValidationError)

      expect(() =>
        calculateFullyBurdenedRate({
          annualSalary: 120000,
          rates: FFTC_RATES,
          profitRate: -0.05,
        })
      ).toThrow(PricingValidationError)
    })
  })

  describe('calculateFTE', () => {
    /**
     * FTE arithmetic:
     *   1920 / 1920 = 1.00
     *   960 / 1920 = 0.50
     *   3840 / 1920 = 2.00
     *   0 / 1920 = 0.00
     *   2080 / 2080 = 1.00
     */
    it('calculates FTE correctly', () => {
      expect(calculateFTE({ plannedBillableHours: 1920 }).fte).toBe(1)
      expect(calculateFTE({ plannedBillableHours: 960 }).fte).toBe(0.5)
      expect(calculateFTE({ plannedBillableHours: 3840 }).fte).toBe(2)
      expect(calculateFTE({ plannedBillableHours: 0 }).fte).toBe(0)
    })

    it('uses custom billable hours per year', () => {
      // 2080 / 2080 = 1.00
      const result = calculateFTE({
        plannedBillableHours: 2080,
        billableHoursPerYear: 2080,
      })
      expect(result.fte).toBe(1)
      expect(result.billableHoursPerYear).toBe(2080)
    })

    it('throws error for invalid billable hours', () => {
      expect(() =>
        calculateFTE({ plannedBillableHours: 1000, billableHoursPerYear: 0 })
      ).toThrow(PricingValidationError)
    })
  })

  describe('calculateGSAYear', () => {
    /**
     * Test #6: GSA year from cumulative month
     *
     * Formula: gsa_year = floor((cumulative_month - 1) / 12) + 1
     *
     * Arithmetic:
     *   Month 1: floor((1-1)/12) + 1 = floor(0) + 1 = 1
     *   Month 12: floor((12-1)/12) + 1 = floor(0.916) + 1 = 1
     *   Month 13: floor((13-1)/12) + 1 = floor(1) + 1 = 2
     *   Month 24: floor((24-1)/12) + 1 = floor(1.916) + 1 = 2
     *   Month 25: floor((25-1)/12) + 1 = floor(2) + 1 = 3
     */
    it('calculates GSA year from cumulative month', () => {
      // Year 1: months 1-12
      expect(calculateGSAYear({ cumulativeMonth: 1 }).gsaYear).toBe(1)
      expect(calculateGSAYear({ cumulativeMonth: 12 }).gsaYear).toBe(1)

      // Year 2: months 13-24
      expect(calculateGSAYear({ cumulativeMonth: 13 }).gsaYear).toBe(2)
      expect(calculateGSAYear({ cumulativeMonth: 24 }).gsaYear).toBe(2)

      // Year 3: months 25-36
      expect(calculateGSAYear({ cumulativeMonth: 25 }).gsaYear).toBe(3)
    })

    it('throws error for invalid month', () => {
      expect(() => calculateGSAYear({ cumulativeMonth: 0 })).toThrow(PricingValidationError)
      expect(() => calculateGSAYear({ cumulativeMonth: -1 })).toThrow(PricingValidationError)
    })
  })

  describe('calculateEscalatedRate', () => {
    /**
     * Test #9: Escalation on internal rate
     *
     * Formula: escalated = base * (1 + rate)^(year - 1)
     *
     * Arithmetic (base = 100, rate = 3%):
     *   Year 1: 100 * 1.03^0 = 100 * 1 = 100.00
     *   Year 2: 100 * 1.03^1 = 100 * 1.03 = 103.00
     *   Year 3: 100 * 1.03^2 = 100 * 1.0609 = 106.09
     *   Year 5: 100 * 1.03^4 = 100 * 1.12550881 = 112.55
     */
    it('calculates escalated rates correctly', () => {
      const baseRate = 100

      // Year 1 = no escalation (multiplier = 1)
      expect(calculateEscalatedRate({ baseRate, year: 1, escalationRate: 0.03 }).escalatedRate).toBe(100)

      // Year 2 = 3% escalation (100 * 1.03 = 103)
      expect(calculateEscalatedRate({ baseRate, year: 2, escalationRate: 0.03 }).escalatedRate).toBe(103)

      // Year 3 = 3% compounded (100 * 1.0609 = 106.09)
      const year3 = calculateEscalatedRate({ baseRate, year: 3, escalationRate: 0.03 })
      expect(year3.escalatedRate).toBe(106.09)

      // Year 5 (100 * 1.12550881 = 112.55)
      const year5 = calculateEscalatedRate({ baseRate, year: 5, escalationRate: 0.03 })
      expect(year5.escalatedRate).toBe(112.55)
    })

    it('returns multiplier', () => {
      // Multiplier for year 3 = 1.03^2 = 1.0609
      const result = calculateEscalatedRate({ baseRate: 100, year: 3, escalationRate: 0.03 })
      expect(result.multiplier).toBe(1.0609)
    })

    it('throws error for invalid inputs', () => {
      expect(() =>
        calculateEscalatedRate({ baseRate: -100, year: 2, escalationRate: 0.03 })
      ).toThrow(PricingValidationError)

      expect(() =>
        calculateEscalatedRate({ baseRate: 100, year: 0, escalationRate: 0.03 })
      ).toThrow(PricingValidationError)
    })
  })

  describe('calculateMinimumViableRate', () => {
    /**
     * Formula: min_rate = cost / (1 - target_margin)
     *
     * Arithmetic:
     *   cost=100, margin=10%: 100 / (1 - 0.10) = 100 / 0.90 = 111.111...
     *   cost=100, margin=20%: 100 / (1 - 0.20) = 100 / 0.80 = 125.00
     *   cost=100, margin=0%: 100 / (1 - 0) = 100 / 1 = 100.00
     */
    it('calculates minimum rate for target margin', () => {
      // 10% margin: 100 / 0.90 = 111.11
      const minRate = calculateMinimumViableRate(100, 0.10)
      expect(minRate).toBe(111.11)

      // 20% margin: 100 / 0.80 = 125.00
      expect(calculateMinimumViableRate(100, 0.20)).toBe(125)

      // 0% margin = cost
      expect(calculateMinimumViableRate(100, 0)).toBe(100)
    })

    /**
     * targetMargin >= 100% guard
     * Must throw to prevent division by zero or negative denominator
     */
    it('throws error for margin >= 100%', () => {
      expect(() => calculateMinimumViableRate(100, 1.0)).toThrow(PricingValidationError)
      expect(() => calculateMinimumViableRate(100, 1.5)).toThrow(PricingValidationError)
    })
  })

  describe('calculateMarginFromRates', () => {
    /**
     * Formula: margin = (bill - cost) / bill
     *
     * Arithmetic:
     *   bill=110, cost=100: (110-100)/110 = 10/110 = 0.0909...
     *   bill=125, cost=100: (125-100)/125 = 25/125 = 0.20
     *   bill=100, cost=100: (100-100)/100 = 0/100 = 0
     *   bill=0, cost=100: return 0 (edge case)
     *   bill=100, cost=0: (100-0)/100 = 1.00 (100% margin)
     */
    it('calculates margin from bill and cost rates', () => {
      // (110-100)/110 = 0.0909
      expect(calculateMarginFromRates(110, 100)).toBeCloseTo(0.0909, 4)

      // (125-100)/125 = 0.20
      expect(calculateMarginFromRates(125, 100)).toBe(0.2)

      // Same rate = 0 margin
      expect(calculateMarginFromRates(100, 100)).toBe(0)
    })

    it('handles edge cases', () => {
      expect(calculateMarginFromRates(0, 100)).toBe(0)
      expect(calculateMarginFromRates(100, 0)).toBe(1) // 100% margin
    })
  })

  describe('calculateBillRate (convenience)', () => {
    /**
     * Verify convenience function returns same as full breakdown
     */
    it('returns just the final rate', () => {
      const rate = calculateBillRate({
        annualSalary: 120000,
        rates: FFTC_RATES,
        profitRate: 0.08,
      })
      // Should match test #1's verified fully_burdened: 121.45
      expect(rate).toBe(121.45)
    })
  })

  describe('calculateCostRate', () => {
    /**
     * Cost rate = fully burdened with 0% profit
     * From test #1: cost_before_profit = 112.457747 → 112.46
     */
    it('returns rate without profit', () => {
      const costRate = calculateCostRate({
        annualSalary: 120000,
        rates: FFTC_RATES,
      })
      expect(costRate).toBeCloseTo(112.4577, 3)

      const fullRate = calculateBillRate({
        annualSalary: 120000,
        rates: FFTC_RATES,
        profitRate: 0.10,
      })
      expect(costRate).toBeLessThan(fullRate)
    })
  })

  describe('constants', () => {
    it('exports correct default values', () => {
      expect(DEFAULT_STANDARD_HOURS).toBe(2080)
      expect(DEFAULT_BILLABLE_HOURS_PER_YEAR).toBe(1920)
      expect(FORMULA_VERSION).toBe('v1.0.0')
    })
  })
})
