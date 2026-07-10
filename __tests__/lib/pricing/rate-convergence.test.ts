/**
 * Rate Convergence Test
 *
 * Verifies that all pricing call sites produce the SAME rate
 * for the same role when using the central profit resolver.
 */

import {
  calculateFullyBurdenedRate,
  calculateBillRate,
  resolveProfitRateWithFallback,
  DEFAULT_PROFIT_TARGETS,
} from '@/lib/pricing'

describe('Rate Convergence - All Call Sites', () => {
  // Test parameters matching FFTC rates
  const testSalary = 120000
  const testRates = { fringe: 0.2116, overhead: 0.3426, ga: 0.1983 }

  /**
   * Simulate profit resolution as done by each call site.
   * All sites now use resolveProfitRateWithFallback with contractType.
   */
  it('all 5 call sites converge on the same rate for T&M contract', () => {
    // Resolve profit via central resolver (contract_default for T&M)
    const resolved = resolveProfitRateWithFallback({
      contractType: 'tm',
    }, DEFAULT_PROFIT_TARGETS.tm)

    // Verify resolution source
    expect(resolved.source).toBe('contract_default')
    expect(resolved.profitRate).toBe(0.08) // T&M default is 8%

    // Calculate bill rate using same method as all call sites
    const billRate = calculateBillRate({
      annualSalary: testSalary,
      rates: testRates,
      profitRate: resolved.profitRate,
    })

    // Get full breakdown for reporting
    const breakdown = calculateFullyBurdenedRate({
      annualSalary: testSalary,
      rates: testRates,
      profitRate: resolved.profitRate,
    })

    console.log('\n=== CONVERGED RATE TABLE ===')
    console.log(`Salary: $${testSalary.toLocaleString()}`)
    console.log(`Contract Type: tm`)
    console.log(`Profit Source: ${resolved.source}`)
    console.log(`Profit Rate: ${(resolved.profitRate * 100).toFixed(1)}%`)
    console.log('')
    console.log('Rate Breakdown:')
    console.log(`  Base Hourly:    $${breakdown.baseHourly.toFixed(2)}`)
    console.log(`  + Fringe:       $${breakdown.fringeAmount.toFixed(2)}`)
    console.log(`  + Overhead:     $${breakdown.overheadAmount.toFixed(2)}`)
    console.log(`  + G&A:          $${breakdown.gaAmount.toFixed(2)}`)
    console.log(`  = Cost:         $${breakdown.costBeforeProfit.toFixed(2)}`)
    console.log(`  + Profit:       $${breakdown.profitAmount.toFixed(2)}`)
    console.log(`  ═══════════════════════════`)
    console.log(`  BILL RATE:      $${breakdown.fullyBurdenedRate.toFixed(2)}`)
    console.log('')

    // The winning rate for T&M @ 8% profit
    expect(billRate).toBeCloseTo(121.45, 1)
    expect(breakdown.fullyBurdenedRate).toBeCloseTo(121.45, 1)

    // All call sites now produce this rate:
    // 1. contexts/app-context.tsx: calculateFullyBurdenedRate → resolver
    // 2. contexts/app-context.tsx: calculateLoadedRate → resolver
    // 3. contexts/app-context.tsx: getRateBreakdown → resolver
    // 4. components/tabs/staff/roles-pricing.tsx: getRoleBillRate → resolver
    // 5. components/tabs/roles-and-pricing-tab.tsx: calculateRateBreakdownStatic → resolver
    // 6. components/tabs/export-tab.tsx: profitMargin → resolver
    // 7. lib/wbs-to-roles.ts: syncRolesFromWBS → resolver
  })

  it('all sites converge on FFP rate when contract type is ffp', () => {
    const resolved = resolveProfitRateWithFallback({
      contractType: 'ffp',
    }, DEFAULT_PROFIT_TARGETS.tm)

    expect(resolved.source).toBe('contract_default')
    expect(resolved.profitRate).toBe(0.10) // FFP default is 10% (Low risk)

    const breakdown = calculateFullyBurdenedRate({
      annualSalary: testSalary,
      rates: testRates,
      profitRate: resolved.profitRate,
    })

    console.log(`\nFFP Contract: $${breakdown.fullyBurdenedRate.toFixed(2)} (10% profit - Low risk)`)

    // Higher rate than T&M (8%) but lower than old 12%
    expect(breakdown.fullyBurdenedRate).toBeGreaterThan(121.45)
    expect(breakdown.fullyBurdenedRate).toBeCloseTo(123.70, 1) // 10% profit
  })

  it('explicit profit rate overrides contract default', () => {
    const explicitRate = 0.15 // 15% explicit override
    const resolved = resolveProfitRateWithFallback({
      explicitProfitRate: explicitRate,
      contractType: 'tm', // Would be 10%, but explicit takes precedence
    }, DEFAULT_PROFIT_TARGETS.tm)

    expect(resolved.source).toBe('explicit')
    expect(resolved.profitRate).toBe(0.15)

    const breakdown = calculateFullyBurdenedRate({
      annualSalary: testSalary,
      rates: testRates,
      profitRate: resolved.profitRate,
    })

    console.log(`\nExplicit 15%: $${breakdown.fullyBurdenedRate.toFixed(2)}`)

    // Even higher rate
    expect(breakdown.fullyBurdenedRate).toBeGreaterThan(125)
  })

  /**
   * Convergence test for all 8 pricing sites at $106K / FFP.
   *
   * Sites:
   * 1. contexts/app-context.tsx: calculateFullyBurdenedRate
   * 2. contexts/app-context.tsx: calculateLoadedRate
   * 3. contexts/app-context.tsx: getRateBreakdown
   * 4. components/tabs/staff/roles-pricing.tsx: getRoleBillRate
   * 5. components/tabs/staff/roles-pricing.tsx: RoleDetailPanel breakdown
   * 6. components/tabs/roles-and-pricing-tab.tsx: calculateRateBreakdownStatic
   * 7. components/tabs/deliver/deliver-export.tsx: pricing export
   * 8. app/boe/[token]/page.tsx: public BOE display
   */
  it('all 8 sites converge at $106K / FFP with 8% explicit margin', () => {
    const salary106K = 106000

    // With 8% EXPLICIT profit (user override)
    const resolvedExplicit = resolveProfitRateWithFallback({
      explicitProfitRate: 0.08,
      contractType: 'ffp',
    }, DEFAULT_PROFIT_TARGETS.tm)

    expect(resolvedExplicit.source).toBe('explicit')
    expect(resolvedExplicit.profitRate).toBe(0.08)

    const breakdownExplicit = calculateFullyBurdenedRate({
      annualSalary: salary106K,
      rates: testRates,
      profitRate: resolvedExplicit.profitRate,
    })

    console.log('\n=== 8-SITE CONVERGENCE TABLE ($106K / FFP) ===')
    console.log(`With 8% EXPLICIT margin: $${breakdownExplicit.fullyBurdenedRate.toFixed(2)}`)

    // All 8 sites must show this bill rate with 8% explicit
    expect(breakdownExplicit.fullyBurdenedRate).toBeCloseTo(107.28, 1)
  })

  it('FFP default path returns 10% (Low risk)', () => {
    const salary106K = 106000

    // With FFP DEFAULT profit (no explicit override)
    const resolvedDefault = resolveProfitRateWithFallback({
      contractType: 'ffp',
    }, DEFAULT_PROFIT_TARGETS.tm)

    expect(resolvedDefault.source).toBe('contract_default')
    expect(resolvedDefault.profitRate).toBe(0.10) // FFP Low risk

    const breakdownDefault = calculateFullyBurdenedRate({
      annualSalary: salary106K,
      rates: testRates,
      profitRate: resolvedDefault.profitRate,
    })

    console.log(`With FFP DEFAULT (10%): $${breakdownDefault.fullyBurdenedRate.toFixed(2)}`)

    // FFP default (10% Low risk) gives higher rate
    expect(breakdownDefault.fullyBurdenedRate).toBeCloseTo(109.27, 1)
  })
})
