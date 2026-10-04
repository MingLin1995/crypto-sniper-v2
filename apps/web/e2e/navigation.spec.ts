import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('路由防護與導航合約測試 (Route Guard & Navigation)', () => {
  test('未登入使用者存取受保護頁面 (/screener) 應自動跳轉至 /login', async ({ page }) => {
    await page.goto('/screener');
    await expect(page).toHaveURL(/\/login\?from=%2Fscreener|\/login\?from=\/screener/);
  });

  test('未登入使用者存取受保護頁面 (/backtest) 應自動跳轉至 /login', async ({ page }) => {
    await page.goto('/backtest');
    await expect(page).toHaveURL(/\/login\?from=%2Fbacktest|\/login\?from=\/backtest/);
  });

  test('具備 session cookie 時應允許存取受保護頁面', async ({ page, context }) => {
    // 注入已認證的 Session Cookie
    await context.addCookies([
      {
        name: 'refresh_token',
        value: 'mock-valid-e2e-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await page.goto('/screener');
    await expect(page).toHaveURL(/\/screener/);
  });
});
