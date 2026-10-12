<p align="center">
  <strong>简体中文</strong> · <a href="README.en.md">English</a> · <a href="README.ru.md">Русский</a> · <a href="README.hi.md">हिन्दी</a> · 繁體中文（待翻譯）
</p>

<p align="center">
  <a href="https://csrg3b.top/">
    <img src="public/branding/classhub-logo-384-d01f9050a1.webp" width="280" alt="ClassHub" />
  </a>
</p>

<h1 align="center">ClassHub</h1>

<p align="center">
  <strong>把班级消息、学习资料与日常事务，放在同一个地方。</strong>
</p>

<p align="center">
  为校园班级构建的信息平台：公告、新闻、活动、资源、交流、班级事务与 AI 辅助。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white" alt="Node.js 22 部署环境" />
  <img src="https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb&logoColor=white" alt="MongoDB 8 部署环境" />
</p>

<p align="center">
  <a href="https://csrg3b.top/">访问网站</a> ·
  <a href="https://csrg3b.top/about">项目介绍</a> ·
  <a href="https://csrg3b.top/privacy">隐私说明</a> ·
  <a href="https://github.com/Mason1035/uniclub-main/issues">反馈问题</a>
</p>

<p align="center">
  <a href="#quick-start">快速开始</a> ·
  <a href="#features">功能概览</a> ·
  <a href="#configuration">配置说明</a> ·
  <a href="#deployment">部署</a> ·
  <a href="#docs">文档</a> ·
  <a href="#faq">常见问题</a>
</p>

---

<a id="overview"></a>

## 项目简介

ClassHub 当前服务于**四川师范大学 2025 级软件工程 3 班**。成员可以集中查看消息、阅读新闻、参与活动、共享资料、发布动态和办理班级事务；管理员在同一套系统中维护内容、名单、报名与提交记录。

项目使用 React + TypeScript 前端与 Node.js + Express + MongoDB 后端，包含真实账号、权限、内容管理、AI 服务和对象存储接入。当前每个部署实例使用一份班级名单，尚不是多租户、多班级管理平台。

首页、About 和隐私说明面向访客展示产品介绍；班级页面需要登录，管理后台需要管理员权限。公开代码仓库不等于公开班级成员资料或业务数据，也不代表学校官方组织身份。

**本文说明当前仓库的实现。** 线上版本、可用内容和外部服务状态可能不同，代码存在不代表某个环境已完成配置或发布。

### 目录

- [功能概览](#features)
- [页面入口与使用方式](#usage)
- [技术栈与架构](#architecture)
- [快速开始](#quick-start)
- [环境与外部服务配置](#configuration)
- [管理员与班级名单](#accounts)
- [AI 与每日新闻](#ai)
- [开发、构建与验证](#development)
- [部署与运维](#deployment)
- [安全、隐私与已知限制](#security)
- [项目目录与内容维护](#structure)
- [文档索引](#docs)
- [常见问题](#faq)
- [参与贡献与问题反馈](#contributing)
- [开发者、许可与素材来源](#credits)
- [多语言 README](#translations)

<a id="features"></a>

## 功能概览

### 成员端

| 模块 | 已实现的能力 |
| --- | --- |
| 首页 | 展示最近的公告、活动、资源与新闻，以及少量班级动态和活动回忆；完整内容进入对应栏目查看 |
| 公告与通知 | 阅读班级公告、查看个人通知和未读状态、标记已读 |
| 新闻 | 新闻列表、正文、内容互动，以及“就这篇新闻问一问”AI 对话 |
| 活动 | 查看活动阶段、日历、类型及年份筛选；申请报名、查看自己的审批状态、取消报名；浏览活动总结、相册和往期记录 |
| 学习资源 | 资料列表、详情、资源链接、下载入口和使用记录 |
| 班级动态 | 发布文字与图片、讨论和互动、收藏，以及既有关注与可见性规则 |
| 站内搜索 | 搜索当前账号有权访问的内容，复用全站搜索弹窗 |
| 量化材料 | 按开放的收集期提交 ZIP、查看结果、截止前重新提交、下载自己的材料 |
| 班费 | 查看付款码、提交支付截图和备注、查看管理员确认状态 |
| 随机点名 | 从真实有效成员池均匀抽取一人，以头像专辑封套与黑胶唱片展示结果，支持“再来一次” |
| 账号与设置 | 学号/编号登录、修改密码、个人资料、头像、偏好和已保存内容 |
| 默认头像 | 未上传头像时从头像库按稳定账号标识分配；同一账号跨页面和设备保持一致 |
| 网页桌宠 | 可选桌宠、皮肤、交互与账号关联偏好，详见[桌宠文档](docs/classhub-pet.md) |

### 管理端

| 模块 | 已实现的能力 |
| --- | --- |
| 数据概览 | 查看现有班级内容与业务概况 |
| 名单与成员 | 导入真实班级名单、管理成员与账号权限 |
| 内容管理 | 管理新闻、资源、公告/通知，以及既有相册记录 |
| 活动管理 | 草稿与发布、时间/容量设置、报名审核与批量操作、未报名统计、相册、总结、归档、隐藏和恢复 |
| 量化材料 | 创建收集期、设置开放时间、按真实名单查看已交/未交、筛选记录与下载材料 |
| 班费管理 | 配置付款码、查看凭证、人工核对并确认到账 |
| AI 助手 | 文本与图片辅助、场景生成、编辑发布预览、连续修改、停止生成和流式回答 |
| AI 每日新闻 | 设置时间、数量和类别；检索、核验、整批发布；查看运行状态、失败原因与历史任务 |

### 交互与展示

- 响应式 Header、手机底部导航、居中页脚，以及共享表单、弹窗和反馈组件。
- 首次进入的品牌加载动画：等待当前路由、首屏字体和可见图片；会话内避免重复播放，保留超时释放和键盘跳过。
- About 页面包含平滑滚动、原创几何体与开发者透明卡片弧线动效；该页不显示顶部页眉。
- 独立 404 页面复用品牌、现有搜索入口与本地宇航员素材。
- 动画考虑 `prefers-reduced-motion`；手机及触摸环境采用相应布局与滚动方式。
- **当前应用固定使用浅色主题。** 历史暗色样式或相关依赖不代表已开放深色模式切换。

<a id="usage"></a>

## 页面入口与使用方式

| 入口 | 路径 | 访问范围 |
| --- | --- | --- |
| 首页 / 项目介绍 / 隐私说明 | `/`、`/about`、`/privacy` | 访客可浏览公开介绍 |
| 登录 | `/auth` | 使用班级账号登录 |
| 公告 / 新闻 / 活动 | `/announcements`、`/news`、`/events` | 登录成员 |
| 资源 / 班级动态 | `/resources`、`/social` | 登录成员 |
| 通知 / 已保存内容 / 设置 | `/notifications`、`/saved-posts`、`/settings` | 当前账号 |
| 班级功能 | `/functions` | 登录成员 |
| 材料提交 / 班费 | `/quantification`、`/fees` | 登录账号，具体操作由后端校验 |
| 随机点名 | `/functions/random-call` | 当前有效班级成员 |
| 管理后台 | `/admin` | 经后端确认的管理员 |
| 后台 AI / 每日新闻 | `/admin/ai`、`/admin/ai#daily-news` | 管理员 |

新闻详情使用 `/article/:id`，同时保留 `/news/:id`；活动详情使用 `/events/:id`，兼容 `/event/:id`；资源详情使用 `/resource/:id`。新闻问答位于新闻详情页底部，不是独立公开聊天页面。

同学使用管理员开通的账号登录后，从导航进入相应栏目。管理员先准备真实名单，再发布内容、开放收集期和配置相关服务。没有发布内容或服务未开通时，页面显示相应空状态或错误提示。

<a id="architecture"></a>

## 技术栈与架构

| 层次 | 技术与实现 |
| --- | --- |
| 前端 | React 18、TypeScript 5、Vite 5、React Router 6 |
| 数据与组件 | TanStack React Query、Axios、Tailwind CSS、Radix UI、Lucide、React Markdown |
| 动画 | GSAP 3.15、`@gsap/react`；About 按需使用 ScrollTrigger / ScrollSmoother |
| 后端 | Node.js、Express 5、CommonJS；路由、业务 Service 与 Repository |
| 数据库 | MongoDB、Mongoose 8 |
| 认证 | bcrypt 密码散列、JWT、数据库账号/管理员校验与 `tokenVersion` 会话撤销 |
| AI | 共享 `DeepSeekAssistant`、SSE、受控联网搜索与正文抓取 |
| 图片与文件 | Multer、Sharp、腾讯云 COS / SCF、短期签名与浏览器直传 |
| 公开页渲染 | 构建时生成首页、About、Privacy 的真实访客 HTML；运行时保留 React 交互 |
| 部署 | ECS / Nginx / systemd；仓库另包含 Vercel 配置 |
| 移动端 | 响应式 Web、Web App Manifest、Capacitor 配置与 Android 工程 |

```text
浏览器 / React 页面
    │
    ├─ 开发：Vite 代理 /api、/uploads
    └─ 生产：Nginx 反向代理 / 独立 API Origin
            │
            ▼
        Express API
            ├─ JWT / 账号 / 权限校验
            ├─ Service / Repository ── MongoDB
            ├─ DeepSeekAssistant ── DeepSeek
            │        └─ NewsAPI / 发布者 RSS / 受控网页读取
            └─ 受保护存储服务 ── SCF / COS
                                  ▲
                       浏览器持短期授权直传或下载
```

主要数据模型包括 `User`、`EnrolledUser`、`News`、`Announcement`、`Event`、`ActivityMedia`、`Resource`、`SocialPost`、`Notification`、`Chat`、`AiSettings`、`DailyNewsJob`，以及量化收集/提交/上传和班费设置/凭证模型。各功能复用现有用户与班级名单，没有第二套学生数据。

<a id="quick-start"></a>

## 快速开始

### 1. 准备环境

- Git、Node.js 与 npm。现有 ECS 部署使用 **Node.js 22**，建议本地保持相同主版本；仓库未设置 `engines` 硬限制。
- 可连接的 MongoDB 实例。现有部署使用 MongoDB 8，部分业务兼容 standalone，不以副本集事务作为启动前提。
- AI 与云上传是可选外部服务：未配置时相关能力不可用，不影响公开介绍页面浏览。

### 2. 获取代码并安装依赖

```bash
git clone https://github.com/Mason1035/uniclub-main.git
cd uniclub-main
npm ci
npm --prefix uniclub-backend ci
```

也可以使用 `npm run install-all`，它会分别执行前后端 `npm install`。GSAP 依赖来自仓库内 `vendor/` 的安装包，克隆、构建和部署时必须保留该目录。

### 3. 配置后端

复制示例文件：

```bash
cp uniclub-backend/.env.example uniclub-backend/.env
```

Windows PowerShell：

```powershell
Copy-Item uniclub-backend/.env.example uniclub-backend/.env
```

编辑 `uniclub-backend/.env`，至少填写：

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/uniclub
JWT_SECRET=replace_with_a_long_random_private_secret
PORT=5050
REQUIRE_ENROLLED_ROSTER=true
ALLOWED_EMAIL_DOMAINS=
```

连接串只是本地示例，`JWT_SECRET` 必须替换。示例中的 NewsAPI / Gemini 占位值不是有效密钥；不启用相关服务时应清空。当前 DeepSeek 功能的配置步骤见下文，不需要 Gemini 密钥。

如果本机已安装 `mongod`，可在单独终端运行：

```bash
npm run mongo
```

脚本默认绑定 `127.0.0.1:27017`，数据目录为 `~/data/db`；它不负责安装 MongoDB。已有数据库服务时无需再次启动。可用 `MONGOD_BIN`、`MONGODB_DBPATH`、`MONGODB_PORT` 覆盖本机路径或端口。

### 4. 启动前后端

```bash
npm start
```

| 服务 | 默认地址 |
| --- | --- |
| 前端 | <http://localhost:8081> |
| 后端健康检查 | <http://localhost:5050/api/health> |
| 项目介绍 | <http://localhost:8081/about> |
| 登录 / 管理后台 | <http://localhost:8081/auth> / <http://localhost:8081/admin> |

后端连接数据库成功后才监听端口。首次使用需要[初始化管理员及班级名单](#accounts)；公开首页不会凭空生成成员或业务内容。

也可在两个终端分别运行 `npm run backend` 与 `npm run frontend`。通用启动命令适用于 Windows；旧 `start:win` / `stop:win` 脚本仍包含 5000 端口假设及终止端口进程的行为，不建议作为默认启动方式。

<a id="configuration"></a>

## 环境与外部服务配置

### 配置放在哪里？

| 配置 | 位置与用途 |
| --- | --- |
| 后端连接、认证、服务端密钥 | `uniclub-backend/.env` 或生产服务器受控环境变量 |
| 前端开发代理 | 根目录 `.env.local` 的 `VITE_API_PROXY_TARGET`，默认 `http://localhost:5050` |
| 前端生产 API 地址 | 构建时的 `VITE_API_URL`；同域反向代理可留空，跨域填 API Origin，不重复追加 `/api` |
| DeepSeek API Key | 管理后台 `/admin/ai` 配置，加密存入 `AiSettings` |
| 存储业务配置 | 后台量化材料存储设置，写入私有配置文件；位置可由 `QUANTIFICATION_STORAGE_CONFIG_PATH` 指定 |

**`VITE_*` 会进入浏览器构建，不能放任何密钥。** 根目录旧 `.env.example` 中的 `VITE_API_URL=http://localhost:5000` 不代表当前开发代理端口，不能直接作为生产配置照搬。

后端改端口时，在根目录 `.env.local` 设置代理目标，再启动：

```dotenv
VITE_API_PROXY_TARGET=http://localhost:5051
```

根启动脚本据此选择后端端口；若额外设置 `PORT`，要保证它与代理目标一致。生产 `VITE_API_URL` 修改后需要重新构建前端。

### 按需启用的服务

| 服务 | 配置要点 | 未配置时 |
| --- | --- | --- |
| DeepSeek | 初始化 `AI_SECRET_ENCRYPTION_KEY`，重启后端，在后台保存 Key 并测试连接 | AI 助手、新闻问答与每日生成不可用 |
| 新闻搜索 | 现有 `NEWS_API_KEY`；共享检索层还可使用固定发布者 RSS | RSS 可补充，但仍受来源、时效和网络限制 |
| COS 直接适配器 | `OBJECT_STORAGE_PROVIDER=cos`、`COS_BUCKET`、`COS_REGION`、`COS_SECRET_ID`、`COS_SECRET_KEY` | 无法真实上传材料 |
| SCF + COS | 私有桶、地域、函数调用地址及匹配的服务端鉴权；后台存储设置 | 对应云上传/下载不可用 |
| 活动媒体 | 受保护 SCF、`CLASSHUB_SCF_AUTH_SECRET`、仅活动目录所需权限、CORS | 活动原图及缩略图无法正常保存 |
| 生产请求来源 | `CORS_ORIGINS`、`BACKEND_URL`，按实际域名配置 | 跨域访问或生成链接可能异常 |
| 鉴权 Cron | `CRON_SECRET` | 外部 Cron 调用被拒绝 |

存储需要另外配置云资源、私有权限、CORS 与持久目录；`npm start` 不会自动创建腾讯云桶、函数或角色。当前实现支持 COS，不包含可直接使用的 OSS 适配器。活动与量化复用存储配置，但对象路径和业务权限分开。

云端步骤见[量化材料文档](docs/quantification.md)、[SCF 配置说明](uniclub-backend/cloud-functions/quantification/README.md)和[活动 COS 文档](docs/activity-v2/ACTIVITY_V2_COS.md)。这些文档包含历史实施记录，实际配置以当前源码与目标环境为准。

<a id="accounts"></a>

## 管理员与班级名单

### 初始化管理员

在后端私有环境中设置 `ADMIN_EMAIL`、`ADMIN_PASSWORD`，可选 `ADMIN_NAME`、`ADMIN_UNIQUE_ID`，然后从根目录运行：

```bash
npm run admin:create
```

- 登录使用 **学号/编号 `uniqueId`**，不是邮箱；独立管理员默认编号为 `ADMIN-...`。
- 如果匹配到已有账号，脚本可能提升其管理员身份。默认保留已有密码，只有明确设置 `ADMIN_UPDATE_PASSWORD=true` 才更新密码。
- 初始化变量使用后应从长期环境中移除；不要把真实密码写进 README、命令示例或提交到 Git。
- 更换现有管理员密码可使用隐藏输入的终端命令：`npm run admin:password -- admin@example.com`。这里的邮箱是示例；密码更新后旧会话失效。

### 导入班级名单

支持 CSV、TSV、JSON；学号与姓名必填，邮箱选填。CSV 示例使用虚构成员：

```csv
学号,姓名
202500001,示例成员甲
202500002,示例成员乙
```

先检查，再确认写入：

```bash
npm run roster:import -- ./名单.csv --dry-run
npm run roster:import -- ./名单.csv
```

`--dry-run` 不改账号、名单或索引。正式导入会创建缺失的登录账号，**初始密码为学号，首次登录应修改**；重复导入保留已有密码、角色和资料。不要把真实名单文件纳入公开仓库。

默认注册策略要求名单中的邮箱与学号匹配；当前主要使用导入后直接学号登录。`REQUIRE_ENROLLED_ROSTER=false` 会放开注册名单检查，不能把它当成修复名单错误的常规办法。

随机点名池来自 `User.isEnrolled` 与 `EnrolledUser.uniqueId` 的交集，不按管理员身份排除。班级名单中的学生管理员参与抽取；不在名单中的独立管理账号不计入。每次使用完整成员池，允许连续抽到同一人；浏览器 `crypto.getRandomValues()` 配合拒绝采样避免取模偏差。

<a id="ai"></a>

## AI 与每日新闻

### 一套共享 AI 服务

后台助手、新闻问答和每日新闻共用 `DeepSeekAssistant`、同一套数据库配置与密钥，不分别创建 AI Key 或 Client。当前代码使用 `deepseek-flash` 和 `https://api.deepseek.com`，具体模型策略集中在共享服务中。

初始化加密主密钥：

```bash
npm --prefix uniclub-backend run ai:init-secret
```

然后重启后端，在 `/admin/ai` 填写 DeepSeek API Key 并测试连接。主密钥为 32 字节 Base64，API Key 以 AES-256-GCM 加密存储。备份时需要同时保留数据库与主密钥；主密钥丢失或被替换后，原保存的 Key 无法解密，需要重新录入。

### 后台内容助手

支持文本/图片输入、12 类场景、流式生成、Markdown 结果、继续修改和停止生成。**资源介绍、公告草稿、新闻稿、活动文案**提供对应栏目发布预览，编辑、校验并确认后通过原业务接口发布；生成本身不等于自动发布。

### 新闻问答

- 前端只发送新闻 ID 与问题；`GET/POST /api/chat/:articleId` 由服务端读取可信正文、文章可见性和当前用户历史。
- 普通总结、文章观点与组织提取优先依据正文；“为什么、分析影响、比较”等问题可启用 reasoning。
- “最新、现在、后续进展、帮我查”等问题按需触发共享搜索；外部网页视为不可信参考内容，不作为系统指令。
- 长新闻和历史消息有上下文预算；SSE 分段显示回答，复用现有 Markdown 渲染，来源只来自实际检索。
- 搜索失败时可以退回新闻正文作答；对话保存在现有 `Chat` 模型，按用户和新闻区分。问题上限 1000 字。
- 存在后端限流和并发保护，默认新闻问答每用户 10 分钟 20 次；当前保护为单进程内存机制，不是分布式额度管理。

### AI 每日新闻

后台 `/admin/ai#daily-news` 管理设置、状态和任务历史。默认北京时间 `19:00`、每天 2 篇，数量可配置为 1–5 篇，覆盖人工智能、科技、软件工程、科学、教育。

```text
定时检查 / 管理员确认运行
    → NewsAPI + 发布者 RSS 检索
    → 时效、发布者与来源校验
    → 选题、读取来源正文、生成与事实审核
    → 暂存完整批次
    → 成功后切换可见批次，保留人工新闻与旧批次记录
```

采用过去 24 小时内的真实来源。可靠来源不足或核验失败时不凑数、不替换最近成功批次；旧 AI 新闻按批次归档，不自动删除人工新闻。

`NODE_ENV=production` 的持久后端进程自动检查任务，开发启动不自动调用付费 AI。Vercel Cron 使用受保护的 `/api/cron/daily-news`，需要 `CRON_SECRET`，也需要套餐支持对应频率和足够执行时长。

手动诊断在后端目录执行：

```bash
cd uniclub-backend
node manual-curation.js --dry-run
```

**这里的 `--dry-run` 仍会真实联网并调用付费 AI，只是不保存新闻。** 去掉参数会尝试发布；`--force` 用于明确重新生成当天批次。旧新闻整理命令已转到统一每日新闻流程，不应再按旧 Dallas 午夜 Gemini 任务说明配置。

NewsAPI Developer 免费套餐的检索文章有 24 小时延迟，且官方限定用于开发和测试，不能用于预发布或生产环境；线上使用该 Provider 需要符合其套餐条件。见 [NewsAPI 官方套餐说明](https://newsapi.org/pricing)。RSS 可以补充来源，但本地成功不保证服务器网络、来源网页和所有日期都成功。更多实现说明见[每日新闻文档](uniclub-backend/README.daily-news.md)。AI 输出与引用应核实，费用取决于供应商及实际使用。

<a id="development"></a>

## 开发、构建与验证

### 常用命令

以下命令在仓库根目录执行：

| 命令 | 用途 |
| --- | --- |
| `npm start` / `npm run dev` | 同时启动前后端 |
| `npm run frontend` / `npm run backend` | 只启动一侧 |
| `npm run mongo` | 启动已安装的本地 MongoDB |
| `npm run typecheck` | 前端及 Vite 配置的 TypeScript 检查 |
| `npm run lint` | 当前 ESLint 配置下的源码检查 |
| `npm run build` | 类型检查、Vite 构建、公开 SEO HTML 生成 |
| `npm run preview` | 预览 `dist/`，不启动后端或数据库 |
| `npm test` | 后端测试及桌宠测试；不包含所有前端专项脚本 |
| `npm --prefix uniclub-backend run test:ai` | 后台 AI 相关测试 |
| `npm run test:seo` | 公开页面及部署路由验证，需先构建 |
| `npm run test:pet` | 桌宠测试 |
| `npm run admin:create` / `npm run roster:import -- ...` | 管理员与名单初始化，会按参数写数据库 |
| `npm run curate:news` | 手动每日新闻任务，可能调用付费服务并写新闻 |
| `npm run daily-curator` | 独立调度进程；生产主进程已有调度时通常无需重复启动 |

按改动范围选择现有专项检查：

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

一些后端集成检查需要 MongoDB 或隔离测试环境；SEO serving 检查在没有 Nginx 时会跳过真实 Nginx 响应测试。测试通过不代表第三方 AI、云权限、真机浏览器和生产环境已经验收。日常修改只运行直接相关验证及必要构建，无需每次执行全站回归。

<a id="deployment"></a>

## 部署与运维

### 前端产物与 HTTP 路由

`npm run build` 生成 `dist/`，包括：

- `index.html`、`about.html`、`privacy.html`：真实访客正文。
- `app.html`：登录/成员/后台使用的私有应用外壳。
- `404.html`：未知路由页面。
- `sitemap.xml`、`seo-routes.json`、`static/` 及公共资源。

不能把所有未知 URL 都无条件回退到首页。部署需要保留公开页、私有外壳、API 代理和真实 404 的区别；Canonical、robots、JSON-LD 与 Sitemap 仅覆盖审核过的公开介绍页。

### ECS / Nginx / systemd

仓库提供现有服务器的发布、备份和回滚流程，见 [`deploy/ecs/README.md`](deploy/ecs/README.md)。它使用持久 Node 进程、MongoDB 与 Nginx，适合当前文件配置、上传和后台任务需求。

维护者在确认 SSH、目标目录和环境配置后，可使用：

```bash
bash deploy/ecs/push.sh
```

这个命令会构建、传输并切换服务器版本，**不是任意新服务器的一键安装命令**。不要在未核对目标时执行。

部署要点：

- 后端环境文件、上传目录和私有存储配置独立于版本目录，纳入受控备份，不加入 Git 或前端包。
- 公网由 Nginx 提供 HTTPS；后端和数据库按部署拓扑监听回环或内网。
- 配置实际生产 `CORS_ORIGINS`；`TRUST_PROXY=loopback` 仅用于相应本机反向代理拓扑。
- SSE 需要代理允许流式传输，并配置足够超时；避免中间层缓存或缓冲吞掉逐段输出。
- 更新后核对健康检查、登录、公开 HTML、静态资源、未知 URL 404，以及本次修改相关业务。
- 备份至少覆盖 MongoDB、上传文件、存储设置和 AI 主密钥；代码回滚不等于数据库回滚。

### Vercel 与移动工程

`vercel.json` 包含构建、API、公开页、静态资源、404 与 Cron 配置。磁盘上传、私有配置写入、进程内限流和长时间 AI 任务需要针对平台适配；不能假设所有现有业务可直接无差异部署到 Serverless。

仓库包含 Capacitor 配置与 Android 工程，仍有历史 `Uniclub` 应用标识。响应式网站和 Web App Manifest 不等于已经发布 Android/iOS 应用，也不代表班级数据支持离线访问。

### 数据升级

已有脚本覆盖桌宠默认偏好、班费初始化、每日新闻和活动 V2 等场景，位于 `uniclub-backend/migrations/` 或后端 scripts。升级前先备份、阅读目标脚本与模块文档，再决定是否执行，不要盲目运行整个目录。

活动 V2 迁移默认 dry-run，使用显式 `ACTIVITY_MIGRATION_MONGO_URI`，只有 `--apply` 写入，远程还需 `--allow-remote`。班费初始化命令为 `npm --prefix uniclub-backend run fees:init`；每日新闻兼容脚本为 `uniclub-backend/migrations/20261006_daily_ai_news.js`。这些操作与普通前端构建分开。

<a id="security"></a>

## 安全、隐私与已知限制

| 范围 | 当前行为与边界 |
| --- | --- |
| 权限 | 后端校验真实账号、会话版本及管理员身份；前端隐藏入口、robots 和 noindex 不能替代 API / 媒体鉴权 |
| 历史接口与媒体 | 部分旧匿名接口和旧媒体链接仍有待独立审计，不能宣称全站所有业务数据已完全私有化；见 [SEO/GEO 审计](docs/SEO_GEO_AUDIT.md) |
| 班级规模 | 当前是单实例单班级，不提供多租户隔离、统一学校组织后台或多班级切换 |
| 班费 | 每用户一条当前记录；截图保存在数据库，由管理员核对实际到账；没有支付网关、自动到账、OCR、退款或多期账本 |
| 量化材料 | ZIP 上限 500 MiB，支持分片与会话内重试；不进行病毒扫描，未传完文件刷新后通常需要重选，不提供完整跨页面文件句柄续传 |
| 活动相册 | 支持 JPEG / PNG / WebP，单张上限 10 MiB，生成 WebP 缩略图；缩略图去元数据，原图可能保留 EXIF；新媒体使用受控签名访问 |
| 随机点名 | 名册与有效账号交集，不包含未开通账号的名单行；可重复随机，没有不重复模式 |
| AI | 服务端持有 Key；输出需要核实；搜索、生成、调用额度和费用受外部服务限制 |
| 多进程 | AI 请求限流当前为进程内保护，动态存储配置还有单进程锁边界；扩容前需要单独评估 |
| 文件与备份 | COS 对象、MongoDB 与本地文件分别管理；公开仓库不得包含真实名单、缴费截图、ZIP、环境文件或备份 |

用户可查看[隐私与网站存储说明](https://csrg3b.top/privacy)。功能文档中的历史验收记录不代表所有问题已在当前线上环境解决。

发现涉及账号、密钥或成员隐私的问题时，不要在公开 Issue 贴漏洞利用细节、真实数据或凭据。先通过维护者已建立的私下联系渠道报告，待确认后公开不含敏感信息的修复说明。仓库目前没有独立 `SECURITY.md` 或承诺响应时限。

<a id="structure"></a>

## 项目目录与内容维护

```text
uniclub-main/
├── src/
│   ├── components/              # Header、Footer、搜索、AI 对话和共享 UI
│   ├── context/                 # 账号、认证、弹窗与主题状态
│   ├── features/pet/            # 正式网页桌宠
│   ├── pages/                   # 成员页面、About 与管理员后台
│   ├── lib/                     # 请求、会话、动效、文件上传和功能工具
│   ├── styles/                  # 设计 tokens 与共享样式
│   ├── seo/                     # 公开页面构建时渲染
│   └── routeConfig.tsx          # 全站路由声明
├── public/                      # 品牌、字体、默认头像、桌宠与静态资源
├── shared/                      # 前后端共享业务规则与 SEO 公开白名单
├── uniclub-backend/
│   ├── index.js                 # Express 入口及任务接入
│   ├── routes/                  # 成员、管理员及鉴权 Cron API
│   ├── middleware/              # 认证、权限、隐私与响应规则
│   ├── models/                  # MongoDB 模型
│   ├── services/                # 业务、AI、搜索与存储服务
│   ├── cloud-functions/         # 腾讯云 SCF 代码
│   ├── jobs/                    # 定时任务
│   ├── migrations/              # 增量迁移
│   ├── scripts/                 # 名单、管理员与运维辅助
│   └── test/                    # 后端测试
├── test/                        # 前端专项测试源文件
├── scripts/                     # 启动、构建、资源处理与专项验证
├── docs/                        # 功能文档、审计、实施报告与旧文档归档
├── deploy/ecs/                  # Nginx、systemd、发布、备份与回滚
├── vendor/                      # 随仓库分发的 GSAP 安装包
├── design-experiments/          # 独立设计实验，不等于正式路由
├── dsh-niulai-pet-master/        # 桌宠上游参考工程
├── android/                     # Capacitor Android 工程
├── tokens.css                   # 全局字体、颜色与设计 tokens
├── package.json                 # 根目录开发命令与前端依赖
└── vercel.json                  # Vercel 部署配置
```

| 想修改什么 | 主要位置 |
| --- | --- |
| About 介绍与开发者 | `src/pages/AboutPage.tsx`、`src/pages/about/` |
| 首页标语及打字参数 | `src/pages/Homepage.tsx`、`src/components/AnimatedTerminalText.tsx` |
| Header、Footer、页面外壳 | `src/components/SiteHeader.tsx`、`SiteFooter.tsx`、`Layout.tsx` |
| 字体、颜色和交互样式 | 根目录 `tokens.css` 与 `src/styles/`；字体来源见 `FONT_NOTES.md` |
| 路由 | `src/routeConfig.tsx`、`src/routes.tsx` |
| 公开 SEO 文案与范围 | `shared/seo.json`、`src/lib/seo.ts`、`scripts/build-seo.mjs` |
| Axios / SSE 请求 | `src/lib/axios.ts`、`src/lib/aiStream.ts` |
| AI 模型、上下文与检索 | `uniclub-backend/services/DeepSeekAssistant.js` 及共享搜索服务 |

<a id="docs"></a>

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [ECS 部署](deploy/ecs/README.md) | 发布、健康检查、备份、回滚与持久目录 |
| [后台 AI](uniclub-backend/README.ai.md) | 密钥、场景、发布预览及服务实现 |
| [AI 每日新闻](uniclub-backend/README.daily-news.md) | 检索、时效、调度、批次发布及失败诊断 |
| [量化材料](docs/quantification.md) | 收集期、ZIP、COS、上传与下载 |
| [班费](docs/fees.md) | 支付凭证与人工确认流程 |
| [活动设计](docs/activity-v2/ACTIVITY_V2_DESIGN.md) | 活动生命周期、报名、媒体与兼容边界 |
| [活动 API](docs/activity-v2/ACTIVITY_V2_API.md) | 成员与管理接口契约 |
| [活动 COS](docs/activity-v2/ACTIVITY_V2_COS.md) | 云存储、SCF、权限及实网验收记录 |
| [活动测试报告](docs/activity-v2/ACTIVITY_V2_TEST_REPORT.md) | 相关验证结果与未覆盖边界 |
| [SCF 函数](uniclub-backend/cloud-functions/quantification/README.md) | 云函数部署和受保护调用 |
| [网页桌宠](docs/classhub-pet.md) | 正式功能、偏好、来源与未迁移能力 |
| [字体说明](FONT_NOTES.md) | 字体来源、语义、分片与许可证 |
| [GSAP 安装包](vendor/README.md) | 本地依赖及构建约定 |
| [SEO / GEO 审计](docs/SEO_GEO_AUDIT.md) | 公开边界、HTML、索引、部署与待办 |
| [旧 UniClub 文档归档](docs/archive/legacy-uniclub/README.md) | 历史架构与操作记录，不作为当前启动指南 |

部分文档保留当时的部署、测试和故障记录。历史端口、UI 状态与“已完成/未完成”结论应结合当前源码核对，不作为今天的生产状态声明。

<a id="faq"></a>

## 常见问题

### 为什么 localhost:8081 打不开？

确认 `npm start` 正在运行、依赖已安装且 8081 未被占用。后端启动失败时查看终端中的 MongoDB 与环境配置错误；`ERR_CONNECTION_REFUSED` 表示目标端口没有可连接服务，不是通过刷新即可修复的页面样式问题。

### 前端能打开，为什么 API 报错？

检查 <http://localhost:5050/api/health>，再核对 `VITE_API_PROXY_TARGET` 与实际后端端口。开发代理和生产 `VITE_API_URL` 用途不同；跨域生产部署还需要正确 CORS。数据库未连接时健康检查可返回 503。

### 为什么首页没有班级消息，或不能进入后台？

访客首页展示公开介绍，不读取班级内容。登录后可用信息取决于已发布记录；后台需要数据库中的管理员权限。改前端按钮或伪造角色字段不会赋予管理员权限。

### 为什么新闻生成出现 `SEARCH_NO_RESULTS` 或 `INSUFFICIENT_SOURCES`？

检查任务记录里的检索结果、独立发布者、可读取正文与时效情况。密钥可用并不保证可靠来源够用；免费 NewsAPI 延迟、RSS 失败或服务器无法访问来源均可能影响结果。任务不以扩大时效窗口、关闭校验或模型编造来凑数。

### 为什么本地 AI 成功，上线后失败？

分别核对目标环境的 AI 加密主密钥、数据库配置、搜索网络、来源正文读取、代理超时与任务时长。前端界面设置相同不等于服务器的密钥、网络和持久目录相同；使用任务错误码定位具体环节。

### 上传为什么提示未开通或 CORS 错误？

检查后台存储配置、私有桶、函数鉴权、最小目录权限、实际站点 Origin 和请求头。活动媒体不能复用未经保护的旧开放凭证函数。签名过期时应重新获取，不应把桶改成公开来绕过问题。

### 随机点名为什么没包含某个人？

确认该人同时存在于当前真实名单与有效成员账号中；只导入名单但没有有效账号的行不进入随机池。管理员身份本身不会导致排除，但不在名单中的独立管理账号不是班级随机成员。

### 可以直接复制成多个班级、启用暗色或发布手机 App 吗？

这些不是当前已完成的产品能力。多班级需要明确的数据隔离设计；当前 Theme 固定浅色；移动工程还需要品牌、签名、平台配置与相应验收。

<a id="contributing"></a>

## 参与贡献与问题反馈

欢迎通过 [Issues](https://github.com/Mason1035/uniclub-main/issues) 提交可复现问题，或通过 Pull Request 提供改进。

- 问题反馈包含页面、复现步骤、预期/实际结果和设备环境；截图、日志应先脱敏。
- 修改沿用现有路由、请求层、用户模型、组件和设计 tokens，避免另建一套认证、AI 或存储系统。
- 涉及成员数据、权限、费用、云资源或迁移的变更，要明确影响范围、失败恢复与验证边界。
- 保留第三方来源和许可说明；随相关改动更新文档。
- 按改动运行相关测试、lint、typecheck 或 build；不把模拟接口检查描述成真实生产验收。
- 目前没有独立 `CONTRIBUTING.md` 或正式 `CHANGELOG.md`，贡献约定以本节及相关模块文档为准。

<a id="credits"></a>

## 开发者、许可与素材来源

项目仓库由 [Mason1035](https://github.com/Mason1035) 等账号维护。参与构建和运维的成员包括 **何宇轩、张鹏飞、李青原**，具体代码贡献可通过仓库提交记录查看。

根目录目前没有统一 `LICENSE`。后端包元数据的 ISC、依赖许可、字体 OFL 和桌宠 MIT 不等于对整个项目及所有素材的统一授权；复制、再分发或商业使用前应与维护者确认适用范围。

| 来源 | 说明 |
| --- | --- |
| 正式字体 | 思源宋体、思源黑体、得意黑、Schibsted Grotesk，来源与 OFL 文本见 [FONT_NOTES.md](FONT_NOTES.md) |
| About 英文字体 | Space Grotesk；保留 [OFL 许可证](public/fonts/classhub/SpaceGrotesk-OFL.txt) |
| 桌宠引擎 | 改写自 whitefirer 的 dsh-niulai-pet；保留 [MIT 文件](public/pet-assets/LICENSE)与[素材说明](public/pet-assets/NOTICE.md) |
| 用户提供的角色、音频和头像素材 | 不因代码或引擎许可自动取得第三方素材授权；适用权利需分别核实 |
| GSAP 与其他依赖 | 保留各自随包许可；本地 GSAP 包见 [vendor/README.md](vendor/README.md) |


<a id="translations"></a>

## 多语言 README

简体中文版作为后续翻译基准，英文版、印地语版与俄语版已完成。语言导航只链接已存在的译文；其他计划版本暂不启用链接。

| 语言 | 状态 |
| --- | --- |
| 简体中文 | 已完成：[README.md](README.md) |
| English | 已完成：[README.en.md](README.en.md) |
| Русский（俄语） | 已完成：[README.ru.md](README.ru.md) |
| हिन्दी（印地语） | 已完成：[README.hi.md](README.hi.md) |
| 繁體中文 | 待翻译 |

后续译文保持相同功能、命令、限制和链接，不把中文没有的能力加进译文。完成真实文件后再启用语言切换链接；其他语种可继续按需要扩展。

---

<p align="center">
  <a href="https://csrg3b.top/">ClassHub</a> · 四川师范大学 · 2025 级软件工程 3 班
</p>
