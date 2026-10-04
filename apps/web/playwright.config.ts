import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 測試設定 - CryptoSniper v2 Web
 * 依循 verify-ui skill 規範：
 * - 優先連接現有開發伺服器 (http://localhost:3001)
 * - 支援 storageState 認證狀態複用
 */
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PORT}`;

const authFile = 'playwright/.auth/user.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  timeout: 45000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'bun --cwd ../api run start:dev',
      url: 'http://localhost:3000/',
      reuseExistingServer: true,
      timeout: 60 * 1000,
    },
    {
      command: 'bun run dev',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 60 * 1000,
    },
  ],
});
