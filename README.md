# ClassHub

ClassHub 是一个面向班级与学生社群的全栈 Web 应用。成员端提供新闻、公告、活动、社交动态、资源和个人设置等页面；管理端提供相应内容管理，以及班费凭证审核、量化材料收集等功能。

本仓库还包含网页桌宠、管理后台 AI 助手、新闻采集/整理代码，以及用于 Vercel 和阿里云 ECS 的部署配置。外部服务是否可用取决于部署环境中的数据库、API 密钥和对象存储配置；本地启动本身不会自动提供这些服务。

## 功能概览

### 成员端

- 新闻与文章、班级公告、活动及往期活动。
- 社交动态、评论、互动和已保存内容。
- 资源浏览、详情和下载入口。
- 注册/登录、个人资料与设置、通知、站内搜索。
- 功能入口（`/functions`）、量化材料提交（`/quantification`）和班费凭证提交（`/fees`）。
- 可选网页桌宠；偏好设置与账号关联，具体行为见[桌宠说明](docs/classhub-pet.md)。

### 管理端

`/admin` 下包含成员与名单管理、新闻、活动、资源、图库、公告/通知、量化材料、班费及 AI 助手等页面。管理权限由后端根据数据库中的用户权限校验，不应仅依赖前端页面隐藏。

班费模块收集缴费凭证并由管理员人工确认，不处理支付，也不自动核验到账。量化材料模块管理收集期及提交记录；上传需要配置对象存储，仓库包含 COS 与 SCF 接入实现，具体配置和限制见[量化材料说明](docs/quantification.md)。班费实现与限制见[班费说明](docs/fees.md)。

后台 AI 助手、新闻 AI 整理依赖相应的服务端 API 密钥；没有配置密钥时，对应 AI 功能不可用。管理端 AI 的详细实现和配置说明见 [`uniclub-backend/README.ai.md`](uniclub-backend/README.ai.md)。

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、React Router、TanStack React Query、Tailwind CSS |
| 后端 | Node.js、Express 5、Mongoose |
| 数据库 | MongoDB |
| 身份验证 | JWT |
| 移动端配置 | Capacitor；仓库包含 Android 工程 |
| 量化材料存储 | 支持腾讯云 COS 适配器，以及通过腾讯云 SCF Function URL 接入 COS；需要配置相应云端资源 |

## 本地开发

### 环境要求

- Node.js（建议使用当前受支持的 LTS 版本）和 npm。
- 可连接的 MongoDB 实例。
- Git。

新闻整理、管理端 AI、量化材料上传等功能还需要各自的外部服务配置；仅运行前端和后端不代表这些服务已经开通。

### 安装依赖

在仓库根目录运行：

```bash
npm run install-all
```

该命令分别安装根目录的前端依赖和 `uniclub-backend/` 中的后端依赖。

### 配置后端

复制 `uniclub-backend/.env.example` 为 `uniclub-backend/.env`，至少填写 MongoDB 连接串和 JWT 签名密钥：

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/uniclub
JWT_SECRET=请替换为随机且私有的密钥
PORT=5050
```

本地 MongoDB 地址仅为示例；也可以使用有权限访问的 MongoDB 实例。不要提交真实密钥或生产环境变量。

按需配置可选服务：

- 新闻采集与整理：`NEWS_API_KEY`、`GEMINI_API_KEY`；`GEMINI_MODEL` 和 `GEMINI_PROXY` 可选。
- 管理端 AI 助手：配置 `AI_SECRET_ENCRYPTION_KEY`。可使用 `npm --prefix uniclub-backend run ai:init-secret` 初始化加密主密钥；助手所需的服务商 API Key 另在管理界面配置。
- 量化材料对象存储：按[量化材料说明](docs/quantification.md)配置 COS 和后台存储设置。未配置时不能进行真实对象上传。

### 启动

在仓库根目录运行：

```bash
npm start
```

该命令启动前端 Vite 开发服务器和后端。默认地址：

- 前端：<http://localhost:8081>
- 后端健康检查：<http://localhost:5050/api/health>

开发环境通过 Vite 将 `/api` 和 `/uploads` 请求代理到 `http://localhost:5050`。若本机后端要使用其他端口，可同时设置代理目标，例如：

```bash
VITE_API_PROXY_TARGET=http://localhost:5051 npm start
```

只启动单侧时，可在两个终端分别运行：

```bash
npm run frontend
npm run backend
```

首次启动前请确认 MongoDB 可访问，并已配置后端 `.env`。后端未配置 `MONGODB_URI` 时不会启动。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm start` / `npm run dev` | 同时启动前后端开发服务 |
| `npm run frontend` | 只启动 Vite 前端 |
| `npm run backend` | 只启动后端 |
| `npm run typecheck` | 检查前端和 Vite 配置的 TypeScript |
| `npm run build` | 执行类型检查并构建前端至 `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `npm run lint` | 对仓库运行 ESLint |
| `npm test` | 运行后端测试和桌宠测试 |
| `npm run test:pet` | 单独运行桌宠测试 |
| `npm run curate:news` | 手动执行一次新闻整理 |
| `npm run curate:news:verbose` | 以详细日志执行一次新闻整理 |
| `npm run daily-curator` | 启动新闻每日整理任务进程 |
| `npm run admin:create` | 执行后端管理员创建脚本 |
| `npm run roster:import` | 执行后端名单导入脚本 |

新闻整理命令依赖后端配置的新闻/API 服务。执行前请先阅读相关代码和环境配置，避免对目标数据库写入不需要的数据。

## 目录结构

```text
.
├── src/                         # React 前端
│   ├── components/              # 通用组件
│   ├── features/                # 功能模块（如桌宠）
│   ├── pages/                   # 成员端与管理端页面
│   ├── lib/                     # API 客户端与共享工具
│   └── routes.tsx               # 前端路由
├── public/                      # 静态资源、PWA 与桌宠资源
├── uniclub-backend/
│   ├── routes/                  # Express 路由
│   ├── models/                  # Mongoose 模型
│   ├── services/                # 业务服务
│   ├── middleware/              # 认证、权限等中间件
│   ├── jobs/                    # 定时/后台任务
│   └── test/                    # 后端测试
├── docs/                        # 业务功能说明
├── deploy/ecs/                  # ECS 部署与维护脚本、说明
├── android/                     # Capacitor Android 工程
├── scripts/                     # 开发、构建和辅助脚本
├── package.json                 # 前端及根目录命令
└── vercel.json                  # Vercel 构建、路由和 Cron 配置
```

## 部署

仓库提供 `vercel.json` 中的 Vercel 构建、API 路由及 Cron 配置，也提供 `deploy/ecs/` 下的 ECS 部署脚本和说明。部署到任一环境前，都需要在对应平台配置后端 MongoDB、JWT 和所需外部服务变量；仅有部署配置不表示当前分支已发布或线上服务可用。

ECS 的具体目录、备份、回滚和运维流程见 [`deploy/ecs/README.md`](deploy/ecs/README.md)。请勿把真实环境文件、凭证或备份加入版本控制。

## 相关文档

- [班费模块](docs/fees.md)
- [量化材料收集与对象存储](docs/quantification.md)
- [网页桌宠](docs/classhub-pet.md)
- [ECS 部署说明](deploy/ecs/README.md)
- [管理端 AI 助手说明](uniclub-backend/README.ai.md)

## ClassHub 交互系统（2026-10-09）

本轮沿用现有品牌、字体、页面结构、Radix 与 GSAP，升级共享组件，不新增依赖。
审计优先级：P0 为加载文案导致尺寸变化、移动菜单跨断点未关闭；P1 为不一致的浮层时序、搜索布局变化与首屏等待；P2 为 Tabs 指示面、骨架屏及通知细节。

### 共享动效与组件约定

- `tokens.css`：微交互 140ms、浮层 220ms、结构进入 320ms、退出 160ms；加载旋转 800ms、骨架呼吸 1600ms。
- `src/lib/motion.ts`：GSAP 从 CSS tokens 读取秒数，集中管理 easing 和 reduced-motion 查询；不在动画帧中读取布局。
- `src/styles/ui-motion.css`：按钮、字段、Dialog/AlertDialog、菜单、Popover、Tooltip、Sheet、Toast 和 Skeleton 的状态反馈；`interaction.css` 补齐既有页面控件。
- `Button` 增加可选 `loading` / `loadingLabel`；通过同一网格保留空闲与加载文案尺寸，处理中使用原生 disabled 和 aria-busy。`asChild` 保留子节点及 ref，阻止禁用时的激活；固定尺寸图标按钮只显示加载图标，加载文案用于无障碍名称。
- 登录、后台操作和确认弹窗复用加载按钮；点赞/收藏保留计数与稳定文案，原 API 与乐观更新逻辑保持原样。
- 搜索按后续反馈恢复升级前的紧凑搜索框及交互：结果区随输入显示，移除新增说明、帮助行、清空按钮和固定高面板；保留原 debounce、取消请求、排序、Escape、焦点恢复和移动 visualViewport。
- 导航保留 Header morph，细化选中和按下反馈；移动“更多”菜单在路由或桌面断点变化时关闭。
- Tabs 保留 Radix API 和键盘交互；指示面仅在选中、内容或尺寸变化时测量，过渡仅移动 transform/opacity。当前业务页面尚未使用此基础组件。

### 性能与验证

首屏最短展示从 900ms 收敛为 320ms，退出改为 220ms 的透明度变化；移除重模糊和正文位移，保留关键资源等待、会话跳过、取消清理及超时释放。减少动态效果时直接显示静态状态。卡片不再插入新的 hover 阴影变化；不新增全局 will-change。

验证通过：`npm run build`（含 typecheck、Vite、SEO HTML）、修改 TS/TSX 的定向 ESLint、`node scripts/test-preloader.mjs` 的 23 项检查。
内置浏览器验证了实际首页/登录页、按钮加载尺寸（前后均 126px）、Slot 禁用、横纵 Tabs 键盘切换、浮层 Escape/焦点/滚动锁释放、搜索清空与错误反馈、移动菜单跨断点关闭、Toast 取消滑动后关闭及移动短高度布局。

验证边界：未执行真实账号的登录、后台提交或搜索成功数据回归；搜索错误反馈使用未登录时的真实接口拒绝响应。未独立实测 Chromium、Safari/iOS 真机、系统 reduced-motion 设置或 FPS/低端设备性能。构建提示现有 Browserslist 数据较旧，未在本轮升级依赖。本轮仅更新本地源码与 dist，未推送生产服务器。

### 后续修正：后台按钮与原版搜索

后台 AdminButton 显式映射共享 Button 的样式类型，修复 ghost 按钮继承蓝底并叠加灰字的问题。主要操作沿用蓝底高对比文字；次要操作为浅底深字；普通轻量操作为透明底深字；列表删除/移除为浅红底、红字及红色描边，确认危险操作为红底高对比文字。相册图片删除图标也改为红色。原操作处理函数与接口保持不变。搜索已恢复升级前备份，仅做兼容共享弹窗的移动端动画选择器修正。


### 最新修正：首屏加载与手机页脚

首屏加载按后续反馈恢复为 Logo 800ms 模糊淡入、最短展示 900ms、关键资源最多等待 4 秒；Logo 收缩上移 200ms，覆盖层以 `power4.inOut` 上滑 900ms，正文从下方 32px 进入。保留同标签页会话跳过、reduced-motion 200ms 淡入淡出、资源等待与清理。相关 preloader 测试 34 项通过。

手机端 Header Logo 固定大小，不再参与滚动缩放；桌面和平板维持原有滚动动效。页脚链接在版权文字下方居中，使用实际底部 padding 为固定导航与 iOS 安全区留出空间。390px、320px 窄屏及 About 点击验证通过；必要 typecheck、build 与定向 ESLint 通过。
