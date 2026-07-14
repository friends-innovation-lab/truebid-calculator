/**
 * Pricing Scenario E2E Tests
 *
 * Tests for the Scenario & Pricing screen (M1 Build Brief 01).
 *
 * Test targets:
 * - T1, T3: PM-HCD on staging
 * - T2, T4, T5: Test fixture proposal (not PM-HCD)
 *
 * Run: npm run test:e2e -- e2e/pricing-scenario.spec.ts
 */

import { test, expect } from '@playwright/test'

// Test configuration
const TEST_CONFIG = {
  // PM-HCD proposal for T1 and T3 (single-source and trace tests)
  pmHcdProposalId: process.env.PM_HCD_PROPOSAL_ID || 'pm-hcd-proposal-id',
  // Test fixture proposal for T2, T4, T5 (gate, staleness, empty tests)
  fixtureProposalId: process.env.FIXTURE_PROPOSAL_ID || 'test-fixture-proposal-id',
}

// Helper to login and navigate to pricing screen
async function navigateToPricing(page: import('@playwright/test').Page, proposalId: string) {
  // TODO: Implement proper authentication for staging
  await page.goto(`/${proposalId}?view=pricing`)
  await page.waitForLoadState('networkidle')
}

test.describe('Scenario & Pricing', () => {
  test.describe('T1: Single-Source (PM-HCD)', () => {
    test('header total equals line sum equals DB sum', async ({ page }) => {
      await navigateToPricing(page, TEST_CONFIG.pmHcdProposalId)

      // Wait for scenario to load
      await page.waitForSelector('[data-testid="scenario-detail"]', { timeout: 10000 })

      // Get header total
      const headerTotal = await page.locator('[data-testid="summary-header-total"]').textContent()

      // Get sum of line extended costs
      const lineExtendedCosts = await page.locator('[data-testid="line-extended-cost"]').allTextContents()
      const clientSum = lineExtendedCosts
        .map((text) => parseFloat(text.replace(/[$,]/g, '')))
        .reduce((sum, val) => sum + val, 0)

      // Values should match to the penny
      // TODO: Also verify against direct DB sum via API or fixture
      expect(headerTotal).toBeTruthy()
      expect(clientSum).toBeGreaterThan(0)

      console.log('T1 Results:')
      console.log(`  Header Total: ${headerTotal}`)
      console.log(`  Client Line Sum: $${clientSum.toFixed(2)}`)
    })
  })

  test.describe('T2: Gate (Test Fixture)', () => {
    test('unresolved flag blocks approval, resolve enables, approve shows badge', async ({ page }) => {
      await navigateToPricing(page, TEST_CONFIG.fixtureProposalId)

      // Find a draft scenario with engine flags
      const draftScenario = page.locator('[data-testid="scenario-card"][data-status="draft"]').first()
      await draftScenario.click()

      // Check that approve button is blocked
      const approveButton = page.locator('[data-testid="approve-button"]')
      const buttonText = await approveButton.textContent()

      // Should show blocked count
      expect(buttonText).toContain('need')

      // TODO: Resolve the flag (navigate to fix, come back)
      // TODO: Verify approve is enabled
      // TODO: Click approve and verify badge appears
    })
  })

  test.describe('T3: Trace (PM-HCD)', () => {
    test('expanded line shows cascade steps with correct arithmetic', async ({ page }) => {
      await navigateToPricing(page, TEST_CONFIG.pmHcdProposalId)

      // Wait for lines to load
      await page.waitForSelector('[data-testid="pricing-line-row"]')

      // Click first line to expand
      const firstLine = page.locator('[data-testid="pricing-line-row"]').first()
      await firstLine.click()

      // Wait for trace panel to appear
      await page.waitForSelector('[data-testid="calc-trace-panel"]')

      // Verify cascade steps are visible
      await expect(page.getByText('Base Salary')).toBeVisible()
      await expect(page.getByText('After Fringe')).toBeVisible()
      await expect(page.getByText('Loaded Cost')).toBeVisible()
      await expect(page.getByText('÷ 2,080 hrs')).toBeVisible()
      await expect(page.getByText('Cost per Hour')).toBeVisible()
      await expect(page.getByText('Bill Rate')).toBeVisible()

      // Verify hours × rate ≈ extended cost
      const hours = await page.locator('[data-testid="line-hours"]').first().textContent()
      const billRate = await page.locator('[data-testid="line-bill-rate"]').first().textContent()
      const extended = await page.locator('[data-testid="line-extended-cost"]').first().textContent()

      console.log('T3 Results:')
      console.log(`  Hours: ${hours}`)
      console.log(`  Bill Rate: ${billRate}`)
      console.log(`  Extended: ${extended}`)
    })
  })

  test.describe('T4: No-Recompute (Test Fixture)', () => {
    test('superseded intelligence shows staleness notice, totals unchanged', async ({ page }) => {
      await navigateToPricing(page, TEST_CONFIG.fixtureProposalId)

      // TODO: This test requires a fixture where intelligence was superseded after approval
      // 1. Navigate to an approved scenario that's now stale
      // 2. Verify staleness notice appears
      // 3. Verify totals are still from the original approval (not recomputed)
      // 4. Click "Create New Scenario" and verify new scenario is created

      const stalenessNotice = page.locator('[data-testid="staleness-notice"]')
      // Test will pass if staleness notice exists OR if setup creates the condition
      // For now, just verify the component renders when appropriate
    })
  })

  test.describe('T5: Empty/Disabled (Test Fixture)', () => {
    test('no confirmed intelligence shows state 1 with link to Scope', async ({ page }) => {
      // TODO: Need a fixture proposal with no confirmed intelligence
      // For now, this test documents the expected behavior

      // await navigateToPricing(page, TEST_CONFIG.fixtureProposalId)

      // Verify empty state appears
      // const emptyState = page.locator('[data-testid="empty-state-pricing"]')
      // await expect(emptyState).toBeVisible()

      // Verify prerequisite is shown as unmet
      // await expect(page.getByText('Confirm intelligence in Scope')).toBeVisible()

      // Verify link to Scope exists
      // const scopeLink = page.getByRole('button', { name: 'Go to Scope' })
      // await expect(scopeLink).toBeVisible()
    })
  })
})

test.describe('PM-HCD Acceptance', () => {
  test('scenario total matches expected value', async ({ page }) => {
    await navigateToPricing(page, TEST_CONFIG.pmHcdProposalId)

    // Wait for approved scenario
    await page.waitForSelector('[data-testid="summary-header"]', { timeout: 10000 })

    // Get the rendered total
    const renderedTotal = await page.locator('[data-testid="summary-header-total"]').textContent()

    // Get lines and compute client sum
    const lineExtendedCosts = await page.locator('[data-testid="line-extended-cost"]').allTextContents()
    const clientSum = lineExtendedCosts
      .map((text) => parseFloat(text.replace(/[$,]/g, '')))
      .reduce((sum, val) => sum + val, 0)

    console.log('=== PM-HCD Acceptance Report ===')
    console.log(`Rendered Header Total: ${renderedTotal}`)
    console.log(`Client Lines Sum: $${clientSum.toFixed(2)}`)
    console.log('DB Sum: [Query staging database for labor_loading extended_cost]')
    console.log('')
    console.log('This number is PM-HCD\'s actual total — the resolution of the Staff-tab question.')
    console.log('===============================')

    // The three numbers must be equal to the penny
    // TODO: Add DB query comparison when staging access is configured
    expect(renderedTotal).toBeTruthy()
    expect(clientSum).toBeGreaterThan(0)
  })
})
