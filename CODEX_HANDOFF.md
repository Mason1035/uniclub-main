# UniClub / ClassHub 项目交接

核对日期：2026-10-01（Asia/Shanghai）。本文件依据当前源代码、配置、历史交付清单及本轮实际检查编写。它不要求新对话读取旧聊天记录。

## 0. 先读：项目位置与交接边界

- **实际应用根目录**：`/Users/alexmason/Desktop/uniclub-main`。页面品牌目前为 **ClassHub**；项目目录、包名及后端仍保留 UniClub 命名。
- 当前 Codex 工作目录 `/Users/alexmason/Documents/Codex/2026-09-26/users-alexmason-desktop-uniclub-main-src` 是检查、备份和报告目录，**不是正在提供网站的源代码根目录**。不要编辑其中的旧 staging 副本后误以为已更新网站。
- 本轮用户要求暂停业务开发，只创建本文件与 `NEXT_TASK.md`。本轮没有更改业务代码、数据库配置或部署资源。
- 用户已授权此前直接实现“功能栏目 / 量化上传及管理”。该功能已经集成；下一阶段是实际云资源联调。收班费仅保留“待开放”入口。
- 实际应用目录与上述 Codex 工作目录均不是 Git 仓库。无法取得 Git 意义上的未提交文件、分支、HEAD 或提交记录。详见第 12 节；不要假定工作区干净，不要自动初始化、提交或覆盖源代码。
- 本机路径是交接时的位置；迁移到其他电脑后，应以这份文件所在目录为项目根，重新核对真实路径、环境变量和数据目录。
- 本文不含管理员密码、JWT_SECRET、AI 密钥或 COS 长期密钥；它们不能从文档恢复，应由项目持有人在私有环境中配置。

## 1. 架构、技术栈与目录

### 1.1 请求与数据流

```text
浏览器
 ├─ React SPA：页面 / 路由 / Query 缓存 / JWT 会话
 ├─ /api/* → Express → Mongoose → MongoDB
 ├─ 旧图片 /uploads/* → Express 静态目录；部分头像与相册仍是 Mongo base64
 └─ 量化 ZIP → 私有 COS（浏览器直传，短期 STS）
                  ↑ 后端核验、复制正式对象、记录元数据、签名下载
```

前后端是两个 npm 包。根包为 ESM，后端为 CommonJS；不要直接把后端 require 文件改为 ESM。Express 本身不提供 React 的 dist 页面，需要生产静态托管及 API 反向代理。

| 层 | 当前实际依赖 |
| --- | --- |
| 前端 | React 18.3、React Router 6、TypeScript 5.9、Vite 5 + SWC |
| UI / 状态 | Tailwind CSS 3.4、shadcn/ui + Radix、TanStack Query 5、Axios、Lucide、date-fns |
| 动效 | CSS 为当前主要实现；GSAP 3.15 与 @gsap/react 2.1.2 的本地 tarball 已安装并注册 |
| 后端 | Express 5.1、Mongoose 8.15、jsonwebtoken 9、bcryptjs 3、express-rate-limit 7 |
| 其他 | dotenv、multer / sharp、node-cron、新闻抓取与 Gemini REST 客户端 |
| 文件存储 | cos-js-sdk-v5、cos-nodejs-sdk-v5、qcloud-cos-sts；目前只实现 COS adapter |
| 移动壳 | Capacitor 配置和 android 目录存在；当前主交付为网页，未据此验证 Android 上架 |

版本范围以两个 package.json 和 package-lock.json 为准。根目录有旧 bun.lockb，当前启动、安装、验收使用 npm。vendor 中的 GSAP 文件是 file: 依赖，源码迁移与 npm ci 时必须保留。

### 1.2 目录树

以下路径相对于实际应用根 `/Users/alexmason/Desktop/uniclub-main`：

```text
src/
  main.tsx, App.tsx, routes.tsx
  pages/                    会员业务页、详情页、登录注册
    admin/                  管理工作台、权限守卫、管理 API 和基础组件
  components/               布局、搜索、内容条目、交互、相册、头像
    ui/                     shadcn/Radix 基础组件
    cards/, chat/
  context/                  Auth、User、Theme、Popup 状态
  hooks/                    评论、互动、列表视图状态等
  lib/                      Axios、session、格式化、导航、量化上传、GSAP
  types/, utils/, styles/
uniclub-backend/
  index.js                  环境加载、Mongo 连接、路由挂载、监听、量化清理定时器
  models/                   20 个 Mongoose Model
  middleware/               JWT、数据库管理员判断、隐私、限流、内容可见性
  routes/                   业务 API；admin/ 子路由
  services/                 业务服务、策展、量化仓库与 storage adapter
  utils/, jobs/, scripts/
  test/                     node:test 安全、启动、量化测试与替身
  public/uploads/           旧静态文件，非量化私有存储
scripts/                    Node 启动封装与旧 Windows PowerShell 脚本
public/fonts/               Noto Sans SC / Noto Serif SC 分片、字体 CSS、OFL
vendor/                     GSAP 本地安装包及说明
docs/quantification.md      量化业务、COS 配置、接口及验证边界
design.md, tokens.css       已确认设计规范与语义变量
.hallmark/                  设计检查记录
dist/                       生成物，不作为源代码修改
android/                    Capacitor Android 工程
start-mongo.command
start-backend.command
package.json, package-lock.json, vite.config.ts
tailwind.config.ts, eslint.config.js, tsconfig*.json, vercel.json
CODEX_HANDOFF.md, NEXT_TASK.md
```

README、API_DOCUMENTATION、部分旧完成报告、.cursorrules 和 Windows 脚本有历史信息，不能替代当前代码。当前没有发现应用根及其祖先的 AGENTS.md。

### 1.3 当前页面与 API

会员页面统一经过 Layout 的登录检查；管理页面在会员 Layout 外，由 AdminGuard / AdminLayout 处理：

| URL | 页面 / 说明 |
| --- | --- |
| / | Homepage |
| /announcements | 公告列表 |
| /news | 新闻列表 |
| /article/:id、/news/:id | 同一新闻详情 |
| /events、/event/:id | 活动列表 / 月历、活动详情 |
| /past-events/:id | 往期活动详情；往期入口在活动页，当前没有独立往期列表路由 |
| /resources、/resource/:id | 资源目录、详情 / 下载 / 可用预览 |
| /social | 班级动态 |
| /functions | 功能目录：量化上传、待开放班费 |
| /quantification | 学生量化提交及回执 |
| /comments/:type/:id | 评论页；type 有其自己的小写 API 枚举 |
| /settings、/saved-posts、/notifications | 设置、收藏、逐用户通知 |
| /auth、/debug | 登录注册、调试页；调试数据接口已加管理员权限 |
| /admin | 后台总览 |
| /admin/roster、/admin/members | 真实名单、注册成员及管理员角色 |
| /admin/events、/admin/news、/admin/resources | 内容管理与审核 |
| /admin/gallery | 往期活动 / 相册管理 |
| /admin/notifications | 实际为班级公告管理，使用 Announcement，名称保留历史兼容 |
| /admin/ai、/admin/quantification | AI 管理、量化收集管理 |

后端挂载：`/api/auth`、`news`、`users`、`chat`、`comments`、`social`、`engagement`、`events`、`curation`、`resources`、`notifications`、`past-events`、`admin`、`quantification`、`announcements`、`featured`、`search`、`cron`。健康检查是 `GET /api/health`。

**前端的登录门禁不等于所有 GET API 都私有。** 部分已发布内容 API 允许匿名读取；未发布资源 / 活动已做所有者与管理员可见性控制。若正式班级要求全部内容仅成员可见，应先明确访问边界，再逐条审核 API 和静态文件，不能仅依靠页面跳转。

## 2. 开发环境与启动

### 2.1 本机快照

本轮核对的 Node 为 `v26.7.0`，npm 为 `11.19.0`。它们是本机实际版本，不表示部署版本已经锁定或 Windows 环境已经验证。

本轮发现并健康检查：

| 服务 | 端口 / 地址 | 状态 |
| --- | --- | --- |
| Vite | http://localhost:8081 | /functions 返回 HTTP 200 |
| Express | http://localhost:5050 | /api/health 返回 status: ok |
| MongoDB | 127.0.0.1:27017 | 监听中；API 能提供健康响应 |

健康接口没有查询数据库，因此不能用单次健康响应替代数据库业务验证。进程可能在新对话开始前停止；先检查端口，不要重复启动或按旧 PID 杀进程。

### 2.2 推荐本机启动路径

如依赖未安装，在根目录执行 `npm ci`，然后 `npm --prefix uniclub-backend ci`。安装需要相应网络访问，两个包各有 lockfile。

```sh
cd /Users/alexmason/Desktop/uniclub-main
npm run mongo
```

Mongo 在独立终端保持运行；另一个终端：

```sh
cd /Users/alexmason/Desktop/uniclub-main
npm run dev
```

根 npm run dev 用 concurrently 同时执行 backend 与 frontend。也可以分别 `npm run backend`、`npm run frontend`。双击 start-mongo.command / start-backend.command 只是同样命令的 zsh 包装，不包含账号密码。

scripts/start-mongo.js：
- 查找 MONGOD_BIN 或 Homebrew / PATH 中 mongod。
- 默认数据目录 `/Users/alexmason/data/db`，绑定 127.0.0.1，端口 27017，前台运行。
- 支持 MONGODB_DBPATH、MONGODB_PORT、MONGOD_BIN。
- **不要为了“修复数据库为空”切换 dbpath、导入演示数据或重建真实数据库。** 先确认 URI 与原来的 dbpath。

### 2.3 5000 / 5050 的实际差异

- 根 `.env.development.local` 当前两个地址均为 http://localhost:5050。
- 根 `scripts/start-backend.js` 读取前端 proxy target，向后端子进程传入 PORT=5050；显式进程 PORT 优先。
- 后端实际私有 `.env` 仍有 PORT=5000，后端 `.env.example` 和 index.js 默认值为 5050。
- 因此根目录标准启动是 **5050**；直接在后端目录 npm start / npm run dev 时可能变为 **5000**。若要与当前前端一致，明确设置 PORT=5050。
- 根 `.env.example` 还保留旧 VITE_API_URL=http://localhost:5000。
- 旧 Windows scripts/start-dev.ps1 直接启动后端并操作 5000，但当前前端代理指向 5050；check-ports.ps1 / stop-dev.ps1 同样有旧端口。这是下一轮要修正的具体启动问题，本轮没有修改。
- 不运行 scripts/kill-all-node.ps1 或无差别 pkill node；它们可能停止其他项目。

### 2.4 Vite 及生产环境区别

开发时 Axios baseURL 为空，用 /api 和 /uploads 代理到 VITE_API_PROXY_TARGET（默认 5050）。Vite 监听 0.0.0.0，strictPort 为 true，端口冲突会失败而非自动换号。

vite.config.ts 可读 VITE_PORT、VITE_CACHE_DIR；但 `npm run frontend` 显式传 `--port 8081`，会覆盖配置端口。需要隔离预览时使用明确的 CLI 端口，例如 `npx vite --port 8083`，并同时指定隔离后端 target。

生产 Axios 使用 VITE_API_URL 或同源路径，但有些现有 fetch 直接请求相对 /api；**不能只配置 VITE_API_URL 就认为跨域部署全面可用**。优先按同源站点部署静态 dist、反向代理 /api 与必要的 /uploads，配置 SPA 路由回退、HTTPS 和长进程守护。Vite dev server 不作为正式服务。

代码保留 Vercel 的 builds/routes/cron 配置。它与用户计划的 Windows 云服务器部署不是同一条已经验收的部署链；没有核验真实服务器上的版本、服务、域名或账号。

## 3. 必要环境变量

dotenv 默认按后端工作目录找 .env；直接在根目录执行 node uniclub-backend/index.js 可能读错文件。根启动 wrapper 会把 cwd 设置为后端目录。创建管理员 / 轮换密码 / 导入名单脚本显式读取后端 .env。

| 位置 / 变量 | 用途及当前状态 |
| --- | --- |
| 前端 .env.development.local：VITE_API_URL | 当前 http://localhost:5050；生产构建时才作为 Axios 地址使用 |
| VITE_API_PROXY_TARGET | 当前 http://localhost:5050，开发代理 |
| VITE_PORT / VITE_CACHE_DIR | 可选；注意 npm 脚本 CLI 端口覆盖 |
| 后端 MONGODB_URI | 必需；本机为 mongodb://127.0.0.1:27017/uniclub，无 URI 内嵌凭据 |
| JWT_SECRET | 必需，当前已配置；JWT 中间件缺失时拒绝运行，不能使用示例弱值 |
| PORT | 后端 .env 当前 5000；标准根启动覆盖为 5050 |
| NODE_ENV、VERCEL | 执行模式；VERCEL 影响导入后的连接 / 长进程行为 |
| REQUIRE_ENROLLED_ROSTER | 当前 true；注册名单检查默认启用 |
| ALLOWED_EMAIL_DOMAINS | 当前为空；可选逗号分隔邮箱域名限制 |
| OBJECT_STORAGE_PROVIDER | 默认 cos；尚不支持 OSS |
| COS_BUCKET、COS_REGION | 必填真实完整桶名（含 APPID）及地域；当前未配置 |
| COS_SECRET_ID、COS_SECRET_KEY | 仅后端私有长期凭据；当前未配置 |
| GEMINI_API_KEY | 当前已配置，但本轮没有调用外部 AI 验证 |
| GEMINI_MODEL | 默认 gemini-2.5-flash-lite，配置有效性需另行验证 |
| GEMINI_PROXY / HTTPS_PROXY / https_proxy | Gemini Axios 的可选代理，按此优先级 |
| GEMINI_TIMEOUT_MS | 默认 60000 毫秒 |
| NEWS_API_KEY | 当前为空；外部新闻采集不能据此称已验证 |
| CRON_SECRET | 调度接口 Bearer 密钥；缺失返回 503，不放前端 |
| RUN_INITIAL_CURATION | 仅 development 且 true 时让策展 daemon 启动即执行真实任务 |
| LOG_LEVEL | 可选日志配置 |
| ADMIN_EMAIL、ADMIN_NAME、ADMIN_PASSWORD | 创建 / 提升管理员脚本输入，私有环境配置 |
| ADMIN_UNIQUE_ID、ADMIN_UPDATE_PASSWORD | 管理员脚本可选；后者重置已有密码并递增 tokenVersion |
| MONGOD_BIN、MONGODB_DBPATH、MONGODB_PORT | 本地 Mongo 启动包装可选 |

不要复制私有 .env 内容进新聊天、文档或仓库。VITE_* 会进入客户端，不能承载长期凭据。当前 .gitignore 排除了 .env、*.local、node_modules、dist、日志，但尚无 Git 仓库，排除规则本身并不产生版本控制或备份。

## 4. 数据库：Model、字段、关系与状态

本机目标数据库为 uniclub。下面来自 Schema，不是生产库数据导出；没有记录真实成员邮箱、密码或人数。除指定集合和特例外，集合名采用 Mongoose 默认规则，通常有 createdAt / updatedAt。

### 4.1 身份与班级名单

| Model / 集合 | 主要字段及约束 |
| --- | --- |
| User / users | email 唯一、uniqueId 唯一（学号 / 成员编号）、name、passwordHash、tokenVersion 默认 0、isEnrolled、isVerified、isAdmin 默认 false、lastActive |
| User.profile | bio、location、website、interests、socialLinks、preferences；avatar 含 data(base64)、contentType、originalName、size、uploadedAt |
| User.settings / socialStats | 隐私与通知偏好；文章互动、评论、动态、活动统计 |
| EnrolledUser / **EnrolledUser** | email 唯一、name、uniqueId 唯一；**集合名区分大小写且被显式指定**，无 timestamps |

EnrolledUser 是允许注册的班级名册，User 是已注册账号，两者按邮箱 / 学号对应，不能把“注册人数”当全班人数。当前没有 Class / School / Tenant Model 或多班级隔离。User._id 是 JWT 与业务关联身份，uniqueId 是显示 / 名册学号，不能互相替代。

### 4.2 内容、互动、通知

| Model | 主要字段 / 关系 / 状态 |
| --- | --- |
| Announcement | title、body、level(info/important/urgent)、pinned、link、isPublished、publishedAt、expiresAt、author→User |
| News | title/excerpt/content、source、author→User、originalAuthor/originalUrl、sourceHash 唯一、imageUrl/publisherLogo、categories、publishedAt；status=draft/pending/approved/archived；isFeatured/isTrending；summary 含摘要、要点等；likes/saves/shares/comments |
| Event | title/description、startDate/endDate、location(physical/virtual/hybrid)、organizer→User、speakers、maxCapacity、rsvpDeadline/rsvpLink、eventType/categories、imageUrl、attachments；status=draft/published/cancelled/completed；rsvpCount/attendedCount、互动计数 |
| EventRSVP | event→Event、user→User 唯一组合；status=going/maybe/not_going/waitlist、guestCount、notes、checkedIn/checkInBy、候补位置、通知及日历字段 |
| Resource | title/description、type=Document/Tutorial/Tool/Video、中文 category；uploadedBy→User；file(type=upload/link,url,originalName,mimeType,size:Number)；旧 fileSize:String/fileUrl/linkUrl；status=pending/approved/rejected/archived、isApproved、approvedBy/approvedAt、isFeatured、downloadCount/views 与互动计数 |
| PastEvent | title/subtitle/date/body、category、attendance、tags/link；poster 与 gallery 为图片/base64 元数据；**没有 owner 字段** |
| SocialPost | content、author→User、media/imageUrl、hashtags/mentions、poll/projectData；postType；visibility=public/club-members/friends/private；status=active/archived/deleted/flagged/pending；allowComments/allowShares、置顶 / 编辑信息、互动计数 |
| Comment | text、contentId、**小写** contentType=news/event/resource/social；userId→User、parentCommentId→Comment；articleId→News 为兼容字段；status=active/flagged/hidden/deleted、likes / likeCount、编辑信息 |
| CommentLike | commentId→Comment + userId→User 唯一；contentId、小写 contentType |
| SocialComment | content、postId→SocialPost、author→User、parentCommentId→SocialComment、depth、mentions/media、moderator 信息；status=active/flagged/hidden/deleted/pending |
| UserEngagement | user→User + contentType + contentId 唯一；**大写模型名** News/SocialPost/Event/Comment/Resource；liked/saved/shared/viewed/downloaded 与时间 |
| SocialInteraction | userId→User、targetType(SocialPost/SocialComment/Group)、targetId、actionType/reactionType/isActive/source；与统一互动系统有历史重叠 |
| Follow | followerId→User + followingId→User 唯一；status=pending/accepted/blocked/muted、关系类别、通知偏好、互动统计 |
| Notification | recipient→User、actor→User、**必需 comment→Comment**；type 仅 comment_reply/comment_like/comment_mention；可选 article/event/resource/post；read/readAt |
| Chat | articleId→News、userId→User、messages[{role:user/assistant,content,timestamp}]、lastUpdated |

注意：

- Announcement 为班级公告；Notification 为评论相关逐用户通知，不能直接用当前 Notification Schema 实现班费催缴或全班广播。
- Resource 同时存在旧字符串大小与新数字字节数；前端格式化兼容，重构前先确认真实记录。
- Comment 与 SocialComment 并存；不同业务中的 ID 和枚举不能随意合并。
- UserEngagement 的 refPath 模型名必须保持大小写；Comment API 的 type 是小写。
- Event 的 recurrence、reminders、calendarIntegration 等 Schema 字段不表示所有自动提醒或日历同步已经实现。
- SocialInteraction 中 Group 枚举不表示已经存在完整群组业务。
- News.sourceHash 是普通 unique 字段，未声明 sparse；导入多条缺失 sourceHash 的数据时需检查唯一索引，不要直接写演示新闻。
- 当前设计偏向单个班级，学校 / 班名 / 学期尚未集中为配置；刊头副标题“软件工程班级信息平台”仍有硬编码。

### 4.3 量化专用 Model

| Model | 字段与约束 |
| --- | --- |
| QuantificationCollection | title≤100、description≤5000、startAt/deadline 可空、status=draft/open/closed、createdBy→User、timestamps |
| QuantificationSubmission | collectionId→Collection + user→User **唯一索引**；upload→Upload、originalFilename≤200、storageKey、fileSize(22 至 524288000)、mimeType、etag、status=submitted、version≥1、submittedAt |
| QuantificationUpload | user、collectionId、originalFilename/fileSize/mimeType；stagingKey/finalKey/previousKey/sealedKeys、multipartId、baseVersion、confirmationId；state=pending/confirming/confirmed/aborted/expired |
| Upload 的生命周期字段 | expiresAt、credentialExpiresAt、confirmLeaseUntil、confirmedAt；cleanupKeys/cleanupAfter/cleanupLeaseUntil/cleanedAt/cleanupAttempts |

不要将 collectionId 改成 collection：避免 Mongoose 保留字段冲突。Upload **没有 TTL 索引**，因为不能在云端清理成功前丢失 key 和重试记录。Submission 只保留每人每期当前有效版本，旧对象进入清理，而不是完整历史版本档案。

## 5. 登录、权限与管理员体系

### 5.1 注册与登录

- /api/auth/signup-step1：邮箱格式 / 重复检查。
- signup-step2：邮箱 + uniqueId 校验 EnrolledUser，邮箱匹配不区分大小写。
- signup-step3：再次在服务端校验组合、重复记录与密码（至少 8 位），bcrypt hash 后创建 User；不能只信上一步客户端结果。
- 普通注册不能指定 isAdmin 或审核字段；默认管理员为 false。
- 当前没有邮箱 OTP、邮件找回密码或 MFA 流程。isVerified 字段存在不表示真正做了邮箱验证。
- JWT 有效期 7 天，使用 HS256，含 userId/email/tokenVersion。后端验证签名、合法 ObjectId、账号存在以及 tokenVersion。
- 密码保存为 passwordHash，普通注册使用 bcrypt cost 10；管理员专用轮换使用 cost 12。不会保存用户明文登录密码。
- 登录及三步注册均挂载 authLimit：每 IP 15 分钟最多 5 次失败请求，成功请求不扣失败额度。

### 5.2 会话兼容

src/lib/session.ts 优先读取 localStorage.token，兼容 sessionStorage.authToken / localStorage.authToken。退出会清除两处兼容会话和用户缓存，并发出 auth:changed。Axios 附加 Authorization: Bearer；401 清会话并发 auth:expired。

AuthContext 与 UserContext 仍同时存在；UserProvider 会用 /api/users/me 填充真实 user.id。Query 需要用 userId 隔离账号数据。不要只修改一种 token key 或只清一个 Context，否则可能遗留假登录或跨账号缓存。

portfolio-demo-token 的旧自动登录路径已停用；portfolioDemo.ts 现在只清理旧演示会话。不要恢复演示账号绕过名单 / JWT。

### 5.3 管理员与内容权限

- 唯一管理员来源：**数据库 User.isAdmin === true**。middleware/admin.js 会验证 JWT，再读数据库；不能相信前端缓存、请求体或 JWT 内伪造角色。
- /api/admin 外层整体 requireAdmin，量化管理子路由也有检查。
- /api/admin/users/:id/admin 可授予 / 撤销其他人的管理员身份，不允许当前管理员把自己降级；没有另建“班委”角色。
- 第一个管理员用 scripts/createAdmin.js，通过私有 ADMIN_* 环境输入；它是幂等创建 / 提升脚本，不要未经确认对真实账号运行。
- `npm run admin:password -- 管理员邮箱` 交互式隐藏输入至少 12 位新密码，递增 tokenVersion，使旧 JWT 失效。
- 启动脚本已移除历史明文凭据；仅凭源码不能确认原暴露密码是否完成真实轮换。本轮没有读取或更换任何管理员密码。

| 内容 | 普通用户 | 管理员 |
| --- | --- | --- |
| 资源 | 新建 pending；所有者可编辑允许字段；修改已审核内容重新 pending 并清审核 / 推荐信息 | 审核、发布、撤销等 |
| 活动 | 新建 draft；所有者编辑后重新待审核，不能自设 published 等状态 | 决定状态与管理 |
| 新闻 | 新建 pending，不能控制发布时间 / 推荐 / 审核；编辑、删除管理员限定 | 发布与管理 |
| 往期活动 | 读取允许内容；无普通用户写权限 | 新建、修改、删除 / 相册 |
| 公告 | 按发布时间 / 到期规则读取 | 管理发布、草稿、置顶、等级 |
| 量化材料 | 只能操作自己的上传会话与当前提交 | 收集期、名单统计、显式管理下载、清理 |
| 策展 | 不能触发执行 | /run 与 /test requireAdmin + 每账号 15 分钟 3 次限流 |

contentPolicy.js 用白名单控制可写字段；contentAccess.js 保证未公开资源 / 活动只有所有者 / 管理员可读，无权通常返回 404。修改内容 API 时保留这些策略和相关测试。

## 6. 已完成的主要工作（以当前代码为准）

1. **安全整改**：全体头像 cleanup-avatars 接口已移除；策展运行 / 测试加管理员与限流；普通资源、活动、新闻无法通过请求体越过审核；往期活动写操作 requireAdmin；登录 / 注册 authLimit 实际挂载；管理员密码轮换与 tokenVersion 机制；未发布内容可见性控制。
2. **工程与启动修复**：React Query 5 对象调用、内容类型、Context / UI 导出整理；当前 typecheck 和零 warning lint 通过；后端 test 从直接失败占位脚本改为真正 node:test；macOS ESM Mongo 启动与根后端端口封装存在。
3. **中文多页重新设计**：ClassHub 刊物 / 孔版印刷体系落地到首页、栏目、详情、登录注册、设置、收藏、通知和管理工作台；不是替换成静态单页。
4. **共用交互**：当前导航状态、滚动收紧、键盘分组搜索、列表筛选 / 视图记忆、活动日历、报名 / 互动待处理与失败状态、真实资源信息、相册交互、页面数据空 / 错误 / 重试状态。
5. **量化功能**：主导航“班级动态”之后加入“功能”，学生业务、管理员收集期 / 统计 / 下载、Mongo 元数据、COS adapter、并发确认 / 清理及测试已经集成。
6. **GSAP 基础接入**：vendor tarball、src/lib/gsap.ts 注册和 main.tsx 导入存在；本轮源码搜索未见其他组件使用 gsap/useGSAP。不能宣称已经完成全站 GSAP 动画。

AI 仍保留两套不同服务：
- ContentCurationService：排序现有 News/Event/Social 内容，重置 / 更新首页推荐标记。
- NewsCurationService：NewsAPI 采集、过滤、AI 选择、抓取与摘要、保存新闻；是会真实修改新闻库和消耗 API 的任务。
- utils/geminiClient.js 是实际统一 AI 出口，使用 Axios REST，不依赖 SDK 自动读取代理。@google/genai 包仍在依赖中。
- jobs/midnightCuration.js 为常驻 daemon，时区 **America/Chicago**，不是北京时间；不会由标准 API 启动自动执行。
- vercel.json cron 为 0 5 * * *；/api/cron/news-curation 要 CRON_SECRET。更换部署平台前重新确定时区、调度次数与是否允许自动改写新闻。

## 7. 当前开发主题：量化文件收集

### 7.1 当前完成度

**业务与本地模拟联调已经完成，真实 COS 配置和上线验收未完成。**

学生可选真实收集期、阅读要求、选择 / 拖放 ZIP、看到上传进度、取消 / 重试、重试确认、查看本期回执、下载自己的材料。管理员可创建 / 编辑 draft/open/closed 收集期，设置开始 / 截止，按真实 EnrolledUser 名册统计已交 / 未交，包含未注册学生，名单外提交单列；支持搜索、状态筛选、排序、分页、本页全选 / 反选、选中文件分别下载与手动清理。

没有写入演示收集期、假班级人数或假上传记录。COS 未配置时明确提示未开通；不得通过本地假 URL 冒充成功上传。

### 7.2 固定业务与文件流程

1. 仅 ZIP，最大 **524,288,000 字节（500MiB，UI 显示 500MB）**；文件名仅展示，建议“学号_姓名.zip”，不决定用户身份。
2. 以 JWT 的真实 User._id 初始化会话，不能提交他人 userId、storageKey、ETag 来决定最终材料。
3. 对象布局：
   - quantification/{collectionId}/{userId}/staging/{uploadId}.zip
   - quantification/{collectionId}/{userId}/submitted/{confirmationId}.zip
4. 大于 20MiB 使用 20MiB 分片、并发 2；COS 浏览器直传，ZIP 不经过 Node 的 JSON body 或网站 3Mbps 带宽中转。
5. 上传会话有效期 2 小时；STS 1800 秒，单个暂存 key，仅 PutObject / UploadPart。初始化、列分片、完成和中止由后端执行。
6. 完成接口空 body。后端核对大小 / 类型 / ETag、ZIP 签名与目录范围，检查后绑定 ETag 读取 / 复制到显式 private 的正式 key。
7. 每次确认使用独立 confirmationId / sealed key；确认租约 5 分钟，提交前再校验有效期与租约。unique(collectionId,user) + baseVersion 比较更新防止并发覆盖。
8. 每人每期只有一份当前材料；旧材料在新版本**确认成功前保持可用**。失败、取消、冲突不能丢掉旧材料。
9. 下载只按 submissionId 签名：学生所有者路由 / 管理员显式路由；5 分钟 URL、no-store。不能提供“任意 key 签名”接口。
10. 清理每 15 分钟扫描到期记录，等待凭证过期，保留失败重试状态，跳过当前有效 submission 指向的 key；迟到复制要再次安排清理。
11. interval 只在直接启动 index.js 时运行；作为 Vercel serverless 导入不会持续清理，换平台要提供真正后台调度。
12. 网页内失败重试能复用已传分片；刷新可重新确认完成传输的会话，**没有跨页面保存文件句柄的断点续传**。
13. ZIP 检查不解压；不等于病毒扫描、完整 CRC 或每个条目检查。
14. 批量下载为 1–50 个 submissionId 的逐文件结果，并不是服务端重新打一个总 ZIP；浏览器可能要求允许多文件下载，单文件入口必须保留。

### 7.3 量化接口索引

学生接口全部 require JWT，管理接口额外 requireAdmin：

| 前缀 | 方法 / 子路径 |
| --- | --- |
| /api/quantification | GET /collections、GET /access、GET /collections/:id/me |
| 同上 | POST /collections/:id/uploads（只收文件名、大小、MIME） |
| 同上 | POST /uploads/:id/credentials、GET /uploads/:id/parts |
| 同上 | POST /uploads/:id/complete、POST /uploads/:id/abort（空 body） |
| 同上 | GET /submissions/:id/download（本人） |
| /api/admin/quantification | GET/POST /collections、PATCH /collections/:id |
| 同上 | GET /collections/:id/submissions（名单 / 统计 / 筛选 / 排序 / 分页） |
| 同上 | GET /submissions/:id/download、POST /downloads（submissionIds） |
| 同上 | POST /cleanup（空 body） |

每账号初始化每小时 12 次、刷新授权每小时 120 次。云端密钥错误不直接回传 SDK 内部详情。

### 7.4 真实存储仍需完成

详见 [量化配置说明](/Users/alexmason/Desktop/uniclub-main/docs/quantification.md)。需要真实私有桶、受限后端 CAM 凭据、STS 授权、网站 Origin CORS、ETag 暴露及未完成分片生命周期规则。不要给正式 submitted 前缀配置自动过期。

当前 provider 为腾讯云 COS；用户此前说“CSS 对象存储”不是已经实现的另一种服务。阿里云服务器并不要求改数据库为 MySQL或对象存储为 OSS；若最终选择 OSS，必须另做 adapter 和真实测试，不能只改 provider 名称。

## 8. 已知问题、未完成和技术债

| 级别 | 已核实状态 / 后续处理 |
| --- | --- |
| 上线阻塞 | 当前 COS 变量未配置；真实上传、IAM/CORS、云端清理 / 签名下载未验收 |
| 启动 Bug | Windows PowerShell、根 .env.example、后端私有 PORT 与当前 5050 约定不一致 |
| 错误处理 Bug | index.js 的 app.listen 回调直接读 server.address().port；本轮沙箱禁止监听时出现 null TypeError，掩盖原始 listen EPERM。成功监听正常，端口错误处理需修复并测试 |
| 版本管理缺失 | 当前无 Git 元数据，不能给出完整未提交 diff；历史备份 / manifests 不是仓库历史 |
| 生产配置 | Express CORS 硬编码 localhost、一个旧 LAN 地址，且用 origin.includes('vercel.app') 判断；真实域名白名单、代理信任与限流 IP 来源需核验 |
| 隐私边界 | 部分已发布内容匿名 API 与旧公开 /uploads 存在；若要求班级资料全私有，要一起审查 / 改造，不能只加前端门禁 |
| 旧文件存储 | 普通资源接口主要处理 URL / 元数据，头像与往期相册仍 base64 / 本地静态文件；量化 COS 没有迁移全站文件 |
| 定时任务 | 量化清理依赖常驻进程；AI daemon 用美国时区，Vercel cron 仍保留；不能部署时重复启动两套策展任务 |
| 身份功能 | 无真实邮箱验证、忘记密码邮件流程或 MFA；密码轮换脚本不是面向学生的自助找回 |
| 状态重复 | Auth/User 双 Context，legacy engagement 与 social interaction 两套模型 / 接口并存，旧兼容字段要逐步迁移 |
| 配置与文案 | 副标题 / 班级信息仍有硬编码；多班级 / 学校 / 学期配置未建立 |
| 旧脚本失效 | 后端 package.json 的 import 指向缺失 importCSV.js；recount-comments 指向缺失 scripts/recountComments.js；不要运行或假定可用 |
| 代码维护 | 部分 TSX 在设计更新后压成很长的行；增加功能前可局部整理，不做无关全库重写 |
| 待开发 | 收班费尚无需求、模型、接口、支付 / 对账实现，入口明确待开放；OSS 尚无 adapter |
| 验收边界 | 500MiB 真上传、超过 30 分钟授权刷新、真实断网恢复、实体手机、Windows 云部署、全站生产安全与备份恢复尚未执行 |

Payload 相关包等历史依赖仍在后端 package.json；不能据依赖表宣称已接入完整 CMS。本轮不是 npm 漏洞审计，也没有把所有未测试功能判定为已完成。

## 9. 核心文件职责

| 文件 | 职责 |
| --- | --- |
| [src/main.tsx](/Users/alexmason/Desktop/uniclub-main/src/main.tsx)、[App.tsx](/Users/alexmason/Desktop/uniclub-main/src/App.tsx)、[routes.tsx](/Users/alexmason/Desktop/uniclub-main/src/routes.tsx) | 全局样式 / GSAP、Providers / QueryClient、懒加载与路由 |
| [Layout.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/Layout.tsx)、[SiteHeader.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/SiteHeader.tsx)、[BottomNavigation.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/BottomNavigation.tsx) | 会员登录门禁、搜索 / 个人入口、桌面 / 移动导航、功能入口 |
| [design.md](/Users/alexmason/Desktop/uniclub-main/design.md)、[tokens.css](/Users/alexmason/Desktop/uniclub-main/tokens.css)、[editorial.css](/Users/alexmason/Desktop/uniclub-main/src/styles/editorial.css) | 已确认视觉规范、统一 HSL 语义变量、布局 / 字体 / 交互样式 |
| [session.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/session.ts)、[axios.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/axios.ts)、[apiFailure.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/apiFailure.ts) | token 兼容、请求认证 / 401、错误分类 |
| [AuthContext.tsx](/Users/alexmason/Desktop/uniclub-main/src/context/AuthContext.tsx)、[UserContext.tsx](/Users/alexmason/Desktop/uniclub-main/src/context/UserContext.tsx) | 双会话状态、用户资料与退出；state 文件提供对应 hooks |
| [SearchDialog.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/SearchDialog.tsx) | 分组服务器搜索、键盘选择 / 打开 / 关闭 |
| [usePageViewState.ts](/Users/alexmason/Desktop/uniclub-main/src/hooks/usePageViewState.ts)、[navigationState.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/navigationState.ts)、[ScrollToTop.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/ScrollToTop.tsx) | 筛选 / 模式 / 后退滚动记忆与栏目当前状态 |
| [ContentState.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/ContentState.tsx)、[contentQuery.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/contentQuery.ts)、[contentFormat.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/contentFormat.ts) | 共用加载 / 空 / 错误、数据查询、真实元数据展示 |
| [useEngagement.ts](/Users/alexmason/Desktop/uniclub-main/src/hooks/useEngagement.ts)、[InteractionButtons.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/InteractionButtons.tsx) | 点赞 / 收藏 / 分享 / 下载状态、计数与失败反馈 |
| [CalendarView.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/CalendarView.tsx)、[EventGallery.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/EventGallery.tsx) | 活动月历、图片浏览 |
| [ArticleContent.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/ArticleContent.tsx) | 文章按纯文本段落渲染及来源链接，不直接注入抓取 HTML |
| [AdminGuard.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/admin/AdminGuard.tsx)、[adminSession.ts](/Users/alexmason/Desktop/uniclub-main/src/pages/admin/adminSession.ts)、[adminApi.ts](/Users/alexmason/Desktop/uniclub-main/src/pages/admin/adminApi.ts) | 后台服务端权限核验、会话与管理请求 |
| [AdminLayout.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/admin/AdminLayout.tsx)、[components.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/admin/components.tsx) | 后台导航 / 工作布局、表格 / 模态 / 表单基础组件 |
| [FunctionsPage.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/FunctionsPage.tsx)、[QuantificationPage.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/QuantificationPage.tsx) | 功能目录、学生收集期 / 上传状态机 / 回执 |
| [AdminQuantification.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/admin/AdminQuantification.tsx) | 管理员收集期、名单 / 统计、筛选 / 下载 / 清理 |
| [quantificationApi.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/quantificationApi.ts)、[quantificationUpload.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/quantificationUpload.ts) | 量化接口、中文错误、ZIP 前置校验、COS 直传 / 分片 / 重试 |
| [quantification.ts](/Users/alexmason/Desktop/uniclub-main/src/types/quantification.ts)、[QuantificationDownloads.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/QuantificationDownloads.tsx)、[quantification.css](/Users/alexmason/Desktop/uniclub-main/src/styles/quantification.css) | 数据契约、下载反馈、继承设计系统的模块布局 |
| [index.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/index.js) | 全部 API、Mongo、CORS、旧静态文件、直接启动与清理 interval |
| [auth.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/middleware/auth.js)、[admin.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/middleware/admin.js) | JWT / tokenVersion、数据库管理员 |
| [authRouter.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/routes/authRouter.js)、[adminRouter.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/routes/adminRouter.js) | 注册登录、管理员成员 / 名单 / 内容与管理子模块 |
| [contentPolicy.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/utils/contentPolicy.js)、[contentAccess.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/middleware/contentAccess.js) | 内容可写白名单、角色 / 审核、未公开内容可读判断 |
| [quantificationRouter.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/routes/quantificationRouter.js) | 学生 / 管理路由、权限、限流、禁止缓存、稳定错误响应 |
| [QuantificationService.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/services/QuantificationService.js) | 时间窗、初始化 / 确认 / 下载 / 清理、ZIP 与并发业务规则 |
| [QuantificationRepository.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/services/QuantificationRepository.js) | Mongoose 查询、唯一索引等待、版本更新 / 租约、名单聚合 |
| [quantificationPolicy.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/utils/quantificationPolicy.js) | 文件 / key / 字段 / ZIP 限制与业务错误 |
| [CosStorageAdapter.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/services/storage/CosStorageAdapter.js)、[storage/index.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/services/storage/index.js) | STS 策略、COS SDK / ETag 读取 / 复制 / 分片 / 删除 / 下载签名、provider 选择 |
| [geminiClient.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/utils/geminiClient.js) | 单一实际 Gemini REST 入口、代理、超时 |
| [scripts/start-backend.js](/Users/alexmason/Desktop/uniclub-main/scripts/start-backend.js)、[scripts/start-mongo.js](/Users/alexmason/Desktop/uniclub-main/scripts/start-mongo.js)、[vite.config.ts](/Users/alexmason/Desktop/uniclub-main/vite.config.ts) | 根目录标准启动、原 dbpath、前端代理 |
| [security.test.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/test/security.test.js)、[startup.test.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/test/startup.test.js)、[quantification.test.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/test/quantification.test.js) | 权限 / 审核 / 限流 / token、启动、量化状态与云请求约束 |

详细字段以对应 Model 为准，具体 Query key、请求 / 响应以 types 与 router/service 为准。修改前先读相关模块而不是复制原型 HTML。

## 10. 修改时必须保留的约束

### 10.1 业务与安全

- 保留现有 routes、真实数据、JWT 登录态、数据库管理员、注册名单、审核状态与未公开内容权限。
- 不能恢复无鉴权 cleanup-avatars、AI 执行、往期写操作，或让普通用户通过 body 设置 approved/published/isAdmin/owner/counters。
- 管理员角色必须从数据库读，不能以按钮隐藏代替服务端检查。
- 所有身份取经过验证的 JWT，不以文件名 / 学号输入代替 User._id。
- 保留量化“旧版本有效直到新确认成功”、唯一索引 / 版本 CAS、确认 key 隔离与租约、清理保护现有材料的逻辑。
- 不放宽 COS 到匿名读写，不把长期密钥放前端，不给任意 key 签名，不给 Upload 上 TTL。
- 新增测试用隔离数据库 / 存储；不要为验收向真实班级插入用户、公告、活动、收集期或伪造统计。
- createAdmin、importRoster、rotateAdminPassword、resetResourceCounts、optimizeDatabase、gallery upload、cleanup-upload-resources、manual-curation 等是可能修改真实数据的运维操作，不能作为普通只读检查执行。
- 不随意把 Mongo 改为截图中的 MySQL 产品；当前 Mongoose 全部依赖 MongoDB。

### 10.2 设计与实现

- 全站简体中文，暖桃纸 / 深墨 / 青蓝操作色；黄、洋红主要用于少量印刷图形。
- 根 tokens.css、editorial.css 为统一来源；新功能继续复用，不另起一套通用渐变 / 玻璃 / 卡片主题。
- 保留 src/index.css 的 Tailwind 指令与 Tailwind 3 / shadcn HSL 变量格式。design.md 的 v4 @theme 只是迁移示例，不能直接当现行配置。
- 中文黑体用于标题 / 功能，宋体用于阅读；日期少量等宽。保持自托管字体与 OFL。
- 表单、导航、错误、空状态都使用自然中文；不编造班级人数、学校、年份、活动或评价。
- 管理后台保持工作台，不改成首页式海报。保持移动端触控 44px、焦点可见、键盘 / 触屏 / reduced-motion。
- 不删除页面 / 组件目录，不擅自升级 React / Vite / Tailwind 主版本。
- GSAP 已在 vendor 中，本机没有必须引入新动效库的需求；新增动画须 scope / cleanup，减少动态时内容仍可见。
- UI 立即反馈并不等于服务端提交成功；错误必须恢复状态，不能生成假交互或吞掉失败。
- 路由变化同时检查 SiteHeader、BottomNavigation、navigationState 和后台侧栏。

## 11. 测试、构建与证据

### 11.1 可执行命令

在真实根目录：

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

- typecheck：两个 tsconfig 的 tsc --noEmit。
- lint：eslint . --max-warnings 0。
- 根 test：转发后端 node --test test/*.test.js。
- build：先 typecheck，再 Vite build，写入 dist；本轮按“只写文档”约束未再次执行会更新 dist 的构建。
- 可用 `node --check 具体后端文件` 做 JS 语法检查；不要把它当权限 / API 测试。
- 无前端独立 unit/e2e npm 脚本；真实浏览器必须额外验证。

### 11.2 本轮 2026-10-01 结果

| 检查 | 实际结果 |
| --- | --- |
| TypeScript | 通过，exit 0 |
| ESLint | 通过，exit 0，max-warnings 0 |
| 后端测试 | **123 / 123 通过**，0 fail / skipped / todo |
| 前端 /functions HTTP | 200 |
| /api/health | status: ok |
| Git status / diff | 都无法运行有效检查：非 Git 仓库 |
| 本轮生产构建 / 全站浏览器 | 未执行；只核对既有交付记录与源码 |

本轮日志在 /private/tmp/uniclub-handoff-typecheck.log、uniclub-handoff-lint.log、uniclub-handoff-tests.log，属于临时文件，可通过重新运行命令复现。第一次测试在无本地网络权限的沙箱中因 listen EPERM 失败；获得本地网络权限后重跑全部 123 通过，不能把第一次环境失败计为 123 个业务回归。

### 11.3 已存在的历史验收

证据目录：
`/Users/alexmason/Documents/Codex/2026-09-26/users-alexmason-desktop-uniclub-main-src/outputs`。

- 生产构建日志 quantification-build.log：2026-10-01 00:13（上海时间），Vite 成功。属于上一轮构建记录，不是本轮重新构建。
- 量化测试历史 123 通过，本轮也复验通过。
- 量化浏览器：真实 Chrome、隔离 Mongo、真实 Model / Express / JWT，**模拟 COS**；19 项交互，实际 ZIP 传输、>20MiB 分片、下载 SHA256、两个文件批量下载、角色拒绝 / 搜索 / 键盘。
- 3 路由（functions / quantification / admin/quantification）× 6 宽度（320、375、414、768、1280、1440）共 18 布局检查无非预期页面横向溢出；管理员表格内部横向滚动是设计允许的。
- Chrome 触屏模拟、明 / 暗 10 个文字样本对比度最低分别 5.61 / 7.26、reduced motion 下上传区域 transition 0s；不是全站所有元素的可访问性审计或实体手机测试。
- normal-motion-results.json 确认 3 路由普通动效模式仍可见。
- 重设计的更广页面检查 / 截图在 redesign-checks 及“UniClub前端重设计-实施与验收.md”；不要拿量化 3 页的 18 次检查代替全站新版本验收。
- 原隔离服务 5052 / 8083 已退出、隔离测试库已删除；本轮未重开。

实际截图示例：
- [功能目录 1440](/Users/alexmason/Documents/Codex/2026-09-26/users-alexmason-desktop-uniclub-main-src/outputs/quantification-checks/isolated-functions-1440.png)
- [学生回执 375](/Users/alexmason/Documents/Codex/2026-09-26/users-alexmason-desktop-uniclub-main-src/outputs/quantification-checks/isolated-member-quantification-light-375.png)
- [管理工作台 1440](/Users/alexmason/Documents/Codex/2026-09-26/users-alexmason-desktop-uniclub-main-src/outputs/quantification-checks/isolated-admin-quantification-1440.png)

这些报告 / 测试 harness 在应用目录外，迁移项目时不会自然跟随。新对话无法访问旧机器时应以仓库内测试和 docs/quantification.md 为基础重新验证，不能宣称已重跑旧浏览器脚本。

## 12. Git / 当前工作区：已修改但未形成提交历史的文件

### 12.1 核查结果与限制

在实际根执行 git status --short 得到 fatal: not a git repository；git diff --stat 同样无有效仓库。没有能核对的提交基线，因此**无法精确断言哪些文件是 Git tracked / untracked / staged 或与 HEAD 的差异**。

下面是通过本地交付 manifests、快照与当前文件核对的**已应用改动清单**，不是伪造的 git diff。本地已有更早的其他改动可能不在这些清单中。新 Codex 必须保留当前文件，不应把较早快照当“干净版本”覆盖回来。

证据均在 Codex 工作目录：

| 清单 | 记录数 / 本轮核对 |
| --- | --- |
| work/change-manifest.json | 100 项早期安全 / 工程 / 启动修改；46 项仍同 hash，其余多数已被后续重设计覆盖 |
| outputs/redesign-checks/sync-applied-manifest.json | 333 项重设计；326 项仍同 hash，7 项后续改变 |
| outputs/quantification-checks/file-manifest.json | 20 新增 + 13 修改 + 0 删除；**33 项当前全部 hash 一致** |
| 合并去重 | 406 个路径：201 个非字体文件 + 205 个 public/fonts 字体相关文件 |

重设计清单后续改变的 7 项为：design.md、SiteHeader.tsx、BottomNavigation.tsx、navigationState.ts、main.tsx、AdminLayout.tsx、routes.tsx。其中大多数因量化入口集成变化，main.tsx 还引入 GSAP 注册。

另有当前存在、上述三张清单未列出的 GSAP 文件：
`src/lib/gsap.ts`、`vendor/README.md`、`vendor/gsap-3.15.0.tgz`、`vendor/gsap-react-2.1.2.tgz`。其创建 / 提交来源无法从 Git 判断；package.json 与 lockfile 已使用它们，不可遗漏。

私有环境文件 .env.development.local 和后端 .env 必须单独安全保留。node_modules、dist、日志和本机 Mongo 数据不属于本文的源码改动清单。本轮新加 CODEX_HANDOFF.md、NEXT_TASK.md，不在旧 manifests 内。

### 12.2 可确认已应用的完整非字体路径

以下清单来自三张 manifest 的去重合并；路径均相对于实际根。它记录曾经应用的变动，不保证这些变动都是同一个人、同一次操作或已具备远程备份。

### 启动、构建、设计与公共配置（16 项）

```text
.hallmark/log.json
.hallmark/preflight.json
design.md
docs/quantification.md
eslint.config.js
index.html
package-lock.json
package.json
public/manifest.json
scripts/start-backend.js
scripts/start-mongo.js
start-backend.command
start-mongo.command
tailwind.config.ts
tokens.css
vite.config.ts
```

### 前端源文件（151 项）

```text
src/components/ArticleContent.tsx
src/components/AvatarManagementModal.tsx
src/components/BackNavigation.tsx
src/components/BottomNavigation.tsx
src/components/CalendarView.tsx
src/components/CommentInput.tsx
src/components/CommentList.tsx
src/components/ContentState.tsx
src/components/CreatePostDialog.tsx
src/components/EmojiPicker.tsx
src/components/EventGallery.tsx
src/components/FeaturedContent.tsx
src/components/FeaturedNews.tsx
src/components/FilterToolbar.tsx
src/components/InteractionButtons.tsx
src/components/Layout.tsx
src/components/OptimizedImage.tsx
src/components/PageHeading.tsx
src/components/ProfilePictureUpload.tsx
src/components/QuantificationDownloads.tsx
src/components/ReactionButtons.tsx
src/components/RisoArtwork.tsx
src/components/ScrollToTop.tsx
src/components/SearchDialog.tsx
src/components/SettingsListItem.tsx
src/components/ShareDialog.tsx
src/components/SiteFooter.tsx
src/components/SiteHeader.tsx
src/components/StatusUpdate.tsx
src/components/UserHeader.tsx
src/components/UserProfile.tsx
src/components/WelcomeCard.tsx
src/components/YouTubeEmbed.tsx
src/components/cards/AnnouncementCard.tsx
src/components/cards/EventCard.tsx
src/components/cards/NewsCard.tsx
src/components/cards/PastEventCard.tsx
src/components/cards/ResourceCard.tsx
src/components/cards/SocialCard.tsx
src/components/chat/ChatBubble.tsx
src/components/chat/ChatWindow.tsx
src/components/ui/ConfirmationDialog.tsx
src/components/ui/accordion.tsx
src/components/ui/alert-dialog.tsx
src/components/ui/alert.tsx
src/components/ui/badge-variants.ts
src/components/ui/badge.tsx
src/components/ui/breadcrumb.tsx
src/components/ui/button-variants.ts
src/components/ui/button.tsx
src/components/ui/calendar.tsx
src/components/ui/card.tsx
src/components/ui/carousel.tsx
src/components/ui/chart.tsx
src/components/ui/command.tsx
src/components/ui/context-menu.tsx
src/components/ui/dialog.tsx
src/components/ui/drawer.tsx
src/components/ui/dropdown-menu.tsx
src/components/ui/form-state.ts
src/components/ui/form.tsx
src/components/ui/hover-card.tsx
src/components/ui/input-otp.tsx
src/components/ui/input.tsx
src/components/ui/menubar.tsx
src/components/ui/navigation-menu-style.ts
src/components/ui/navigation-menu.tsx
src/components/ui/pagination.tsx
src/components/ui/popover.tsx
src/components/ui/progress.tsx
src/components/ui/select.tsx
src/components/ui/sheet.tsx
src/components/ui/sidebar-state.ts
src/components/ui/sidebar.tsx
src/components/ui/sonner.tsx
src/components/ui/switch.tsx
src/components/ui/tabs.tsx
src/components/ui/textarea.tsx
src/components/ui/toast.tsx
src/components/ui/toggle-group.tsx
src/components/ui/toggle-variants.ts
src/components/ui/toggle.tsx
src/components/ui/tooltip.tsx
src/context/AuthContext.tsx
src/context/PopupContext.tsx
src/context/ThemeContext.tsx
src/context/UserContext.tsx
src/context/authContextState.ts
src/context/popupContextState.ts
src/context/themeContextState.ts
src/context/userContextState.ts
src/hooks/useComments.ts
src/hooks/useEngagement.ts
src/hooks/usePageViewState.ts
src/hooks/useProfilePicture.ts
src/lib/apiError.ts
src/lib/apiFailure.ts
src/lib/axios.ts
src/lib/contentFormat.ts
src/lib/contentQuery.ts
src/lib/mobile.ts
src/lib/navigationState.ts
src/lib/quantificationApi.ts
src/lib/quantificationUpload.ts
src/lib/session.ts
src/main.tsx
src/pages/AnnouncementsPage.tsx
src/pages/ArticlePage.tsx
src/pages/AuthPage.tsx
src/pages/CommentsPage.tsx
src/pages/DebugPage.tsx
src/pages/EventDetailPage.tsx
src/pages/EventsPage.tsx
src/pages/FunctionsPage.tsx
src/pages/Homepage.tsx
src/pages/Index.tsx
src/pages/NewsPage.tsx
src/pages/NotFound.tsx
src/pages/NotificationsPage.tsx
src/pages/PastEventDetailPage.tsx
src/pages/QuantificationPage.tsx
src/pages/ResourceDetailPage.tsx
src/pages/ResourcesPage.tsx
src/pages/SavedPostsPage.tsx
src/pages/SettingsPage.tsx
src/pages/SignInForm.tsx
src/pages/SignUpStepper.tsx
src/pages/SocialPage.tsx
src/pages/admin/AdminAi.tsx
src/pages/admin/AdminDashboard.tsx
src/pages/admin/AdminEvents.tsx
src/pages/admin/AdminGallery.tsx
src/pages/admin/AdminGuard.tsx
src/pages/admin/AdminLayout.tsx
src/pages/admin/AdminMembers.tsx
src/pages/admin/AdminNews.tsx
src/pages/admin/AdminNotifications.tsx
src/pages/admin/AdminQuantification.tsx
src/pages/admin/AdminResources.tsx
src/pages/admin/AdminRoster.tsx
src/pages/admin/adminApi.ts
src/pages/admin/adminSession.ts
src/pages/admin/components.tsx
src/pages/admin/formatting.ts
src/routes.tsx
src/styles/editorial.css
src/styles/quantification.css
src/types/content.ts
src/types/quantification.ts
src/utils/eventTransform.ts
src/utils/navigationUtils.ts
```

### 后端源文件（34 项）

```text
uniclub-backend/.env.example
uniclub-backend/index.js
uniclub-backend/middleware/auth.js
uniclub-backend/middleware/contentAccess.js
uniclub-backend/middleware/rateLimit.js
uniclub-backend/models/QuantificationCollection.js
uniclub-backend/models/QuantificationSubmission.js
uniclub-backend/models/QuantificationUpload.js
uniclub-backend/models/User.js
uniclub-backend/package-lock.json
uniclub-backend/package.json
uniclub-backend/routes/adminRouter.js
uniclub-backend/routes/authRouter.js
uniclub-backend/routes/cronRouter.js
uniclub-backend/routes/curationRouter.js
uniclub-backend/routes/eventRouter.js
uniclub-backend/routes/newsRouter.js
uniclub-backend/routes/pastEventRouter.js
uniclub-backend/routes/quantificationRouter.js
uniclub-backend/routes/resourceRouter.js
uniclub-backend/routes/userRouter.js
uniclub-backend/scripts/createAdmin.js
uniclub-backend/scripts/rotateAdminPassword.js
uniclub-backend/services/QuantificationRepository.js
uniclub-backend/services/QuantificationService.js
uniclub-backend/services/storage/CosStorageAdapter.js
uniclub-backend/services/storage/index.js
uniclub-backend/test/fixtures/quantificationMemory.js
uniclub-backend/test/fixtures/startup-preload.cjs
uniclub-backend/test/quantification.test.js
uniclub-backend/test/security.test.js
uniclub-backend/test/startup.test.js
uniclub-backend/utils/contentPolicy.js
uniclub-backend/utils/quantificationPolicy.js
```

### 字体资产（205 项）

同一重设计 manifest 另记录 public/fonts 下共 205 个字体 / 授权 / 样式文件。目录中的 Sans / Serif woff2 分片、对应字体声明与 OFL 必须整体保留；逐文件名称和 SHA256 见 sync-applied-manifest.json。此处以目录与数量列示，避免把 205 个分片误当 205 次业务修改。

### 本机备份位置及使用原则

Codex 工作目录的 work/originals、work/redesign-baseline、work/quantification-baseline 是历史快照；work/patched-project、work/redesign-project 是旧 staging。它们不是当前运行代码，不含可靠 Git 提交语义。

work/sync-project.py、sync-redesign.py、record-applied-sync.py、rotate-and-verify.cjs 等可能覆盖文件或修改真实账号，**交接时不要执行**。需要比对时先明确基线版本，只做读取 / 差异检查。

## 13. 下一轮如何继续

1. 先在新的对话读取本文件、[NEXT_TASK.md](/Users/alexmason/Desktop/uniclub-main/NEXT_TASK.md)、design.md、docs/quantification.md，然后核对实际根、两个 package.json 和当前端口。
2. 不重做已集成的量化页面或复制 ZIP 中的原型 HTML。先完成下一轮任务 1：统一 5050 启动约定、修复监听失败信息，并补必要启动测试。
3. 之后用真实私有 COS 做小 ZIP → 分片 → 500MiB → 长授权 / 断网 → 并发重提 / 清理的分层验证。真实密钥和有费用的资源需由持有人提供 / 配置；缺少配置时如实记录，不能假联调。
4. 联调稳定后准备 Windows 云服务器同源部署、Mongo 权限与备份恢复、域名 / HTTPS、进程守护、实际 API 隐私边界与调度。
5. “收班费”等下一业务在需求明确前维持待开放，不启用假付款 / 假账单。

本文件创建后本轮停止开发；未来是否实施、部署或创建新功能，以新对话中用户的指示为准。



## 2026-10-01 补充：量化材料网页存储配置与 SCF 接入

- 用户选择接入提供的腾讯云函数接口。管理后台量化材料页面已新增“存储配置”，统一管理 Bucket、Region、Endpoint、目录、上传凭证函数根地址与下载函数根地址，共六项配置。
- 配置原子保存到后端私有 `.quantification-storage.json`，已忽略版本管理；保存后立即生效，重启保留。原 `.env` 保留为默认来源。
- 云函数模式中，角色临时密钥只在网站后端使用；学生获取指定 staging 对象/分片的 300 秒 PUT 签名。保留原 COS SDK 接入兼容、实名归属、ZIP 检查、确认封存、替换及清理保护。
- 新目录作用于新上传，旧会话确认和旧提交下载保留原目录；有材料时禁止直接更换桶/地域。下载接口从数据库取 key，SCF `/download` 返回地址再核验；后台连接检查会调用上传凭证接口及 `/list`。
- 配套云函数源码和部署说明位于 `uniclub-backend/cloud-functions/quantification/`。两份函数通过开放 Function URL 直接调用；上传角色执行写入和分片，下载角色执行读取与核验。网页配置不会修改腾讯云控制台的 IAM、环境变量或跨域规则。
- typecheck、lint、build、138 项后端测试及 3 项 Python 测试通过。真实 localhost 后台表单与手机布局已浏览器验证；保存、重载和连接检查使用临时文件与模拟云接口。
- 尚未在用户腾讯云账号部署或验收真实 COS 上传/下载；未向真实配置写入测试值，未修改真实数据库/账号。部署文档和云权限仍属于实际上线待办。

## 2026-10-01 补充：恢复开放 Function URL 调用

- 按用户要求撤销云函数访问凭据功能，管理表单只显示六项存储配置；网站后端不再要求访问凭据或响应版本标记。
- 上传凭证、列表和下载均使用普通 SCF GET 请求，本地两份云函数也采用开放调用。原接口不带版本标记仍可使用。
- 旧配置中的停用字段兼容忽略，读取不改写文件，下次正常保存仅写六项配置；没有数据库迁移。
- ClassHub 登录 JWT、管理员校验和 COS 运行角色临时密钥、上传及下载签名均保留。

## 2026-10-01 补充：修复原 SCF 量化上传与材料列表

- 对照用户提供的原版代码，真实诊断得到：下载 /list 有 42 个 ZIP，上传角色 HEAD 返回 403，下载签名 Range GET 返回 206。此前 100% 后失败发生在确认读取阶段。
- SCF 新上传恢复“上传目录/原文件名.zip”；平铺文件核验后直接确认。读取通过下载角色签名 URL，不使用上传角色读取/复制权限。
- 旧 staging 上传支持流式恢复原文件名后确认；旧对象保留且已确认副本在列表去重。同名已有材料禁止覆盖，上传对象绑定上传会话编号。
- 后台加入独立的存储桶材料列表：刷新、搜索、排序、单个及批量下载。名单为空不再阻碍读取桶内材料；名单人数统计与材料列表分开。
- 继续采用六项存储配置与开放 Function URL，保留网站 JWT/管理员校验；没有重新引入云函数口令，没有数据库迁移。

### 本轮真实验收（上述旧记录的后续进展）

- 147 项后端测试、3 项上传云函数 Python 测试、typecheck、lint、生产 build 全部通过。
- 使用当前真实登录账号，已成功重新确认那份 517.3 KB 的待确认 ZIP；恢复为原目录中的原文件名，提交记录持久化，实际下载得到 529673 字节。未创建测试账号或导入名单。
- 真实后台刷新显示 42 份材料；全选后生成 42 个下载入口，无失败项。名单人数仍为 0，名单统计文案已明确区分材料份数。
- 恢复后的旧临时对象保留作为副本，列表去重 1 份。未删除现有 COS 材料，未修改腾讯云 IAM、CORS 或部署在线云函数。
- 新上传请求头的真实 COS OPTIONS 预检返回 200，并允许 content-type、x-cos-acl、x-cos-forbid-overwrite、x-cos-meta-classhub-upload。
- 大文件分片完成、授权范围与会话归属已有回归测试；本轮未额外向真实班级上传 500MB 测试文件。

## 2026-10-01：班费缴纳 / 凭证管理已完成

- 按用户最新完整需求，功能页“交班费”正式开放：`/fees`；后台新增班费管理：`/admin/fees`。
- 付款码与支付截图为 Mongoose Buffer / MongoDB BSON Binary，内存 multipart 上传、Sharp 内容验证，原始最大5MiB；最长边1920，存图统一PNG。
- 状态仅 SUBMITTED / CONFIRMED。待确认可改备注或截图；确认后后端锁定。每用户唯一索引；确认记录 confirmedBy / confirmedAt，重复确认幂等。
- 复用原 JWT/tokenVersion/数据库管理员权限；截图只有 owner 或管理员可读，私有二进制接口，元数据不含图。
- 已执行 `npm --prefix uniclub-backend run fees:init`，增加两个集合与索引。正式库用户50、名单49、班费配置1、正式提交0；已有付款码保留，测试图片未进入正式配置。
- build/typecheck、ClassHub范围lint通过，完整测试201/201、显式真实MongoDB集成13/13通过。浏览器验证提交/备注修改/图片Modal/确认取消与执行/只读/390px布局；控制台无warning/error。最终全目录lint报错来自独立的dsh-niulai-pet-master（4错误4警告）；未改该子项目，显式排除它后ClassHub lint通过。
- 浏览器与并发测试使用独立临时数据库及虚构账号；测试服务和数据库已清理。正式8081/5050服务继续运行。
- 认证与量化材料/COS共16个关键文件哈希未变；原量化 collections API仍200。本次未进行真实付款或确认正式缴费记录。
- 完整文件清单、API、数据库、验证和操作报告：`docs/fees.md`。管理员检查当前付款码，核对真实微信到账后才能确认。
