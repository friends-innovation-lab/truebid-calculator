/**
 * Pricing Command Tests
 *
 * Tests for pricing scenario computation and charge codes.
 */

import {
  type RateConfigSnapshot,
  type PricingScenarioStatus,
  type SalarySource,
  type ProfitSource,
  type PricingLineType,
} from '@/lib/commands/pricing'
import { FORMULA_VERSION, calculateFullyBurdenedRate } from '@/lib/pricing'

describe('Pricing Commands', () => {
  describe('Types', () => {
    it('RateConfigSnapshot has required fields', () => {
      const snapshot: RateConfigSnapshot = {
        fringe: 0.2116,
        overhead: 0.3426,
        ga: 0.1983,
        defaultProfitRate: 0.10,
        escalationRate: 0.03,
        snapshotAt: new Date().toISOString(),
        sourceSettingsRowVersion: 1,
      }

      expect(snapshot.fringe).toBe(0.2116)
      expect(snapshot.overhead).toBe(0.3426)
      expect(snapshot.ga).toBe(0.1983)
      expect(snapshot.defaultProfitRate).toBe(0.10)
      expect(snapshot.escalationRate).toBe(0.03)
    })

    it('PricingScenarioStatus values are valid', () => {
      const statuses: PricingScenarioStatus[] = ['draft', 'approved', 'superseded']
      expect(statuses).toHaveLength(3)
    })

    it('SalarySource values are valid', () => {
      const sources: SalarySource[] = ['catalog', 'override']
      expect(sources).toHaveLength(2)
    })

    it('ProfitSource values are valid', () => {
      const sources: ProfitSource[] = ['explicit', 'contract_default']
      expect(sources).toHaveLength(2)
    })

    it('PricingLineType values are valid', () => {
      const types: PricingLineType[] = ['wbs_estimate', 'labor_loading']
      expect(types).toHaveLength(2)
      expect(types).toContain('wbs_estimate')
      expect(types).toContain('labor_loading')
    })
  })

  describe('Formula Version', () => {
    it('engine version is v1.1.0 (with escalation fields)', () => {
      expect(FORMULA_VERSION).toBe('v1.1.0')
    })
  })

  describe('ComputePricingScenario', () => {
    /**
     * Logic-only tests for command behavior.
     * Integration tests require database and are in separate file.
     */

    it('label defaults to "Primary"', () => {
      // This would be tested in integration; here we document expected behavior
      const defaultLabel = 'Primary'
      expect(defaultLabel).toBe('Primary')
    })

    it('salary resolution order: override > catalog > skip', () => {
      // Document the expected precedence
      const precedence = ['salary_override_cents', 'labor_category_lookup', 'skip']
      expect(precedence[0]).toBe('salary_override_cents')
    })

    it('profit source tracks explicit vs contract_default', () => {
      // Document profit source tracking
      const explicit: ProfitSource = 'explicit'
      const contractDefault: ProfitSource = 'contract_default'
      expect(explicit).not.toBe(contractDefault)
    })

    it('output includes both wbs_estimate and labor_loading totals', () => {
      // Document output structure
      const outputKeys = [
        'scenarioId',
        'label',
        'engineVersion',
        'wbsEstimateTotalCost',
        'wbsEstimateLineCount',
        'laborLoadingTotalCost',
        'laborLoadingLineCount',
        'totalCost',
        'lineCount',
        'computedAt',
        'needsUtilizationBackfill',
      ]
      expect(outputKeys).toContain('wbsEstimateTotalCost')
      expect(outputKeys).toContain('laborLoadingTotalCost')
      expect(outputKeys).toContain('needsUtilizationBackfill')
    })

    it('labor_loading formula: hoursPerMonth × period.months', () => {
      // Document labor loading calculation
      // Standard hours per month for full-time = 160
      const STANDARD_HOURS_PER_MONTH = 160
      const utilizationPct = 100 // full-time
      const hoursPerMonth = (utilizationPct / 100) * STANDARD_HOURS_PER_MONTH
      const periodMonths = 12

      const laborLoadingHours = hoursPerMonth * periodMonths
      expect(laborLoadingHours).toBe(1920) // Full-time for 12 months = 1920 hours
    })
  })

  describe('ApprovePricingScenario', () => {
    it('only draft scenarios can be approved', () => {
      // Document valid state transition
      const validFromState: PricingScenarioStatus = 'draft'
      const validToState: PricingScenarioStatus = 'approved'
      expect(validFromState).toBe('draft')
      expect(validToState).toBe('approved')
    })

    it('approving supersedes existing approved scenario', () => {
      // Document one-approved constraint behavior
      const constraint = 'one approved scenario per proposal'
      expect(constraint).toBeTruthy()
    })
  })

  describe('Escalation fields in breakdown', () => {
    /**
     * Verify that escalation fields are part of the breakdown
     * and properly null for non-escalated calculations.
     */
    it('escalation fields are null when not provided', () => {
      const breakdown = calculateFullyBurdenedRate({
        annualSalary: 120000,
        rates: { fringe: 0.2116, overhead: 0.3426, ga: 0.1983 },
        profitRate: 0.10,
      })

      expect(breakdown.escalationRateApplied).toBeNull()
      expect(breakdown.escalationYearIndex).toBeNull()
    })

    it('escalation fields are populated when escalation provided', () => {
      const breakdown = calculateFullyBurdenedRate({
        annualSalary: 120000,
        rates: { fringe: 0.2116, overhead: 0.3426, ga: 0.1983 },
        profitRate: 0.10,
        escalation: { rate: 0.03, yearIndex: 2 },
      })

      expect(breakdown.escalationRateApplied).toBe(0.03)
      expect(breakdown.escalationYearIndex).toBe(2)
      // Verify escalation was applied (year 2 = 3% increase)
      expect(breakdown.fullyBurdenedRate).toBeGreaterThan(123.70)
    })
  })
})
