import { test, expect } from '@playwright/test';

test.describe('量化回測頁面合約測試 (Backtest Contract)', () => {
  test('應成功渲染回測參數配置卡片、標的輸入框與開始按鈕', async ({ page }) => {
    await page.goto('/backtest');

    const startBtn = page.locator('[data-testid="backtest-start-btn"]');
    const stratSelect = page.locator('[data-testid="backtest-strategy-select"]');
    const symbolInput = page.locator('[data-testid="backtest-symbol-input"]');

    await expect(startBtn).toBeVisible();
    await expect(stratSelect).toBeVisible();
    await expect(symbolInput).toBeVisible();

    // 初始狀態下因未選擇策略與標的，開始回測按鈕應為 disabled
    await expect(startBtn).toBeDisabled();
  });
});
