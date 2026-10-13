<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.ru.md">Русский</a> · <a href="README.hi.md">हिन्दी</a> · <a href="README.ja.md">日本語</a> · <strong>繁體中文</strong> · <a href="README.es.md">Español</a>
</p>

<p align="center">
  <a href="https://csrg3b.top/">
    <img src="public/branding/classhub-logo-384-d01f9050a1.webp" width="280" alt="ClassHub" />
  </a>
</p>

<h1 align="center">ClassHub</h1>

<p align="center">
  <strong>讓班級消息、學習資料與日常事務，都在同一個地方。</strong>
</p>

<p align="center">
  為校園班級打造的資訊平台：公告、新聞、活動、資源、交流、班級事務與 AI 輔助。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white" alt="Node.js 22 部署環境" />
  <img src="https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb&logoColor=white" alt="MongoDB 8 部署環境" />
</p>

<p align="center">
  <a href="https://csrg3b.top/">前往網站</a> ·
  <a href="https://csrg3b.top/about">專案介紹</a> ·
  <a href="https://csrg3b.top/privacy">隱私說明</a> ·
  <a href="https://github.com/Mason1035/uniclub-main/issues">回報問題</a>
</p>

<p align="center">
  <a href="#quick-start">快速開始</a> ·
  <a href="#features">功能概覽</a> ·
  <a href="#configuration">設定說明</a> ·
  <a href="#deployment">部署</a> ·
  <a href="#docs">文件</a> ·
  <a href="#faq">常見問題</a>
</p>

---

<a id="overview"></a>

## 專案簡介

ClassHub 目前服務於**四川師範大學 2025 級軟體工程 3 班**。成員可以集中查看消息、閱讀新聞、參與活動、分享資料、發布動態及辦理班級事務；管理員則在同一套系統中維護內容、名單、報名與提交紀錄。

專案採用 React + TypeScript 前端與 Node.js + Express + MongoDB 後端，包含真實帳號、權限、內容管理、AI 服務及物件儲存整合。目前每個部署執行個體使用一份班級名單，尚未提供多租戶、多班級管理平台。

首頁、About 與隱私說明向訪客展示產品介紹；班級頁面需要登入，管理後台需要管理員權限。公開程式碼儲存庫不代表公開班級成員資料或業務資料，也不代表學校官方組織身分。

**本文說明目前儲存庫的實作。** 線上版本、可用內容與外部服務狀態可能不同；有相關程式碼，不代表某個環境已完成設定或發布。

### 目錄

- [功能概覽](#features)
- [頁面入口與使用方式](#usage)
- [技術組合與架構](#architecture)
- [快速開始](#quick-start)
- [環境與外部服務設定](#configuration)
- [管理員與班級名單](#accounts)
- [AI 與每日新聞](#ai)
- [開發、建置與驗證](#development)
- [部署與維運](#deployment)
- [安全、隱私與已知限制](#security)
- [專案目錄與內容維護](#structure)
- [文件索引](#docs)
- [常見問題](#faq)
- [參與貢獻與問題回報](#contributing)
- [開發者、授權與素材來源](#credits)
- [多語言 README](#translations)

<a id="features"></a>

## 功能概覽

### 成員端

| 模組 | 已實作的功能 |
| --- | --- |
| 首頁 | 顯示最近的公告、活動、資源與新聞，以及少量班級動態和活動回憶；完整內容可進入對應專區查看 |
| 公告與通知 | 閱讀班級公告、查看個人通知和未讀狀態、標記已讀 |
| 新聞 | 新聞清單、內文、內容互動，以及「針對這篇新聞提問」AI 對話 |
| 活動 | 查看活動階段、行事曆、類型及年份篩選；申請報名、查看自己的審核狀態、取消報名；瀏覽活動總結、相簿及歷次紀錄 |
| 學習資源 | 資料清單、詳細內容、資源連結、下載入口及使用紀錄 |
| 班級動態 | 發布文字與圖片、討論和互動、收藏，以及既有追蹤與可見性規則 |
| 站內搜尋 | 搜尋目前帳號有權存取的內容，沿用全站搜尋彈出視窗 |
| 量化材料 | 在開放的收集期間提交 ZIP、查看結果、截止前重新提交、下載自己的材料 |
| 班費 | 查看付款碼、提交付款截圖與備註、查看管理員確認狀態 |
| 隨機點名 | 從真實有效成員池中等機率抽取一人，以頭像專輯封套與黑膠唱片展示結果，支援「再來一次」 |
| 帳號與設定 | 學號／編號登入、修改密碼、個人資料、頭像、偏好及已儲存內容 |
| 預設頭像 | 未上傳頭像時，依穩定的帳號識別值從頭像庫分配；同一帳號在不同頁面與裝置上保持一致 |
| 網頁桌寵 | 可選桌寵、外觀、互動及與帳號連結的偏好，詳見[桌寵文件](docs/classhub-pet.md) |

### 管理端

| 模組 | 已實作的功能 |
| --- | --- |
| 資料概覽 | 查看現有班級內容與業務概況 |
| 名單與成員 | 匯入真實班級名單、管理成員與帳號權限 |
| 內容管理 | 管理新聞、資源、公告／通知，以及既有相簿紀錄 |
| 活動管理 | 草稿與發布、時間／人數上限設定、報名審核與批次操作、未報名統計、相簿、總結、封存、隱藏及還原 |
| 量化材料 | 建立收集期、設定開放時間、依真實名單查看已交／未交、篩選紀錄及下載材料 |
| 班費管理 | 設定付款碼、查看憑證、人工核對並確認入帳 |
| AI 助手 | 文字與圖片輔助、情境生成、編輯發布預覽、連續修改、停止生成及串流回答 |
| AI 每日新聞 | 設定時間、數量與類別；檢索、查核、整批發布；查看執行狀態、失敗原因及歷史任務 |

### 互動與呈現

- 響應式 Header、手機底部導覽、置中頁尾，以及共用表單、彈出視窗和回饋元件。
- 首次進入時的品牌載入動畫：等待目前路由、首屏字型及可見圖片；同一工作階段內避免重複播放，保留逾時解除與鍵盤略過功能。
- About 頁面包含平滑捲動、原創幾何體及開發者透明卡片弧線動畫；此頁不顯示頂部頁首。
- 獨立 404 頁面沿用品牌、現有搜尋入口及本地太空人素材。
- 動畫考量 `prefers-reduced-motion`；手機與觸控環境採用相應版面及捲動方式。
- **目前應用程式固定使用淺色主題。** 歷史深色樣式或相關相依套件不代表已開放深色模式切換。

<a id="usage"></a>

## 頁面入口與使用方式

| 入口 | 路徑 | 存取範圍 |
| --- | --- | --- |
| 首頁／專案介紹／隱私說明 | `/`、`/about`、`/privacy` | 訪客可瀏覽公開介紹 |
| 登入 | `/auth` | 使用班級帳號登入 |
| 公告／新聞／活動 | `/announcements`、`/news`、`/events` | 已登入成員 |
| 資源／班級動態 | `/resources`、`/social` | 已登入成員 |
| 通知／已儲存內容／設定 | `/notifications`、`/saved-posts`、`/settings` | 目前帳號 |
| 班級功能 | `/functions` | 已登入成員 |
| 材料提交／班費 | `/quantification`、`/fees` | 已登入帳號，具體操作由後端驗證 |
| 隨機點名 | `/functions/random-call` | 目前有效班級成員 |
| 管理後台 | `/admin` | 經後端確認的管理員 |
| 後台 AI／每日新聞 | `/admin/ai`、`/admin/ai#daily-news` | 管理員 |

新聞詳細頁使用 `/article/:id`，同時保留 `/news/:id`；活動詳細頁使用 `/events/:id`，相容於 `/event/:id`；資源詳細頁使用 `/resource/:id`。新聞問答位於新聞詳細頁底部，並非獨立的公開聊天頁面。

同學使用管理員開通的帳號登入後，從導覽進入相應專區。管理員先準備真實名單，再發布內容、開放收集期及設定相關服務。尚無發布內容或服務未開通時，頁面會顯示相應的空白狀態或錯誤提示。

<a id="architecture"></a>

## 技術組合與架構

| 層級 | 技術與實作 |
| --- | --- |
| 前端 | React 18、TypeScript 5、Vite 5、React Router 6 |
| 資料與元件 | TanStack React Query、Axios、Tailwind CSS、Radix UI、Lucide、React Markdown |
| 動畫 | GSAP 3.15、`@gsap/react`；About 視需要使用 ScrollTrigger / ScrollSmoother |
| 後端 | Node.js、Express 5、CommonJS；路由、業務 Service 與 Repository |
| 資料庫 | MongoDB、Mongoose 8 |
| 驗證 | bcrypt 密碼雜湊、JWT、資料庫帳號／管理員驗證及 `tokenVersion` 工作階段撤銷 |
| AI | 共用 `DeepSeekAssistant`、SSE、受控網路搜尋及內文擷取 |
| 圖片與檔案 | Multer、Sharp、騰訊雲 COS / SCF、短期簽章及瀏覽器直接上傳 |
| 公開頁呈現 | 建置時產生首頁、About、Privacy 的實際訪客 HTML；執行時保留 React 互動 |
| 部署 | ECS / Nginx / systemd；儲存庫另包含 Vercel 設定 |
| 行動端 | 響應式 Web、Web App Manifest、Capacitor 設定及 Android 專案 |

```text
瀏覽器 / React 頁面
    │
    ├─ 開發：Vite 代理 /api、/uploads
    └─ 正式環境：Nginx 反向代理 / 獨立 API Origin
            │
            ▼
        Express API
            ├─ JWT / 帳號 / 權限驗證
            ├─ Service / Repository ── MongoDB
            ├─ DeepSeekAssistant ── DeepSeek
            │        └─ NewsAPI / 發布者 RSS / 受控網頁讀取
            └─ 受保護的儲存服務 ── SCF / COS
                                  ▲
                       瀏覽器持短期授權直接上傳或下載
```

主要資料模型包括 `User`、`EnrolledUser`、`News`、`Announcement`、`Event`、`ActivityMedia`、`Resource`、`SocialPost`、`Notification`、`Chat`、`AiSettings`、`DailyNewsJob`，以及量化收集／提交／上傳與班費設定／憑證模型。各功能沿用現有使用者及班級名單，沒有第二套學生資料。

<a id="quick-start"></a>

## 快速開始

### 1. 準備環境

- Git、Node.js 與 npm。現有 ECS 部署使用 **Node.js 22**，建議本地使用相同主要版本；儲存庫未設定 `engines` 強制限制。
- 可連線的 MongoDB 執行個體。現有部署使用 MongoDB 8，部分業務相容於 standalone，啟動不以副本集交易為前提。
- AI 與雲端上傳是選用的外部服務：未設定時，相關功能無法使用，但不影響瀏覽公開介紹頁面。

### 2. 取得程式碼並安裝相依套件

```bash
git clone https://github.com/Mason1035/uniclub-main.git
cd uniclub-main
npm ci
npm --prefix uniclub-backend ci
```

也可以使用 `npm run install-all`，分別執行前後端的 `npm install`。GSAP 相依套件來自儲存庫內 `vendor/` 的安裝包，複製、建置與部署儲存庫時必須保留此目錄。

### 3. 設定後端

複製範例檔案：

```bash
cp uniclub-backend/.env.example uniclub-backend/.env
```

Windows PowerShell：

```powershell
Copy-Item uniclub-backend/.env.example uniclub-backend/.env
```

編輯 `uniclub-backend/.env`，至少填入：

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/uniclub
JWT_SECRET=replace_with_a_long_random_private_secret
PORT=5050
REQUIRE_ENROLLED_ROSTER=true
ALLOWED_EMAIL_DOMAINS=
```

連線字串只是本地範例，`JWT_SECRET` 必須替換。範例中的 NewsAPI / Gemini 預留值不是有效金鑰；不啟用相關服務時應清空。目前 DeepSeek 功能的設定步驟見下文，不需要 Gemini 金鑰。

如果本機已安裝 `mongod`，可在獨立終端機執行：

```bash
npm run mongo
```

指令碼預設綁定 `127.0.0.1:27017`，資料目錄為 `~/data/db`；不負責安裝 MongoDB。已有資料庫服務時無須再次啟動。可用 `MONGOD_BIN`、`MONGODB_DBPATH`、`MONGODB_PORT` 覆寫本機路徑或連接埠。

### 4. 啟動前後端

```bash
npm start
```

| 服務 | 預設位址 |
| --- | --- |
| 前端 | <http://localhost:8081> |
| 後端健康檢查 | <http://localhost:5050/api/health> |
| 專案介紹 | <http://localhost:8081/about> |
| 登入／管理後台 | <http://localhost:8081/auth> / <http://localhost:8081/admin> |

後端成功連線至資料庫後才會監聽連接埠。首次使用需要[初始化管理員及班級名單](#accounts)；公開首頁不會自行產生成員或業務內容。

也可在兩個終端機分別執行 `npm run backend` 與 `npm run frontend`。通用啟動指令適用於 Windows；舊的 `start:win` / `stop:win` 指令碼仍假設使用 5000 連接埠，並會終止占用連接埠的程序，不建議作為預設啟動方式。

<a id="configuration"></a>

## 環境與外部服務設定

### 設定放在哪裡？

| 設定 | 位置與用途 |
| --- | --- |
| 後端連線、驗證、伺服器端金鑰 | `uniclub-backend/.env` 或正式伺服器的受控環境變數 |
| 前端開發代理 | 根目錄 `.env.local` 的 `VITE_API_PROXY_TARGET`，預設為 `http://localhost:5050` |
| 前端正式環境 API 位址 | 建置時的 `VITE_API_URL`；同網域反向代理可留空，跨網域填入 API Origin，不重複附加 `/api` |
| DeepSeek API Key | 在管理後台 `/admin/ai` 設定，加密儲存於 `AiSettings` |
| 儲存業務設定 | 後台的量化材料儲存設定，寫入私有設定檔；位置可由 `QUANTIFICATION_STORAGE_CONFIG_PATH` 指定 |

**`VITE_*` 會進入瀏覽器建置產物，不能放入任何金鑰。** 根目錄舊的 `.env.example` 中，`VITE_API_URL=http://localhost:5000` 不代表目前的開發代理連接埠，不能直接照搬為正式環境設定。

修改後端連接埠時，在根目錄 `.env.local` 設定代理目標，再啟動：

```dotenv
VITE_API_PROXY_TARGET=http://localhost:5051
```

根目錄啟動指令碼會依此選擇後端連接埠；若另外設定 `PORT`，須確保與代理目標一致。修改正式環境的 `VITE_API_URL` 後，需要重新建置前端。

### 視需求啟用的服務

| 服務 | 設定重點 | 未設定時 |
| --- | --- | --- |
| DeepSeek | 初始化 `AI_SECRET_ENCRYPTION_KEY`，重新啟動後端，在後台儲存 Key 並測試連線 | AI 助手、新聞問答及每日生成無法使用 |
| 新聞搜尋 | 現有 `NEWS_API_KEY`；共用檢索層也可使用固定發布者的 RSS | RSS 可補充來源，但仍受來源、時效及網路限制 |
| COS 直接配接器 | `OBJECT_STORAGE_PROVIDER=cos`、`COS_BUCKET`、`COS_REGION`、`COS_SECRET_ID`、`COS_SECRET_KEY` | 無法實際上傳材料 |
| SCF + COS | 私有儲存桶、區域、函式呼叫位址及相符的伺服器端授權驗證；後台儲存設定 | 對應的雲端上傳／下載無法使用 |
| 活動媒體 | 受保護的 SCF、`CLASSHUB_SCF_AUTH_SECRET`、僅活動目錄所需的權限、CORS | 活動原圖及縮圖無法正常儲存 |
| 正式環境請求來源 | `CORS_ORIGINS`、`BACKEND_URL`，依實際網域設定 | 跨網域存取或產生連結可能異常 |
| 需授權驗證的 Cron | `CRON_SECRET` | 外部 Cron 呼叫會被拒絕 |

儲存功能需要另外設定雲端資源、私有權限、CORS 及持久化目錄；`npm start` 不會自動建立騰訊雲儲存桶、函式或角色。目前實作支援 COS，不包含可直接使用的 OSS 配接器。活動與量化沿用相同儲存設定，但物件路徑與業務權限分開。

雲端步驟見[量化材料文件](docs/quantification.md)、[SCF 設定說明](uniclub-backend/cloud-functions/quantification/README.md)及[活動 COS 文件](docs/activity-v2/ACTIVITY_V2_COS.md)。這些文件包含歷史實施紀錄，實際設定以目前原始碼與目標環境為準。

<a id="accounts"></a>

## 管理員與班級名單

### 初始化管理員

在後端私有環境中設定 `ADMIN_EMAIL`、`ADMIN_PASSWORD`，可選填 `ADMIN_NAME`、`ADMIN_UNIQUE_ID`，然後從根目錄執行：

```bash
npm run admin:create
```

- 登入使用 **學號／編號 `uniqueId`**，不是電子郵件；獨立管理員的預設編號為 `ADMIN-...`。
- 如果符合已有帳號，指令碼可能將其提升為管理員。預設保留原有密碼，只有明確設定 `ADMIN_UPDATE_PASSWORD=true` 才會更新密碼。
- 初始化變數使用後應從長期環境中移除；不要將真實密碼寫入 README、指令範例或提交至 Git。
- 更換現有管理員密碼可使用隱藏輸入的終端機指令：`npm run admin:password -- admin@example.com`。這裡的電子郵件是範例；密碼更新後，舊工作階段會失效。

### 匯入班級名單

支援 CSV、TSV、JSON；學號與姓名必填，電子郵件選填。CSV 範例使用虛構成員：

```csv
学号,姓名
202500001,示例成员甲
202500002,示例成员乙
```

先檢查，再確認寫入：

```bash
npm run roster:import -- ./名单.csv --dry-run
npm run roster:import -- ./名单.csv
```

`--dry-run` 不會修改帳號、名單或索引。正式匯入會建立缺少的登入帳號，**初始密碼為學號，首次登入應修改**；重複匯入會保留原有密碼、角色及資料。不要將真實名單檔案納入公開儲存庫。

預設註冊策略要求名單中的電子郵件與學號相符；目前主要是在匯入後直接以學號登入。`REQUIRE_ENROLLED_ROSTER=false` 會解除註冊時的名單檢查，不應作為修正名單錯誤的常規方法。

隨機點名池來自 `User.isEnrolled` 與 `EnrolledUser.uniqueId` 的交集，不會依管理員身分排除。班級名單中的學生管理員會參與抽選；不在名單中的獨立管理帳號不計入。每次使用完整成員池，允許連續抽到同一人；瀏覽器的 `crypto.getRandomValues()` 搭配拒絕取樣，避免取模偏差。

<a id="ai"></a>

## AI 與每日新聞

### 一套共用 AI 服務

後台助手、新聞問答與每日新聞共用 `DeepSeekAssistant`、同一套資料庫設定及金鑰，不會分別建立 AI Key 或 Client。目前程式碼使用 `deepseek-flash` 與 `https://api.deepseek.com`，具體模型策略集中於共用服務中。

初始化加密主金鑰：

```bash
npm --prefix uniclub-backend run ai:init-secret
```

接著重新啟動後端，在 `/admin/ai` 填入 DeepSeek API Key 並測試連線。主金鑰為 32 位元組 Base64，API Key 以 AES-256-GCM 加密儲存。備份時需要同時保留資料庫與主金鑰；主金鑰遺失或被替換後，原先儲存的 Key 無法解密，需要重新輸入。

### 後台內容助手

支援文字／圖片輸入、12 類情境、串流生成、Markdown 結果、繼續修改及停止生成。**資源介紹、公告草稿、新聞稿、活動文案**提供對應專區的發布預覽；編輯、驗證並確認後，透過原有業務介面發布，生成本身不代表自動發布。

### 新聞問答

- 前端只傳送新聞 ID 與問題；`GET/POST /api/chat/:articleId` 由伺服器端讀取可信內文、文章可見性及目前使用者的歷史紀錄。
- 一般摘要、文章觀點與組織資訊擷取優先依據內文；「為什麼、分析影響、比較」等問題可啟用 reasoning。
- 「最新、現在、後續進展、幫我查」等問題視需求觸發共用搜尋；外部網頁視為不可信參考內容，不作為系統指令。
- 長篇新聞與歷史訊息設有上下文額度；SSE 分段顯示回答，沿用現有 Markdown 呈現方式，來源僅來自實際檢索。
- 搜尋失敗時可以回到新聞內文作答；對話儲存在現有 `Chat` 模型中，依使用者與新聞區分。問題上限為 1000 字。
- 後端設有限流與並行請求保護，預設每位使用者的新聞問答額度為每 10 分鐘 20 次；目前使用單一程序的記憶體保護機制，並非分散式額度管理。

### AI 每日新聞

後台 `/admin/ai#daily-news` 管理設定、狀態及任務歷史。預設於北京時間 `19:00` 執行，每天 2 篇；數量可設定為 1–5 篇，涵蓋人工智慧、科技、軟體工程、科學、教育。

```text
定時檢查 / 管理員確認執行
    → NewsAPI + 發布者 RSS 檢索
    → 時效、發布者與來源驗證
    → 選題、讀取來源內文、生成與事實查核
    → 暫存完整批次
    → 成功後切換可見批次，保留人工新聞與舊批次紀錄
```

採用過去 24 小時內的真實來源。可靠來源不足或查核失敗時，不湊足篇數，也不替換最近成功的批次；舊 AI 新聞依批次封存，不會自動刪除人工新聞。

`NODE_ENV=production` 的常駐後端程序會自動檢查任務，開發環境啟動時不會自動呼叫付費 AI。Vercel Cron 使用受保護的 `/api/cron/daily-news`，需要 `CRON_SECRET`，也需要方案支援對應頻率及足夠的執行時間。

手動診斷在後端目錄執行：

```bash
cd uniclub-backend
node manual-curation.js --dry-run
```

**這裡的 `--dry-run` 仍會實際連網並呼叫付費 AI，只是不儲存新聞。** 移除參數會嘗試發布；`--force` 用於明確重新生成當日批次。舊的新聞整理指令已改用統一的每日新聞流程，不應再依照舊 Dallas 午夜 Gemini 任務說明設定。

NewsAPI Developer 免費方案的檢索文章有 24 小時延遲，且官方限定用於開發與測試，不能用於預備發布或正式環境；線上使用此 Provider 須符合其方案條件。見 [NewsAPI 官方方案說明](https://newsapi.org/pricing)。RSS 可以補充來源，但本地執行成功不保證伺服器網路、來源網頁及所有日期都能成功。更多實作說明見[每日新聞文件](uniclub-backend/README.daily-news.md)。AI 輸出與引用應加以查核，費用取決於供應商及實際使用量。

<a id="development"></a>

## 開發、建置與驗證

### 常用指令

以下指令在儲存庫根目錄執行：

| 指令 | 用途 |
| --- | --- |
| `npm start` / `npm run dev` | 同時啟動前後端 |
| `npm run frontend` / `npm run backend` | 只啟動其中一端 |
| `npm run mongo` | 啟動已安裝的本地 MongoDB |
| `npm run typecheck` | 前端及 Vite 設定的 TypeScript 檢查 |
| `npm run lint` | 依目前 ESLint 設定檢查原始碼 |
| `npm run build` | 型別檢查、Vite 建置、公開 SEO HTML 生成 |
| `npm run preview` | 預覽 `dist/`，不啟動後端或資料庫 |
| `npm test` | 後端測試及桌寵測試；不包含所有前端專項指令碼 |
| `npm --prefix uniclub-backend run test:ai` | 後台 AI 相關測試 |
| `npm run test:seo` | 公開頁面及部署路由驗證，須先建置 |
| `npm run test:pet` | 桌寵測試 |
| `npm run admin:create` / `npm run roster:import -- ...` | 管理員與名單初始化，會依參數寫入資料庫 |
| `npm run curate:news` | 手動每日新聞任務，可能呼叫付費服務並寫入新聞 |
| `npm run daily-curator` | 獨立排程程序；正式環境主程序已有排程時，通常無須重複啟動 |

依修改範圍選擇現有專項檢查：

```bash
node scripts/test-news-chat.mjs
node scripts/test-ai-preview.mjs
node scripts/test-daily-news-ui.mjs
node scripts/test-activity-frontend.mjs
node scripts/test-random-call.mjs
node scripts/test-default-avatars.mjs
node scripts/test-preloader.mjs
node scripts/test-request-sharing.mjs
node scripts/test-not-found.mjs
```

部分後端整合檢查需要 MongoDB 或隔離的測試環境；SEO serving 檢查在沒有 Nginx 時，會略過實際 Nginx 回應測試。測試通過不代表第三方 AI、雲端權限、實機瀏覽器及正式環境已完成驗收。日常修改只需執行直接相關的驗證及必要建置，無須每次進行全站迴歸測試。

<a id="deployment"></a>

## 部署與維運

### 前端產物與 HTTP 路由

`npm run build` 產生 `dist/`，包括：

- `index.html`、`about.html`、`privacy.html`：實際的訪客內文。
- `app.html`：登入／成員／後台使用的私有應用程式外殼。
- `404.html`：未知路由頁面。
- `sitemap.xml`、`seo-routes.json`、`static/` 及公開資源。

不能將所有未知 URL 都無條件回退至首頁。部署時需要區分公開頁、私有外殼、API 代理及真正的 404；Canonical、robots、JSON-LD 與 Sitemap 僅涵蓋經過審核的公開介紹頁。

### ECS / Nginx / systemd

儲存庫提供現有伺服器的發布、備份及回復流程，見 [`deploy/ecs/README.md`](deploy/ecs/README.md)。採用常駐 Node 程序、MongoDB 與 Nginx，適合目前的檔案設定、上傳及後台任務需求。

維護者確認 SSH、目標目錄及環境設定後，可使用：

```bash
bash deploy/ecs/push.sh
```

此指令會建置、傳輸並切換伺服器版本，**並非任意新伺服器的一鍵安裝指令**。請勿在尚未核對目標時執行。

部署重點：

- 後端環境檔案、上傳目錄及私有儲存設定獨立於版本目錄，納入受控備份，不加入 Git 或前端套件。
- 對外由 Nginx 提供 HTTPS；後端與資料庫依部署拓樸監聽迴路或內網位址。
- 設定實際正式環境的 `CORS_ORIGINS`；`TRUST_PROXY=loopback` 僅用於對應的本機反向代理拓樸。
- SSE 需要代理允許串流傳輸，並設定足夠的逾時時間；避免中間層快取或緩衝使分段輸出無法即時送達。
- 更新後核對健康檢查、登入、公開 HTML、靜態資源、未知 URL 的 404，以及此次修改相關的業務功能。
- 備份至少涵蓋 MongoDB、上傳檔案、儲存設定及 AI 主金鑰；程式碼回復不代表資料庫回復。

### Vercel 與行動端專案

`vercel.json` 包含建置、API、公開頁、靜態資源、404 及 Cron 設定。磁碟上傳、私有設定寫入、程序內限流及長時間 AI 任務需要針對平台調整；不能假設所有現有業務都可直接以相同方式部署至 Serverless。

儲存庫包含 Capacitor 設定及 Android 專案，仍保留歷史 `Uniclub` 應用程式識別值。響應式網站與 Web App Manifest 不代表已發布 Android/iOS 應用程式，也不代表班級資料支援離線存取。

### 資料升級

現有指令碼涵蓋桌寵預設偏好、班費初始化、每日新聞及活動 V2 等情境，位於 `uniclub-backend/migrations/` 或後端 scripts。升級前先備份、閱讀目標指令碼與模組文件，再決定是否執行，不要盲目執行整個目錄。

活動 V2 遷移預設為 dry-run，使用明確指定的 `ACTIVITY_MIGRATION_MONGO_URI`，只有 `--apply` 才會寫入，遠端還需要 `--allow-remote`。班費初始化指令為 `npm --prefix uniclub-backend run fees:init`；每日新聞相容指令碼為 `uniclub-backend/migrations/20261006_daily_ai_news.js`。這些操作與一般前端建置分開。

<a id="security"></a>

## 安全、隱私與已知限制

| 範圍 | 目前行為與界線 |
| --- | --- |
| 權限 | 後端驗證真實帳號、工作階段版本及管理員身分；前端隱藏入口、robots 與 noindex 無法取代 API／媒體的授權驗證 |
| 歷史介面與媒體 | 部分舊匿名介面與舊媒體連結仍待獨立稽核，不能宣稱全站所有業務資料已完全私有化；見 [SEO/GEO 稽核](docs/SEO_GEO_AUDIT.md) |
| 班級規模 | 目前為單一執行個體、單一班級，不提供多租戶隔離、統一的學校組織後台或多班級切換 |
| 班費 | 每位使用者一筆目前紀錄；截圖儲存在資料庫，由管理員核對實際入帳；沒有支付閘道、自動入帳、OCR、退款或多期帳本 |
| 量化材料 | ZIP 上限 500 MiB，支援分片及工作階段內重試；不進行病毒掃描，檔案未傳完時重新整理通常需要重新選取，不提供完整的跨頁面檔案控制代碼續傳 |
| 活動相簿 | 支援 JPEG / PNG / WebP，單張上限 10 MiB，產生 WebP 縮圖；縮圖移除中繼資料，原圖可能保留 EXIF；新媒體使用受控簽章存取 |
| 隨機點名 | 名冊與有效帳號的交集，不包含尚未開通帳號的名單列；隨機結果可重複，沒有不重複模式 |
| AI | 伺服器端持有 Key；輸出需要查核；搜尋、生成、呼叫額度及費用受外部服務限制 |
| 多程序 | AI 請求限流目前採程序內保護，動態儲存設定也受單一程序鎖定機制限制；擴充前需要另行評估 |
| 檔案與備份 | COS 物件、MongoDB 與本地檔案分別管理；公開儲存庫不得包含真實名單、繳費截圖、ZIP、環境檔案或備份 |

使用者可查看[隱私與網站儲存說明](https://csrg3b.top/privacy)。功能文件中的歷史驗收紀錄不代表所有問題都已在目前線上環境解決。

發現涉及帳號、金鑰或成員隱私的問題時，不要在公開 Issue 貼出漏洞利用細節、真實資料或憑證。請先透過維護者已建立的私下聯絡管道回報，確認後再公開不含敏感資訊的修正說明。儲存庫目前沒有獨立 `SECURITY.md`，也未承諾回應時限。

<a id="structure"></a>

## 專案目錄與內容維護

```text
uniclub-main/
├── src/
│   ├── components/              # Header、Footer、搜尋、AI 對話與共用 UI
│   ├── context/                 # 帳號、驗證、彈出視窗與主題狀態
│   ├── features/pet/            # 正式網頁桌寵
│   ├── pages/                   # 成員頁面、About 與管理後台
│   ├── lib/                     # 請求、工作階段、動畫、檔案上傳及功能工具
│   ├── styles/                  # 設計 tokens 與共用樣式
│   ├── seo/                     # 公開頁面建置時呈現
│   └── routeConfig.tsx          # 全站路由宣告
├── public/                      # 品牌、字型、預設頭像、桌寵與靜態資源
├── shared/                      # 前後端共用業務規則與 SEO 公開允許清單
├── uniclub-backend/
│   ├── index.js                 # Express 入口與任務整合
│   ├── routes/                  # 成員、管理員及需授權驗證的 Cron API
│   ├── middleware/              # 驗證、權限、隱私與回應規則
│   ├── models/                  # MongoDB 模型
│   ├── services/                # 業務、AI、搜尋與儲存服務
│   ├── cloud-functions/         # 騰訊雲 SCF 程式碼
│   ├── jobs/                    # 排程任務
│   ├── migrations/              # 增量遷移
│   ├── scripts/                 # 名單、管理員與維運輔助
│   └── test/                    # 後端測試
├── test/                        # 前端專項測試原始檔
├── scripts/                     # 啟動、建置、資源處理與專項驗證
├── docs/                        # 功能文件、稽核、實施報告與舊文件封存
├── deploy/ecs/                  # Nginx、systemd、發布、備份與回復
├── vendor/                      # 隨儲存庫散布的 GSAP 安裝包
├── design-experiments/          # 獨立設計實驗，不代表正式路由
├── dsh-niulai-pet-master/        # 桌寵上游參考專案
├── android/                     # Capacitor Android 專案
├── tokens.css                   # 全域字型、顏色與設計 tokens
├── package.json                 # 根目錄開發指令與前端相依套件
└── vercel.json                  # Vercel 部署設定
```

| 想修改的內容 | 主要位置 |
| --- | --- |
| About 介紹與開發者 | `src/pages/AboutPage.tsx`、`src/pages/about/` |
| 首頁標語及打字參數 | `src/pages/Homepage.tsx`、`src/components/AnimatedTerminalText.tsx` |
| Header、Footer、頁面外殼 | `src/components/SiteHeader.tsx`、`SiteFooter.tsx`、`Layout.tsx` |
| 字型、顏色與互動樣式 | 根目錄 `tokens.css` 與 `src/styles/`；字型來源見 `FONT_NOTES.md` |
| 路由 | `src/routeConfig.tsx`、`src/routes.tsx` |
| 公開 SEO 文案與範圍 | `shared/seo.json`、`src/lib/seo.ts`、`scripts/build-seo.mjs` |
| Axios / SSE 請求 | `src/lib/axios.ts`、`src/lib/aiStream.ts` |
| AI 模型、上下文與檢索 | `uniclub-backend/services/DeepSeekAssistant.js` 及共用搜尋服務 |

<a id="docs"></a>

## 文件索引

| 文件 | 內容 |
| --- | --- |
| [ECS 部署](deploy/ecs/README.md) | 發布、健康檢查、備份、回復與持久化目錄 |
| [後台 AI](uniclub-backend/README.ai.md) | 金鑰、情境、發布預覽及服務實作 |
| [AI 每日新聞](uniclub-backend/README.daily-news.md) | 檢索、時效、排程、批次發布及失敗診斷 |
| [量化材料](docs/quantification.md) | 收集期、ZIP、COS、上傳及下載 |
| [班費](docs/fees.md) | 付款憑證與人工確認流程 |
| [活動設計](docs/activity-v2/ACTIVITY_V2_DESIGN.md) | 活動生命週期、報名、媒體及相容界線 |
| [活動 API](docs/activity-v2/ACTIVITY_V2_API.md) | 成員與管理介面的契約 |
| [活動 COS](docs/activity-v2/ACTIVITY_V2_COS.md) | 雲端儲存、SCF、權限及實際網路驗收紀錄 |
| [活動測試報告](docs/activity-v2/ACTIVITY_V2_TEST_REPORT.md) | 相關驗證結果及未涵蓋的範圍 |
| [SCF 函式](uniclub-backend/cloud-functions/quantification/README.md) | 雲端函式部署與受保護的呼叫 |
| [網頁桌寵](docs/classhub-pet.md) | 正式功能、偏好、來源及尚未遷移的功能 |
| [字型說明](FONT_NOTES.md) | 字型來源、語意、分片及授權條款 |
| [GSAP 安裝包](vendor/README.md) | 本地相依套件及建置約定 |
| [SEO / GEO 稽核](docs/SEO_GEO_AUDIT.md) | 公開界線、HTML、索引、部署及待辦事項 |
| [舊 UniClub 文件封存](docs/archive/legacy-uniclub/README.md) | 歷史架構與操作紀錄，不作為目前的啟動指南 |

部分文件保留當時的部署、測試及故障紀錄。歷史連接埠、UI 狀態與「已完成／未完成」結論應配合目前原始碼核對，不代表今日的正式環境狀態。

<a id="faq"></a>

## 常見問題

### 為什麼 localhost:8081 無法開啟？

確認 `npm start` 正在執行、相依套件已安裝且 8081 未被占用。後端啟動失敗時，查看終端機中的 MongoDB 與環境設定錯誤；`ERR_CONNECTION_REFUSED` 表示目標連接埠沒有可連線的服務，不是重新整理就能修正的頁面樣式問題。

### 前端能開啟，為什麼 API 出現錯誤？

檢查 <http://localhost:5050/api/health>，再核對 `VITE_API_PROXY_TARGET` 與實際後端連接埠。開發代理與正式環境的 `VITE_API_URL` 用途不同；跨網域正式部署還需要正確的 CORS。資料庫未連線時，健康檢查可能回傳 503。

### 為什麼首頁沒有班級消息，或無法進入後台？

訪客首頁顯示公開介紹，不讀取班級內容。登入後可用的資訊取決於已發布紀錄；後台需要資料庫中的管理員權限。修改前端按鈕或偽造角色欄位不會取得管理員權限。

### 為什麼新聞生成出現 `SEARCH_NO_RESULTS` 或 `INSUFFICIENT_SOURCES`？

檢查任務紀錄中的檢索結果、獨立發布者、可讀取內文及時效情況。金鑰可用不保證可靠來源充足；免費 NewsAPI 的延遲、RSS 失敗或伺服器無法存取來源都可能影響結果。任務不會透過擴大時效範圍、關閉驗證或讓模型編造來湊足篇數。

### 為什麼本地 AI 成功，上線後卻失敗？

分別核對目標環境的 AI 加密主金鑰、資料庫設定、搜尋網路、來源內文讀取、代理逾時及任務時長。前端介面設定相同，不代表伺服器的金鑰、網路與持久化目錄相同；請使用任務錯誤碼定位具體環節。

### 為什麼上傳時提示未開通或 CORS 錯誤？

檢查後台儲存設定、私有儲存桶、函式授權驗證、最小目錄權限、實際網站 Origin 與請求標頭。活動媒體不能沿用未受保護的舊開放憑證函式。簽章到期時應重新取得，不應將儲存桶改為公開來繞過問題。

### 為什麼隨機點名沒有包含某個人？

確認該人同時存在於目前真實名單與有效成員帳號中；只匯入名單但沒有有效帳號的列不會進入隨機池。管理員身分本身不會導致排除，但不在名單中的獨立管理帳號不是班級隨機成員。

### 可以直接複製成多個班級、啟用深色模式或發布手機 App 嗎？

這些都不是目前已完成的產品功能。多班級需要明確的資料隔離設計；目前 Theme 固定為淺色；行動端專案還需要品牌、簽章、平台設定及相應驗收。

<a id="contributing"></a>

## 參與貢獻與問題回報

歡迎透過 [Issues](https://github.com/Mason1035/uniclub-main/issues) 提交可重現的問題，或透過 Pull Request 提供改進。

- 問題回報包含頁面、重現步驟、預期／實際結果及裝置環境；截圖、紀錄應先移除敏感資訊。
- 修改時沿用現有路由、請求層、使用者模型、元件及設計 tokens，避免另建一套驗證、AI 或儲存系統。
- 涉及成員資料、權限、費用、雲端資源或遷移的變更，要明確說明影響範圍、失敗後的復原方式及驗證界線。
- 保留第三方來源及授權說明；隨相關修改更新文件。
- 依修改內容執行相關測試、lint、typecheck 或 build；不將模擬介面檢查描述為實際正式環境驗收。
- 目前沒有獨立 `CONTRIBUTING.md` 或正式 `CHANGELOG.md`，貢獻約定以本節及相關模組文件為準。

<a id="credits"></a>

## 開發者、授權與素材來源

專案儲存庫由 [Mason1035](https://github.com/Mason1035) 等帳號維護。參與建置與維運的成員包括 **何宇軒、張鵬飛、李青原**，具體程式碼貢獻可透過儲存庫的提交紀錄查看。

根目錄目前沒有統一的 `LICENSE`。後端套件中繼資料中的 ISC、相依套件授權、字型 OFL 與桌寵 MIT，不代表對整個專案及所有素材的統一授權；複製、再散布或商業使用前，應與維護者確認適用範圍。

| 來源 | 說明 |
| --- | --- |
| 正式字型 | 思源宋體、思源黑體、得意黑、Schibsted Grotesk，來源與 OFL 文字見 [FONT_NOTES.md](FONT_NOTES.md) |
| About 英文字型 | Space Grotesk；保留 [OFL 授權條款](public/fonts/classhub/SpaceGrotesk-OFL.txt) |
| 桌寵引擎 | 改寫自 whitefirer 的 dsh-niulai-pet；保留 [MIT 檔案](public/pet-assets/LICENSE)及[素材說明](public/pet-assets/NOTICE.md) |
| 使用者提供的角色、音訊及頭像素材 | 不會因程式碼或引擎授權而自動取得第三方素材授權；適用權利須分別查核 |
| GSAP 與其他相依套件 | 保留各自隨套件附帶的授權條款；本地 GSAP 套件見 [vendor/README.md](vendor/README.md) |


<a id="translations"></a>

## 多語言 README

簡體中文版作為後續翻譯的基準，英文版、俄文版、印地語版、日文版、繁體中文版與西班牙語版均已完成。語言導覽連結至各版本的 README。

| 語言 | 狀態 |
| --- | --- |
| 简体中文 | 已完成：[README.md](README.md) |
| English | 已完成：[README.en.md](README.en.md) |
| Русский（俄文） | 已完成：[README.ru.md](README.ru.md) |
| हिन्दी（印地語） | 已完成：[README.hi.md](README.hi.md) |
| 日本語（日文） | 已完成：[README.ja.md](README.ja.md) |
| 繁體中文 | 已完成：[README.zh-TW.md](README.zh-TW.md) |
| Español（西班牙語） | 已完成：[README.es.md](README.es.md) |

後續譯文應保持相同的功能、指令、限制與連結，不加入簡體中文版未描述的功能。完成實際檔案後再啟用語言切換連結；其他語言可依需求繼續擴充。

---

<p align="center">
  <a href="https://csrg3b.top/">ClassHub</a> · 四川師範大學 · 2025 級軟體工程 3 班
</p>
