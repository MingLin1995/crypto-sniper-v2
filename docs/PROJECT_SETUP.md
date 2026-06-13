# CryptoSniper v2 專案設定與部署指南

本文檔說明如何設定與啟動 CryptoSniper v2 的開發與生產環境。

## 1. 專案架構概覽 (Monorepo)

本專案使用 Turborepo + Bun Workspaces 建立，結構如下：

- **`apps/api`**：NestJS 11.x 後端服務（對外埠口 `3000`）。
- **`apps/web`**：Next.js App Router 前端介面（對外埠口 `3001`）。
- **`packages/shared`**：前後端共享的資料型別與 DTO 規範。

---

## 2. 環境變數設定 (.env)

在專案根目錄下，複製 `.env.example` 並命名為 `.env`：

```bash
cp .env.example .env
```

請依需求編輯 `.env` 中的關鍵設定：

| 變數名稱 | 預設值 | 說明 |
| :--- | :--- | :--- |
| `PROJECT_NAME` | `crypto-sniper` | Docker 容器與網路名稱的前綴 |
| `POSTGRES_USER` | `dev_user` | PostgreSQL 使用者名稱 |
| `POSTGRES_PASSWORD` | `dev_password`| PostgreSQL 密碼 |
| `POSTGRES_DB` | `crypto_dev` | PostgreSQL 資料庫名稱 |
| `JWT_SECRET` | (強隨機字串) | JWT Access Token 簽章密鑰 (生產環境必改) |
| `JWT_REFRESH_SECRET`| (強隨機字串) | JWT Refresh Token 簽章密鑰 (生產環境必改) |

---

## 3. 開發環境啟動 (Docker)

專案已將資料庫 (PostgreSQL)、快取 (Redis) 與雙端應用容器化。

### 步驟 1：啟動開發容器
於根目錄執行啟動指令，這會自動安裝依賴、啟動 PostgreSQL、Redis、NestJS 伺服器與 Next.js 前端：

```bash
bun run dev
```

- **後端 API 與 Swagger 文檔**：[http://localhost:3000/apidoc](http://localhost:3000/apidoc)
- **前端 Web 介面**：[http://localhost:3001](http://localhost:3001)

### 步驟 2：初始化資料庫與 Seed 資料
當容器第一次啟動成功後，您需要建立資料表並寫入預設的管理員帳號：

```bash
# 執行 migration 並產生 Prisma Client
docker compose -f docker-compose.dev.yml exec app bun run prisma:migrate
# 寫入 Seed 資料 (包含預設管理員 admin001 / 000000)
docker compose -f docker-compose.dev.yml exec app bun run prisma:seed
```

---

## 4. 常用運維指令

### 開發環境容器指令
- **停止所有服務**：
  ```bash
  docker compose -f docker-compose.dev.yml down
  ```
- **查看後端 API 日誌**：
  ```bash
  docker compose -f docker-compose.dev.yml logs -f app
  ```
- **重置資料庫（會清空所有資料並重跑 seed）**：
  ```bash
  docker compose -f docker-compose.dev.yml exec app bunx prisma migrate reset
  ```

### 新增 API 模組 (NestJS CLI)
若要新增新的 API 功能模組，請透過 Docker 容器內的 Nest CLI 生成以保持路徑一致：
```bash
docker compose -f docker-compose.dev.yml exec app nest g resource <module-name>
```

---

## 5. 生產環境部署

生產環境使用 `docker-compose.prod.yml` 配置，並關閉了除必要 Port 外的外部連線（例如 Redis 不對外暴露）。

### 部署步驟
1. 確保伺服器上已安裝 Docker 與 Bun。
2. 建立正確的生產環境 `.env`。
3. 執行部署腳本：
   ```bash
   ./deploy.sh
   ```

最後更新：2026-06-13
