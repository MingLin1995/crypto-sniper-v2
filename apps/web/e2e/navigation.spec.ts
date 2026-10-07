import { test, expect } from '@playwright/test';

test.describe('路由防護與導航合約測試 (Route Guard & Navigation)', () => {
  test.describe('未登入狀態 (Unauthenticated)', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('未登入使用者存取受保護頁面 (/profile) 應自動跳轉至 /login', async ({ page }) => {
      await page.goto('/profile');
      await expect(page).toHaveURL(/\/login\?from=%2Fprofile|\/login\?from=\/profile/);
    });

    test('未登入使用者存取受保護頁面 (/alerts) 應自動跳轉至 /login', async ({ page }) => {
      await page.goto('/alerts');
      await expect(page).toHaveURL(/\/login\?from=%2Falerts|\/login\?from=\/alerts/);
    });

    test('未登入使用者存取公開訪客頁面 (/screener) 應允許正常瀏覽 (訪客模式)', async ({ page }) => {
      await page.goto('/screener');
      await expect(page).toHaveURL(/\/screener/);
    });

    test('未登入使用者存取公開訪客頁面 (/backtest) 應允許正常瀏覽 (訪客模式)', async ({ page }) => {
      await page.goto('/backtest');
      await expect(page).toHaveURL(/\/backtest/);
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
