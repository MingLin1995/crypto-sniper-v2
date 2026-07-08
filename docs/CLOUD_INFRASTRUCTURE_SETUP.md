# 雲端基礎設施配置與 EC2 部署指南

本文檔專為 **CryptoSniper v2** 的正式生產環境（AWS EC2 + ECR + Cloudflare + Traefik）所寫。內容涵蓋**前置雲端帳號與資源申請**、**安全防火牆設定**、**EC2 主機環境初始化步驟**，以及 **Docker Compose 參數化配置**。

---

## 目錄

1. [AWS IAM 使用者申請與最小權限設定](#1-aws-iam-使用者申請與最小權限設定)
2. [AWS ECR 儲存庫建立與生命週期規則](#2-aws-ecr-儲存庫建立與生命週期規則)
3. [AWS EC2 安全群組防火牆配置](#3-aws-ec2-安全群組-security-group-防火牆配置)
4. [Cloudflare DNS 路由與 SSL 安全配置](#4-cloudflare-dns-路由與-ssl-最高安全配置)
5. [EC2 主機參數化配置](#5-ec2-主機參數化配置-env-詳解)
6. [EC2 首次初始化與啟動步驟](#6-ec2-首次初始化與啟動步驟)
7. [生產環境容器日誌旋轉策略](#7-生產環境容器日誌旋轉策略-docker-log-rotation)
8. [Prometheus 時序資料庫容量保護](#8-prometheus-時序資料庫容量保護-tsdb-retention)
9. [CI/CD Runner IP 取得的三重容錯機制](#9-cicd-runner-ip-取得的三重容錯機制)

---

## 1. AWS IAM 使用者申請與最小權限設定

CI/CD 流程需要一個專用的 AWS IAM 使用者（Programmatic Access）來執行推播 Docker 映像檔至 ECR 以及動態修改 EC2 安全群組。

1. **ECR 權限**：直接掛載 AWS 官方內建託管策略 **`AmazonEC2ContainerRegistryPowerUser`**（免去手動維護繁瑣 ECR Action 的麻煩）。
2. **EC2 防火牆權限**：掛載自定義策略，並且**嚴格將 Resource 鎖定在專案專用的特定安全群組 ARN**，防止 CI/CD 帳號越權修改帳號內其他的安全群組

### 步驟說明：

1. 登入 **AWS Management Console**，進入 **IAM** 服務。
2. 點選左側 **IAM 使用者** -> **建立人員**。
3. 使用者名稱輸入：`github-actions-deployer` (可自定義)。
4. 權限設定選擇 **直接連接政策**：
   - 搜尋並勾選 AWS 內建策略：**`AmazonEC2ContainerRegistryPowerUser`**。
   - 點選 **建立策略** 建立第二個專屬防火牆修改策略。
5. 在建立策略頁面切換到 **JSON** 標籤頁，貼上以下專為本專案設計的安全群組白名單策略（請替換 ARN 中的 AWS 帳號 ID 與安全群組 ID）：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecurityGroupDynamicWhitelisting",
      "Effect": "Allow",
      "Action": ["ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress"],
      "Resource": "arn:aws:ec2:*:帳號ID:security-group/群組ID" // 零信任與最小權限原則
    }
  ]
}
```

6. 命名策略為 `CryptoSniperSGPolicy` 並儲存，回到使用者建立頁面同時勾選 `AmazonEC2ContainerRegistryPowerUser` 與 `CryptoSniperSGPolicy` 完成人員建立。
7. 進入該名用戶的 **安全憑證** -> **建立存取金鑰** -> 選擇 **命令列介面 (CLI)**。
8. 將產生的 `Access key ID` 與 `Secret access key` 複製，設定至 GitHub Repository 的 `Settings -> Secrets and variables -> Actions`，命名為：
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION` (例如 `ap-east-2`)

---

## 2. AWS ECR 儲存庫建立與生命週期規則

AWS ECR 用於存放由 GitHub Actions 跨平台編譯的 API 與 Web 映像檔。

1. 進入 AWS Console 的 **Amazon ECR** 服務。
2. 確認右上角區域（Region）為目標部署區域（例如台北 `ap-east-2`）。
3. 點選 **建立儲存庫**，設定為 **Private (私有)**。
4. 分別建立兩個儲存庫名稱（需與 CI/CD 設定一致）：
   - `cryptosniper-api`
   - `cryptosniper-web`
5. **成本控制與節省關鍵**：
   點入建立好的 Repository -> 點選左側 **生命週期政策** -> **建立規則**。建議配置以下**雙規則組合**，兼顧及時清除垃圾與緊急回滾需求：

   - **規則 1 (及時清除懸空垃圾)**：當新版本推送 `latest` 標籤時，舊版映像檔會失去 `latest` 標籤變成 `Untagged (<none>)`，該規則能在 24 小時內快速釋放這些懸空容量。
     - 優先級：1
     - 描述：`自動刪除舊版懸空 (Untagged) 映像檔`
     - 標籤狀態：`未加上標籤 (Untagged)`
     - 比對條件：`自建立以來的天數大於 1 天`
     - 動作：`到期 (Expire)`

   - **規則 2 (控制歷史版本總量)**：確保了即使 CI/CD 有打上 Git Hash 等永久標籤，總儲存數量也不會超過 5 個，鎖死 AWS ECR 儲存帳單上限。
     - 優先級：2
     - 描述：`保留最近 5 個映像檔供 Rollback 使用`
     - 標籤狀態：`任何 (Any)`
     - 比對條件：`映像計數超過 5 個`
     - 動作：`到期 (Expire)`

---

## 3. AWS EC2 安全群組防火牆配置（防止 Cloudflare 源站 IP 洩漏或遭繞過攻擊）

1. **不開放 HTTP (80 Port)**：所有訪客 HTTP 流量在 Cloudflare 邊界即被強制重定向至 HTTPS，源站 EC2 完全不接收明文請求。
2. **鎖死 HTTPS (443 Port) 來源**：不對全世界 (`0.0.0.0/0`) 開放，而是**透過白名單鎖定 Cloudflare 的官方 IPv4 網段**。

**VPC 受管前綴清單 - Managed Prefix List**：

- 在安全群組中手動新增 15 筆 Cloudflare IP 非常繁瑣。建議到 **AWS VPC 控制台 -> 受管前綴清單 -> 建立前綴清單**（例如命名為 `cloudflare-ipv4-list`，最大條目數設為 20），將 Cloudflare 官方 15 組網段一次貼入。
- 設定完成後，在安全群組傳入規則的「來源」只需選擇該前綴清單 ID (如 `pl-0123456789abcdef0`)，即可一鍵綁定全部網段，日後若 Cloudflare 調整 IP，只需修改 VPC 前綴清單，所有套用的安全群組自動同步生效。

### 步驟說明：

1. 進入 **AWS EC2 Console** -> 左側選單點選 **安全群組**。
2. 找到你 EC2 實例綁定的安全群組，點選 **編輯傳入規則**。
3. 配置以下規則：

| 類型 (Type) | 協定 (Protocol) | 埠口範圍 | 來源 (Source)                                                       | 說明                                                                |
| :---------- | :-------------- | :------- | :------------------------------------------------------------------ | :------------------------------------------------------------------ |
| **HTTPS**   | TCP             | 443      | `pl-0123456789abcdef0`<br>_(或手動輸入 15 組 Cloudflare IPv4 CIDR)_ | **僅允許 Cloudflare 邊界節點轉發加密流量**                          |
| **SSH**     | TCP             | 22       | `你的個人固定 IP/32`                                                | **僅限你自己電腦的 IP**，切勿開 `0.0.0.0/0`！(CI/CD 會自動動態開關) |

> Cloudflare 官方 IP 列表可隨時於 `https://www.cloudflare.com/ips/` 查閱。

> 複製此安全群組 ID (如 `sg-0123456789abcdef0`)，存入 GitHub Secrets 的 `AWS_SG_ID`。

---

## 4. Cloudflare DNS 路由與 SSL 最高安全配置

專案使用 Traefik 與 Cloudflare 搭配，防禦 DDoS 並提供 SSL 。

### 步驟 1：DNS A 紀錄配置

進入 Cloudflare DNS 管理後台，將以下網域指向你的 **EC2 公網 IP**，並**開啟 Proxy 狀態 (橘雲標誌)**：

- `yourdomain.com` (Root 網域)
- `crypto-sniper.yourdomain.com` (前端 Web 主站)
- `api-crypto-sniper.yourdomain.com` (後端 API 服務，**注意：Cloudflare 免費憑證僅支援單層子網域，不可使用 api.crypto-sniper**)
- `monitor-crypto-sniper.yourdomain.com` (Grafana 監控後台)

### 步驟 2：啟用 SSL Full (Strict) 模式

進入左側選單 **SSL/TLS -> Overview**，將加密模式設定為 **Full (strict)**。
_(此模式要求源站 EC2 必須提供由信任 CA 或 Cloudflare 簽發的有效憑證，防禦中間人監聽)_

### 步驟 3：申請源站憑證 (Origin Server Certificate)

為了滿足 Full Strict 模式，我們需要在 Cloudflare 免費產生一張專屬源站憑證給 EC2 Traefik：

1. 點選左側 **SSL/TLS -> Origin Server (源站伺服器)**。
2. 點選 **Create Certificate (建立憑證)**。
3. 私鑰類型選擇 **RSA (2048)**，主機名稱保持預設值（會自動包含 `*.yourdomain.com` 與 `yourdomain.com`），憑證效期選擇 **15 years**，點選 Create。
4. 複製畫面上出現的 **Origin Certificate (公鑰)** 與 **Private Key (私鑰)**，分別存入 GitHub Secrets：
   - `CF_ORIGIN_CERT` (存放 PEM 公鑰內容)
   - `CF_ORIGIN_KEY` (存放 KEY 私鑰內容)

> 我們的 CI/CD 腳本會在部署時自動將這兩組 Secret 同步至 EC2 的 `~/crypto-sniper-v2/traefik/certs/` 目錄中，讓 Traefik 自動載入。

---

## 5. EC2 主機參數化配置 (CI/CD 自動化注入)

本專案中，**所有環境變數的管理皆由 GitHub Actions CI/CD Pipeline (`.github/workflows/ci.yml`) 完全自動化處理**

### CI/CD 自動化組裝機制：

在部署工作流程中，GitHub Actions 會自動執行以下步驟處理設定檔：

1. **變數合併**：自動讀取 GitHub Repository 的 `Secrets` 與 `Variables`。
2. **動態組裝**：自動組合出生產環境專用的資料庫連線字串 `DATABASE_URL` 與 ECR 映像檔路徑 (`API_IMAGE`, `WEB_IMAGE`)。
3. **過濾寫入**：自動過濾掉 CI/CD 專用私鑰（如 `EC2_SSH_KEY`、`AWS_SG_ID`），將純淨安全的變數內容寫入 `.env` 並透過 SCP 自動傳送至 EC2 伺服器的專案目錄下。

> **維護指南**：未來若需調整資料庫帳密、網域或任何參數，**完全不需要登入 EC2 主機**只需至 GitHub Repository -> `Settings -> Secrets and variables -> Actions` 修改對應數值，下次觸發 GitHub Actions 部署時即會自動生成最新的 `.env` 並覆蓋生效。

---

## 6. EC2 首次初始化與啟動步驟

由於 `.github/workflows/ci.yml` 已經完備了極度自動化的部署工作流程（包含自動建立專案資料夾、自動生成 Cloudflare 源站 SSL 憑證、自動寫入 `.env`，以及自動建立 `traefik-public` 外部 Docker 網絡），因此**當你啟用一台全新的 EC2 實例時唯一需要手動執行的只有「安裝 Docker 引擎」**

### 唯一手動步驟：安裝 Docker 與 Docker Compose Plugin

SSH 登入全新的 EC2 Ubuntu 主機後，複製並執行以下官方安裝指令：

```bash
# 更新套件庫並安裝授權金鑰
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 加入 Docker 官方 Apt 來源
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安裝 Docker 引擎與 Compose 插件，並將目前帳號加入 docker 群組
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

安裝完成後，輸入 `exit` 登出 SSH 並重新登入一次（使 docker 群組權限生效），確認 `docker ps` 可以正常執行即可。
在此之後，直接至 GitHub Repository 觸發 CI/CD Pipeline，腳本將為你自動完成所有目錄初始化、憑證掛載、網路建立與服務啟動。

---

## 7. 生產環境容器日誌旋轉策略 (Docker Log Rotation)

在 EC2 小型實例（如 `t4g.micro`，僅 8GB EBS 磁碟）上長時間運行，容器日誌可能在無聲中佔滿磁碟空間，導致系統全面癱瘓。

### 配置方式：

`docker-compose.prod.yml` 中**所有服務容器**均配置了 `json-file` 日誌驅動與旋轉上限：

```yaml
logging:
  driver: 'json-file'
  options:
    max-size: '10m'   # 每個日誌檔案最大 10MB
    max-file: '3'     # 最多保留 3 個歷史檔案
```

### 設計考量：

| 參數 | 說明 |
|:---|:---|
| `max-size: 10m` | 每個容器的單一日誌檔案上限為 10MB，超過即自動輪替 |
| `max-file: 3` | 最多保留 3 個歷史日誌檔案（10MB × 3 = 30MB/容器上限） |
| **全服務覆蓋** | Traefik、PostgreSQL、Redis、API、Web、Prometheus、Grafana — 7 個容器均已配置 |
| **空間計算** | 7 容器 × 30MB = 最大 210MB 日誌空間，對 8GB 磁碟而言是安全的 |

> **注意事項**：若未配置日誌旋轉，一個高流量的 API 容器可能在數天內產生數 GB 的日誌檔案。這在 `t4g.micro` 等小型實例上會直接導致磁碟爆滿 → PostgreSQL WAL 寫入失敗 → 資料庫 Crash。

---

## 8. Prometheus 時序資料庫容量保護 (TSDB Retention)

Prometheus 作為監控指標收集器，其時序資料庫 (TSDB) 會持續寫入磁碟。若不加限制，長期運行下會緩慢撐爆 EC2 的 EBS 磁碟。

### 配置方式：

```yaml
# docker-compose.prod.yml - prometheus service
command:
  - '--storage.tsdb.retention.time=7d'    # 監控數據最多保留 7 天
  - '--storage.tsdb.retention.size=1GB'   # TSDB 磁碟上限 1GB
```

### 雙重保護機制：

| 保護機制 | 說明 |
|:---|:---|
| **時間保護 (`retention.time`)** | 超過 7 天的歷史監控數據自動清除 |
| **空間保護 (`retention.size`)** | 即使 7 天內數據量異常暴增，也不會超過 1GB |
| **為何同時設定** | 僅設時間，若某日異常產生大量指標數據可能在 7 天內撐爆磁碟；僅設空間，低流量時可能過早清除需要回溯分析的數據 |

---

## 9. CI/CD Runner IP 取得的三重容錯機制

GitHub Actions 部署流程需要取得 Runner 的公網 IP，以臨時加入 EC2 安全群組的 SSH 白名單。由於依賴外部 HTTP 服務來查詢 IP，單一服務的不可用會直接阻斷整個部署流程。

### 防禦性實作：

```yaml
# .github/workflows/ci.yml
- name: 取得 GitHub Runner 公網 IP
  run: |
    for i in {1..3}; do
      ip=$(curl -s --connect-timeout 5 https://checkip.amazonaws.com \
        || curl -s --connect-timeout 5 https://ifconfig.me \
        || curl -s --connect-timeout 5 https://api.ipify.org)
      ip=$(echo "$ip" | tr -d '\r' | tr -d '\n' | tr -d ' ')
      if [[ $ip =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "RUNNER_IP=$ip" >> $GITHUB_ENV
        exit 0
      fi
      sleep 2
    done
    echo "無法取得有效的公網 IP"
    exit 1
```

### 三層防禦策略：

| 層級 | 說明 |
|:---|:---|
| **第一層：三重服務回退** | 依序嘗試 `checkip.amazonaws.com` → `ifconfig.me` → `api.ipify.org`，任一成功即可 |
| **第二層：正規表達式驗證** | 取得的 IP 必須匹配 `^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$`，防止非 IP 格式（如 HTML 錯誤頁面）被誤用 |
| **第三層：重試迴圈** | 整個流程重試 3 次，每次間隔 2 秒，應對瞬時網路抖動 |
| **連線超時保護** | 每個 `curl` 請求設定 `--connect-timeout 5`，單一服務無回應時快速切換至下一個 |

> **安全收尾**：部署結束後（無論成功或失敗），CI/CD 的最後一步 (`if: always()`) 會自動呼叫 `aws ec2 revoke-security-group-ingress` 撤銷該 Runner IP 的 SSH 權限，確保不留下任何永久性防火牆開口。

