import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('註冊頁面核心合約測試 (Register Contract)', () => {
  test('應成功渲染註冊表單所有必要輸入框與送出按鈕', async ({ page }) => {
    await page.goto('/register');

    const emailInput = page.locator('[data-testid="register-email-input"]');
    const sendCodeBtn = page.locator('[data-testid="register-send-code-button"]');
    const nicknameInput = page.locator('[data-testid="register-nickname-input"]');
    const codeInput = page.locator('[data-testid="register-code-input"]');
    const passwordInput = page.locator('[data-testid="register-password-input"]');
    const submitBtn = page.locator('[data-testid="register-submit-button"]');

    await expect(emailInput).toBeVisible();
    await expect(sendCodeBtn).toBeVisible();
    await expect(nicknameInput).toBeVisible();
    await expect(codeInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  test('未輸入 Email 點擊傳送驗證碼時應顯示錯誤訊息', async ({ page }) => {
    await page.goto('/register');

    const sendCodeBtn = page.locator('[data-testid="register-send-code-button"]');
    await sendCodeBtn.click();

    const errorMessage = page.locator('[data-testid="register-error-message"]');
    await expect(errorMessage).toBeVisible();
  });
});
