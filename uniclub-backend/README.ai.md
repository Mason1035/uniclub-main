# ClassHub 管理后台 AI 助手

入口：`/admin/ai`。仅登录管理员可用，沿用数据库用户身份、JWT 和现有栏目发布权限。

## DeepSeek

- 模型：DeepSeek V4.1 Flash，API ID `deepseek-flash`。
- API：`https://api.deepseek.com/chat/completions`，服务器发送 Bearer 认证。
- 文本和图片均走 Chat Completions；图片只放在 user message 的 `image_url` 中。
- SSE 流式生成，标题和正文逐步实时预览；完整结构化结果校验通过后展开可编辑表单。
- 四种发布场景使用 JSON mode；关闭 thinking。格式错误只修复一次，仍失败则显示普通文本，禁止直接发布。
- 单次生成的服务器总时限为 240 秒；支持停止生成和断开连接清理。
- 官方说明：[Vision](https://api-docs.deepseek.com/zh-cn/guides/vision/)、[Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)。

## API Key

数据库 `ai_settings` 中只有一条 `_id: deepseek` 配置，保存配置状态、末四位、更新时间、管理员 ID 和 AES-256-GCM 密文。主加密密钥只在服务器环境变量 `AI_SECRET_ENCRYPTION_KEY` 中，格式为 32 个随机字节的 Base64。

GET/PUT/DELETE 的设置响应只返回 `configured`、`provider`、`model`、`last4`、`updatedAt`、`updatedBy`。不会返回明文、密文、IV 或认证标签；Mongoose 默认不选择 secret。任何管理员都不能通过界面查看或复制已保存的 Key。

可配置、更换、删除和测试连接。更换输入为空；连接测试由服务器解密后发送最小请求。日志只含安全错误代码、状态、provider/model，不记录密钥、Authorization 或图片。

### 本机

本次已安装新增的 `react-markdown` 依赖，并初始化本机后端 `.env` 中的主密钥（文件权限 600）。本机现有 DeepSeek API Key 已通过真实连接验证。

以后新环境可运行：

```bash
cd /Users/alexmason/Desktop/uniclub-main
npm ci
npm --prefix uniclub-backend run ai:init-secret
```

重启后端，然后在「管理后台 → AI 助手 → 配置 API Key」输入真实密钥，再点击「测试连接」。

### 现有 ECS

本次修改保留在本机，尚未推送到服务器。通过现有 `deploy/ecs/push.sh` 发布新版本后，在服务器执行：

```bash
sudo node /opt/classhub/current/uniclub-backend/scripts/init-ai-secret.js /opt/classhub/shared/backend.env
sudo systemctl restart classhub
```

脚本保留已有主密钥，只在未配置时生成，不打印密钥；目标配置文件权限设置为 600。该服务器的 systemd 已从 `/opt/classhub/shared/backend.env` 加载变量，更新版本不会替换此文件。随后在网站后台配置和测试 DeepSeek API Key。

主密钥须与数据库备份一起妥善保存，保存在环境文件中，不进入 Git。替换或丢失主密钥后，旧 API Key 无法解密，需要重新输入 API Key。没有主密钥或 API Key 时，仅 AI 功能不可用。

## 场景与图片

活动文案、公告草稿、新闻稿、新闻摘要、资源介绍、通知文案、活动总结、内容润色、内容扩写、内容精简、自由提问、图片理解。

JPEG / PNG / GIF / WebP，最多 4 张，每张 2 MiB。服务器使用 sharp 校验实际格式、解码和像素尺寸。输入图仅保留在当前页面和请求内存中，不写 COS、数据库或磁盘，不自动成为发布封面。移除、新对话、离开页面释放预览 URL；保留图片可供重新生成。

对话只保留当前页面 Session；新对话或刷新清空。继续修改会带上管理员人工修改后的内容。普通回答安全渲染 Markdown、列表和代码，禁用原始 HTML；非发布场景没有发布按钮。

## 发布与真实模型

| AI Result → Adapter | 复用 API / Service | 最终记录 |
| --- | --- | --- |
| 活动 → `mapToCreateActivityDTO` | `POST /api/events` → `EventService.createEvent` | `Event`，`status: published`，当前管理员 organizer |
| 公告 → `mapToCreateAnnouncementDTO` | `POST /api/admin/announcements` → 现有公告 route | `Announcement`，`isPublished: true`，当前管理员 author |
| 新闻 → `mapToCreateNewsDTO` | `POST /api/news` → 现有新闻 route | `News`，`status: approved`，当前管理员 author |
| 资源 → `mapToCreateResourceDTO` | `POST /api/resources` → 现有资源 route | `Resource`，`status: approved`，当前管理员 uploadedBy |

Event 实际使用 description、起止时间、location、eventType、分类、报名字段；Announcement 使用 body，没有 summary/content；News 使用 excerpt/content/source；Resource 使用 description，没有 content。预览与原栏目表单共享验证，缺失的时间、地点、来源或资源链接需要管理员补充。

输入图与可选封面链接分开，封面沿用当前栏目表单的 URL 方式。AI 不自动发布。点击一键发布先打开确认 Dialog；确认后再调用现有 API。请求期间禁止重复点击，同一结果版本发布成功后标记已发布；人工修改或重新生成产生新版本。公告只有列表页，查看链接使用现有公告列表，其余使用真实详情路由。

## AI API

所有接口都在已有 `/api/admin` 管理员中间件后，普通用户不可调用。

| Method | Path | 用途 |
| --- | --- | --- |
| GET | `/api/admin/ai/status` | 安全配置状态、场景和输入限制 |
| GET | `/api/admin/ai/settings` | 安全配置元数据 |
| PUT | `/api/admin/ai/settings` | 配置或替换完整 API Key |
| DELETE | `/api/admin/ai/settings` | 删除存储的 Key |
| POST | `/api/admin/ai/test` | 服务器端连接测试 |
| POST | `/api/admin/ai/generate` | JSON 或 multipart 输入，SSE / JSON 输出；仅生成 |

有每管理员限流和单次生成并发保护。未配置、权限不足、Key 无效、余额不足、超时、网络、格式、长度和发布校验错误分别处理。

## 本次文件变化

以下路径相对 `/Users/alexmason/Desktop/uniclub-main`：

| 路径 | 用途 |
| --- | --- |
| `src/pages/admin/AdminAi.tsx` | 新输入工作区、流式结果、会话、预览、确认发布 |
| `src/pages/admin/ai/types.ts` | 场景、结构化结果、发布预览类型 |
| `src/pages/admin/ai/api.ts` | 安全设置接口及 multipart/SSE 请求 |
| `src/pages/admin/ai/KeySettings.tsx` | 密钥配置、更换、删除、测试界面 |
| `src/pages/admin/ai/PublishEditor.tsx` | 四种真实栏目字段的人工编辑 |
| `src/pages/admin/ai/publication.ts` | 各栏目 DTO Adapter、现有创建 API、查看链接 |
| `src/pages/admin/ai/Answer.tsx` | 安全 Markdown 回答 |
| `src/pages/admin/ai/streaming.ts` | 按已收到的顶层 JSON 字段生成临时文本预览 |
| `src/pages/admin/ai/StreamingPreview.tsx` | 流式展示标题和正文，完整校验前不可发布 |
| `src/pages/admin/ai/ai.css` | 沿用 ClassHub 风格的响应式工作区 |
| `src/pages/admin/contentValidation.ts` | AI 与现有创建表单共享验证 |
| `src/pages/admin/adminApi.ts` | 清理旧 AI Gemini 请求，保留原栏目创建 API |
| `src/pages/admin/AdminEvents.tsx` | 活动表单复用共享验证 |
| `src/pages/admin/AdminNotifications.tsx` | 公告表单复用共享验证 |
| `src/pages/admin/AdminNews.tsx` | 新闻表单复用共享验证 |
| `src/pages/admin/AdminResources.tsx` | 资源表单复用共享验证 |
| `uniclub-backend/routes/admin/ai.js` | DeepSeek 管理员路由、内存上传、限流、SSE、取消清理 |
| `uniclub-backend/services/DeepSeekAssistant.js` | 官方 API、服务器密钥调用、输出修复和安全错误 |
| `uniclub-backend/utils/aiPrompts.js` | 后端统一场景与 Prompt |
| `uniclub-backend/utils/aiValidation.js` | 输入、真实图片格式、结构化结果校验 |
| `uniclub-backend/utils/aiSecret.js` | AES-256-GCM 加解密 |
| `uniclub-backend/models/AiSettings.js` | 新增单条加密 AI 配置 |
| `uniclub-backend/scripts/init-ai-secret.js` | 初始化本机或服务器环境文件中的主密钥 |
| `scripts/test-ai-preview.mjs` | 流式预览解析的 3 项专项测试 |
| `uniclub-backend/test/adminAi.test.js` | 聚焦 AI、权限、密钥和发布接口的隔离测试 |
| `uniclub-backend/package.json` | AI 主密钥初始化和 AI 测试命令 |
| `uniclub-backend/.env.example` | 主密钥环境变量说明 |
| `uniclub-backend/.env`（忽略提交） | 本机主密钥，权限 600 |
| `package.json` / `package-lock.json` | 新增锁定的 react-markdown 依赖 |
| `.hallmark/log.json` | 记录本次 AI 工作区沿用设计体系与验证结果 |
| `uniclub-backend/README.ai.md` | 本次 AI 功能、配置及部署说明 |

数据库仅增加 `ai_settings` 单条配置；MongoDB/Mongoose 自动建集合，无需 migration。不修改四个栏目的数据结构，不保存对话或输入图片。其他新闻业务仍使用 Gemini 的部分保持原状。

## 验证范围

- TypeScript、生产 build、修改过的前端文件 ESLint。
- `node --test scripts/test-ai-preview.mjs`：3 项测试通过，验证流式中间状态、转义、嵌套字段和原型安全。
- `npm --prefix uniclub-backend run test:ai`：13 项隔离测试通过，测试使用真实权限中间件、栏目路由与模型验证，DeepSeek 和数据库边界使用内存替身，不写本机/生产内容。
- 浏览器仅验证 `/admin/ai`：密钥 UI、文本/图片请求、四类预览修改/校验/确认/防重复、上下文、Markdown、错误降级、320/375/414/768px 与暗色。
- 本机已配置的 Key 通过官方 DeepSeek 实际连接、真实文本、PNG 图片理解、结构化 JSON 和 SSE 流式生成验证，输入仅用程序合成文本与纯色图。四栏目的发布流程使用隔离数据验证，未发布测试内容。未做无关页面回归。
