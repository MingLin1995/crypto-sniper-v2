import { test, expect } from '@playwright/test';

test.describe('多時框篩選器合約測試 (Screener Contract)', () => {

  test('應成功渲染多時框篩選器設定卡片與按鈕', async ({ page }) => {
    await page.goto('/screener');

    // 檢查關鍵操作按鈕具備穩定的 data-testid
    const addTimeframeBtn = page.locator('[data-testid="screener-add-timeframe-btn"]');
    const stratNameInput = page.locator('[data-testid="screener-strat-name-input"]');
    const saveStratBtn = page.locator('[data-testid="screener-save-strat-btn"]');
    const resetBtn = page.locator('[data-testid="screener-reset-btn"]');
    const runScannerBtn = page.locator('[data-testid="screener-run-scanner-btn"]');

    await expect(addTimeframeBtn).toBeVisible();
    await expect(stratNameInput).toBeVisible();
    await expect(saveStratBtn).toBeVisible();
    await expect(resetBtn).toBeVisible();
    await expect(runScannerBtn).toBeVisible();
  });

  test('點擊「新增時框區塊」按鈕時應新增一個時框設定區塊', async ({ page }) => {
    await page.goto('/screener');

    const addTimeframeBtn = page.locator('[data-testid="screener-add-timeframe-btn"]');
    await addTimeframeBtn.click();

    // 驗證時框區塊 #1 是否成功生成
    const block = page.locator('text=時框區塊 #1').or(page.locator('text=Timeframe #1'));
    await expect(block.first()).toBeVisible();
  });
});
