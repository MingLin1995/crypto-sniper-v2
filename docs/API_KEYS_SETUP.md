# 第三方服務註冊與 API 金鑰設定指南 (Google, Discord, Telegram, Web Push, SMTP)

本指南說明如何為 **CryptoSniper v2** 的第三方登入、帳號綁定、Email 驗證碼以及通知管道申請所需的 API 金鑰與相關設定。

---

## 1. Google OAuth2 設定 (登入與帳號綁定)

Google OAuth2 用於提供「使用 Google 登入」與在個人設定中「綁定/解綁 Google 帳號」。

### 註冊與設定步驟：

1. **進入 Google Cloud 主控台**
   - 瀏覽 [Google Cloud Console](https://console.cloud.google.com/)。
   - 建立一個新專案（例如 `crypto-sniper-v2`）。

2. **設定 OAuth 同意畫面 (OAuth Consent Screen)**
   - 在左側選單進入「API 和服務」 > 「OAuth 同意畫面」。
   - **使用者類型 (User Type)** 選擇 **「外部 (External)」**，然後點擊「建立」。 // 之後應該要改外部
   - 輸入「應用程式名稱」（例如 `CryptoSniper`）、輸入您的「聯絡電子郵件」與「開發人員聯絡資訊」。
   - 在「授權網域」部分，本機開發環境可先留空，點擊「儲存並繼續」。
   - **範圍 (Scopes)**：點擊「新增或移除範圍」，勾選以下基本範圍：
     - `.../auth/userinfo.email` (取得 Email)
     - `.../auth/userinfo.profile` (取得個人基本資料如姓名、大頭貼)
   - **測試使用者 (Test users)**：新增您自己或要用來測試登入的 Google 帳號，點擊「儲存並繼續」。

3. **建立憑證 (Credentials)**
   - 進入左側選單的「憑證」。
   - 點擊上方「+ 建立憑證」，選擇 **「OAuth 用戶端 ID」**。
   - **應用程式類型** 選擇 **「網頁應用程式 (Web application)」**。
   - **名稱**：輸入識別名稱（例如 `CryptoSniper Web Client`）。
   - **已授權的 JavaScript 來源**：
     - 本機開發：`http://localhost:3000` (API) 與 `http://localhost:3001` (Web)
   - **已授權的重新導向 URI (Authorized redirect URIs)**：
     - 這是 Google 驗證成功後將使用者導回的網址（通常由後端 NestJS API 處理）。
     - 本機後端開發預設：`http://localhost:3000/api/auth/google/callback`
   - 點擊「建立」後，系統會彈出視窗顯示您的 **「用戶端 ID (Client ID)」** 與 **「用戶端密鑰 (Client Secret)」**。

### `.env` 設定項目：

```env
GOOGLE_CLIENT_ID=你的Google用戶端ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=你的Google用戶端密鑰
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

---

## 2. Discord OAuth2 & Webhook 設定 (登入、綁定與通知)

Discord 在本專案中扮演兩個角色：

1. **OAuth2 登入/綁定**：讓使用者透過 Discord 帳號快速登入。
2. **Webhook 通知**：將到價告警發送到使用者指定的 Discord 頻道。

### A. Discord OAuth2 申請 (登入/綁定)

1. **進入 Discord 開發者入口網站**
   - 瀏覽 [Discord Developer Portal](https://discord.com/developers/applications)。
   - 點擊右上角 **「New Application」**，命名為 `CryptoSniper` 並點擊 Create。

2. **取得 Client ID 與 Client Secret**
   - 進入左側選單的 **「OAuth2」**。
   - 在頁面頂端可看到 **Client ID**。
   - 點擊 **Client Secret** 下方的「Reset Secret」，即可取得並複製您的 Client Secret（注意：密鑰只會顯示一次，請妥善保存）。

3. **設定 Redirects**
   - 在 OAuth2 頁面的 **Redirects** 區塊，點擊 **「Add Redirect」**。
   - 輸入您的重新導向 URI（本機開發為 NestJS API 回呼地址）：
     - `http://localhost:3000/api/auth/discord/callback`
   - 點擊頁面下方的 **「Save Changes」**。

### B. Discord Webhook 設定 (通知)

_注意：本項目不需要系統級的 Webhook 金鑰，而是由使用者在前端貼上他們自己的 Webhook 網址。_

- **使用者操作步驟** (可在前端 UI 提供此引導)：
  1. 在 Discord 中，進入自己擁有管理權限的伺服器。
  2. 在想要接收通知的頻道旁，點擊「編輯頻道」(齒輪圖示)。
  3. 選擇「整合」 > 「Webhook」 > 「建立 Webhook」。
  4. 複製該 Webhook URL 並貼回 CryptoSniper 前端 `/profile` 進行綁定。

### `.env` 設定項目：

```env
DISCORD_CLIENT_ID=你的Discord用戶端ID
DISCORD_CLIENT_SECRET=rlN-g2UQT_XIjilfoTUujCF7Lg5_ldIO
DISCORD_CALLBACK_URL=http://localhost:3000/api/auth/discord/callback
```

---

## 3. Telegram Bot 設定 (登入、綁定與通知)

Telegram 的綁定與通知機制是透過 **Telegram Bot** 來實現：

1. **通知管道**：Bot 可向使用者發送個人到價通知。
2. **帳號綁定**：使用者透過 Deep Linking（點擊 `t.me/YourBot?start=token`）向 Bot 發送 `/start` 啟動對話，Bot 會自動取得使用者的 `telegramChatId` 並回傳至 NestJS 後端完成綁定。

### 申請與設定步驟：

1. **建立 Telegram Bot**
   - 開啟 Telegram，搜尋官方機器人 **`@BotFather`**。
   - 發送對話指令 `/newbot`。
   - 依指示輸入機器人的 **顯示名稱** (Name)（例如：`CryptoSniper Alert`）。
   - 輸入機器人的 **唯一使用者名稱** (Username)（必須以 `bot` 結尾，例如：`crypto_sniper_alert_bot`）。
   - 建立成功後，`@BotFather` 會提供一串 **API Token**（例如：`1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ`）。

2. **啟用 Widget 登入 (選用)**
   - 如果您希望在網頁上直接放「Telegram 登入按鈕」，需要向 `@BotFather` 註冊網域。
   - **重要限制**：
     - Telegram `/setdomain` 只接受**純網域**（例如 `localhost` 或 `your-ngrok-domain.ngrok-free.app`），**不能包含協議 (`http://` 或 `https://`)，也不能包含通訊埠（Port，例如 `:3001`）**。
     - 由於 Telegram Widget 載入時會嚴格驗證瀏覽器地址列的 Origin，而瀏覽器的 `localhost:3001` 在 Telegram 看來與 `localhost` 不匹配，因此**直接在 `localhost:3001` 測試會顯示 `Bot domain invalid`**。
   - **本地開發的測試方式 (使用 ngrok)**：
     1. 發送 `/setdomain` 給 `@BotFather`。
     2. 選擇您的機器人，輸入您的 ngrok 網域（例如：`your-ngrok-domain.ngrok-free.app`）。
     3. 啟動 ngrok 將流量導向您的前端埠（如 `ngrok http 3001`）。
     4. **關鍵**：您必須透過 `https://your-ngrok-domain.ngrok-free.app/login` 訪問網頁，不能使用 `localhost:3001`。這樣 Widget 就能比對成功並正常運作。

### `.env` 設定項目：

```env
TELEGRAM_BOT_TOKEN=你的Telegram機器人Token
TELEGRAM_BOT_USERNAME=你的Telegram機器人Username (不含 @，例如：crypto_sniper_alert_bot)
```

---

## 4. Web Push (瀏覽器通知) VAPID 金鑰設定

為支援瀏覽器背景 Web Push 推送，需生成 VAPID (Voluntary Application Server Identification) 金鑰對。

### 產生步驟：

1. 在專案根目錄下，使用 `npx` 執行 `web-push` 工具產生：
   ```bash
   npx web-push generate-vapid-keys
   ```
2. 指令會輸出類似下方的公鑰與私鑰：

   ```text
   ========================================
   Public Key:
   BJK... (一長串 Base64 字串)

   Private Key:
   _a8... (另一長串 Base64 字串)
   ========================================
   ```

### `.env` 設定項目：

```env
VAPID_PUBLIC_KEY=你的WebPush公鑰
VAPID_PRIVATE_KEY=你的WebPush私鑰
VAPID_SUBJECT=mailto:你的聯絡電子信箱 (例如 mailto:your-email@example.com)
```

---

## 5. Gmail SMTP 與應用程式密碼設定 (用於 Email 驗證碼發送)

在註冊時發送驗證信需要使用 SMTP 伺服器。如果是使用個人 Gmail 帳號發送，必須啟用「兩步驟驗證」並產生「應用程式密碼」。

### 申請與設定步驟：

1. **啟用 Google 帳號的「兩步驟驗證」**
   - 登入並進入 [Google 帳戶管理](https://myaccount.google.com/)。
   - 點擊左側選單的 **「安全性 (Security)」**。
   - 在「如何登入 Google」區塊中，點擊 **「兩步驟驗證 (2-Step Verification)」**，並依指示啟用。

2. **建立應用程式密碼 (App Password)**
   - 啟用兩步驟驗證後，回到「安全性」頁面，再次進入「兩步驟驗證」頁面。
   - 滾動到頁面最下方，會看到 **「應用程式密碼 (App passwords)」**（如果沒看到，可直接在上方搜尋框搜尋「應用程式密碼」）。
   - 輸入密碼名稱（例如 `CryptoSniper`），然後點擊 **「建立 (Create)」**。
   - 系統會彈出一個視窗，顯示一串 **16 字元的密碼**（例如：`abcd efgh ijkl mnop`）。
   - **請立即複製此密碼**（關閉視窗後將無法再次查看）。

3. **填入設定值**
   - 將剛才複製的 16 字元密碼（**去除中間的空白字元**，合併為 16 位字母）填入 `.env` 中的 `SMTP_PASS`。

### `.env` 設定項目：

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=你的Gmail信箱 (例如 your-email@gmail.com)
SMTP_PASS=你的16位應用程式密碼 (不含空白，例如 abcdefghijklmnop)
```

---

## 6. Cloudflare Turnstile 設定 (人機安全防護)

Cloudflare Turnstile 用於登入前的智慧型人機安全防護，可有效防止惡意腳本、自動化暴力破解與撞庫攻擊。

### 申請與設定步驟：

1. **進入 Cloudflare 控制台**
   - 瀏覽 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
   - 在左側選單選擇 **Turnstile**。

2. **建立站點 (Add site)**
   - 點擊 **「Add site」**。
   - **Site name**：輸入名稱（例如 `CryptoSniper v2`）。
   - **Domain**：輸入應用程式網域（例如 `example.com`；本機開發請填入 `localhost`）。
   - **Widget Mode**：推薦選擇 **「Managed」** (智慧評估，低風險無感通過) 或 **「Non-interactive」**。
   - 點擊 **「Create」**。

3. **取得金鑰並填入設定**
   - 建立後即可取得 **Site Key** (公鑰) 與 **Secret Key** (私鑰)。

### 官方測試金鑰 (本機開發可直接使用)：
- **永遠通過 (Always Pass)**：
  - Site Key: `1x00000000000000000000AA`
  - Secret Key: `1x0000000000000000000000000000000AA`
- **永遠阻擋 (Always Block)**：
  - Site Key: `2x00000000000000000000AB`
  - Secret Key: `2x0000000000000000000000000000000AA`

### `.env` 與 GitHub Actions Secrets 設定項目：

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=你的SiteKey (例如 1x00000000000000000000AA)
TURNSTILE_SECRET_KEY=你的SecretKey (例如 1x0000000000000000000000000000000AA)
TURNSTILE_ENABLED=true
```


