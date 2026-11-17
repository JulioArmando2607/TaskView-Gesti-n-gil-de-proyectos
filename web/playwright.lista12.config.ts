import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'scrum.lista12.reports.spec.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:18888',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'auth-setup', testMatch: 'auth.lista12.setup.ts' },
    { name: 'chromium', dependencies: ['auth-setup'], use: { storageState: 'test-results/.auth/l04-editor.json' } },
  ],
})
