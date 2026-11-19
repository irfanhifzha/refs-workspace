import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5175',
    // Use the installed Chrome instead of downloading a bundled browser.
    channel: 'chrome',
  },
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
