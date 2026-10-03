# ClassHub 班费缴纳模块开发报告

完成日期：2026-10-01。项目目录：`/Users/alexmason/Desktop/uniclub-main`。

## 1. 实际检查到的项目技术栈

| 项目 | 实际实现 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite 5、React Router 6、TanStack React Query、Tailwind |
| 后端 | Express 5、CommonJS，沿用现有 router / service / repository 组织 |
| 数据库 | 当前本地 MongoDB，正式数据库 `uniclub` |
| ORM | Mongoose 8 |
| 认证 | 原有学号/编号 + 密码、bcrypt、JWT；保留 tokenVersion 会话校验 |
| 管理员权限 | 原有 `requireAdmin`，读取数据库 `User.isAdmin`；不信任客户端或 JWT 中的管理员声明 |
| 图片处理 | 项目已有 Multer 内存上传、Sharp；没有增加依赖 |
| 组件 | 沿用 PageHeading、后台 Panel / Field / Button / Badge / Table / Pagination、现有 Radix Dialog |

已检查 package.json、两个 lockfile、模型、认证中间件、用户和管理员路由、功能页、后台导航、现有上传、构建和测试配置。项目原本没有独立迁移框架，本次增加可重复执行的增量初始化脚本。

## 2. 新增功能

- “功能”页正式开放 **交班费**，按钮为 **进入班费缴纳**。
- 学生页显示当前付款码；未配置时显示空状态。
- 必须提交支付成功截图，备注非必填、最多 200 字符；选择后立即预览，可重新选择。
- 提交按钮显示加载状态并防止重复点击；成功消息为“缴费凭证提交成功”。
- 读取当前用户自己的记录、备注、提交时间、状态及凭证大图。
- 待确认记录允许只修改备注或更换截图；确认后用户页只读，后端同时拒绝修改。
- 后台新增 **班费管理**：上传/更换单例付款码、分页查看记录、状态筛选、按需预览图片。
- 人工确认到账前弹出二次确认；记录确认人、确认时间。重复确认保持原确认人和时间。
- 原始图片支持 JPEG / PNG / WebP，最大 5MiB；前端和后端均校验。
- 桌面左右布局，移动端上下布局；包含加载、空状态、错误、成功提示。

状态只有 `SUBMITTED`（待确认）和 `CONFIRMED`（已确认）。没有支付 API、自动确认、OCR、驳回、退款或多项目账本。

## 3. 修改文件

以下路径均位于当前项目，未改认证或量化材料的实现文件。

| 文件 | 修改用途 |
| --- | --- |
| [src/routes.tsx](/Users/alexmason/Desktop/uniclub-main/src/routes.tsx) | 加入学生及管理员班费页面懒加载路由 |
| [src/pages/FunctionsPage.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/FunctionsPage.tsx) | 开放班费入口，保留材料收集入口 |
| [src/pages/admin/AdminLayout.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/admin/AdminLayout.tsx) | 增加班费管理导航 |
| [uniclub-backend/index.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/index.js) | 挂载 `/api/fees` |
| [uniclub-backend/routes/adminRouter.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/routes/adminRouter.js) | 在已有管理员权限保护下挂载 `/fees` |
| [uniclub-backend/package.json](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/package.json) | 增加 `fees:init` 命令 |
| [CODEX_HANDOFF.md](/Users/alexmason/Desktop/uniclub-main/CODEX_HANDOFF.md) | 追加本次实现与验证结果 |
| [NEXT_TASK.md](/Users/alexmason/Desktop/uniclub-main/NEXT_TASK.md) | 更新班费已开放及操作说明 |

## 4. 新增文件

| 文件 | 用途 |
| --- | --- |
| [src/types/fees.ts](/Users/alexmason/Desktop/uniclub-main/src/types/fees.ts) | 两种状态及元数据类型 |
| [src/lib/feesApi.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/feesApi.ts) | 复用 axios/JWT 的 JSON、multipart、二进制 API |
| [src/components/fees/FeeImage.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/fees/FeeImage.tsx) | 鉴权图片读取、错误重试、Object URL 生命周期清理 |
| [src/components/fees/FeeImagePicker.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/fees/FeeImagePicker.tsx) | 文件限制、即时预览、重新选择 |
| [src/components/fees/FeeProofDialog.tsx](/Users/alexmason/Desktop/uniclub-main/src/components/fees/FeeProofDialog.tsx) | 复用 Dialog 的按需大图预览 |
| [src/pages/FeesPage.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/FeesPage.tsx) | 学生缴费凭证页面 |
| [src/pages/admin/AdminFees.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/admin/AdminFees.tsx) | 收款设置、记录、人工确认 |
| [src/styles/fees.css](/Users/alexmason/Desktop/uniclub-main/src/styles/fees.css) | 沿用主题变量，响应式班费布局 |
| [uniclub-backend/models/FeeSettings.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/models/FeeSettings.js) | 单例付款码 Binary 模型 |
| [uniclub-backend/models/FeeSubmission.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/models/FeeSubmission.js) | 用户唯一提交、Binary、确认人/时间 |
| [uniclub-backend/utils/feeImage.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/utils/feeImage.js) | 文件内容校验、图片处理、备注规则 |
| [uniclub-backend/services/FeeRepository.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/services/FeeRepository.js) | 数据库读取、分页、条件更新及并发保护 |
| [uniclub-backend/services/FeeService.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/services/FeeService.js) | 业务规则、权限、元数据输出 |
| [uniclub-backend/routes/feesRouter.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/routes/feesRouter.js) | 登录/管理员保护、内存上传、私有图片接口 |
| [uniclub-backend/scripts/initializeFees.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/scripts/initializeFees.js) | 增量、幂等数据库初始化 |
| [uniclub-backend/test/fees.test.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/test/fees.test.js) | 23 项图片、HTTP、认证、ownership、锁定回归测试 |
| [uniclub-backend/test/feesMongo.integration.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/test/feesMongo.integration.js) | 显式运行的真实 MongoDB 集成测试，独立临时数据库 |
| [docs/fees.md](/Users/alexmason/Desktop/uniclub-main/docs/fees.md) | 本报告与操作说明 |

## 5. 数据库变化

新增两个集合，不迁移、不删除、不清空已有业务数据：

| 集合 | 字段及约束 |
| --- | --- |
| `fee_settings` | `_id: current` 单例；`paymentQrData` Binary，`paymentQrMimeType`，`paymentQrSize`，`createdAt` / `updatedAt` |
| `fee_submissions` | `user` 引用 User；`remark`；`proofImageData` Binary、MIME、大小；`status`；`confirmedBy` 引用 User；`confirmedAt`；创建/更新时间 |

`fee_submissions.user` 建立数据库唯一索引 `fee_user_unique`；另有状态和时间索引。更新使用 `status: SUBMITTED` 条件，管理员确认与用户修改并发时不会解锁已确认记录。

已执行 `npm run fees:init`：初始化时配置 1 条、提交 0 条，唯一索引存在。此命令可重复执行，不使用 drop / syncIndexes。最后只读核查：正式库仍有用户 50、名单 49、配置 1、提交 0；已有付款码配置被保留。测试记录、测试付款图均在独立数据库中完成，测试环境已清理。

## 6. API

| Method | Path | 权限 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/fees/settings` | 登录用户 | 配置元数据，不返回图片 |
| GET | `/api/fees/payment-qr` | 登录用户 | 当前付款码二进制 |
| GET | `/api/fees/me` | 登录用户 | 自己的记录元数据，未提交为 null |
| POST | `/api/fees/submissions` | 登录用户 | multipart：必填 `proof`，可选 `remark`；待确认重复提交更新原记录 |
| PATCH | `/api/fees/submissions/me` | 登录用户 | multipart 或备注 JSON；待确认备注/截图修改 |
| GET | `/api/fees/submissions/:id/proof` | 凭证所属用户或管理员 | 凭证二进制；他人请求返回 404 |
| PUT | `/api/admin/fees/payment-qr` | 管理员 | multipart：`paymentQr`，更新单例 |
| GET | `/api/admin/fees/submissions` | 管理员 | 分页元数据；`page`、`limit`（最多100）、`status` |
| POST | `/api/admin/fees/submissions/:id/confirm` | 管理员 | 人工确认；重复操作幂等 |

图片由共享 axios 客户端携带原有站内 JWT 获取，再生成临时浏览器 Blob URL。

## 7. 前端页面

- 学生：[http://localhost:8081/fees](http://localhost:8081/fees)，复用前台 Layout 及登录门禁。
- 管理：[http://localhost:8081/admin/fees](http://localhost:8081/admin/fees)，复用 AdminGuard、AdminLayout。
- 原 `/functions` 的“交班费”入口已开放；其他入口保留。
- 图片 Modal 打开时才请求凭证；后台列表不会批量下载所有截图。
- 刷新、重新进入页面或窗口重新获得焦点时读取最新配置/状态。确认后隐藏编辑表单，后端拒绝修改。

## 8. 权限保护

所有班费读取/提交接口均经过原 `authenticateToken`。管理员写入、列表和确认经过原 `requireAdmin`，权限依据 MongoDB 的 `User.isAdmin`。

读取支付截图时，先读取元数据并比较 `submission.user` 与当前 JWT 的 `userId`。不匹配则查询数据库管理员资格；非管理员返回 404，且不会先读取他人图片二进制。修改接口始终使用当前用户 ID，不接受客户端传入 user/status/confirmedBy 等字段。

已确认记录的修改返回 409。数据库条件更新和用户唯一索引共同防止重复记录及确认/修改竞态。图片接口设置 `Cache-Control: private, no-store`、`Vary: Authorization`、`X-Content-Type-Options: nosniff`。

## 9. 图片存储

**付款二维码和支付截图的二进制内容都直接存在当前 MongoDB。** Mongoose 字段为 Buffer，MongoDB 实际字段类型验证为 BSON `binData`。

请求为 multipart → Multer memoryStorage → Buffer → Sharp 解码处理 → MongoDB Binary。班费模块没有调用 COS/S3/第三方存储，没有写公开 uploads 或保存本地图片路径，没有保存 Base64 TEXT，也没有把图片装入 JSON 元数据接口。

后端校验真实魔数、声明类型、解码结果、像素上限及原始 5MiB 限制；图片最长边不超过1920，统一重编码为 PNG，去除元数据和非图片尾部内容。单张图片处理后仍超过5MiB会拒绝。图片原比例保留；不支持动画。更换付款码更新同一条配置记录。

## 10. 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm run build`（含 TypeScript） | 通过，生成学生/管理员班费页面构建产物 |
| ClassHub 范围 lint | 通过；命令显式排除独立的 `dsh-niulai-pet-master/**`，未修改 lint 配置 |
| 最终 `npm run lint`（全目录） | 未通过：`dsh-niulai-pet-master` 中4个错误、4个警告。首次检查时全目录通过；最终检查出现该独立子项目的问题 |
| `npm test` | **201/201 通过**，包括原有测试及新增23项班费测试 |
| `node --test test/feesMongo.integration.js` | **13/13 通过**，真实 MongoDB、真实 HTTP、中间件、唯一索引与 Binary |
| `npm run fees:init` | 通过，已执行正式库增量初始化 |
| 正式 API | 班费 settings/me/admin-list、原量化材料 collections 均 HTTP200 |
| 浏览器 | 功能入口、未配置/未提交空状态、付款码预览/保存/学生读取、非法文件提示、提交成功、备注修改、用户/管理员图片 Modal、二次确认取消/执行、确认只读均通过 |
| 移动端 | 390px 视口：左右变上下、内容宽度等于可用视口、无页面横向溢出 |
| 浏览器控制台 | 学生和后台测试页面未出现 warning/error |
| 量化材料与认证 | 16 个关键实现/配置文件哈希未变，原有相关测试通过；未重新上传真实量化文件 |

真实数据库测试包括：12 个并发首次提交只产生1条记录、8个并发确认保留同一确认时间/人、用户修改与确认竞态、确认后修改/重新提交409、普通用户越权404/403、元数据不含图、QR更换仍1条、迁移重复执行保留已有记录。

截图为**虚构测试数据**，不是实际付款或实际收款码：

![学生已提交界面](/Users/alexmason/Documents/Codex/2026-10-01/files-mentioned-by-the-user-codex/outputs/fees/student-submitted.jpg)

![后台确认界面](/Users/alexmason/Documents/Codex/2026-10-01/files-mentioned-by-the-user-codex/outputs/fees/admin-confirmed.jpg)

![移动端已确认界面](/Users/alexmason/Documents/Codex/2026-10-01/files-mentioned-by-the-user-codex/outputs/fees/student-mobile-confirmed.jpg)

## 11. 需要手动执行的操作

**当前班费功能不需要再运行 migration、增加环境变量、重启服务或重新构建**：这些实现和检查已完成；正式前端8081、后端5050继续运行。全目录 lint 的独立宠物子项目错误需要该子项目维护者单独处理。

1. 管理员打开 `/admin/fees`，检查当前付款二维码是否为本班正确收款码；需要时选择“更换付款码”并保存。
2. 学生从“功能 → 交班费”进入，正常完成付款后提交截图。初次提交必须有截图；待确认可保存修改。
3. 管理员查看截图并核对微信真实到账，再点击“确认到账”及二次确认。

如果以后部署到其他环境，使用该环境已有 MongoDB/JWT 配置，首次运行 `npm --prefix uniclub-backend run fees:init`，再执行现有构建/启动流程。无需新增 COS 或支付配置。

## 12. 尚未完成 / 实际限制

班费代码、迁移、自动测试、构建和浏览器验证已完成；全目录 lint 有以下独立子项目限制。

- 没有进行真实付款，也没有替管理员确认任何正式缴费记录。截图真实性、实际金额和到账必须人工核对。
- 按当前需求每个用户只有一条当前缴费记录，没有多期班费或历史账本；确认后没有撤回/驳回入口。
- 大尺寸图片会缩至最长边1920并转PNG；建议上传清晰截图，管理员在确认前核对内容。
- 原 Vite 构建存在主包超过500kB的体积提示；构建通过，本次没有重构无关模块解决该既有提示。
- 最终全目录 lint 被 `dsh-niulai-pet-master/src/client/card.tsx` 的条件调用 Hooks、`demo.ts` 的 prefer-const 和4项警告阻断。该目录为独立宠物项目，未修改其中代码；排除该目录后 ClassHub lint 通过。
- 图片直接进入数据库，日后应随现有数据库备份保存；本次未新增备份或数据保留系统。
- 没有执行腾讯云 COS 真实上传/下载回归；已通过现有测试、正式 collections API 与文件哈希检查确认集成未改动其逻辑。
