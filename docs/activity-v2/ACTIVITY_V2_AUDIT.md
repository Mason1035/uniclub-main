# ClassHub Activities V2 业务与工程审计

原审计日期：2026-10-08；云接入补充：2026-10-09（北京时间）。原本地审计/隔离测试阶段没有生产数据库或云部署操作，历史业务证据保留。2026-10-09在用户确认范围内完成备份、仅后端服务端鉴权补丁/secret配置、两个SCF部署、活动PutObject IAM及CORS；真实云受控验收与隔离DB浏览器确认发布通过。本文区分升级前实现、本地证据、已完成云接入和未完成的全量生产条件。

**云集成受控实网验收：PASS；活动V2全量发布：NOT READY。** 鉴权12 checks、媒体46 checks、正式XHR→真实COS→确认服务→独立Mongo相册/封面发布及浏览器10MiB PNG验收通过；最终边界报告6 checks PASS。300秒签名到期及GET续签PASS（旧403、新206且哈希/ETag一致），临时运行角色凭据自然轮换/续期仍NOT TESTED；活动V2全量release未部署，未主动生产迁移。

## 1. 审计范围与真实技术栈

| 层次 | 本地实际依赖版本/实现 | 代码依据 |
| --- | --- | --- |
| 前端 | React 18.3.1、TypeScript 5.9.3、Vite 5.4.19 | 根目录 package.json、node_modules 包元数据 |
| 路由 | React Router 6.27.0；集中配置与 ContentRoute 校验 | src/routeConfig.tsx、src/components/ContentRoute.tsx |
| 请求/界面 | Axios、TanStack Query、现有后台组件、editorial 样式、Radix Dialog | src/lib/axios.ts、src/pages/admin/components.tsx、src/styles/editorial.css |
| 后端 | Express 5.1.0、CommonJS；本地验证 Node v26.7.0 | uniclub-backend/index.js、package.json |
| 数据 | MongoDB + Mongoose 8.15.1；无 SQL 表/ORM | uniclub-backend/models/ |
| 图片处理 | sharp 0.34.4，已有依赖 | 头像/班费实现及 activityMediaPolicy.js |
| COS | cos-nodejs-sdk-v5 3.0.0、qcloud-cos-sts 3.1.3，已有 SCF 存储适配器 | services/storage/、QuantificationStorageSettings.js |
| 迁移 | 项目已有导出函数 + 可独立运行的增量脚本；没有集中迁移框架 | uniclub-backend/migrations/、scripts/initializeFees.js |
| 部署 | 仓库包含 ECS/Nginx 发布脚本、Docker Mongo 配置、前端构建与 SEO 生成 | deploy/ecs/、scripts/build-seo.mjs |

部署脚本及本机 Mongo 启动脚本没有配置 replica set。因此不能将多文档事务作为升级的默认运行条件。未远程核对生产 Mongo 版本、拓扑或实际部署版本；以上版本是本地事实。

原有仓库已有大量其他功能的改动，本轮保留这些改动。活动升级扩展现有 Event、User、EnrolledUser、COS/SCF 架构，不建立第二套认证、班级名单或存储桶。

## 2. 升级前的完整业务地图

| 问题 | 升级前实际情况 |
| --- | --- |
| 1. 活动字段 | Event 包含标题、介绍、开始/结束时间、举办形式、地址/房间/线上链接/坐标、类型、技术分类、人数限制、RSVP 截止/外部链接、组织者、讲者、imageUrl、附件、准备事项、标签、技能等级、状态、互动/报名/签到计数、候补/提醒/重复举办设置和时间戳。标题最多 200 字、介绍最多 2000 字。 |
| 2. 活动状态 | draft、published、cancelled、completed；没有 archived 或软删除字段。 |
| 3. 报名保存位置 | 独立 EventRSVP 集合，关联 Event ObjectId 和 User ObjectId；有 event+user 唯一索引。 |
| 4. 报名审核 | 没有审核流程；going、maybe、not_going、waitlist 表示参与意向/候补，不等同管理员审核。 |
| 5. 管理员可见 | /api/admin/events 分页基本列表；界面只能编辑或删除，不能从标题进入独立完整预览；没有按人查询的审核/未报名名单。 |
| 6. 学生可见 | published 详情、自己的 RSVP；登录用户还可调用 attendees 获取他人完整 RSVP 记录，包括不应外露的内部字段。 |
| 7. 活动结束 | 不自动归档；前台日程用时间排除结束 Event，往期展示来自另一 PastEvent 集合。completed Event 也不在默认 published 列表中。 |
| 8. 图片位置 | Event 封面只有 imageUrl 字符串；PastEvent 海报和相册为 MongoDB 内嵌 Base64。量化材料另有既有 COS/SCF 上传流程。 |
| 9. 多图 | Event 没有相册；PastEvent 有独立 gallery 数组。 |
| 10. 历史入口 | 有 /past-events/:id、/admin/gallery，但历史资料由管理员另建，与 Event/报名没有稳定关联。 |
| 11. 详情展示 | /event/:id 显示完整文本、封面、日期地点、报名和互动；没有审核、总结或 Event 相册。 |
| 12. 权限问题 | 普通登录用户可创建草稿；组织者可编辑/删除；报名缺真实班级资格/发布状态/截止/结束检查；attendees 权限过宽；calendar 可读未公开活动；部分推荐/互动/收藏入口缺活动可见性守卫。 |
| 13. 删除级联 | 先物理删除 Event，再 deleteMany 物理删除 RSVP；无跨文档原子性，也不符合长期保存目标。 |
| 14. 日期计算 | 前端判断是否结束；数据库 status 不随日期自动更新，不能依靠 completed 实现往期回溯。 |
| 15. 历史类型 | Event 模型实际枚举为 Workshop、Masterclass、Tutorial、Meetup、Hackathon、Seminar、Social。原本地审计未查询生产活动分类，不能宣称某种历史值实际存在。旧 PastEvent 的分类另含 Orientation、Other。 |

### 原模型中与活动无关但必须兼容的内容

Event 的外部报名链接、讲者、附件、标签、重复活动和互动字段保留，不因本轮升级删除。旧 PastEvent ID、海报、相册及独立管理入口继续存在。历史 Base64 图片未迁移到 COS，也未被清理。

## 3. Current State → Problems → Target State

| 原实现/问题 | 已落地目标与处理 | 验证/边界 |
| --- | --- | --- |
| 后台标题不能预览，编辑混杂详情 | 独立 /admin/events/:id 详情；基本编辑、报名、相册、总结分开 | 前端验证见 TEST_REPORT |
| 旧类型在多个组件复制 | shared/activity-v2.json 统一五类；保留旧标签、未知值兼容读取；新建只允许新类型 | 后端真实 Mongo + policy 测试 PASS |
| count→upsert 并发超额 | Event 嵌入当前报名账本；状态、审批记录、人数检查和计数由同一文档版本 CAS 提交 | 真实 standalone Mongo 并发批准 PASS |
| 普通成员直接创建/组织者编辑 | 创建、编辑、隐藏、审核、总结、相册均核验数据库管理员权限 | 假管理员 JWT、普通成员请求 PASS |
| 不核对真实班级成员 | User.isEnrolled 且 uniqueId 仍在 EnrolledUser；平台管理员可管理但不能冒充班级成员报名 | 离班残留 isEnrolled、管理员名单案例 PASS |
| 取消报名/删除活动销毁记录 | CANCELLED 保留原 ID、时间和历史；活动 DELETE 改软隐藏，支持恢复 | 保留/恢复案例 PASS |
| 被拒绝/取消被当作未报名 | UNREGISTERED 仅指当前名单中没有任何当前账本记录的人；拒绝、取消独立显示 | 同名、拒绝、管理员、未注册名单案例 PASS |
| 旧计数写 engagement.rsvpCount，模型实际在顶层 | 更新顶层 rsvpCount；另维护 approvedCount，人数上限只约束 APPROVED | 真实 Mongo 计数/容量案例 PASS |
| 已结束 Event 消失 | published 结束活动及已结束 completed/archived 保留前台读取；按时间/类型/年份分页 | 结束、总结、历史报名案例 PASS |
| 手填封面 URL，Event 没相册 | 管理员初始化上传 → 精确 COS PUT → 内容核验 → 原子发布清单；相册与活动同 ID | 本地媒体验证与真实云边界见 COS/TEST_REPORT |
| DB/COS 删除无统一事务 | Event.mediaRefs + mediaVersion 是发布真相；删除加入 tombstone，保留 COS 和媒体记录；不靠物理删除补偿 | 无自动历史清理、无 TTL、无云端破坏操作 |
| 私密 RSVP/原始账本可能由旁路 API 泄露 | DTO 白名单、默认 select:false；活动限定的推荐/评论/互动/收藏守卫 | activityReadAccess 与 activityPreview 真实 HTTP/序列化 PASS |
| PastEvent limit 无 page | 原接口保留 data 字段，新增 page/skip/pagination，旧资料仍可全部访问 | 仍为独立历史资料，不伪造与 Event 的一一关联 |

## 4. V2 数据来源与状态规则

### 活动、时间与报名分别建模

- 活动状态仍使用已有小写值，扩展 archived；不会把所有旧 status 强制重写。
- phase 按开始/结束时间实时计算：UPCOMING、ONGOING、ENDED，不另保存可能过期的时间状态。
- 报名状态：PENDING、APPROVED、REJECTED、CANCELLED，与活动是否结束完全独立。
- 活动发布且未结束、未超过 rsvpDeadline 才能申请；待审核不占批准名额。
- 批准只在仍未结束的 published 活动进行；拒绝可以保留历史审核结果。
- 取消可在 published 且未结束时进行，即使新申请截止时间已过；结束后冻结学生取消。
- REJECTED/CANCELLED 在报名开放时可以重新申请，沿用唯一报名 ID，版本递增并追加历史。
- archived 用于已开展结束、可公开的档案；草稿/取消活动不能通过专用归档接口公开。DELETE 是隐藏，不是归档，不物理删除；恢复后沿用原 ID/状态。

### 报名账本与旧 RSVP

Event.registrations 是 V2 当前状态与审核历史的唯一来源；registrationVersion 串行化报名、审核、基本属性、容量、归档/隐藏等相关更新。原 EventRSVP 只读保留，不双写两个可能冲突的当前状态。

兼容读取/增量初始化保留原记录 ID、用户 ID、创建/更新时间和 legacyStatus：

| 原状态 | V2 兼容结果 | 保留的语义 |
| --- | --- | --- |
| going | APPROVED | 旧系统的直接参加/隐式接受，不补造管理员审核 |
| maybe | PENDING | 旧参与意向；通过 legacyStatus 仍可区分 |
| waitlist | PENDING | 旧候补；不自动提名为已批准 |
| not_going | CANCELLED | 旧“不参加”意向；保留原标签，不声称发生过新系统取消动作 |
| 其他旧值 | PENDING | 保留 legacyStatus，需管理员核对，不静默丢弃 |

历史导入 reviewedBy/reviewedAt 为 null。导入不会重写旧 RSVP 的 notes、饮食/无障碍字段或状态。无法从已删除账号还原姓名时显示明确历史占位文字，不伪造身份。新报名保留业务必要姓名快照；离班/账号移除不会删除活动档案。

### 成员集合与统计

班级成员来源为现有 EnrolledUser。以稳定 User ObjectId 匹配申请；名单中的旧未注册成员使用 roster ID 展示，userId 为 null，不能伪造用户 ID。属于班级的管理员参与名单计算；不属于班级的平台管理员不计入“未报名”。

registered 包含 PENDING/APPROVED/REJECTED，不包含 CANCELLED；未报名只计算当前班级中没有记录的成员。离班历史记录继续列出并标 currentMember=false，故历史报名统计不必等于当前班级人数。名单分页只返回姓名、头像接口、状态和已有内部学号，禁止按姓名去重或返回邮箱/电话。

## 5. 类型与永久链接兼容

新类型为 LEAGUE_ACTIVITY/TEAM_BUILDING/CLASS_MEETING/GROUP_DISCUSSION/OTHER，对应团活动、团建、班会、小组交流、其他。不会把 Workshop 任意映射为团活动。

已有值仍按旧值显示；编辑不改类型时保留原值，即使是未知历史类型。管理员显式改为新类型时，首次原分类保存为 legacyEventType，报名、封面、相册和链接均不重建。

旧 /event/:id 永久链接保留，新增 /events/:id 别名；旧 /past-events/:id 保留。活动标题变化不改变 ObjectId 或媒体路径。

## 6. COS/SCF 审计与安全边界

复用现有配置源、两个 SCF 和存储桶 lianghuacailiao-2026-1306497854，Region ap-guangzhou。新对象为 activity/{eventId}/{cover|photos}/{mediaId}.{jpg|png|webp}，缩略图为同目录 {mediaId}-thumb.webp。原 quantification/ 目录和 ZIP 校验独立保留，不新增桶。

升级前 SCF 角色凭证桥与下载/列举入口缺调用者鉴权，存在宽范围签名风险。新增源码支持后端专用 CLASSHUB_SCF_AUTH_SECRET、固定桶/Region、business 与 Prefix 校验；活动业务要求至少 32 字符密钥及 secured:true 响应，缺失时拒绝启用，不能回退旧开放接口。

SCF 的临时运行角色凭据留在服务端，ClassHub 后端签发精确对象、私有 ACL、禁止覆盖、MIME、上传 nonce、大小的 300 秒 PUT URL；浏览器不获得可复用的角色凭据对象、SecretKey 或共享密钥，也不将 ClassHub JWT 发给 COS。签名 URL 会包含 COS 验签所需的 q-ak 和 session token 等字段，但客户端不能据此为其他对象生成签名。此实现不是“每个业务另建一套 STS 服务”；2026-10-09活动上传IAM已核验为仅关联QuantificationUploadRole的PutObject activity/*，下载角色保留原QcloudCOSReadOnlyAccess；真实凭据轮换/续期未测。

完成上传检查 HEAD 大小/MIME/ETag/nonce、实际字节、文件签名及 sharp 全解码。支持单张 JPEG/PNG/WebP；不支持 HEIC、GIF、动画图片或仅改扩展名的文件。单图 10MiB、像素 4000 万以内、每活动最多 200 张当前照片；缩略图最长 640×480，去除 EXIF。原图保留原始字节及可能存在的元数据，只通过班级授权和短期签名读取。

图片 READY 仅表示已核验；必须进入同 Event 的 mediaRefs 才发布。mediaVersion CAS 同时改变相册清单/封面/墓碑。DB 核验成功但关联失败留下可追踪记录，可以重新确认；不会显示假成功引用。替换/删除封面保留旧 imageUrl，但 legacyCoverHidden 阻止删除后旧封面突然重新出现。删除照片不删除 COS，对应 tombstone 防止迟到确认重新发布已删照片。

**兼容边界：** 旧 PastEvent Base64 海报/相册保留原公开读取语义；未在本轮批量改成私有 COS 对象。媒体软删除保留恢复资料，但本轮没有照片一键恢复或永久删除 API。失败/过期上传会话没有 TTL 清理，也没有自动清理历史对象政策；后续云端清理需另行确认，不能把未确认对象记录直接丢掉。

**真实COS/SCF/IAM/CORS受控验收：PASS。** 2026-10-09已完成受控备份、服务端鉴权接入、两个SCF部署、用户确认的仅活动PutObject IAM、限定来源CORS。鉴权12 checks PASS，媒体46 checks PASS（三种原图及缩略图、长度+1拒绝/正确长度成功、覆盖409、匿名GET/HEAD403、元数据与哈希、旧ZIP Range206）；正式前端XHR到真实COS，经现有确认服务向独立Mongo `classhub_activity_cloud_browser_20261009` 发布引用，管理员与成员相册显示正常。合法10MiB PNG实网PUT/哈希/解码与浏览器保存PASS，超限10MiB+1本地400；封面完整保存，独立DB Media3 READY（PHOTO2/COVER1，fileSize2476/10485760/2476，mediaVersion3）。最终边界报告6 checks PASS（COS Date06:28:01Z，旧300秒签名403/新GET206，哈希/ETag一致）；13个新私有测试对象保留清单，不删除历史对象。测试写入只使用新随机活动Key，未改写或清理历史对象。300秒签名到期及GET续签PASS（旧403、新206且哈希/ETag一致），临时运行角色凭据自然轮换/续期仍NOT TESTED；完整边界见ACTIVITY_V2_COS.md与TEST_REPORT第10节。

## 7. 迁移、回滚与生产操作

20261008_activity_v2.js 默认 DRY_RUN，要求显式 ACTIVITY_MIGRATION_MONGO_URI，不加载生产 .env。--apply 才写；远程连接还需 --allow-remote，但该开关不代替用户的生产确认。

迁移涉及 Event 增量字段/索引和旧 RSVP 的兼容导入；原 EventRSVP、User、EnrolledUser、PastEvent 和原封面/分类不删除不重写。新 ActivityMedia 集合存会话和对象元数据，不存图片字节。应用写操作对尚未初始化的 Event 有幂等初始化路径，因此不能在确认前将新代码接到生产后端进行测试。

迁移前检查全部候选活动的重复旧申请和账本安全上限；账本最多 2000 成员、JSON 大小 6MiB，达到上限明确拒绝，不截断历史。迁移前后核对 Event 数、旧 RSVP 数、旧封面引用数，以及分类/封面和完整旧 RSVP 的 SHA-256 摘要。原 updatedAt 使用 timestamps:false 保留。

回滚只对有迁移备份且 registrationVersion=0 的未使用导入账本执行：恢复原 rsvpCount 和 approvedCount 的值/是否存在，移除新增兼容账本，保留索引、旧报名、媒体和封面。存在 V2 新建活动或任何 V2 报名/编辑写入时整体拒绝回滚，避免“回滚成功但新档案丢失”。若检查后发生并发写，逐活动 CAS 会中止，可能形成部分未使用账本已回退的结果；原历史报名仍完整，需停止写入后核对，不可强制删字段。

正式生产活动迁移/全量部署前仍须报告备份、涉及集合、旧值/计数核对、写入冻结和恢复方案，并取得用户明确确认。2026-10-09已执行上述限定云接入；生产backend仅安装服务端鉴权两处补丁并配置secret，health200。**活动V2全量release未部署，未主动生产数据库迁移**；真实图片确认发布使用独立测试DB。

2026-10-09验收收尾：专用API5068正常exit0并drop测试DB，Mongo27186与Vite9188均exit0，测试端口全部释放。13个新私有云测试对象保留清单为 `/Users/alexmason/Documents/Codex/.classhub-cloud-20261009/retained-cloud-test-objects.json`，未删除历史对象；五张新增截图已归档到 `docs/activity-v2/screenshots/`。本地后端`.env`先备份 `local-backend.env.before-scf-auth` 再配置同一服务器SCFsecret（0600，不记录值），现有后端5050恢复且Mongo已连接、前端8081 health200，保留开发会话。

## 8. 已有后端证据与剩余验证

最终后端核心命令（当时的端口 27188 为新建的隔离 standalone Mongo）：

```sh
ACTIVITY_TEST_MONGO_URI=mongodb://127.0.0.1:27188 node --test uniclub-backend/test/activityPolicy.test.js uniclub-backend/test/activityMongo.integration.js
node --test --test-name-pattern='eventRouter' uniclub-backend/test/homePreview.test.js
node --test --test-name-pattern='event|activity' uniclub-backend/test/security.test.js
```

结果依次为 **27 PASS / 0 FAIL**、**2 PASS / 0 FAIL**、**25 PASS / 0 FAIL**。第一条包含真实模型、JWT、Express HTTP、并发容量、状态/权限、旧数据摘要、两种计数回滚分支和 activityReadAccess/activityPreview 的旁路授权与无账本序列化检查。第二/三条为活动限定的旧回归兼容检查。

随机测试数据库已删除，专用 Mongo 进程已停止，专用临时目录已清理；不能直接把已关闭端口当作现有测试环境。本节历史本地测试结果不包含真实腾讯云、生产用户或生产数据；2026-10-09新增真实云受控验收记录见第6节及TEST_REPORT第10节。完整媒体、浏览器、构建结果与明确未完成项，以 ACTIVITY_V2_TEST_REPORT.md 为准。
