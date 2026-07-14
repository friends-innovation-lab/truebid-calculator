import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const isRemote = baseURL !== 'http://localhost:3000'
const authFile = path.join(__dirname, '.playwright/.auth/user.json')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Main tests depend on setup
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],
  // Skip webServer when running against remote (staging/prod)
  ...(isRemote ? {} : {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
  }),
})
