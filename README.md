# CryptoSniper v2 - Monorepo Enterprise Platform

CryptoSniper v2 是一款基於 Monorepo 架構設計的企業級加密貨幣即時監控、策略篩選與到價告警系統。本專案整合了 NestJS 後端、Next.js 前端與共享型別庫，並特別針對極限制的硬體資源（如 AWS EC2 `t4g.micro`，僅 1GB 記憶體與 8GB 磁碟）進行了效能與容錯設計，實現 700+ 交易對的秒級監控與篩選。

---

## 核心架構亮點

### 1. 高頻行情監控與自適應限流

- **WebSocket 單連線訂閱**：採用幣安 WebSocket 訂閱全市場 ticker 行情更新，大幅節省 API 權重。配置 30 秒看門狗與指數退避重連，並在連線失效時自動切換至 REST 備援輪詢。
- **BullMQ 削峰去重 (Conflation)**：利用相同的 `jobId: "price-check:${symbol}"` 對排隊中的行情任務進行覆蓋，防止快市期間佇列無效堆積引發 Redis OOM。
- **冷熱標的分流與模除輪詢**：根據 24h 成交量排名，熱門標的（前 50 名）即時更新，冷門標的實施模除輪詢（如更新週期為 5m 時僅輪詢更新 1/3 的冷門標的），減少 66% API 權重消耗。
- **自適應 API 權重限制**：Axios 攔截器實時監控 `X-MBX-USED-WEIGHT-1M` 反饋，動態將請求延遲從 100ms 延長至最大 3000ms，徹底防範 429 封鎖。

### 2. 縱深安全防禦

- **七層全域管線**：NestJS 請求管線嚴格按「IP 黑名單 (O(1) 複雜度) ➔ ThrottlerGuard 速率限制 ➔ JwtAuthGuard 全域 JWT 驗證 ➔ RolesGuard 權限角色 ➔ ValidationPipe DTO 白名單 ➔ 業務邏輯 ➔ 日誌/可觀測性」順序處置。
- **雙 Token 驗證與 Session 劫持防禦**：Access Token (30min) + Refresh Token (7d) 寫入 HttpOnly Secure Cookie。Refresh Token 提供旋轉更新 (Rotation) 並透過 `User-Agent` 比對偵測 Session 劫持。
- **OAuth 安全合併與 Email 衝突保護**：第三方 OAuth Email 若與現有密碼帳號衝突，強制拒絕自動合併以防範帳號接管攻擊；臨時帳號與主帳號的合併則由 Prisma `prisma.$transaction` 原子事務確保資產安全轉移。
- **敏感日誌深層遮罩**：所有進入 `SystemLog` 的資料在寫入資料庫前，均經過 `maskSensitiveData()` 遞迴深層淨化，對 45+ 敏感欄位進行隱碼處理。

### 3. Redis 空間優化與降級防護

- **高效選型**：最新成交價使用單一 **Redis Hash** 扁平化儲存，避免產生大量 Key 與記憶體碎片；IP 黑名單與活躍幣種使用 **Redis Set**，提供 O(1) 的超高速比對。
- **極限容量保護**：生產環境實施「內外雙層限制法則」，設定 Redis 記憶體淘汰機制 (`--maxmemory 28mb` & `volatile-lru`)，配合 Docker 外層限制，防止分頁換出（Swap）拖垮 EC2 I/O。
- **故障自動降級**：若 Redis 連線中斷，黑名單過濾將自動降級改為查詢 PostgreSQL 資料庫，確保防禦不中斷。

---

## 技術棧一覽

| 類別              | 技術                      | 說明                                                      |
| :---------------- | :------------------------ | :-------------------------------------------------------- |
| **Runtime**       | Bun 1.x                   | 超快速的 JavaScript 執行環境、套件管理器與 Test Runner    |
| **Monorepo**      | Turborepo                 | 專案建置、打包與任務快取管線優化工具                      |
| **Backend**       | NestJS 11.x (TS 5.x)      | 強型別、架構嚴謹的全功能 Node.js 後端框架                 |
| **Frontend**      | Next.js 14.x (App Router) | React 前端框架，支援伺服器渲染 (SSR) 與路由守衛           |
| **Database**      | PostgreSQL 16             | 核心關聯式資料庫，支援 ACID 事務                          |
| **ORM**           | Prisma 7.x (v7.2.0)       | 現代化強型別資料庫 ORM，支援 Client Extension 擴充        |
| **Cache / Queue** | Redis 7.x + BullMQ        | 高速快取、黑名單 Set 以及基於 Redis 的非同步任務/告警佇列 |
| **Reverse Proxy** | Traefik v3.6              | 容器化邊界路由，依據 Subdomain 自動動態分流與 SSL 終止    |
| **CI/CD**         | GitHub Actions            | 執行單元測試、跨平台編譯 (ARM64/AMD64) 並推送至 AWS ECR   |
| **Observability** | Prometheus + Grafana      | 內部監控指標採集與視覺化儀表板                            |

---

## 專案目錄結構

```
crypto-sniper-v2/
├── apps/
│   ├── api/                    # NestJS 11.x 後端 API 服務 (內部埠口 3000)
│   │   ├── src/                # 業務邏輯 (Auth, Users, Tasks, Logs)
│   │   └── prisma/             # Prisma Schema 與 Seed 資料
│   └── web/                    # Next.js 14.x App Router 前端介面 (內部埠口 3001)
│       └── src/                # 前端頁面與組件
├── packages/
│   └── shared/                 # 前後端共享之型別定義與 DTO 規範 (workspace:*)
├── prometheus/                 # Prometheus 設定檔
├── docs/                       # 系統設計、配置與踩坑指南等詳細文檔
├── dev.sh                      # 本地開發環境一鍵啟動腳本
├── deploy.sh                   # 生產環境部署腳本
├── package.json                # Turborepo 根目錄配置與工作區宣告
└── turbo.json                  # Turborepo 建置管線配置
```

---

## 快速啟動開發環境

確保您的本機已安裝 [Bun](https://bun.sh/)、Docker 與 Docker Compose。

### 1. 安裝依賴項目

在專案根目錄下執行：

```bash
bun install
```

### 2. 啟動本機開發容器

執行以下指令，系統會自動根據 `.env.example` 建立本機環境變數 `.env`，並啟動所有的開發容器（包括 PostgreSQL、Redis、NestJS API 和 Next.js Web）：

```bash
bun run dev
```

啟動完成後，您可以透過以下入口存取：

- **前端 Web 應用**：[http://localhost:3001](http://localhost:3001)
- **後端 API Swagger 文檔**：[http://localhost:3000/apidoc](http://localhost:3000/apidoc)

### 3. 初始化本地資料庫與 Seed 測試資料

在另一個終端機中執行，以在 Docker 容器內完成資料庫表格建立與測試資料寫入（預設管理員帳密：`admin001` / `000000`）：

```bash
# 執行資料庫 Migration (開發環境)
docker compose -f docker-compose.dev.yml exec app bun run prisma:migrate

# 寫入預設測試資料 (Idempotent Seed)
docker compose -f docker-compose.dev.yml exec app bun run prisma:seed
```

---

## 生產環境部署概要

專案實踐了**零手動部署 (Zero-touch CI/CD)**，任何推送至 `main` 分支的程式碼均會自動觸發以下流程：

1. **GitHub Actions 測試**：執行 Jest 單元測試，並產生 JUnit 測試報告。
2. **QEMU & Buildx 跨架構編譯**：專為 AWS Graviton (`t4g.micro`) 實例編譯 `linux/arm64` 映像檔。
3. **AWS ECR 安全推送**：推播至私有 ECR 儲存庫，並自動透過生命週期規則（自動清理懸空映像檔，僅保留最新 5 個）降低 AWS 帳單費用。
4. **AWS 安全群組動態白名單**：CI/CD 透過三重回退 IP 查詢（Amazon, ifconfig.me, ipify.org）取得 Runner 的公網 IP，臨時將其加入 EC2 SSH 22 埠的防火牆白名單。
5. **安全滾動升級**：將 `.env` 與 Cloudflare 源站 SSL 憑證經由 SCP 傳送至 EC2，再透過 SSH 觸發 `docker compose pull && up -d` 無縫滾動重啟，最後執行 `bunx prisma migrate deploy` 完成正式環境資料庫遷移。
6. **防火牆復原**：部署結束後（不論成功或失敗），必定觸發 `if: always()` 清除 Runner IP 的 SSH 權限，確保源站安全性。

---

## 系統文件索引

所有的詳細架構設計與踩坑指引，均已彙整於 `docs/` 目錄中：

1. **[系統架構與全端資料流向指南 (docs/SYSTEM_ARCHITECTURE_AND_DATA_FLOWS.md)](./docs/SYSTEM_ARCHITECTURE_AND_DATA_FLOWS.md)**
   - 詳細分析了系統的 9 大核心資料流向、資料庫實體關係圖 (ERD)、Redis Key 空間設計，以及 NestJS 七層防禦管線架構。
2. **[雲端基礎設施配置與 EC2 部署指南 (docs/CLOUD_INFRASTRUCTURE_SETUP.md)](./docs/CLOUD_INFRASTRUCTURE_SETUP.md)**
   - 記錄了 AWS ECR 私有庫建立、Cloudflare DNS 與 SSL Full (Strict) 原生憑證掛載、Docker Log Rotation 日誌旋轉策略、Prometheus 容量保護，以及動態 SSH 白名單機制。
3. **[CryptoSniper v2 踩坑指南 (docs/GUIDE_TO_PITFALLS.md)](./docs/GUIDE_TO_PITFALLS.md)**
   - 收錄了 17 個開發與運維過程中真實發生的「血淚踩坑案例」，涵蓋 Prisma client 擴充、半開連線看門狗、Discord 限流規避、Cloudflare 雙層子網域證書握手失敗、以及 Redis Swap 懲罰等技術細節。
4. **[補充技術設計細節 (docs/SUPPLEMENTARY_TECHNICAL_DETAILS.md)](./docs/SUPPLEMENTARY_TECHNICAL_DETAILS.md)**
   - 收錄了 Monorepo 工作空間架構、OAuth Email 衝突處理策略、Telegram Widget 簽名驗證、OAuth 解綁安全、WebSocket 重連防事件洩漏與定時清理排程等 6 個特色設計細節。
5. **[第三方 API 金鑰配置說明 (docs/API_KEYS_SETUP.md)](./docs/API_KEYS_SETUP.md)**
   - 包含 Binance API、Telegram Bot API、Discord Webhook 以及 PWA Web Push 憑證的申請與本地/雲端配置說明。
6. **[新專案設定與部署指南 (docs/PROJECT_SETUP.md)](./docs/PROJECT_SETUP.md)**
   - 提供更詳細的本地開發細節、Prisma 各式 CLI 操作命令指引，以及常用 NestJS 指令。

---

## 授權條款

本專案採用 [MIT License](./LICENSE) 授權。
