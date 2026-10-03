# 下一轮具体任务

更新：2026-10-01。实际项目根：`/Users/alexmason/Desktop/uniclub-main`。

**本轮已暂停业务开发，只做交接。新对话先读 [CODEX_HANDOFF.md](/Users/alexmason/Desktop/uniclub-main/CODEX_HANDOFF.md)，核对当前代码，再按用户指示继续。以下任务尚未执行。**

## 1. 先统一启动端口并修复监听失败提示

### 当前进度

- 根标准启动、Vite proxy 及实际运行服务已经使用 **5050 / 8081**。
- 后端私有 .env 仍写 PORT=5000，根 .env.example 仍写旧 VITE_API_URL=5000。
- Windows start-dev.ps1 直接启动后端并操作旧 5000；check-ports.ps1 / stop-dev.ps1 同样旧端口，存在 API / proxy 不匹配。
- index.js 的 app.listen 回调在监听失败时直接读取 server.address().port；本轮 listen EPERM 触发 null TypeError，掩盖原错误。
- 本轮 typecheck、lint、后端 123 测试通过；Windows 原脚本仍未实际验收。

### 相关文件

- [scripts/start-backend.js](/Users/alexmason/Desktop/uniclub-main/scripts/start-backend.js)
- [scripts/start-dev.ps1](/Users/alexmason/Desktop/uniclub-main/scripts/start-dev.ps1)
- [scripts/check-ports.ps1](/Users/alexmason/Desktop/uniclub-main/scripts/check-ports.ps1)
- [scripts/stop-dev.ps1](/Users/alexmason/Desktop/uniclub-main/scripts/stop-dev.ps1)
- [.env.example](/Users/alexmason/Desktop/uniclub-main/.env.example)
- [vite.config.ts](/Users/alexmason/Desktop/uniclub-main/vite.config.ts)
- [uniclub-backend/index.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/index.js)
- [startup.test.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/test/startup.test.js)

### 具体工作

1. 统一默认 API 5050，保留显式 PORT / proxy target 的覆盖逻辑；Windows wrapper 与 Node wrapper 使用同一约定。
2. 修正公开示例 / 运行说明；核对私有 PORT 时保留所有密钥，不自动重写整个 .env。
3. 让监听失败显示原始 EADDRINUSE / EPERM 等错误并正确退出；成功后再读实际地址。
4. 扩充必要启动测试，覆盖默认 / 自定义端口及监听失败。
5. Windows 停止脚本只停止目标项目服务，不停止所有 Node；如无法取得 Windows 环境，明确未验收范围。

### 验收

- 根 npm run dev 的 /api/health 经 8081 代理返回正常。
- 自定义 API 端口与前端 target 一致；端口占用 / 禁止监听无 null TypeError。
- 当前 TypeScript、ESLint、123 项现有测试继续通过，新增启动场景通过。
- 原 Mongo dbpath 和真实数据保持；不为验证启动空库或覆盖班级数据。

## 2. 配置真实私有 COS，完成量化上传联调

### 当前进度

学生页 / 管理页、Model、API、COS adapter、确认 / 清理并发保护已完成。已有真实 Chrome + 隔离 Mongo / JWT 验收，但 COS 为模拟存储。**实际桶、长期凭据、IAM、STS、CORS 尚未配置 / 验证。**

这一步需要持有人提供真实云资源配置；缺少配置时保留“未开通”状态，不能生成假提交。详见 [docs/quantification.md](/Users/alexmason/Desktop/uniclub-main/docs/quantification.md)。

### 相关文件

- [CosStorageAdapter.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/services/storage/CosStorageAdapter.js)
- [storage/index.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/services/storage/index.js)
- [QuantificationService.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/services/QuantificationService.js)
- [QuantificationRepository.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/services/QuantificationRepository.js)
- [quantificationPolicy.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/utils/quantificationPolicy.js)
- [quantificationRouter.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/routes/quantificationRouter.js)
- [quantificationUpload.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/quantificationUpload.ts)
- [QuantificationPage.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/QuantificationPage.tsx)
- [AdminQuantification.tsx](/Users/alexmason/Desktop/uniclub-main/src/pages/admin/AdminQuantification.tsx)
- [quantification.test.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/test/quantification.test.js)

### 具体工作与顺序

1. 配置 OBJECT_STORAGE_PROVIDER=cos、COS_BUCKET / REGION / SECRET_ID / SECRET_KEY，仅放后端私有环境。
2. 验证私有桶、限定前缀 CAM、STS 签发权限、复制时显式 private ACL、网站 Origin CORS / ETag 暴露、未完成分片生命周期。
3. 使用独立测试账号 / 收集期 / 对象前缀，避免在真实班级名单中写演示数据。
4. 小 ZIP 单上传 → >20MiB 分片 → 完整 500MiB → >30 分钟凭据刷新，依次验证。
5. 测试断网、重试、取消、页面退出、上传完成后刷新再确认、重复点击和同账号并发重提。
6. 验证下载文件 SHA256、学生跨用户访问拒绝、普通账号管理拒绝、1–50 项批量逐文件结果及多文件下载提示。
7. 验证过期 / 失败 / 迟到复制清理；必要时只针对可复现云端问题改 adapter / service，不重写现有并发机制。

### 验收

- 云端真实对象保持私有，长期密钥不进入前端或日志；STS 只能写单个暂存 key。
- 非 ZIP / 超限文件拒绝；完整 524288000 字节 ZIP 可传，上传流量不由 Node 中转。
- 上传成功后才更新 submission；取消 / 失败保留旧材料；并发只留正确当前版本。
- 短期签名下载正确、过期失效；不能给任意 key 或他人 submission 签名。
- 清理不会删除当前有效材料；失败能重试，不因 TTL 丢失记录。
- 记录实际 IAM / CORS / 时间跨度 / 文件大小 / 设备 / 网络结果，不把模拟测试写成云端通过。
- 320 / 375 / 414 / 768 / 1280 / 1440px 实际浏览器检查关键路径、焦点、触屏、深浅色和 reduced-motion；提供新截图。

### 注意

- OSS 尚无 adapter。若最终选择 OSS，先重新明确 provider，再单独实现，不只改字符串。
- 网页内分片重试已支持；跨页面文件句柄续传未实现，不能当作现有承诺。
- ZIP 目录边界检查不等于病毒 / 全量 CRC 检查。
- 收集期草稿 / 开放 / 关闭、开始 / 截止规则保持；统计基于 EnrolledUser，包括未注册者。

## 3. 准备并验证 Windows 云服务器部署

### 当前进度

代码可本地运行，存在 Vercel 配置和旧 Windows 脚本；**没有验证真实 Windows 服务器已部署当前代码**。用户计划是服务器保存账号 / Mongo 元数据、对象存储保存文件。截图不是部署成功证据。

### 相关文件 / 配置

- [package.json](/Users/alexmason/Desktop/uniclub-main/package.json) 与两个 lockfile
- [vendor/README.md](/Users/alexmason/Desktop/uniclub-main/vendor/README.md) 及 GSAP tarball
- [uniclub-backend/index.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/index.js)
- [vite.config.ts](/Users/alexmason/Desktop/uniclub-main/vite.config.ts)、[axios.ts](/Users/alexmason/Desktop/uniclub-main/src/lib/axios.ts)
- [rateLimit.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/middleware/rateLimit.js)
- [vercel.json](/Users/alexmason/Desktop/uniclub-main/vercel.json)
- [midnightCuration.js](/Users/alexmason/Desktop/uniclub-main/uniclub-backend/jobs/midnightCuration.js)
- 源文件各内容 Router、/uploads 静态目录、Mongo / Windows 服务和反向代理配置

### 具体工作

1. 先核对真实服务器系统、资源、访问方式、域名 / HTTPS 与现有数据备份；凭据不写交接文档。
2. 生产构建静态 dist，配置同源 /api 和必要 /uploads 反向代理与 SPA 回退；避免混合 VITE_API_URL 与硬编码相对 fetch 造成生产请求失败。
3. 使用受守护的 Node 生产进程、Mongo 服务、重启自启和稳定日志，不使用 Vite dev server 上线。
4. 把 CORS 的 vercel.app 子串匹配改为所需精确 Origin 规则，核对反向代理信任与 authLimit 的真实客户端 IP。
5. 明确全班内容的私有范围，检查匿名内容 GET / search / featured / curation 和旧静态文件；按明确规则补权限与测试。
6. 为 Mongo 配置访问控制、端口边界、备份及实际恢复演练；保留密码 hash / tokenVersion，不保存明文密码。
7. 明确量化清理的常驻调度；确认 AI 是否运行及中国时区计划，避免旧 Vercel cron 与 Windows daemon 重复执行。
8. 普通头像 / 相册 / 资源迁移对象存储作为独立工作，不把量化上线误称全站文件已迁移。

### 验收

- 生产 build、typecheck、lint、后端测试通过；服务器真实域名深链 /auth、/quantification、/admin/quantification 正常。
- 真实登录、角色 / 审核、名单、量化提交 / 下载可用；公开 / 私有范围与规则一致。
- 服务器重启后服务恢复；数据库备份能恢复到隔离环境。
- 未核验的云安全配置、设备或网络如实列出；无实际部署权限 / 配置时交付可审阅部署配置和未完成清单。

## 4. 建立可追踪源码基线与可迁移验收记录

### 当前进度

真实根没有 .git，只有外部工作目录的 manifests / backups / reports；无法精确列出与 HEAD 的未提交差异。CODEX_HANDOFF 已列出可确认改动。

### 具体工作 / 验收

- 在用户要求建立版本管理时，先备份当前实际源代码，再初始化 / 连接正确仓库；不要自动推送或用旧备份覆盖当前树。
- 包含两个 lockfile、vendor、public/fonts、设计与量化文档、测试；排除私有 .env、Mongo 数据、node_modules、dist 和临时日志。
- 将仍有用的浏览器验收脚本 / 报告整理为可迁移、无凭据的项目内资料，避免下一台电脑只能依赖旧绝对路径。
- 使用实际 git status / diff 建立基线后，更新交接文档的非 Git 限制。不能在尚无仓库时声称“无未提交改动”。

## 暂不启动的业务

“收班费”维持明确待开放。当前没有金额 / 周期 / 对象、支付渠道、角色、凭证、退款、对账或通知需求，不新建假支付 / 假账单；下一轮若用户指定开发，应先确定这些业务规则。

## 每次继续后的完成要求

- 聚焦用户授权的任务，修改前列相关文件；保留 CODEX_HANDOFF 第 10 节业务与设计约束。
- 最少跑 typecheck、lint、相关后端测试；涉及交付跑生产 build；UI / 云功能需真实浏览器 / 实际接口复验。
- 测试数据与真实班级隔离；不得顺带运行导入、密码轮换、AI 策展或全库清理。
- 更新本文件的进度和实际验收，分清实现、模拟验证、真实 COS 和上线四种状态。



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

## 最新状态：班费功能已开放（2026-10-01）

- 学生“功能 → 交班费”：`/fees`；后台“班费管理”：`/admin/fees`。
- 按最新需求实现单例付款二维码、必填支付截图、可选200字备注、待确认修改、人工确认与只读锁定；图片存MongoDB Binary，不使用COS。
- 已运行 `fees:init`、build/typecheck、ClassHub范围lint；完整测试201/201，真实MongoDB集成13/13。浏览器检查和390px上下布局通过。最终全目录lint受独立dsh-niulai-pet-master的4错误4警告影响，未改该子项目；排除该目录后ClassHub lint通过。
- 正式数据库用户50、名单49、班费配置1、缴费提交0。真实配置中已有付款码；独立测试环境已清理，未写测试缴费记录到正式库。
- 当前无需再迁移、增加环境变量或重启。管理员请检查付款码；实际到账由管理员人工核对，代码不会自动确认。
- 下一次维护从 `docs/fees.md` 查看完整文件/API清单与限制，继续保留当前站内认证和量化材料COS流程。
