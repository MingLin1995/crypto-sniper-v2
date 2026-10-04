import { test, expect } from '@playwright/test';

test.describe('路由防護與導航合約測試 (Route Guard & Navigation)', () => {
  test.describe('未登入狀態 (Unauthenticated)', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('未登入使用者存取受保護頁面 (/screener) 應自動跳轉至 /login', async ({ page }) => {
      await page.goto('/screener');
      await expect(page).toHaveURL(/\/login\?from=%2Fscreener|\/login\?from=\/screener/);
    });

    test('未登入使用者存取受保護頁面 (/backtest) 應自動跳轉至 /login', async ({ page }) => {
      await page.goto('/backtest');
      await expect(page).toHaveURL(/\/login\?from=%2Fbacktest|\/login\?from=\/backtest/);
    });
  });

  test.describe('已登入狀態 (Authenticated)', () => {
    test('具備有效 session 時存取受保護頁面 (/screener) 應正常保留在該頁面', async ({ page }) => {
      await page.goto('/screener');
      await expect(page).toHaveURL(/\/screener/);
    });

    test('具備有效 session 時存取登入頁面 (/login) 應自動跳轉回 /screener', async ({ page }) => {
      await page.goto('/login');
      await expect(page).toHaveURL(/\/screener/);
    });
  });
});
