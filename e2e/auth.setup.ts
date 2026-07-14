import { test as setup } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../.playwright/.auth/user.json')

/**
 * Global setup for Playwright authentication.
 * Logs in once and saves the session for reuse.
 *
 * Required env vars:
 * - PLAYWRIGHT_TEST_EMAIL
 * - PLAYWRIGHT_TEST_PASSWORD
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD

  if (!email || !password) {
    console.log('⚠️  PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD required for auth')
    console.log('   Skipping authentication setup')
    return
  }

  // Navigate to login
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // Fill email and continue
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', email)
  await page.click('button:has-text("Continue with Email")')

  // Wait for password field (magic link or password flow)
  await page.waitForTimeout(2000)

  // Check if password field appears
  const passwordField = page.locator('input[type="password"]')
  if (await passwordField.isVisible()) {
    await passwordField.fill(password)
    await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")')
  }

  // Wait for redirect to dashboard or proposal
  await page.waitForURL(/\/(dashboard|[a-f0-9-]{36})/, { timeout: 30000 })

  // Save authentication state
  await page.context().storageState({ path: authFile })

  console.log('✓ Authentication saved to', authFile)
})
