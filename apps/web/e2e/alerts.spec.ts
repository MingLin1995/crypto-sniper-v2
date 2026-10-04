import { test, expect } from '@playwright/test';

test.describe('價格通知頁面合約測試 (Alerts Contract)', () => {
  test('應成功渲染價格通知儀表板、切換標籤與新增通知按鈕', async ({ page }) => {
    await page.goto('/alerts');

    const activeTab = page.locator('[data-testid="alerts-active-tab"]');
    const historyTab = page.locator('[data-testid="alerts-history-tab"]');
    const channelsTab = page.locator('[data-testid="alerts-channels-tab"]');
    const createBtn = page.locator('[data-testid="alerts-create-btn"]');

    await expect(activeTab).toBeVisible();
    await expect(historyTab).toBeVisible();
    await expect(channelsTab).toBeVisible();
    await expect(createBtn).toBeVisible();
  });

  test('點擊歷史通知標籤時應能正常切換', async ({ page }) => {
    await page.goto('/alerts');

    const historyTab = page.locator('[data-testid="alerts-history-tab"]');
    await historyTab.click();

    // 驗證歷史通知內容卡片已加載
    const historyCard = page.locator('[data-testid="alerts-history-card"]');
    await expect(historyCard).toBeVisible();
  });
});
