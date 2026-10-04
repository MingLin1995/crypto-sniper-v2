import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('登入頁面核心合約測試 (Login Contract)', () => {
  test('應成功渲染登入表單與必要欄位 (data-testid)', async ({ page }) => {
    await page.goto('/login');

    // 驗證核心欄位具備穩定的 data-testid
    const emailInput = page.locator('[data-testid="login-email-input"]');
    const passwordInput = page.locator('[data-testid="login-password-input"]');
    const submitButton = page.locator('[data-testid="login-submit-button"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('輸入錯誤憑證時應顯示錯誤提示', async ({ page }) => {
    await page.goto('/login');

    // 填寫錯誤帳號密碼
    await page.fill('[data-testid="login-email-input"]', 'nonexistent@example.com');
    await page.fill('[data-testid="login-password-input"]', 'WrongPassword123!');
    await page.click('[data-testid="login-submit-button"]');

    // 驗證錯誤訊息元素
    const errorMessage = page.locator('[data-testid="login-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});
