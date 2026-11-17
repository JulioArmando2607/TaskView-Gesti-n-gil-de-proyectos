import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'scrum.lista03.flow.spec.ts',
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174',
    browserName: 'chromium',
    launchOptions: process.env.SCRUM_BROWSER_PATH ? { executablePath: process.env.SCRUM_BROWSER_PATH } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
