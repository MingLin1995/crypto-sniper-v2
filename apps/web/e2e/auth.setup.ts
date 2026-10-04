import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('驗證登入並儲存認證狀態 (Authenticate & Persist storageState)', async ({ page }) => {
  await page.goto('/login');

  await page.fill('[data-testid="login-email-input"]', 'admin001@example.com');
  await page.fill('[data-testid="login-password-input"]', '000000');
  await page.click('[data-testid="login-submit-button"]');

  // 等待跳轉至 /screener
  await page.waitForURL('**/screener', { timeout: 15000 });
  await expect(page).toHaveURL(/\/screener/);

  // 持久化 storageState 至檔案供其他測試複用
  await page.context().storageState({ path: authFile });
});
