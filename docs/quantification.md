# 量化材料收集

## 使用入口

- 主导航“班级动态”后面的“功能”：`/functions`。移动端在“更多”中。
- 学生提交：`/quantification`。沿用现有账号登录，材料身份取已验证的 JWT userId。
- 管理后台“量化材料”：`/admin/quantification`。管理员权限以数据库 `User.isAdmin` 为准。
- “收班费”展示待开放状态，本次未接入支付。

管理员先创建真实收集期，填写标题、说明、开始时间、截止时间并开放。草稿对学生隐藏；开始前、截止后和手动关闭时不可提交。学生每期只有一份当前有效材料；成功重提后更新版本，失败或取消保留原材料。

支持 ZIP，最大 **524,288,000 字节（500MiB，界面显示 500MB）**。文件名建议“学号_姓名.zip”，只用作显示，不决定上传身份或对象路径。超过 20MiB 的文件使用 20MiB 分片，并发两片；网页内失败重试可复用上传会话和已上传分片。刷新后可尝试重新确认已完成传输的会话；未传完的文件需要重新选择，当前没有跨页面保存文件句柄的续传功能。

管理页按真实 `EnrolledUser` 名单统计已交、未交，包含尚未注册的同学；名单外提交单独标注。支持姓名、学号、文件名搜索，状态筛选、排序、分页、本页全选/反选和选中文件下载。批量下载分别下载原 ZIP；浏览器可能要求允许多文件下载，单文件入口始终可用。

## 开通 COS

当前实现腾讯云 COS；不支持的 provider 会明确报错。OSS 适配器尚未实现。

在后端 `uniclub-backend/.env` 填写以下配置并重启后端，真实值只放服务器环境变量或私有 `.env`：

```dotenv
OBJECT_STORAGE_PROVIDER=cos
COS_BUCKET=
COS_REGION=
COS_SECRET_ID=
COS_SECRET_KEY=
```

`COS_BUCKET` 填完整桶名（带 APPID 后缀），`COS_REGION` 填桶所在地域，例如 `ap-guangzhou`。使用权限受限的 CAM 子账号凭据；长期密钥不得填入前端 `VITE_*`、浏览器、源码、测试或文档。后端使用长期凭据向 STS 换取短期上传授权。未配置时前端提示上传尚未开通；收集期管理仍可使用，不会生成假提交。

### 桶与权限

1. 桶保持**私有读写**，不要开放匿名读写。正式材料服务端复制时显式设为 private；小文件暂存对象继承桶的默认私有权限。
2. 后端 COS 的 CAM 权限限制到目标桶 `quantification/*` 下，覆盖 `cos:PutObject`、`cos:HeadObject`、`cos:GetObject`、`cos:DeleteObject`、`cos:InitiateMultipartUpload`、`cos:ListParts`、`cos:CompleteMultipartUpload`、`cos:AbortMultipartUpload`。复制需要源对象读取和目标对象写入权限。签发 STS 的授权属于独立服务，应按账号的 STS 授权方式配置，不能沿用 COS 桶 resource；结合当前账号的 CAM 控制台验证签发权限和显式 private ACL 的配置权限。不要授予管理整个账号的权限。参见 [COS API 授权指引](https://cloud.tencent.com/document/product/436/31923)。
3. 浏览器 STS 策略由后端生成，1800 秒，仅允许单个会话的完整暂存 key 执行 `cos:PutObject` / `cos:UploadPart`；不给读取、列桶、改 ACL、删除或写正式目录的权限。分片初始化、分片列表、完成与中止由后端执行。
4. 配置桶 CORS，AllowedOrigins 只列真实网站 Origin（开发可加 `http://localhost:8081`、`http://127.0.0.1:8081`）；允许 PUT；允许请求头 `Authorization`、`Content-Type`、`x-cos-security-token`；暴露 `ETag`。浏览器会自动发预检请求，必须能正确响应。不要把所有网站 Origin 都开放。
5. 开启“中止未完成分片上传”的生命周期规则，例如 1 天。它处理初始化响应丢失等没有完整上传记录的云端分片。可额外设置仅针对暂存目录的对象过期兜底，但其有效期必须长于上传会话和凭证有效期。**不要给正式 `submitted` 目录设置自动过期规则。**

如账号对上传时设置 ACL 做单独权限校验，还需在同一对象前缀授权后端 `cos:PutObjectACL`；浏览器不授予此权限。[对象 ACL 授权说明](https://cloud.tencent.com/document/product/436/7748)

上传实现依据：[腾讯云 Web 直传实践](https://cloud.tencent.com/document/product/436/109014)、[上传对象说明](https://cloud.tencent.com/document/product/436/64960)。配置后须用实际桶复验；本地模拟存储测试不能证明云端 IAM、CORS、计费和网络已经正确。

### 数据与对象布局

MongoDB 只保存收集期、当前提交和上传会话，ZIP 不存数据库：

```text
QuantificationCollection：标题、说明、时间、状态、创建管理员
QuantificationSubmission：collectionId + user 唯一，文件元数据、storageKey、版本、提交时间
QuantificationUpload：上传会话、暂存/正式 key、分片 ID、确认租约、清理记录

quantification/{collectionId}/{userId}/staging/{uploadId}.zip
quantification/{collectionId}/{userId}/submitted/{confirmationId}.zip
```

首次初始化上传会等待当前提交唯一索引就绪。确认使用版本比较更新，防止同一账号同时提交互相覆盖。每次确认租约使用新正式 key，避免失效的慢请求覆盖另一请求确认的文件；提交前再次校验会话有效期并续期当前确认租约，清理占用时不能提交。正式对象确认前旧文件保持有效。过期后迟到的复制会安排再次清理。

确认先核对对象大小、类型、ETag，并检查 ZIP 签名与目录范围；范围读取和服务端复制绑定被检查的 ETag，再更新提交元数据。不会解压学生文件；该检查不等于病毒扫描、完整 CRC 验证或逐条验证所有压缩条目。下载后的材料应由实际业务接收者按需要检查。

上传会话有效期 2 小时。过期授权不能继续签发，后台每 15 分钟处理到期暂存/旧文件/失败复制，跳过当前有效提交指向的对象。清理等待临时凭证过期，失败保留记录重试；管理页有手动清理入口。会话不使用 Mongo TTL 删除，避免尚未清理的 key 丢失。

### 下载

学生仅能下载自己的 submissionId；管理员验证权限后可按 submissionId 下载。接口不给任意对象 key 签名。签名链接 5 分钟有效，响应禁止缓存；链接本身持有下载权限，不应公开转发。

ZIP 从浏览器直传 COS、下载直接来自 COS，500MB 文件不经过 Node 或 3Mbps 网站服务器中转。仍需承担 COS 存储、请求和下载流量费用。

## 接口

所有接口要求现有 JWT；管理接口额外要求 `requireAdmin`。

| 角色 | 方法与路径 | 用途 |
| --- | --- | --- |
| 已登录 | GET /api/quantification/collections | 非草稿收集期、存储状态、文件限制 |
| 已登录 | GET /api/quantification/access | 数据库中的管理权限 |
| 学生 | GET /api/quantification/collections/:id/me | 自己的当前提交与待确认会话 |
| 学生 | POST /api/quantification/collections/:id/uploads | 初始化，仅接收文件名、大小、MIME |
| 所有者 | POST /api/quantification/uploads/:id/credentials | 刷新单 key 临时授权 |
| 所有者 | GET /api/quantification/uploads/:id/parts | 已上传分片 |
| 所有者 | POST /api/quantification/uploads/:id/complete | 服务端完成并确认，空请求体 |
| 所有者 | POST /api/quantification/uploads/:id/abort | 取消未确认上传，空请求体 |
| 所有者 | GET /api/quantification/submissions/:id/download | 自己的短期下载链接 |
| 管理员 | GET/POST /api/admin/quantification/collections | 查询/新建收集期 |
| 管理员 | PATCH /api/admin/quantification/collections/:id | 编辑收集期 |
| 管理员 | GET /api/admin/quantification/collections/:id/submissions | 真实名单、统计、搜索、筛选、排序、分页 |
| 管理员 | GET /api/admin/quantification/submissions/:id/download | 单份下载 |
| 管理员 | POST /api/admin/quantification/downloads | 1–50 个 submissionId，逐文件结果 |
| 管理员 | POST /api/admin/quantification/cleanup | 到期上传清理 |

初始化按账号每小时 12 次、刷新凭证每小时 120 次限流。接口错误使用中文且不回传 SDK 内部密钥信息。

## 验证边界

后端测试：`cd uniclub-backend && npm test`。新增量化测试的数据库/存储边界使用内存替身；测试 Express、JWT、权限、状态、ZIP 检查、版本更新、清理和 COS 请求约束。

浏览器验收另外使用新生成的隔离 MongoDB、真实模型/业务 API/JWT，以及模拟对象存储。它实际传输了 ZIP 和 20MiB 以上的分片文件，并核对下载文件；隔离数据库退出时删除，没有向真实班级写入样例。

实际 COS、500MiB 完整上传、长期凭证刷新、断网恢复、真实移动设备、云端部署仍需在配置真实云资源后验收。不得据此称已完成线上部署或真实 COS 联调。
