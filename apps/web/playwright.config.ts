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
      command: 'bun --cwd ../api dev',
      url: 'http://127.0.0.1:3000/',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dev_user:dev_password@127.0.0.1:5432/app_dev?schema=public',
        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: process.env.REDIS_PORT || '6379',
        PORT: '3000',
        FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',
        JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-for-ci-at-least-32chars-long',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret-for-ci-at-least-32chars-long',
      },
    },
    {
      command: 'bun run dev',
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        PORT: String(PORT),
        API_URL: process.env.API_URL || 'http://127.0.0.1:3000/api',
      },
    },
  ],
});
