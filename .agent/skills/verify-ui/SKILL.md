---
name: verify-ui
description: UI 驗證策略與 Agent 可定址架構指引 (Verification Strategy & Agent-Addressable Architecture)。定義 Tier 1~4 驗證天梯、低成本驗證順序、前端業務邏輯解耦及穩定選取器規範。
---

# Verify UI — 驗證策略與 Agent 可定址架構 (Verification Strategy & Agent-Addressable Architecture)

> 證明任何 UI 變更的單一事實來源。在驗證任何前端可見變更，或為新子專案規劃測試設置前必須閱讀。本文件產出之所有報告、註釋與文件**必須一律使用正體中文 (Traditional Chinese)**。

## 為何存在此規範 (Why this exists)

Agent 修改代碼只需數秒，但證明代碼正常運作常花費數分鐘。成本不在於模型本身，而是驗證方式：依賴截圖與無障礙樹（Accessibility Tree）的瀏覽器逐步操作，每一步都需要一次模型往返（one model round trip per step）。一次 10 步的操作即消耗 10 次推論與 10 次龐大的頁面狀態載荷。

解法不是更快的瀏覽器代理，而是：
1. **永遠在能證明訴求的最低成本層級進行驗證**。
2. **規範專案架構，讓低成本層級能涵蓋絕大多數驗證**。

---

## 驗證天梯 (The Ladder) — 永遠在能證明訴求的最低層級驗證

| Tier | 證明項目 (Proves) | 成本 (Cost) | 適用情境 (Use it for) |
|---|---|---|---|
| **1. 單元測試 (Unit test)** | 純邏輯 (pure logic) | 毫秒級 | 公式計算、規則校驗、Guard、格式化、State Reducers、純函式 (如 `packages/shared`, `apps/web/src/lib/`) |
| **2. 腳本 / 查詢 (Script / query)** | 數據與持久化狀態 | 秒級 | DB 寫入、Prisma 查詢、資料庫遷移行為、Redis 佇列/快取、定時任務/背景 Worker 輸出 |
| **3. Playwright 規範測試** | UI 契約 (The UI contract) | 秒級、無頭 (Headless)、**零模型推論** | 必須持續運作的關鍵核心流程：登入/驗證、表單提交、列表→詳情、權限控制、防回歸測試 |
| **4. Agent 驅動瀏覽器** | 單次視覺或探索性確認 | 分鐘級、每一步消耗一次推論 | 全新版面佈局、CSS 樣式微調、「此頁面實際渲染外觀」 |

### 天梯四大守則 (Rules)：

1. **僅在訴求為純視覺時才從 Tier 4 開始**（排版、樣式、間距、溢出、z-index）— 因為較低層級無法證明視覺外觀。其他所有訴求一律從較低層級開始。驗證前須明確陳述選擇該 Tier 的原因。
2. **Tier 4 絕非最終交付物**。若某個流程需要被瀏覽器驅動第二次，必須將其固化為 Tier 3 的 Playwright spec。探索並非持久的驗證手段。
3. **真正執行並回報真實輸出才算通過**。指令必須實際運行並附上真實輸出。失敗即如實回報失敗日誌，**嚴禁要求使用者手動到瀏覽器確認**。
4. **不要為了「安心」向上攀爬**。若 Tier 1 已能證明邏輯正確，額外跑一次瀏覽器無法增加任何確定性，只會白白浪費數分鐘與 Token。

---

## Tier 4 — 若確實需要瀏覽器時的操作守則

- **禁止截圖死循環 (No screenshot loops)**：優先以文字讀取狀態（無障礙樹、抽取頁面文字或執行評估 JS）。截圖僅作為給使用者的最終視覺證明，或真正針對視覺外觀問題（間距、色彩、溢出、圖層）時才使用。
- **批次呼叫 (Batch)**：將 `導覽 (navigate) → 點擊 (click) → 輸入 (type) → 提交 (submit) → 讀取 (read)` 合併為單一批次操作，將 N 次 round trips 降為 1 次。
- **複用現有開發伺服器與 Session**：永遠附著在已運行的 dev server（`http://localhost:3001`，具備 HMR）；切勿每次檢查都重啟伺服器或逐步重新登入。
- **鎖定 `data-testid` 或 role**：絕不使用像素座標或易碎的 DOM 層級選取器。
- **回報並固化**：回報發現後，將其固化為 Tier 3 規格。

---

## 讓驗證保持低成本的架構約束 (Architecture Rules)

這些是架構審查時必須強制執行的設計約束，而非單純的測試技巧：

1. **可無頭執行的業務邏輯 (Headless-runnable business logic)**：
   嚴禁將計算、規則過濾或數據轉換邏輯深鎖在已渲染的 React 元件內。邏輯必須抽離至 `lib/`、`services/` 或 `packages/shared/`，可脫離瀏覽器直接由測試呼叫。
2. **確定性的 URL 入口 (Deterministic entry points)**：
   每個可驗證的畫面都必須能透過攜帶 Seed 數據與儲存之 Auth 狀態的 URL 直接抵達。若驗證一個行為需要連續點擊 8 次，那是架構瑕疵，不是測試問題。
3. **可斷言狀態優於視覺檢查 (Assertable state over visual inspection)**：
   在畫面上暴露可供斷言的特徵（穩定文字、`data-testid`、API 響應），而非強求人類或模型去比對像素。
4. **穩定的選取器 (Stable selectors)**：
   關鍵操作流程所依賴的元素一律具備 `data-testid`。絕不使用結構型、索引型或文字相對位置的選取器。
5. **單一長效開發伺服器**：
   驗證直接依附已在運行的開發實例，絕不自行建立多餘的伺服器程序。

---

## 在尚未配置的專案中建立 Tier 3 (Playwright) 的步驟

嚴格按順序建立，每一步驟驗證通過後才進行下一步：

1. `playwright.config.ts`：指向現有的 dev server URL（例如 `http://localhost:3001`），設定 `reuseExistingServer: true`。
2. **種子數據與全域 Setup**：透過腳本生成基準數據，並透過 global setup 執行**一次**登入並持久化 `storageState`，使後續所有 spec 啟動時均已認證。
3. **單一最小核心 Spec**：先針對最頻繁使用的單一流程撰寫 spec，必須跑通綠燈（green）才撰寫第二個。
4. **npm script**：封裝為單一快捷指令（如 `bun run test:e2e`）。
5. **後續演進**：任何 Tier 4 探索過第二次的流程，立即補充進 Tier 3 spec。

---

## 報告規範 (Reporting)

驗證回報時，必須清楚交代：
1. **採用的驗證層級 (Tier)** 與選用原因。
2. **實際執行的完整指令**。
3. **終端機輸出的真實結果**。若有部分被略過或受阻，精確說明原因與受阻環節。
