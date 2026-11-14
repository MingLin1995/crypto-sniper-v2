# CryptoSniper v2 資安政策與防護架構 (Security Policy)

## 支援版本 (Supported Versions)

目前僅針對 CryptoSniper v2 (`2.x`) 主線版本提供安全性更新與漏洞修補：

| 版本    | 支援狀態           | 說明                                     |
| :------ | :----------------- | :--------------------------------------- |
| `2.x`   | :white_check_mark: | 目前正式營運與持續維護版本               |
| `1.x`   | :x:                | 已停止維護（Legacy Express + MongoDB）   |

---

## 安全漏洞通報 (Reporting a Vulnerability)

若您在本專案中發現潛在的安全性漏洞或敏感資訊暴露風險，請勿直接於公開 Issue 中揭露細節或利用程式 (Exploit)。

1. 請透過專案維護者之私人聯繫管道或 GitHub Security Advisory（Private Vulnerability Reporting）回報。
2. 通報內容建議包含：受影響的端點或模組、重現步驟、潛在影響評估與建議修補方向。
3. 我們會在確認通報後儘速進行風險評估、修補驗證與上線部署，並於修補完成後同步更新對應之架構與維運文件。

---

## 多層縱深資安控制 (Defense-in-Depth Architecture)

CryptoSniper v2 於網路、傳輸、認證、資料庫、日誌與觀測層實作以下強制性安全控制：

1. **網路與邊界隔離 (L3/L4)**：
   - 正式環境結合 Cloudflare WAF 代理與 AWS VPC Prefix List 僅放行 Cloudflare IP；關閉 80 Port，所有對外流量經 Traefik v3 強制升級為 HTTPS (TLS Full Strict)。
   - PostgreSQL、Redis、Prometheus 僅存在內部 Docker 網路 (`app-network-prod`)，不對公網暴露埠口。
2. **應用層前置防禦 (L7)**：
   - `IpBlacklistMiddleware` 透過 Redis Set ($O(1)$) 快速封鎖惡意 IP（Redis 異常時自動降級查詢 PostgreSQL）。
   - 全域 `ThrottlerGuard` 速率限制、Cloudflare Turnstile 人機驗證與 DTO `ValidationPipe`（`whitelist: true` + `forbidNonWhitelisted: true` + 具名驗證 DTO 如 `RebindOAuthDto`）。
3. **身份認證與第三方 OAuth 防護**：
   - 全 API 預設受 `JwtAuthGuard` + `RolesGuard` 保護，僅顯式標註 `@Public()` 端點豁免；生產環境啟動時強制檢查 `JWT_SECRET` / `JWT_REFRESH_SECRET` 長度與強度（Fail-Fast）。
   - Access Token 與 Refresh Token 皆採 HttpOnly Secure Cookie 傳輸，支援 Refresh Token Rotation 與 User-Agent 異常劫持偵測。
   - OAuth State Token 存於 Redis（短 TTL 防 CSRF）；重導向一律經 `resolveSafeOrigin()` 比對允許網域白名單，防範 Open Redirect 攻擊。
   - Telegram Webhook Token 比對與 Telegram Login Widget HMAC-SHA256 簽章比對皆採用 **SHA-256 雜湊後 `crypto.timingSafeEqual` 常數時間驗證**，防範時序側信道推敲攻擊。
4. **資料層與帳號生命週期完整性**：
   - 密碼皆以 `bcrypt`（10 rounds）雜湊；透過 **Prisma Client Extension (`softDeleteExtension`)** 自動將 `User` 刪除改為 `deletedAt` 軟刪除、查詢預設過濾已刪除用戶並全域隱匿 `password` 欄位。
   - 用戶軟刪除時同步停用名下有效 `PriceAlert` 並清除 `WebSubscription`，OAuth 帳號強制合併時亦於 Prisma `$transaction` 內完整轉移關聯資產並撤銷舊 Refresh Token。
5. **日誌、連線與可觀測性防護**：
   - `maskSensitiveData()`（遞迴遮罩 45+ 敏感鍵名）搭配 `maskSensitiveUrl()`（自動遮罩 `/telegram/webhook/<token>` 路徑憑證與 `?code=` / `?token=` / `?rebindToken=` 等查詢參數）於 `LoggingInterceptor` 與 `HttpExceptionFilter` 寫入日誌前淨化敏感資訊。
   - Redis 連線字串日誌遮罩密碼段，並於斷線重連時防止重複包裝 `client.get`。
   - Prometheus HTTP 指標對未匹配路由正規化為固定標籤 `'UNMATCHED_ROUTE'`，防範隨機 404 路徑引發高基數 (High-Cardinality) 記憶體耗盡 DoS。
