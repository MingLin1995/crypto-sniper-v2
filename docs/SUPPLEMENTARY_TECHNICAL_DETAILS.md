# 補充技術設計細節 (Supplementary Technical Details)

> 本文件整合了 CryptoSniper v2 中值得深入了解但不屬於核心資料流向的**6 個特色功能設計細節**。
> 依照「架構基礎 → 用戶認證入口 → 運行時數據保障 → 背景維護」的邏輯順序排列。

---

## 目錄

1. [Monorepo 工作空間架構](#1-monorepo-工作空間架構) — 專案基礎架構
2. [OAuth Email 衝突處理策略](#2-oauth-email-衝突處理策略) — 用戶登入入口
3. [Telegram Widget OAuth 簽名驗證](#3-telegram-widget-oauth-簽名驗證) — 第三方身分驗證
4. [OAuth 解綁安全保護](#4-oauth-解綁安全保護) — 帳號安全管理
5. [WebSocket 強制重連防事件洩漏](#5-websocket-強制重連防事件洩漏) — 運行時連線保障
6. [定時清理排程](#6-定時清理排程) — 背景維護作業

---

## 1. Monorepo 工作空間架構

### 功能概述

CryptoSniper v2 採用 **Bun + Turborepo** 的 Monorepo 架構，在單一 Git Repository 中管理前後端與共享套件。

### 專案結構

```
crypto-sniper-v2/
├── apps/
│   ├── api/          ← NestJS Backend API (Bun Runtime)
│   └── web/          ← Next.js Frontend (App Router)
├── packages/
│   └── shared/       ← 跨專案共享 DTO 與 TypeScript 型別
├── turbo.json        ← Turborepo 建置管線
├── package.json      ← workspaces: ["apps/*", "packages/*"]
└── bun.lock
```

### 共享套件引用

```json
// apps/api/package.json
{ "dependencies": { "@cryptosniper/shared": "workspace:*" } }
```

### 設計優勢

| 優勢               | 說明                                                  |
| :----------------- | :---------------------------------------------------- |
| **型別安全跨邊界** | DTO 統一定義，前後端引用同一份原始碼                  |
| **統一依賴管理**   | `bun install` 一次安裝，自動 Hoist 共用套件           |
| **Turborepo 快取** | 未變更的套件不重新建置，加速 CI/CD                    |
| **獨立部署**       | API 和 Web 各有獨立 `Dockerfile.prod`，可獨立推送 ECR |

### CI/CD 整合

- `bun install --frozen-lockfile`：CI 環境強制使用鎖定檔，禁止自動升級。
- `bun --cwd apps/api prisma generate`：在 Monorepo 中定位到正確的子專案執行 Prisma Client 產生。

### 面試延伸

- **為什麼選 Bun？** → 同時作為 Runtime、Package Manager 和 Test Runner，減少工具鏈複雜度，Install 速度顯著快於 npm/yarn。
- **Monorepo vs Polyrepo？** → 規模適中（2 Apps + 1 Package），Monorepo 的跨專案共用與原子提交優勢大於建置複雜度。

---

## 2. OAuth Email 衝突處理策略

### 功能概述

當第三方 OAuth 回傳的 Email 已被密碼註冊帳號使用時，若直接自動合併將產生**帳號接管攻擊 (Account Takeover)** 風險。

**核心程式碼**：`apps/api/src/auth/oauth.service.ts` — `handleOAuthLogin()`

### 攻擊場景

```
1. 受害者使用 ming@example.com + 密碼 註冊
2. 攻擊者在 Google 上建立 ming@example.com 帳號
3. 攻擊者用 Google OAuth 登入系統
4. 若自動合併 → 攻擊者直接接管受害者帳號
```

### 防禦策略

| 場景                       | 處理方式                                                                                        |
| :------------------------- | :---------------------------------------------------------------------------------------------- |
| 全新用戶（Email 不存在）   | 建立新帳號並登入                                                                                |
| 已綁定同一 Provider        | 直接登入                                                                                        |
| **Email 已被密碼帳號使用** | **拒絕自動合併**，回傳 `ConflictException: '此 Email 已有帳戶，請使用密碼登入後至個人設定綁定'` |
| 已綁定其他 Provider        | 允許追加綁定                                                                                    |

### 安全的綁定替代流程

```
1. 用戶先使用密碼登入（證明帳號擁有權）
2. 在個人設定頁面點擊「綁定 Google」
3. 完成 OAuth 授權 → 安全寫入 googleId
```

### 與帳號合併 (Rebind) 的區別

> 此處處理的是 **OAuth 與密碼帳號的衝突**（需密碼驗證擁有權），而 SYSTEM_ARCHITECTURE §3 的 Rebind 處理的是**兩個 OAuth 臨時帳號間的衝突**（透過 Redis Token 確認合併）。

### 面試延伸

- **為什麼不根據 Email 自動合併？** → 部分平台不驗證 Email 擁有權，自動合併等同允許攻擊者接管帳號。
- **業界標準？** → GitHub、GitLab 均採用「先用密碼登入證明擁有權，再手動綁定」。

---

## 3. Telegram Widget OAuth 簽名驗證

### 功能概述

當用戶使用 Telegram Login Widget 進行 OAuth 登入或帳號綁定時，系統必須驗證 Telegram 回傳的用戶資料是否為 Telegram 官方簽發，防止攻擊者偽造身分冒充登入。

**核心程式碼**：`apps/api/src/auth/oauth.service.ts` — `verifyTelegramData()`

### HMAC-SHA256 簽名驗證機制

Telegram Login Widget 在用戶授權後回傳一組資料（`id`, `first_name`, `auth_date`, `hash` 等），其中 `hash` 是 Telegram 用 Bot Token 對其他欄位生成的 HMAC-SHA256 簽名。

```
驗證步驟：
1. 將回傳資料（排除 hash）依字母序排列，以 \n 連接
   → "auth_date=1234567\nfirst_name=Ming\nid=123456789"
2. 使用 SHA-256(Bot Token) 作為 HMAC 金鑰
   → secretKey = SHA256(TELEGRAM_BOT_TOKEN)
3. 計算 HMAC-SHA256(secretKey, dataCheckString)
4. 比對計算結果與回傳的 hash 是否一致
```

### 時效性檢查

- 驗證資料必須在 **24 小時** 內使用，超過即判定過期，限制重放攻擊窗口。

### 安全設計要點

| 要點                    | 說明                                                    |
| :---------------------- | :------------------------------------------------------ |
| **防偽造**              | 攻擊者無法在不知道 Bot Token 的情況下偽造合法 HMAC 簽名 |
| **防重放**              | `auth_date` 超過 24 小時即失效                          |
| **與 OAuth State 配合** | 仍搭配 Redis State Token 進行 CSRF 防禦                 |

### 面試延伸

- **為什麼 Telegram 用 HMAC 而非 Authorization Code Flow？** → Telegram Login Widget 是前端嵌入式設計，資料直接在前端取得後轉發給後端，沒有 Server-to-Server Code Exchange 階段。
- **為什麼 HMAC 金鑰是 `SHA256(Bot Token)` 而非直接用 Bot Token？** → Telegram 官方規範，衍生金鑰避免暴露原始 Token 的長度與熵值。

---

## 4. OAuth 解綁安全保護

### 功能概述

當用戶解除綁定某個第三方帳號時，系統必須防止用戶「解綁掉唯一的登入方式」而導致帳號永久鎖死。

**核心程式碼**：`apps/api/src/auth/oauth.service.ts` — `unlinkProvider()`

### 防護機制：最少保留一種登入方式

系統將以下欄位視為獨立的登入方式：

| 欄位              | 登入方式              |
| :---------------- | :-------------------- |
| `user.password`   | Email + 密碼登入      |
| `user.googleId`   | Google OAuth          |
| `user.discordId`  | Discord OAuth         |
| `user.telegramId` | Telegram Login Widget |

**判斷規則**：統計上述四個欄位中「有值」的數量，若解綁後剩餘方式 < 1，拒絕操作並回傳：

```
BadRequestException: '無法解除綁定，這是您目前唯一的登入方式。請先設定密碼或綁定其他第三方帳號。'
```

### 邊界場景矩陣

| 場景                             | 結果 |
| :------------------------------- | :--- |
| 僅有 Google，解綁 Google         | 拒絕 |
| 有密碼 + Google，解綁 Google     | 允許 |
| 有 Google + Discord，解綁 Google | 允許 |

### 面試延伸

- **為什麼不只在前端隱藏按鈕？** → 前端隱藏僅為 UX 優化，攻擊者可直接呼叫 API 繞過 UI，後端驗證才是安全保障。

---

## 5. WebSocket 強制重連防事件洩漏

### 功能概述

`BinanceWebsocketService` 維護與幣安的 WebSocket 長連線。重連時若未正確清理舊連線的事件監聽器，會導致**事件洩漏**與**重複重連風暴**。

**核心程式碼**：`apps/api/src/market/binance-websocket.service.ts` — `reconnect()`

### 問題場景

```
1. WebSocket 連線 A 因網路異常觸發 onclose
2. onclose Handler 呼叫 reconnect()
3. reconnect() 呼叫 ws.close()
4. ws.close() 再次觸發 onclose
5. onclose 再次呼叫 reconnect() → 無窮重連迴圈
6. Node.js 記憶體耗盡或幣安 IP 被封鎖
```

### 解決方案：重連前清除事件

```typescript
private reconnect() {
  // ① 先清除事件，防止 close() 觸發重複 reconnect
  if (this.ws) {
    this.ws.onclose = null;
    this.ws.onerror = null;
    this.ws.onmessage = null;
    this.ws.close();
    this.ws = null;
  }
  // ② 延遲重連，避免快速重連風暴
  setTimeout(() => this.connect(), this.reconnectDelay);
}
```

### 看門狗 (Watchdog) 心跳機制

| 機制          | 說明                                                                        |
| :------------ | :-------------------------------------------------------------------------- |
| **心跳週期**  | 每 10 秒 Cron Job 檢查                                                      |
| **半開偵測**  | `(當前時間 - lastMessageAt) > 30s` → 判定半開連線                           |
| **指數退避**  | 重連延遲 2s → 4s → 8s → ... → 最大 60s                                      |
| **REST 備援** | 重連期間 `isAlive()` 回傳 `false`，MarketScheduleService 自動啟用 REST 輪詢 |

### 關鍵設計要點

| 要點             | 說明                                                   |
| :--------------- | :----------------------------------------------------- |
| **事件清理時機** | 必須在 `close()` **之前**清理，因為 `close()` 是異步的 |
| **`ws = null`**  | 斷開參照讓 GC 正確回收舊連線物件                       |
| **單執行緒安全** | Node.js 單執行緒不會出現真正的併發重連                 |

### 面試延伸

- **什麼是半開連線？** → TCP 一端已關閉但另一端不知道，WebSocket 的 `readyState` 仍顯示 `OPEN`，只能靠應用層心跳偵測。
- **為什麼用 `onclose = null` 而非 `removeEventListener`？** → Node.js `ws` 庫使用 Property Handler 模式，設為 `null` 是正確的清除方式。

---

## 6. 定時清理排程

### 功能概述

系統透過 `@nestjs/schedule` 的 `@Cron` 裝飾器，在每日凌晨 (`EVERY_DAY_AT_MIDNIGHT`) 自動執行兩項清理任務，防止歷史資料無限堆積撐爆 PostgreSQL 儲存空間。

**核心程式碼**：`apps/api/src/tasks/cleanup.service.ts`

### 清理項目

```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async handleCleanup() {
    await this.cleanOldLogs();       // 清理 30 天前的 SystemLog
    await this.cleanExpiredTokens(); // 清理已過期的 RefreshToken
}
```

| 清理項目               | 條件                                | 說明                                 |
| :--------------------- | :---------------------------------- | :----------------------------------- |
| **過期系統日誌**       | `SystemLog.createdAt < 30天前`      | 批次硬刪除（日誌不需軟刪除）         |
| **過期 Refresh Token** | `RefreshToken.expiresAt < 當前時間` | 用戶未主動登出時殘留的 7d 過期 Token |

### 設計要點

| 要點             | 說明                                             |
| :--------------- | :----------------------------------------------- |
| **排程時段**     | 每日凌晨 00:00，流量最低時段                     |
| **錯誤隔離**     | 兩個清理任務獨立 try-catch，一個失敗不影響另一個 |
| **硬刪除合理性** | 日誌與過期 Token 不具業務審計價值，無需軟刪除    |
| **批次操作**     | 使用 `deleteMany` 而非逐筆刪除，減少連線池佔用   |

### 面試延伸

- **為什麼不用 PostgreSQL 的 `pg_cron`？** → 保持「業務邏輯集中於應用層」原則，且 Docker 環境下不需依賴 DB 端擴充。
- **為什麼保留 30 天？** → 平衡除錯需求與 EC2 小型實例的儲存成本。
