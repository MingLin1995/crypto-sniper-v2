import { test, expect } from '@playwright/test';

test.describe('個人帳號設定頁面合約測試 (Profile Contract)', () => {
  test('應成功渲染個人資料卡片與登出按鈕', async ({ page }) => {
    await page.goto('/profile');

    const profileCard = page.locator('[data-testid="profile-info-card"]');
    const logoutBtn = page.locator('[data-testid="profile-logout-btn"]');

    await expect(profileCard).toBeVisible();
    await expect(logoutBtn).toBeVisible();
  });
});
