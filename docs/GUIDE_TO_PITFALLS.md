# CryptoSniper v2 踩坑指南

> 本文件從核心架構設計 → 行情引擎開發 → 通知整合 → 首次部署上線 → 生產環境優化，呈現每個階段實際遭遇的技術挑戰與解決方案。

---

## 目錄

### Phase 1：核心架構設計

1. [Prisma Extension 軟刪除攔截與密碼欄位自動隱匿](#案例-1prisma-extension-軟刪除攔截與密碼欄位自動隱匿)
2. [NestJS 全域請求生命週期的分層日誌防重複寫入](#案例-2nestjs-全域請求生命週期的分層日誌防重複寫入)
3. [敏感資料遞迴深層遮罩與日誌安全淨化](#案例-3敏感資料遞迴深層遮罩與日誌安全淨化)
4. [NestJS Helmet 嚴格 CSP 規則與 Scalar API 文件相容性衝突](#案例-4nestjs-helmet-嚴格-csp-規則與-scalar-api-文件相容性衝突)
5. [生產環境密鑰安全配置與啟動防呆檢驗 (Secure by Default)](#案例-5生產環境密鑰安全配置與啟動防呆檢驗-secure-by-default)

### Phase 2：行情引擎開發

6. [BullMQ 高頻行情削峰去重 (Conflation) 與記憶體保護](#案例-6bullmq-高頻行情削峰去重-conflation-與記憶體保護)
7. [K 線佇列啟動時的競態條件 (Race Condition) 與三級優先排序](#案例-7k-線佇列啟動時的競態條件-race-condition-與三級優先排序)
8. [WebSocket 半開連線看門狗與指數退避自動重連機制](#案例-8websocket-半開連線看門狗與指數退避自動重連機制)

### Phase 3：通知與第三方整合

9. [Discord 通知選擇 Webhook 而非 Bot 的限流規避設計](#案例-9discord-通知選擇-webhook-而非-bot-的限流規避設計)
10. [Telegram 通知 Webhook 雙層身分驗證與反冒充機制](#案例-10telegram-通知-webhook-雙層身分驗證與反冒充機制)

### Phase 4：首次部署上線

11. [AWS Graviton (ARM64) 跨架構編譯與 ECR 免憑證轉發](#案例-11aws-graviton-arm64-跨架構編譯與-ecr-免憑證轉發)
12. [GitHub Actions 動態 IP 與 AWS 安全群組 SSH 逾時排查](#案例-12github-actions-動態-ip-與-aws-安全群組-ssh-逾時排查)
13. [CI/CD 動態生成 .env 檔案格式損毀與環境變數污染](#案例-13cicd-動態生成-env-檔案格式損毀與環境變數污染)
14. [Cloudflare 雙層子網域 Wildcard SSL 憑證 Handshake 失敗](#案例-14cloudflare-雙層子網域-wildcard-ssl-憑證-handshake-失敗)

### Phase 5：生產環境維運優化

15. [Docker 引擎升級 v29+ 廢棄舊 API 導致反向代理靜默路由失效](#案例-15docker-引擎升級-v29-廢棄舊-api-導致反向代理靜默路由失效)
16. [雲端磁碟 Swap I/O 懲罰與容器雙層記憶體安全限制](#案例-16雲端磁碟-swap-io-懲罰與容器雙層記憶體安全限制)
17. [防禦源站 IP 洩漏與 DDoS 攻擊：Cloudflare CIDR 收緊與 80 埠關閉策略](#案例-17防禦源站-ip-洩漏與-ddos-攻擊cloudflare-cidr-收緊與-80-埠關閉策略)

### Phase 6：量化回測引擎與策略實證

18. [量化回測未來函數 (Look-Ahead Bias) 根除與次根 K 棒開盤價撮合機制](#案例-18量化回測未來函數-look-ahead-bias-根除與次根-k-棒開盤價撮合機制)
19. [跨時框 K 線向前填充 (Forward Fill) 對齊與 15m 高頻手續費滑點磨損陷阱](#案例-19跨時框-k-線向前填充-forward-fill-對齊與-15m-高頻手續費滑點磨損陷阱)

---

## Phase 1：核心架構設計

> 專案初期搭建 NestJS 後端框架時，在 ORM 安全層、全域管線、日誌系統與安全配置上遭遇的設計挑戰。

---

### 案例 1：Prisma Extension 軟刪除攔截與密碼欄位自動隱匿

- **Situation (情境與困境)**：
  專案採用 Prisma ORM 進行資料庫操作。根據資料安全政策，所有 User 實體的刪除操作必須使用軟刪除（設定 `deletedAt` 而非真正從資料庫移除），同時所有查詢結果中的 `password` 欄位必須自動隱匿。然而 Prisma 原生並不支援這些功能，若依賴開發者手動在每個查詢中加入 `where: { deletedAt: null }` 和 `select: { password: false }`，人為遺漏的風險極高。
- **Task (目標)**：
  在 ORM 層級建立自動化的安全防護機制，讓開發者無法繞過軟刪除與密碼隱匿。
- **Action (行動與解決方案)**：
  實作了 **Prisma Client Extension (`softDeleteExtension`)**，在資料庫驅動層級攔截所有 CRUD 操作：
  1. **Delete → Update 攔截**：將所有 `delete` 和 `deleteMany` 操作自動轉換為 `update({ data: { deletedAt: new Date() } })`。
  2. **查詢自動過濾**：在 `findMany`、`findFirst`、`findUnique`、`count` 等查詢操作中自動追加 `where: { deletedAt: null }` 條件。
  3. **密碼自動隱匿**：透過 Prisma 的 `omit` 功能，在所有 User 相關查詢中自動排除 `password` 欄位。
- **Result (成果)**：
  所有開發者在使用 Prisma 時，軟刪除與密碼隱匿是**默認行為**，無需額外記憶或手動配置，從根源杜絕了資料洩漏與硬刪除的風險。

---

### 案例 2：NestJS 全域請求生命週期的分層日誌防重複寫入

- **Situation (情境與困境)**：
  系統同時配置了 `LoggingInterceptor`（負責記錄成功的 CUD 操作與慢請求）和 `HttpExceptionFilter`（負責記錄異常）。在某些邊界場景中——例如 `JwtAuthGuard` 拋出 `UnauthorizedException` 時——Interceptor 的 `error` 回呼與 Exception Filter 的 `catch` 方法**同時被觸發**，導致同一筆異常被重複寫入資料庫 `SystemLog` 兩次，浪費了有限的 EC2 PostgreSQL 連線池資源，並在日誌分析時產生干擾噪音。
- **Task (目標)**：
  設計一個跨 NestJS 管線層級的去重機制，確保每一個請求（無論成功或失敗）最多只被記錄一次日誌。
- **Action (行動與解決方案)**：
  深入研究 NestJS Request Lifecycle 執行順序（`Middleware → Guard → Interceptor(before) → Pipe → Controller → Service → Interceptor(after) → Filter`），發現 Interceptor 的 RxJS `tap({ error })` 回呼會**先於** Exception Filter 執行。據此設計了一個基於 `request` 物件的跨層通訊機制：
  1. `LoggingInterceptor` 在記錄完日誌後，於 `request` 物件上設定 `request.__systemLogged = true` 標記。
  2. `HttpExceptionFilter` 在 `catch()` 中**先檢查 `request.__systemLogged`** 標記，若已設定則跳過日誌寫入。
  3. 反之，若異常發生在 Interceptor 管轄範圍之外（如 Middleware 層），Filter 仍會正常記錄，確保無遺漏。
- **Result (成果)**：
  徹底消除了所有重複日誌寫入，同時這個實作展示了對 NestJS Request Lifecycle 執行順序的深層理解——面試中可以用此案例自然引出對框架管線的系統性闡述。

---

### 案例 3：敏感資料遞迴深層遮罩與日誌安全淨化

- **Situation (情境與困境)**：
  日誌系統需要記錄完整的 `requestBody` 以便事後除錯與審計，但 HTTP Body 中可能包含密碼、API Key、JWT Token、信用卡號等敏感欄位。直接明文寫入 `SystemLog` 資料庫將導致嚴重的資安合規問題（違反 GDPR / 個資法），一旦資料庫被洩漏，攻擊者可直接取得用戶憑證。
- **Task (目標)**：
  在不影響日誌可讀性與除錯效率的前提下，自動辨識並遮罩所有敏感欄位，且必須支援巢狀物件與陣列的深層掃描。
- **Action (行動與解決方案)**：
  實作了一個**遞迴深度限制 (maxDepth=5) 的敏感欄位偵測與遮罩工具** `maskSensitiveData()`：
  1. **敏感欄位清單**：預定義 45+ 個高風險欄位名稱，涵蓋認證類（password、token、apiKey）、金融類（creditCard、cvv）、個資類（ssn、passport）。
  2. **雙層遮罩策略**：密碼/金鑰類欄位使用「完全遮罩 (`*****`)」；卡號/身分證類欄位使用「部分遮罩（保留前後各 2 字元）」，保留最低限度的可辨識性。
  3. **遞迴安全保護**：設定最大遞迴深度 5 層，超過深度直接回傳 `[Max Depth Reached]`，防止循環引用導致的無窮遞迴。
  4. **整合至日誌管線**：在 `LoggingInterceptor` 與 `HttpExceptionFilter` 中，所有 `requestBody` 寫入 DB 前均通過 `maskSensitiveData()` 淨化。
- **Result (成果)**：
  所有進入 SystemLog 的請求內容均經過自動淨化，即使資料庫被完整匯出，攻擊者也無法從日誌中取得任何可用的憑證或敏感資訊。

---

### 案例 4：NestJS Helmet 嚴格 CSP 規則與 Scalar API 文件相容性衝突

- **Situation (情境與困境)**：
  為了通過資安漏洞掃描並防禦 XSS 攻擊，後端 NestJS 導入了 `helmet` 中介軟體並在生產環境啟動嚴格的 Content Security Policy (CSP)。上線後發現所有 API 運作正常，但對外的互動式 API 文件頁面 (`/apidoc`) 卻變成一片空白，DevTools Console 顯示大量資源被 CSP 封鎖。
- **Task (目標)**：
  兼顧生產環境 API 的資安防護（CSP headers），同時確保基於 `@scalar/nestjs-api-reference` 的文檔頁面與 Cloudflare 分析監控腳本能正常渲染。
- **Action (行動與解決方案)**：
  在 `main.ts` 中對 Helmet CSP 進行精細化授權配置。分析 Scalar 渲染引擎的依賴，發現其需要從 CDN 異步載入樣式與腳本，且包含動態渲染邏輯：
  ```typescript
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                  "'self'",
                  "'unsafe-inline'",
                  "'unsafe-eval'",
                  'https://cdn.jsdelivr.net',
                  'https://static.cloudflareinsights.com',
                ],
                styleSrc: [
                  "'self'",
                  "'unsafe-inline'",
                  'https://fonts.googleapis.com',
                  'https://cdn.jsdelivr.net',
                ],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", 'https:', 'wss:'],
              },
            }
          : false,
    }),
  );
  ```
- **Result (成果)**：
  成功在維持 API 端點嚴格安全防護的同時，放行了 `jsdelivr` CDN 與 Cloudflare 監控腳本，API 文件頁面。

---

### 案例 5：生產環境密鑰安全配置與啟動防呆檢驗 (Secure by Default)

- **Situation (情境與困境)**：
  在專案從本地開發轉向雲端 EC2 生產部署的過程中，開發與維運人員常為了求快，直接將本地開發用 `.env` 複製到生產環境，或者在 GitHub Secrets 隨意設定了諸如 `123456` 等極短的 JWT 密鑰。若缺乏自動化防禦機制，這類預設或弱密鑰將直接暴露應用程式於 JWT 偽造與權限越界攻擊的巨大風險中。
- **Task (目標)**：
  落實 **Secure by Default（預設安全）** 與 **Fail-Fast（快速失敗）** 設計原則，確保生產環境容器在啟動的第一時間即嚴格檢驗所有核心加密密鑰的強度，杜絕人為疏忽導致的安全漏洞。
- **Action (行動與解決方案)**：
  在後端 NestJS 應用的進入點 (`main.ts` bootstrap) 加入強硬的安全配置檢查約束。當偵測到執行環境為生產模式 (`NODE_ENV === 'production'`) 時，系統會自動針對 `JWT_SECRET` 與 `JWT_REFRESH_SECRET` 執行雙重檢驗：
  1. **預設黑名單過濾**：比對密鑰是否為 `.env.example` 中的預設字串（如 `your-secret-key-change-this-in-production`）。
  2. **最小熵值與長度約束**：強制要求密鑰長度必須 $\ge 32$ 字元。
     若不符合規定，應用程式會立即阻斷啟動流程並拋出致命錯誤 `Error('生產環境必須更換 JWT_SECRET ！')`，促使 CI/CD 或容器管理工具判定部署失敗並回滾。
- **Result (成果)**：
  從程式碼底層杜絕了弱密鑰與預設配置流向生產環境的可能性，建立了標準化的強密鑰生成規範（如使用 `crypto.randomBytes(32)`）。

---

## Phase 2：行情引擎開發

> 開發幣安行情資料抓取、佇列處理與 WebSocket 即時連線時遇到的高頻數據、併發與連線穩定性挑戰。

---

### 案例 6：BullMQ 高頻行情削峰去重 (Conflation) 與記憶體保護

- **Situation (情境與困境)**：
  幣安 WebSocket 每秒推送數百筆行情更新。初版設計中，系統每收到一筆更新就推入一個 BullMQ 到價比對 Job，導致佇列在尖峰市場（如加密貨幣暴漲暴跌）期間以每秒數百筆的速率膨脹，Redis 記憶體急遽上升，最終觸發 OOM Killer。
- **Task (目標)**：
  在保證到價比對即時性的前提下，控制佇列深度與記憶體消耗。
- **Action (行動與解決方案)**：
  實作 **Conflation（衝突合併）** 機制：利用 BullMQ 的 `jobId` 唯一約束，為每個交易對固定使用 `jobId: "price-check:${symbol}"` 入列。當同一交易對的前一筆 Job 仍在排隊中，BullMQ 會用新價格覆蓋舊 Job，確保佇列中每個交易對最多只有一筆待處理 Job。
  ```typescript
  await this.priceCheckQueue.add(
    'check',
    { symbol, price },
    {
      jobId: `price-check:${symbol}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  ```
- **Result (成果)**：
  佇列最大深度從「無上限膨脹」壓縮至「活躍告警幣種數」（通常 < 50），Redis 記憶體消耗維持穩定。

---

### 案例 7：K 線佇列啟動時的競態條件 (Race Condition) 與三級優先排序

- **Situation (情境與困境)**：
  `MarketScheduleService` 在系統啟動時需要預熱 9 個時間週期（5m ~ 1M）× 700+ 交易對的 K 線快取。初版設計中，每個 `enqueueKlinesForInterval()` 呼叫都會立即呼叫 `processQueue()` 啟動佇列消費器。然而，由於 Node.js 是單執行緒事件迴圈，當第一批 5m 任務入列並啟動消費器後，消費器會立即開始從佇列頭部取出任務執行，導致 5m 時框的冷門交易對被提前消費，而後續入列的 15m、1h 等更重要的熱門標的反而被排在後面——完全破壞了全局的優先排序設計。
- **Task (目標)**：
  確保系統啟動時的預熱階段，所有 9 個時框的任務完全入列並排好全局優先序後，才開始消費。
- **Action (行動與解決方案)**：
  在 `enqueueKlinesForInterval()` 新增 `startProcessor` 參數（預設 `true`），啟動預熱階段呼叫時設為 `false` 以抑制消費器啟動。完整流程如下：
  1. 預熱階段依序呼叫 9 次 `enqueueKlinesForInterval(interval, false, ...)`，全部任務入列但消費器不啟動。
  2. 每次入列後，佇列會根據**三級優先排序規則**自動重排：
     - **第一級**：熱門標的 (Volume Rank < 50) 優先於冷門標的。
     - **第二級**：同屬熱門/冷門時，短時框 (5m) 優先於長時框 (1M)。
     - **第三級**：同時框且同熱度時，成交量排行更前面的標的優先。
  3. 全部 9 輪入列完成後，才統一呼叫一次 `processQueue()`，消費器從完整且有序的佇列頭部開始依序處理。
- **Result (成果)**：
  啟動預熱完全遵守全局優先排序規則，最重要的熱門短週期 K 線最先被快取，系統上線後前端 Screener 能在最短時間內取得可用的篩選結果。

---

### 案例 8：WebSocket 半開連線看門狗與指數退避自動重連機制

- **Situation (情境與困境)**：
  系統使用 WebSocket 長連線訂閱幣安即時行情。上線後發現每隔數天，前端看板上的價格會突然「凍結」，但後端日誌與容器狀態均顯示正常——因為 WebSocket 的 `readyState` 仍然是 `OPEN`，但實際上幣安端已不再推送資料（即「半開連線 Half-Open Connection」），程式層面完全無法察覺。
- **Task (目標)**：
  設計一個主動偵測機制，能在網路層無法感知的「半開連線」場景下，自動發現並恢復即時行情推送。
- **Action (行動與解決方案)**：
  1. 實作**心跳看門狗 (Heartbeat Watchdog)**：每 10 秒記錄最後一次收到 WebSocket 訊息的時間戳 (`lastMessageAt`)。若超過 30 秒無訊息，判定為半開連線，主動觸發 `reconnect()`。
  2. 重連前**先清除所有事件監聽器** (`onclose = null`, `onerror = null`)，防止 `ws.close()` 觸發 `onclose` Handler 造成遞迴重連風暴。
  3. 重連延遲採用**指數退避 (Exponential Backoff)**：2s → 4s → 8s → ... → 最大 60s。連線成功後重設為初始值。
  4. 搭配 **REST 備援切換**：看門狗觸發重連期間，`isAlive()` 回傳 `false`，`MarketScheduleService` 的備援 Cron Job 自動啟用 REST API 輪詢。
- **Result (成果)**：
  徹底解決了價格凍結問題，實現了「WebSocket 為主、REST 為備」的雙軌行情保障。

---

## Phase 3：通知與第三方整合

> 整合 Discord 與 Telegram 多管道推送時遭遇的限流設計與安全驗證挑戰。

---

### 案例 9：Discord 通知選擇 Webhook 而非 Bot 的限流規避設計

- **Situation (情境與困境)**：
  設計多管道告警推送時，Discord 推送通知最直覺的方式是建立一個 Discord Bot 加入用戶的伺服器。然而 Discord Bot 受到**全域 Rate Limit** 約束（每個 Bot Token 全域共享限流 Bucket），當平台用戶量增長時，所有用戶的通知請求共用同一個 Rate Limit 窗口，極容易被限速甚至暫時封鎖，導致到價通知延遲或遺失——這對一個即時行情告警系統而言是無法接受的。
- **Task (目標)**：
  設計一套不受全域限流影響、能隨用戶量線性擴展的 Discord 推送方案。
- **Action (行動與解決方案)**：
  捨棄 Discord Bot 方案，改為讓每個用戶在自己的 Discord 頻道建立專屬的 **Webhook URL**，並將其儲存至 `User.discordWebhook` 欄位。系統推送通知時直接以 `axios.post(user.discordWebhook, { embeds: [...] })` 發送 Rich Embed 訊息。每個 Webhook 擁有**獨立的 Rate Limit Bucket**（由 Discord 以 Webhook ID 為單位隔離），用戶 A 的推送頻率不會影響用戶 B。
- **Result (成果)**：
  系統告警推送量可隨用戶數線性擴展，不受 Discord Bot Global Rate Limit 影響。同時省去了 Bot 需要 OAuth2 授權加入伺服器的繁瑣流程，用戶只需在 Discord 建立一個 Webhook 並貼上 URL 即可完成配置。

---

### 案例 10：Telegram 通知 Webhook 雙層身分驗證與反冒充機制

- **Situation (情境與困境)**：
  整合 Telegram 即時推送通知功能時，面臨兩大安全隱患：(1) Webhook 端點若被第三方發現，可能被偽造假通知更新 (Webhook Spoofing)；(2) 惡意 Telegram 用戶可能冒充其他用戶啟用通知，導致他人的到價通知被攔截轉發。
- **Task (目標)**：
  設計一套安全的 Telegram 通知綁定流程，確保只有經過身分驗證的合法用戶才能接收對應帳號的到價通知。
- **Action (行動與解決方案)**：
  1. **Webhook URL 隱匿**：Webhook 路由使用 Bot Token 作為 URL 路徑的一部分 (`/api/auth/telegram/webhook/${botToken}`)，第三方無法猜測完整端點。
  2. **深層連結 Token 機制**：在系統設定頁面點擊「啟用 Telegram 通知」時，後端產生一個限時 Token 存入 Redis (`tg_link:${token}`)，並將其附在深層連結 `https://t.me/BotName?start=${token}` 中，用戶點擊連結後由 Bot 接收。
  3. **三重身分驗證**：Bot 收到 `/start ${token}` 指令後依序執行：
     - ① Token 合法性：Redis 中是否存在且未過期。
     - ② 平台綁定檢查：用戶是否已在網站完成 Telegram OAuth 登入（`telegramId` 欄位已填入）。
     - ③ 帳號一致性比對：發送 `/start` 的 Telegram 帳號 `from.id` 是否與網站綁定的 `telegramId` 完全一致，不一致直接拒絕並回傳錯誤訊息。
  4. 驗證通過後僅更新 `telegramChatId`（用於發送通知的群組/私聊 ID），不涉及認證層級的綁定。
- **Result (成果)**：
  徹底杜絕了 Webhook 偽造與冒充綁定攻擊的可能性。每一步失敗都會回傳針對性的錯誤訊息，引導用戶完成正確的綁定流程。

---

## Phase 4：首次部署上線

> 將系統從本地開發環境推上 AWS EC2 生產環境時，在 CI/CD、跨架構編譯與 SSL 配置上遭遇的部署障礙。

---

### 案例 11：AWS Graviton (ARM64) 跨架構編譯與 ECR 免憑證轉發

- **Situation (情境與困境)**：
  為了大幅降低 AWS EC2 主機成本並提升運算效能，我們將生產伺服器選用了基於 AWS Graviton 晶片的 `t4g.micro` 系列實例（ARM64 架構）。然而 CI/CD 構建完 Docker 映像檔放上 EC2 執行時，容器瞬間當掉，日誌僅留下 `exec format error`。此外，為了從 EC2 拉取 ECR 私有映像檔，原本需要在 EC2 上配置 AWS CLI 與設定 IAM 實體權限，增加維護負擔與金鑰外洩風險。
- **Task (目標)**：
  解決跨 CPU 架構的編譯相容性問題，並設計一套「零 AWS CLI 相依」的 EC2 極簡部署流程。
- **Action (行動與解決方案)**：
  1. 在 GitHub Actions 引入 `docker/setup-qemu-action` 與 `setup-buildx-action`，於 `build-push-action` 明確指定編譯目標為 `platforms: linux/arm64`。
  2. 設計 **Token 管道轉發機制**：在 CI/CD Runner 端透過 IAM Credentials 取得 ECR 臨時授權 Token，接著透過 SSH 管道直接傳給遠端 EC2 的 Docker Daemon：
     ```bash
     echo "$ECR_TOKEN" | ssh -i key.pem ec2-user@host "docker login --username AWS --password-stdin <ecr-url>"
     ```
- **Result (成果)**：
  EC2 主機完全不需要安裝繁重的 AWS CLI 或綁定複雜的 Instance Profile，即可安全拉取 ARM64 架構專用的映像檔。

---

### 案例 12：GitHub Actions 動態 IP 與 AWS 安全群組 SSH 逾時排查

- **Situation (情境與困境)**：
  雲端安全最佳實踐要求 EC2 的 SSH 22 埠不可以對全世界 (`0.0.0.0/0`) 開放。但因為 GitHub Actions 雲端 Runner 每次執行的 IP 都是動態隨機的，導致部署腳本在嘗試 SSH 連入 EC2 時必定卡住，最後噴出 `dial tcp ***:22: i/o timeout`。
- **Task (目標)**：
  在不開放 22 埠危險權限的前提下，實現 CI/CD 自動化安全連線。
- **Action (行動與解決方案)**：
  1. 在 CI 腳本中加入步驟，透過 `curl -s https://checkip.amazonaws.com` 取得當前 Runner IP，調用 AWS CLI 動態加入 EC2 安全群組白名單，部署完後再利用 `if: always()` 確實移除白名單。
  2. **細節坑踩破**：實作初期 AWS CLI 狂噴 Invalid Parameter 錯誤，仔細除錯發現 API 回傳的 IP 字尾隱藏了換行符號 `\n`！立刻補上 `tr -d '\n'` 清洗字串：
     ```bash
     RUNNER_IP=$(curl -s https://checkip.amazonaws.com | tr -d '\n')
     aws ec2 authorize-security-group-ingress --group-id $AWS_SG_ID --protocol tcp --port 22 --cidr ${RUNNER_IP}/32
     ```
- **Result (成果)**：
  兼顧了雲端網路安全防護（SSH 零對外開放）與 CI/CD 完全自動化部署。

---

### 案例 13：CI/CD 動態生成 `.env` 檔案格式損毀與環境變數污染

- **Situation (情境與困境)**：
  最初為了優化 CI/CD 流程，在 GitHub Actions 採用 `toJson(secrets)` 自動將所有密鑰傾倒寫入伺服器的 `.env` 檔案。結果導致 `docker compose up` 啟動失敗，甚至 API 容器在解析環境變數時拋出 Fatal Error 崩潰。
- **Task (目標)**：
  找出自動化腳本寫入 `.env` 時造成的語法損毀根因，重構安全、白標化的環境變數注入機制。
- **Action (行動與解決方案)**：
  1. 排查發現 GitHub Secrets 包含了 `SSH_PRIVATE_KEY`（含有數十行 `---BEGIN RSA PRIVATE KEY---` 換行符）以及帶有 `$`、`"`、`'` 等 Shell 特殊字元的密碼。全量傾倒時破壞了 `.env` 的 `KEY=VALUE` 換行解析規範。
  2. 提出 **「基礎設施金鑰與應用環境分離」** 原則。SSH Key、AWS Security Group ID 等僅在 GitHub Runner 內暫存；對 EC2 寫入 `.env` 時，採逐項白標映射與嚴格過濾。
- **Result (成果)**：
  徹底杜絕了特殊字元與多行憑證破壞設定檔的隱患，CI/CD 部署成功率。

---

### 案例 14：Cloudflare 雙層子網域 Wildcard SSL 憑證 Handshake 失敗

- **Situation (情境與困境)**：
  專案採用 Cloudflare 作為前端 DNS 託管與 DDoS 防護。當初為了架構語意清晰，將後端 API 網域規劃為雙層子網域 `api.crypto-sniper.yourdomain.com`。然而部署上線後，當前端發起 API 請求時，瀏覽器直接噴出 SSL 握手失敗錯誤 (`ERR_SSL_VERSION_OR_CIPHER_MISMATCH` / `SSL_ERROR_BAD_CERT_DOMAIN`)，導致整個應用癱瘓。
- **Task (目標)**：
  在不增加額外購買付費 SSL 憑證成本（Cloudflare Advanced Certificate Manager 每網域每月 $10 USD）的前提下，修復 HTTPS 加密連線問題。
- **Action (行動與解決方案)**：
  1. 深入研究 RFC 6125 SSL/TLS 規範與 Cloudflare Universal SSL 憑證機制，發現免費的萬用憑證 `*.yourdomain.com` 僅能匹配**單層（Single-level）子網域**。
  2. 當訪客請求 `api.crypto-sniper.yourdomain.com`（雙層）時，Cloudflare 憑證不匹配，瀏覽器基於安全性強制斷線。
  3. 實施**網域扁平化策略 (Subdomain Flattening)**：將 DNS 路由與環境變數統一調整為單層結構 `api-crypto-sniper.yourdomain.com` 與 `monitor-crypto-sniper.yourdomain.com`，同時在 Traefik 路由規則同步修正。
- **Result (成果)**：
  零成本解決了 SSL 憑證握手失敗問題，所有 API 請求順利通過 Cloudflare 加密通道。

---

## Phase 5：生產環境維運優化

> 系統上線後在長期營運中陸續遭遇的相容性破壞、資源瓶頸與安全防禦強化。

---

### 案例 15：Docker 引擎升級 v29+ 廢棄舊 API 導致反向代理靜默路由失效

- **Situation (情境與困境)**：
  某次 AWS EC2 系統升級後，Cloudflare 突然報出 **521 Web Server Is Down**。登入主機排查，發現 PostgreSQL、Redis、NestJS API 和 Next.js Web 容器全部處於 `Up (healthy)` 狀態，應用程式本身毫無異常，但外部流量就是無法進入。
- **Task (目標)**：
  找出反向代理層與底層容器引擎之間的靜默斷連原因，並修復路由轉發。
- **Action (行動與解決方案)**：
  1. 深入檢視 Traefik 代理容器的 Debug 系統日誌，發現 `docker provider` 不停拋出對 Docker Socket 通訊拒絕的警告。
  2. 查閱 Docker v29 版本發布公告，發現新版 Docker Engine 徹底廢棄了過舊的 Daemon API 版本（低於 v1.44 的支援）。而我們使用的舊版 Traefik 預設使用舊 API 溝通，導致其完全抓不到後端應用容器的 Labels 標記，動態路由表變成了空白。
  3. 將 Traefik 映像檔升級至最新穩定版 `v3.6`，並在 `docker-compose.prod.yml` 明確注入環境變數 `DOCKER_API_VERSION=1.46`。
- **Result (成果)**：
  反向代理與 Docker Daemon 重新建立通訊，路由表自動恢復掛載。

---

### 案例 16：雲端磁碟 Swap I/O 懲罰與容器雙層記憶體安全限制

- **Situation (情境與困境)**：
  系統在面對突發流量時，AWS EC2 監控圖表顯示 Disk I/O 嚴重壅塞（I/O Penalty），伺服器回應極度緩慢，偶爾伴隨 Redis 容器被 OOM Killed。
- **Task (目標)**：
  在有限的 EC2 記憶體資源下，根治磁碟 I/O 飆高與容器隨機被殺的問題。
- **Action (行動與解決方案)**：
  1. 分析發現雖然在 `docker-compose.prod.yml` 給 Redis 設了 `limits: memory: 40M`，但這是 **Docker 外層硬限制**。Redis 內部不知情，持續配置記憶體直到觸頂，導致 Linux 核心為了自保，頻繁將分頁換出到 EBS 雲端硬碟（Swap），引發災難性的磁碟 I/O 延遲。
  2. 總結並落實 **「內外雙層限制法則」 (Inner Limit < Outer Limit)**：
     ```yaml
     redis:
       # 內部限制：限制 Node 到 28MB 就執行 volatile-lru 淘汰，絕對不觸碰 OS 換頁底線
       command: redis-server --maxmemory 28mb --maxmemory-policy volatile-lru
       deploy:
         resources:
           limits:
             memory: 40M # 外部硬限制：保留 12MB 給 OS 網路連接緩衝
     ```
- **Result (成果)**：
  Swap 磁碟交換率降為 0，Disk I/O 恢復平穩，系統在高併發行情推送下的延遲降低了 65%，再無 OOM 事件發生。

---

### 案例 17：防禦源站 IP 洩漏與 DDoS 攻擊：Cloudflare CIDR 收緊與 80 埠關閉策略

- **Situation (情境與困境)**：
  在許多雲端架構中，開發者習慣將 EC2 安全群組的 80 (HTTP) 與 443 (HTTPS) 埠對全世界 (`0.0.0.0/0`) 開放。然而這存在嚴重的致命死角：一旦駭客透過網際網路全網段端口掃描或 DNS 歷史紀錄，探測出 EC2 伺服器的真實公網 IP，即可繞過 Cloudflare 的 WAF 與 DDoS 防禦罩，直接向 EC2 發動 HTTP 洪水攻擊或進行漏洞掃描，導致源站崩潰。
- **Task (目標)**：
  實現**頂級源站防護 (Origin Shielding)**，確保 EC2 主機「完全無法被網際網路上任何非 Cloudflare 代理的請求訪問」。
- **Action (行動與解決方案)**：
  1. **完全關閉 HTTP (80 埠)**：由於 Cloudflare 邊界已啟用強制 HTTPS 重定向，所有訪客流量進入網路前線即已加密，源站 EC2 根本不需要監聽或接受明文 HTTP 請求，直接關閉 80 埠減小攻擊面。
  2. **鎖死 443 埠為 Cloudflare IPv4 白名單**：將安全群組 443 傳入規則從 `0.0.0.0/0` 移除，改為嚴格配置 Cloudflare 官方公布的 15 組 IPv4 CIDR 網段。
  3. **專家級架構優化 (VPC Managed Prefix List)**：為了避免在多個安全群組中手動維護 15 筆 IP 導致繁瑣與易錯，團隊在 AWS VPC 控制台建立了一組**受管前綴清單 (Managed Prefix List)** 統一納管這 15 個 CIDR。安全群組傳入規則只需引用該前綴清單 ID，日後 Cloudflare 網段異動時只需單點修改前綴清單，全網域主機防火牆自動同步生效。
- **Result (成果)**：
  成功打造了「隱形源站」，任何試圖直接繞過 CDN 攻擊主機真實 IP 的封包都在 AWS VPC 網路層直接被丟棄 (Drop)，同時透過前綴清單將防火牆維護成本降低。

---

## Phase 6：量化回測引擎與策略實證

> 構建量化回測系統時，在防範未來函數、跨時框向前填充、手續費滑點磨損與資金管理模型上遭遇的挑戰。

---

### 案例 18：量化回測未來函數 (Look-Ahead Bias) 防範與次根 K 棒開盤價撮合機制

- **Situation (情境與困境)**：
  在開發量化回測引擎初期，常見的回測模型往往以「訊號觸發當根 K 棒的收盤價 (Close)」或「當根最高/最低價」進行開倉撮合。這在歷史回測中表面上能產生較高的回報。然而一旦切換至實盤對接，發現實盤不可能在 Bar $i$ 收盤的同一瞬間以該收盤價成交（因為收盤價唯有在該 K 棒走完的最後一刻才確定，實盤下單必然延遲至下一根 K 棒）。這種方式容易引入**未來函數 (Look-Ahead Bias)**，導致回測與實盤產生巨大落差。
- **Task (目標)**：
  防範未來函數，建立具備可重現性 (Reproducibility) 的量化撮合架構，提升回測結果的參考價值。
- **Action (行動與解決方案)**：
  1. **次根 K 棒開盤價撮合 (Bar $i+1$ Open Execution)**：在 `BacktestEngine` 撮合引擎核心迴圈中嚴格規定：當在 Bar $i$ 評估指標產生買進訊號時，系統僅將該訊號標記為確認，**強制於 Bar $i+1$ 的 `open` 價格撮合成交**。
  2. **基於已閉合 K 棒確認訊號**：指標計算嚴格基於已收盤之 K 線序列，避免在當前正在即時跳動的未閉合 K 棒中產生假訊號。
  3. **雙向摩擦成本扣減**：開倉與平倉均扣除 0.05% 幣安合約 Taker 手續費以及 0.02%~0.05% 市價滑點，還原訂單簿深度衝擊。
- **Result (成果)**：
  避免了回測過度樂觀的虛胖現象，使策略回測評估更貼近真實市場環境與交易執行依據。

---

### 案例 19：跨時框 K 線向前填充 (Forward Fill) 對齊與 15m 高頻手續費滑點磨損

- **Situation (情境與困境)**：
  1. **跨時框數據滲漏**：當量化策略結合長週期趨勢濾網（如 1D EMA100）與小時框進場訊號（如 4H 或 15m EMA 金叉）時，資料庫中 1D K 線與小時框 K 線的時間戳並不齊平。若簡單地以相同 index 對齊，或使用了當天尚未結束的 1D K 線收盤價，將發生「未來數據滲漏 (Information Leakage)」。
  2. **短線高頻交易盲點**：使用者通常直覺認為 15m 短線週期靈活、交易次數多，預期短線策略應該比 1D/4H 長線賺更多。但實測初步結果卻頻繁產生負收益或大幅回撤，引發對策略邏輯的質疑。
- **Task (目標)**：
  1. 實作高精度的跨時框向前填充 (Forward Fill) 對齊演算法，確保在任何短週期時間點 $T$，僅能獲取已經完整收盤的大時框歷史指標。
  2. 透過量化數據剖析 15m 短線策略績效不佳的本質原因，提供客觀數據依據。
- **Action (行動與解決方案)**：
  1. **跨時框向前填充 (Forward Fill Alignment)**：
     - 在 `BacktestEngine.alignMultiTimeframe` 中，以主交易時框的時間戳陣列為主軸。
     - 遍歷每個主時框 K 棒時，掃描大時框 K 線，過濾條件嚴格設為：`higherKline.openTime + higherKlineIntervalMs <= currentCandle.openTime`。只有在大時框已經完全收盤時，其指標才被「向前填充」至當前小時框。
  2. **高頻交易摩擦磨損量化分析**：
     - 透過回測引擎的詳細交易日誌統計，15m 短線在長期回測中觸發頻繁交易。即便單筆停損僅 3%，雙向 0.05% 手續費與滑點在數百次進出場下累計大幅侵蝕本金。
     - 加上 15m 雜訊較多，頻繁觸發停損與手續費磨損，使短線雙均線策略容易受交易摩擦侵蝕，相較之下較大時框（如 4H）趨勢交易能更有效降低交易頻率與摩擦成本。
- **Result (成果)**：
  實現跨時框對齊機制；同時將短週期摩擦損耗分析寫入指引文件，說明大時框趨勢策略與組合分散在降低交易摩擦上的特性。
