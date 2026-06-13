# CryptoSniper v2 - Monorepo Enterprise Template

CryptoSniper v2 是一款基於 Monorepo 架構設計的企業級加密貨幣交易與監控系統基礎模板。本專案將 NestJS 後端、Next.js 前端與共用型別庫整合在單一工作區中，提供快速且一致的開發與部署流程。

---

## 🚀 快速啟動開發環境

本專案使用 Docker 將主服務、資料庫與快取進行容器化配置，您只需安裝 Bun 即可開始。

### 1. 安裝與依賴處理
確保本機已安裝 [Bun](https://bun.sh/) 與 Docker/Docker Compose。在根目錄執行：
```bash
bun install
```

### 2. 啟動所有服務
執行以下指令，系統會自動根據 `.env.example` 建立 `.env` 檔案，並啟動所有的 Docker 容器（包含 PostgreSQL, Redis, NestJS, Next.js）：
```bash
bun run dev
```

* **前端 Web 應用**：[http://localhost:3001](http://localhost:3001)
* **後端 API Swagger 文檔**：[http://localhost:3000/apidoc](http://localhost:3000/apidoc)

### 3. 初始化資料庫與 Seed 資料
在另一個終端機執行以建立資料庫表格並導入預設管理員（預設帳密：`admin001` / `000000`）：
```bash
# 執行 DB Migration
docker compose -f docker-compose.dev.yml exec app bun run prisma:migrate

# 寫入預設測試資料 (Seed)
docker compose -f docker-compose.dev.yml exec app bun run prisma:seed
```

---

## 📁 專案目錄結構

```
crypto-sniper-v2/
├── apps/
│   ├── api/                    # NestJS 11.x 後端 API 服務 (對外 Port 3000)
│   │   ├── src/                # 業務邏輯 (Auth, Users, Tasks, Logs)
│   │   └── prisma/             # Prisma Schema 與 Seed 資料
│   └── web/                    # Next.js 14.x App Router 前端介面 (對外 Port 3001)
│       └── src/                # 前端頁面與組件
├── packages/
│   └── shared/                 # 前後端共享之資料型別與 DTO 規範
├── docs/                       # 設計與設定相關文檔
├── dev.sh                      # 開發環境啟動腳本
├── deploy.sh                   # 生產環境部署腳本
├── package.json                # Turborepo 根目錄配置與工作區宣告
└── turbo.json                  # Turborepo 建置管線配置
```

---

## 🛠️ 技術棧一覽

| 類別 | 技術 | 說明 |
| :--- | :--- | :--- |
| **Runtime** | Bun 1.x | 超快速的 JavaScript 執行環境與套件管理器 |
| **Monorepo** | Turborepo | 專案建置與打包管線優化工具 |
| **Backend** | NestJS 11.x | 強型別、架構嚴謹的 Node.js 後端框架 |
| **Frontend** | Next.js 14.x | React App Router 前端伺服器渲染框架 |
| **Database** | PostgreSQL 16 | 關聯式資料庫 |
| **ORM** | Prisma 7.x | 現代化 TypeScript 類型的資料庫 ORM |
| **Cache** | Redis 7.x | 行情數據快取與 Session 儲存 |
| **Queue** | BullMQ | 基於 Redis 的高效能非同步任務/告警佇列 |
| **Container**| Docker | 開發/生產環境容器化隔離 |

---

## 🔒 安全防護機制

1. **二階驗證與防護**：
   - 密碼使用 `bcrypt` 進行 10 次雜湊（Salt rounds）。
   - Prisma 查詢結果會自動排除（Omit）密碼欄位以防外洩。
2. **全域安全守衛**：
   - 使用 `JwtAuthGuard` 作為全域認證守衛（可使用 `@Public()` 裝飾器豁免）。
   - 使用 `@Roles()` 裝飾器進行細粒度的 RBAC 角色權限控管。
   - 使用 `Helmet` 設定網頁安全標頭，並內建 `Throttler` 防止 API 遭受暴力破解 (Rate Limiting)。
3. **敏感資料遮罩**：
   - 系統日誌 (`LoggingInterceptor`) 會自動將敏感資訊（如 `password`, `token`）進行隱碼遮罩。

---

## 📖 相關文件

* [開發里程碑與追蹤計畫 (ROADMAP.md)](./ROADMAP.md) - 詳細記錄了 Phase 0 ~ Phase 5 的實作狀態與規劃。
* [新專案設定與部署指南 (docs/PROJECT_SETUP.md)](./docs/PROJECT_SETUP.md) - 提供更詳細的環境變數配置、DB 運維與 Nest CLI 常用指令。

---

## 📄 授權條款

本專案採用 [MIT License](./LICENSE) 授權。
