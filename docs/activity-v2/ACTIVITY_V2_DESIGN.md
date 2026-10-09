# ClassHub Activities V2 业务与架构设计

日期：2026-10-09。范围：现有活动模块增量升级，保持现有 Header、字体、背景和数据体系。

## 1. 唯一业务架构

沿用 React/Router/TanStack Query/Tailwind、Express/Mongoose、现有 JWT/tokenVersion、数据库管理员判定与班级名册。没有第二套用户、活动或 COS 配置系统，没有新增依赖。

```text
活动列表 / 成员详情 / 后台独立详情
  ├─ activityApi → /api/events → ActivityService
  │                  └─ Event + 原 EventRSVP（兼容读取）
  │                     + User / EnrolledUser（真实名册）
  └─ activityUpload → ActivityMediaService
                      ├─ ActivityMedia（持久上传元数据）
                      ├─ Event.mediaRefs（唯一发布清单，CAS）
                      └─ 既有存储配置/COS SDK/受保护 SCF
                              └─ 精确签名 PUT，浏览器直传
```

原 EventService 是兼容门面；原 EventRSVP 不再承担 V2 写入。项目真实 MongoDB 为 standalone，所以报名和媒体发布通过 Event 单文档原子条件更新，不依赖副本集事务，不声称多文档天然事务。

## 2. 类型、生命周期、时间阶段

新建严格采用共享 activity-v2.json 的团活动、团建、班会、小组交流、其他。历史英文/未知类型按原值显示和编辑，不推断映射。管理员明确改为新分类时保存 legacyEventType，源分类证据保留。

生命周期：draft/published/cancelled/completed/archived；deletedAt 是软隐藏，区别于归档。

| 时间阶段 | 判断 |
| --- | --- |
| UPCOMING | now < startDate |
| ONGOING | startDate ≤ now < endDate |
| ENDED | now ≥ endDate |

普通成员可读条件：未隐藏，并且已发布；或 completed/archived 且已结束。草稿、取消、提前标记完成的未来活动不能通过列表、详情、日历、评论、收藏、精选/推荐、搜索绕过。“公开”是登录班级成员可见，不是互联网匿名公开。管理员可以编辑、发布、取消、结束后归档、隐藏和恢复。修改时间会更新阶段但不更改稳定 ID 或媒体。

## 3. 报名状态机

```text
无记录 ──申请──> PENDING ──批准──> APPROVED
                      └──拒绝──> REJECTED
PENDING / APPROVED ──本人取消──> CANCELLED
REJECTED / CANCELLED ──开放期间再申请──> PENDING
```

报名要求真实当前成员、published、未隐藏、未结束、未过报名截止。截止留空以结束为截止，不强制开始前 24 小时。尚未结束允许本人取消，即使报名截止已经过去；结束后不改历史报名。

当前 PENDING/APPROVED 重复申请幂等；拒绝/取消后再申请更新同一 userId 行、版本、历史。审批只接受 PENDING，相同结果重复审批幂等，旧版本冲突 409。批量至多 100 人，逐人返回成功/失败，不把部分失败称为全部成功。

行保存 ID、必要姓名快照、状态、创建/更新时间、审核人/时间、说明、版本与历史。离班历史仍可回溯，不复制邮箱/电话。旧 going→APPROVED，maybe/waitlist→PENDING，not_going→CANCELLED，保留 legacyStatus。旧审核时间/人缺失保持 null，不编造。

## 4. 名册与未报名

真实来源：User.isEnrolled 与 EnrolledUser.uniqueId 双重确认。班级管理员计入；不属于名册的平台管理员有管理权限但不计入班级池。未开通 User 的名册行仍显示未报名，不能审核。同名依稳定 ID 区分。

| 名单 | 语义 |
| --- | --- |
| UNREGISTERED | 当前名册中从未提交本活动申请 |
| PENDING | 已申请，等待审核 |
| APPROVED | 已通过，占名额 |
| REJECTED | 曾申请未通过，单独统计，不计入未报名 |
| CANCELLED | 曾取消，保留历史，不计入从未报名 |

已报名统计是存在非取消当前记录（含待审/通过/拒绝）；分别展示子项。管理员分页按状态/姓名搜索，并保留离班历史行。普通成员只能查看自己及总人数，不能查看全班审核或未报名名单。响应不含邮箱、电话、密码、JWT 或内部角色详情。

## 5. 并发容量

容量以 APPROVED 计，PENDING 不占；null 不限。ledger、approvedCount、rsvpCount、registrationVersion 在同一次 Event 更新中写入：读取当前版本→验证/计算→带版本 updateOne→冲突重新读取规则。多管理员/多进程都由 Mongo 单文档原子性保证。基础编辑（时间/状态/容量）也更新该版本；容量不能低于已通过数。

每活动最多 2000 行、ledger 约 6MiB，控制 Mongo 16MiB 文档风险；达到边界明确失败，不能丢历史。班级长期运行需要监测 ledger 大小，超出班级规模应另行迁移，不在本轮引入复杂分布式方案。

## 6. 媒体与失败恢复

ActivityMedia 会话状态 UPLOADING/READY/FAILED；READY 是字节已验证，不等于已公开。Event.mediaRefs 与 READY 交集才显示；coverMediaId 和封面清单原子更新；mediaVersion 防并发覆盖、mediaTombstones 防迟到确认复活。

原图 PUT 后仍需服务器 HEAD、精确长度/MIME/上传 nonce/ETag、If-Match 有界读、字节签名和 sharp 全图解码；生成独立私有 WebP 缩略图再 CAS 发布。缩略图/DB 失败没有错误显示引用。READY 未关联可以同一 ID 重试。封面保存授权时版本，旧会话不能覆盖新封面；冲突重新授权。

每活动公开 PHOTO 最多 200 张，数量与 CAS 同时验证；分页只签当前页、列表只取封面缩略图、大图点开加载。签名最长 300 秒，前端过期前刷新/图片错误重取。上传有进度/失败/重试，草稿失败保留已创建 ID，避免重复创建。

删除/替换只修改清单/tombstone 和审计，不删除 COS。审计失败不复活照片。旧 imageUrl 原值保留，新封面优先；替换/移除后 legacyCoverHidden 防旧封面意外回来。结束/归档/编辑不动 ID/Key；无对象自动过期删除。旧已签 GET URL 仍可能使用剩余 300 秒，不承诺即时撤销。失败/孤儿对象持久保留供只读盘点，永久清理另行批准。原图保留原始字节，可能包含 EXIF；缩略图去元数据。

存储唯一配置同一 Bucket lianghuacailiao-2026-1306497854 / ap-guangzhou。Key 为 activity/{eventId}/cover|photos/{mediaId}.jpg|png|webp，与 quantification/ 隔离。有任意保留 ActivityMedia 禁止换桶/地域；量化/活动默认共享配置操作锁，避免首次上传与换配置竞态。当前单进程配置文件管理保持；多进程动态配置需额外跨进程租约。

2026-10-09本地后端`.env`已受控备份 `local-backend.env.before-scf-auth` 后补充与服务器一致的SCF服务端secret，权限0600，不记录值；后端5050重启恢复并连接Mongo，前端8081 health200，保留现有开发会话。真实云验收专用5068/9188/27186已正常exit0，专用DB已删除、端口已释放；13个新私有云测试对象保留清单见COS/TEST_REPORT，历史对象未删除。

## 7. 鉴权与云端限制

JWT、tokenVersion、真实账号、名册每次独立后端校验。管理操作再次查数据库 isAdmin。前端只取单对象签名 PUT URL，不取 SecretKey 或 SCF secret。

升级前SCF开放凭证/下载签名；本轮加入CLASSHUB_SCF_AUTH_SECRET与固定资源/业务检查，活动拒绝旧开放契约。2026-10-09已先部署并验证受保护SCF，再按用户在执行时确认追加仅活动PutObject IAM、保存限定来源CORS。真实鉴权12 checks、媒体46 checks、正式前端XHR→COS→确认服务→独立Mongo发布/相册显示及合法10MiB PNG受控验收PASS。最终边界报告6 checks PASS，旧300秒签名403/新GET206且哈希/ETag一致；浏览器10MiB与封面保存通过，独立DB Media3 READY（PHOTO2/COVER1）。临时运行角色凭据自然轮换/续期仍NOT TESTED，GET续签不代表角色轮换。详见ACTIVITY_V2_COS.md与TEST_REPORT第10节；历史本地HTTP fixture记录保留。

## 8. 页面与长期历史

后台 /admin/events 标题进入 /admin/events/:id，概览/报名管理/活动相册/活动总结分 tab；基本编辑只管基本信息。前台 /events 分即将开始/正在进行/往期，年份/类型/关键词服务器分页，日历按月份范围；/events/:id 和旧 /event/:id 共用详情。描述/总结分区，相册复用现有图库，键盘方向键/Esc、触摸/缩放保留。

原独立 PastEvent、/past-events/:id、Base64 图片和旧后台相册保留，仅扩列表分页，不自动迁移 COS、不偷偷改变旧公开语义。新 V2 媒体按当前成员权限保护；旧档案私有化需另评估。

## 9. 迁移、回滚

Event 增 ledger/版本/summary/媒体发布字段，新增 ActivityMedia。原 Event ID/类型/imageUrl/EventRSVP 保留。迁移默认 dry-run，显式 ACTIVITY_MIGRATION_MONGO_URI，不加载生产 dotenv；远程另需 --allow-remote，写另需 --apply。

先检查全部旧 ledger 容量，Event 分类/封面及旧 RSVP 数量/SHA256 前后比对；初始化 ledger/索引，不重分类、不删源报名、不改 URL。迁移只在隔离随机DB验证，未主动执行生产活动数据库迁移；真实图片确认发布另使用独立测试DB，未写生产活动数据。

回滚只接受导入后未写入的 ledger，恢复 rsvpCount/approvedCount 原值或原本缺失；索引保留。任何 V2 新行/变更都拒绝数据损失式回滚。应用回滚需关闭入口/导出新证据/前向恢复；云回滚不能把扩权角色接回开放凭证函数，对象保留。

## 10. 自我审查与实际修复

| 问题 | 修复 |
| --- | --- |
| 提交/批准混淆、取消删记录 | 四状态/审核历史/取消保留 |
| 同名、未开通账号、班级管理员遗漏 | 稳定 ID+真实 roster，无账号未报名 |
| 审批/容量编辑并发超额 | 统一 Event CAS，真实 standalone 并发验证 |
| 结束活动消失、未来完成状态泄露 | phase/status 分离和公开条件 |
| 间接精选/评论/搜索/收藏绕过 | 活动读守卫+安全 DTO，非活动保持 |
| 上传成功但 DB 失败错误引用 | READY 与发布 ref 分离，幂等恢复 |
| 迟到封面/删图确认复活 | mediaVersion/tombstone/会话版本 |
| 删除审计失败、201 张照片竞态 | 清单唯一真相，数量/CAS 同时验证 |
| 异步选图/路由刷新覆盖未保存编辑 | 选择序列、按 ID 重置、刷新保留编辑 |
| 链接过期/草稿重试重复创建 | 刷新签名、持有草稿 ID |
| 迁移丢计数或新增报名 | 原计数备份、严格无新写入才回滚 |
| 共享桶切换/配置两把锁 | ActivityMedia 计入守卫、默认共享锁 |
| 原开放 SCF 扩权风险 | server auth+固定资源已云部署验证；仅活动PutObject IAM与限定来源CORS已执行，基本云验收PASS |

## 11. 就绪判断

2026-10-09真实SCF鉴权、活动PutObject IAM、CORS、三种图片/缩略图、正式前端XHR长度/确认服务/隔离Mongo相册发布及合法10MiB PNG受控验收PASS。300秒签名到期及GET续签PASS（旧403、新206且哈希/ETag一致），临时运行角色凭据自然轮换/续期仍NOT TESTED；原图EXIF、孤儿盘点、ledger上限和单进程配置锁边界仍保留。

云集成受控实网验收PASS，活动V2全量生产结论NOT READY：生产backend仅服务端鉴权两处补丁/secret配置，health200，活动V2全量release未部署，未主动生产迁移。正式迁移/全量部署或历史对象清理仍需按具体动作取得明确确认。
