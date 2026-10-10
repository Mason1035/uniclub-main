# ClassHub Activities V2 API

日期：2026-10-08；云验收更新：2026-10-09。依据当前路由、ActivityService、ActivityMediaService与校验代码。接口已经本地实现；**真实COS/SCF/IAM/CORS受控集成验收PASS**（鉴权12、媒体46、边界6项及真实浏览器封面/10MiB/隔离DB确认发布；300秒签名到期与GET续签通过）。临时运行角色凭据自然轮换/续期仍NOT TESTED；**活动V2全量生产release未部署、未主动生产迁移，生产结论NOT READY**。完整证据及清理/配置恢复见TEST_REPORT第10节。

## 1. 通用约定

基础路径为 /api/events。所有 V2 活动接口要求 Authorization: Bearer <ClassHub JWT>，JWT 必须通过现有签名、账号存在和 tokenVersion 校验。权限来自实时数据库，不信任请求体或 JWT 中的 isAdmin。

- 当前班级成员：User.isEnrolled=true 且 uniqueId 仍在现有 EnrolledUser。
- 管理员：User.isAdmin=true；不在班级的维护管理员仍可管理/预览。
- 报名/取消要求真实班级成员，维护管理员不能凭角色替学生报名。
- 普通成员只可读公开且未隐藏活动，不能读草稿、取消活动、他人申请/未报名名单。
- 普通成员可读 published；completed/archived 仅在已经结束时可读。管理员可预览全部状态及隐藏记录。
- ID 为 24 位十六进制 Mongo ObjectId；时间输出为 JSON ISO 8601。输入时间宜使用明确时区。
- core JSON 成功响应通常带 success:true；媒体响应按下文返回对象，不额外包 success。
- 错误至少有 error；业务错误带稳定 code。认证中间件的 401/403 可能只有 error，客户端不可假设每个响应都有 code。
- 核心写操作按已验证用户限制为每分钟 60 次；媒体初始化每小时 120 次。
- 不允许提交报名账本、组织者、计数、审核人、Event 内部版本、存储 Key 或封面指针来绕过服务器规则。

## 2. 类型、活动状态与 DTO

### 类型

| 值 | 中文 |
| --- | --- |
| LEAGUE_ACTIVITY | 团活动 |
| TEAM_BUILDING | 团建 |
| CLASS_MEETING | 班会 |
| GROUP_DISCUSSION | 小组交流 |
| OTHER | 其他 |

新建或主动改分类仅接受以上值。旧分类可原样读取、筛选、在编辑时保留；不会从 Workshop 自动映射团活动。首次显式重新分类保留 legacyEventType（管理员元数据）。元数据来源 shared/activity-v2.json。

### 生命周期

| 字段 | 值/语义 |
| --- | --- |
| status | draft / published / cancelled / completed / archived；数据库举办状态 |
| phase | UPCOMING / ONGOING / ENDED；按当前时间实时计算，不保存重复时间状态 |
| registrationOpen | published、未隐藏、未结束且未超过 rsvpDeadline |
| registrationClosedReason | 关闭时的中文说明，否则 null |
| cancellationOpen | published、未隐藏且未结束；允许截止后取消已有报名 |
| cancellationClosedReason | 取消被禁止时的说明，否则 null |

### Activity DTO

安全字段包括 id/_id、title、description、startDate/endDate、location、eventType/eventTypeLabel、category、status/phase、maxCapacity、rsvpDeadline/rsvpLink、准备事项/标签/技能等级、summary、创建/更新时间、归档时间、互动和报名/签到计数、报名/取消开放信息及封面展示 URL。

- organizer 仅包含 _id/name。
- rsvpCount = PENDING + APPROVED；approvedCount 单独表示批准数。未初始化旧列表可缺准确批准数；详情使用旧 RSVP 的兼容统计。界面不能把 rsvpCount 标为“已通过”。
- imageUrl/coverUrl 对旧记录兼容原 URL；新封面为私有对象缩略图的短期签名 URL。封面存储不可用时可能为空并标 coverMediaUnavailable=true。
- 管理员 DTO 另有 deletedAt、mediaVersion、coverMediaId、legacyEventType。
- 普通 DTO 不返回 registrations、报名历史、registrationVersion、迁移备份、mediaRefs、mediaTombstones、objectKey/thumbnailKey、账号邮箱/电话、密码或云凭据。

## 3. 活动列表、创建与详情

### GET /api/events

当前成员或管理员可访问。返回：

```json
{
  "success": true,
  "events": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "pages": 1 },
  "years": [2026],
  "types": [{ "value": "CLASS_MEETING", "label": "班会" }]
}
```

| 参数 | 限制/默认 |
| --- | --- |
| view | upcoming 默认；ongoing、past、calendar；upcoming 为开始时间>当前时间，ongoing 为已开始且未结束，past 为已结束 |
| page / limit | page 至少 1，默认 1；limit 默认 20，范围 1–100；无数据 pages=1 |
| eventType 或 type | 精确类型筛选，字符串最多 100 字；可筛旧值 |
| year | 2000–2100 整数；按活动开始日期、Asia/Shanghai 年边界 |
| search | 标题/介绍关键词，最多 200 字；正则字符转义为字面量 |
| from / to | 日历相交范围；须同时提供有效时间、to>from，跨度≤370 天 |
| status | 默认公开集合；非公开 status 仅数据库管理员可请求；all 不向成员开放隐藏/草稿 |
| sort | latest 按创建时间倒序，保留首页最近发布排序；其他按近期升序、往期降序 |
| upcoming | 旧兼容参数 false 对应未显式指定 view 时的 calendar |

years/types 从有权限可见的活动集合生成；types 包含五类及已出现的旧值，旧项标 legacy:true。相册原图不随列表加载。

### GET /api/admin/events

数据库管理员专用。返回结构同列表。支持上述搜索、类型、年份、分页、status，以及 includeDeleted=true（默认隐藏已删除记录）。默认按 startDate 倒序；默认不按 upcoming 限制，可选 view。通过这一入口查询管理数据，不依赖前端 isAdmin。

### POST /api/events

管理员专用；201 返回 {success:true,event}。示例：

```json
{
  "title": "班级交流会",
  "description": "完整活动介绍",
  "eventType": "CLASS_MEETING",
  "status": "draft",
  "startDate": "2026-10-20T14:00:00+08:00",
  "endDate": "2026-10-20T16:00:00+08:00",
  "location": { "type": "physical", "address": "教学楼", "room": "101", "virtualLink": "" },
  "maxCapacity": 40,
  "rsvpDeadline": "2026-10-19T18:00:00+08:00"
}
```

标题 1–200 字、介绍 1–2000 字；结束晚于开始；location.type 为 physical/virtual/hybrid。线下/混合需地址，线上/混合需 http/https 链接。人数为 null（不限）或 1–2000 整数。截止可 null，不能晚于结束；新建省略截止时为 null。status 缺省 draft。

保留已有 category/speakers/attachments/prerequisites/tags/skillLevel/提醒/重复活动等受控可编辑字段，仍受模型校验。imageUrl 不再作为新封面的主要写入口；先创建获得稳定 ID，再使用媒体初始化。

### GET /api/events/:id

返回 {success:true,event}。成员不能凭知道 ID 读取未公开/隐藏内容；不公开时返回 404。活动结束后沿用原路径，可读取历史介绍、总结、封面，相册通过媒体接口按需加载。

### GET /api/events/:id/admin

管理员专用，返回 {success:true,event,stats}；完整预览与编辑分离。stats 定义见报名部分。

### PUT /api/events/:id

管理员专用；请求为部分活动基本属性，返回 {success:true,event}。不支持直接写 summary、报名、计数、组织者或媒体指针。已隐藏活动需先恢复。修改人数不得低于已批准人数；同 Event registrationVersion CAS 防止与批准并发造成超额。显式改 completed/archived 要求活动已结束。

## 4. 个人报名与状态机

### Registration DTO

```json
{
  "id": "报名记录 ObjectId",
  "userId": "成员 ObjectId",
  "name": "报名时必要姓名快照",
  "status": "PENDING",
  "version": 1,
  "createdAt": "ISO时间",
  "updatedAt": "ISO时间",
  "reviewedBy": null,
  "reviewedAt": null,
  "reviewNote": "",
  "legacyStatus": null
}
```

版本为当前申请的乐观锁；审批 actorId/history 由服务器保存，不由客户端写入。旧 going→APPROVED、maybe/waitlist→PENDING、not_going→CANCELLED，保留 legacyStatus；旧审核人/时间为空，不伪造审批。

### GET /api/events/:id/rsvp

读取当前用户，返回 {success:true,rsvp:null|Registration}，没有全班数据。

### POST /api/events/:id/rsvp

成员提交空请求体、{} 或 {"status":"PENDING"}。旧 {"status":"going"} 兼容为新待审核，不直接批准。其他字段/自行指定 APPROVED 被拒绝。

返回 {success:true,rsvp}。重复 PENDING/APPROVED 申请幂等，不新建记录或追加异常历史。REJECTED/CANCELLED 开放期间重申请沿用 ID、版本递增、审核当前值重置并追加历史。

申请不占批准名额；发布状态、活动结束与截止由后端检查。申请不能绕过真实 roster，也不能给其他 userId 报名。

### DELETE /api/events/:id/rsvp

本人取消，返回 {success:true,rsvp,message}；原记录改 CANCELLED，不物理删除，APPROVED 名额原子释放。不存在记录返回 rsvp:null，已取消幂等。新申请截止后仍可在未结束 published 活动取消；结束/隐藏后拒绝改变历史。

状态流转：无记录→PENDING；PENDING→APPROVED/REJECTED/CANCELLED；APPROVED→CANCELLED；REJECTED/CANCELLED→PENDING（报名开放）。审批与活动 ENDED 互不自动转换。

## 5. 管理员名单、统计与审批

### GET /api/events/:id/registrations

管理员专用。参数 filter=all|registered|pending|approved|rejected|cancelled|unregistered，默认 all；search 为姓名字面搜索，最多 100 字；page/limit 默认 1/20，上限 100。

返回 {success:true,members,stats,pagination}。member 行：

```json
{
  "id": "用户ID或roster:名单ID",
  "userId": "用户ID或null",
  "name": "姓名",
  "uniqueId": "已有班级学号（可能省略）",
  "avatar": "/api/users/avatar/用户ID或null",
  "status": "UNREGISTERED",
  "registration": null,
  "currentMember": true
}
```

同名成员使用 ID 区分。未注册 roster 条目 userId=null；离班/移除账号历史申请继续显示 currentMember=false。不得向普通学生开放该 API。

| stats | 实际口径 |
| --- | --- |
| totalMembers | 当前 roster 成员总数，含未注册名单和属于班级的管理员 |
| registered | 所有有记录且非 CANCELLED 的申请，含被拒绝、离班历史 |
| pending / approved / rejected / cancelled | 对应账本当前状态数 |
| unregistered | 当前成员中没有任何账本记录的人；拒绝/取消不算“从未报名” |

### POST /api/events/:id/registrations/:userId/review

管理员专用，请求 {"status":"APPROVED|REJECTED","version":1,"note":"可选，最多500字"}；返回 {success:true,rsvp}。

只从 PENDING 审批，期望版本必须匹配。重复成功请求的相同结果/version 保留原操作人和时间；冲突结果返回 VERSION_CONFLICT。批准检查 published 且未结束、最终批准人数低于 maxCapacity；不能由前端按钮或 count→insert 控制名额。

### POST /api/events/:id/registrations/bulk-review

请求：

```json
{
  "status": "APPROVED",
  "registrations": [{ "userId": "成员ID", "version": 1 }],
  "note": "批量审批说明"
}
```

1–100 个不同成员，拒绝重复 userId。前端需显示数量并二次确认。逐项执行同一审批规则；不是“有一项失败就回滚全部”。返回 {success:true,results,stats,succeeded,failed}，results 每项包含 userId、success，成功时 rsvp，失败时 error/code。HTTP 200 不能代表每一项成功。

核心一致性：Event 的报名账本、版本、审批人/时间/历史、rsvpCount/approvedCount 在同一次 Mongo 单文档 CAS 更新中提交。普通 standalone Mongo 可运行，无需未经确认的生产 replica set 改造。

## 6. 活动总结、归档、隐藏与恢复

| 路由 | 权限/请求 | 返回与含义 |
| --- | --- | --- |
| PUT /api/events/:id/summary | 管理员；{summary:string}，仅此字段，最多 10000 字 | {success:true,event}；独立保存，不覆盖原 description |
| POST /api/events/:id/archive | 管理员；无需业务请求字段 | {success:true,event}；仅已结束且非 draft/cancelled，status=archived；仍可被成员回溯 |
| DELETE /api/events/:id | 管理员 | {success:true,event,message}；设置 deletedAt/deletedBy，成员不可见；保留报名/媒体/原ID |
| POST /api/events/:id/restore | 管理员 | {success:true,event}；清除隐藏字段；原生命周期状态保留，不自动发布草稿 |

接口没有永久删除活动、级联删报名或结束后自动删除 COS 的行为。

## 7. 封面与相册 API

本节由 /api/events/:id/media 子路由处理；读取沿用活动可见权限，所有写操作仅数据库管理员。媒体响应设置 Cache-Control:no-store, private。签名 URL 是短期授权，应按过期时间重新请求，不保存成永久资源 URL。

### GET /api/events/:id/media

page 默认 1（范围 1–10000）、limit 默认 24（范围 1–50），超过末页自动落到末页。返回：

```json
{
  "media": [
    { "id": "图片ID", "type": "PHOTO", "thumbnailUrl": "短期URL", "url": "原图短期URL", "expiresAt": "ISO时间", "caption": "", "width": 1200, "height": 800, "sortOrder": 0 }
  ],
  "version": 3,
  "pagination": { "page": 1, "limit": 24, "total": 1, "pages": 1 }
}
```

只返回本活动发布清单 mediaRefs 引用且 READY 的媒体，不能通过指定任意 Key 签名。封面排序在照片之前。数据库最多读取该活动 200 张当前照片的元数据，图片字节/签名按本页返回；不把三年照片一次下载到列表。

### POST /api/events/:id/media/init

201 请求/响应：

```json
{"mediaType":"COVER","filename":"cover.jpg","mimeType":"image/jpeg","size":123456}
```

```json
{"upload":{"id":"媒体ID","url":"精确对象PUT签名URL","method":"PUT","headers":{"Content-Type":"image/jpeg","x-cos-acl":"private","x-cos-forbid-overwrite":"true","x-cos-meta-classhub-upload":"媒体ID"},"expiresAt":"ISO时间"}}
```

mediaType=COVER|PHOTO；JPEG/PNG/WebP；12 字节至 10MiB；文件名最多 200 字且无路径/控制字符。每活动最多 200 张当前 PHOTO，最多 30 个有效待确认会话；会话 2 小时，PUT URL 300 秒。

原文件名仅做元数据，不作为 Key。服务端生成 activity/{id}/{cover|photos}/{mediaId}.扩展名；无需客户端传 bucket、prefix、objectKey。PUT 将文件 Blob 直接发 COS，使用返回 headers；Content-Length 由浏览器根据 Blob 自动设置。不能附加 ClassHub JWT 或共享密钥。

### POST /api/events/:id/media/:mediaId/complete

请求为空对象 {}（或不传体），返回 {media:MediaDTO,version}。HEAD 验证大小/MIME/ETag/nonce，按 ETag 读取全部字节，核对签名、sharp 解码及≤4000万像素、单帧，生成 WebP 缩略图后才提交 READY；随后 CAS 发布到该 Event 的媒体清单。

READY 不等于已发布。活动关联失败时保留可追踪对象，重复确认可重试；已关联重复确认幂等。封面使用初始化时的 baseMediaVersion；期间别的媒体操作改变版本，返回 MEDIA_VERSION_CONFLICT，不能以旧上传抢占新封面。原封面保留但不重新出现。

### DELETE /api/events/:id/media/:mediaId

请求 {} 或无体；返回 {deleted:true,version}。只在 activityId+mediaId 精确范围操作。Event CAS 移除引用并加入 tombstone；重复删除幂等。审计行 deletedAt 更新若失败不影响隐藏真相；不调用 COS 物理删除。迟到 complete 不能重新发布该 tombstone 媒体。

### DELETE /api/events/:id/media/cover

请求 {"clearLegacy":true,"version":当前媒体版本}，返回 {deleted:true,version}。同时删除新封面发布指针并设 legacyCoverHidden；原 imageUrl 不擦除，管理员删除封面后不回退旧 URL。未匹配版本返回冲突。

### PATCH /api/events/:id/media/order

请求 {"ids":["PHOTO图片ID1","PHOTO图片ID2"],"version":当前媒体版本}；2–200 个唯一、本活动、已发布 PHOTO ID。可对选择的子集排序；未选择图片保持相对位置。返回 {ordered:true,version}。不能混入封面、其他活动或已删除图片。

### COS/SCF 必要条件

复用桶 lianghuacailiao-2026-1306497854 / ap-guangzhou；活动只能 activity/，量化 ZIP 的 quantification/ 不受新图片校验影响。网站后端与 SCF 共享服务端 CLASSHUB_SCF_AUTH_SECRET（至少32字符），SCF 固定目标和 business 校验。活动适配器要求 secured:true、business=activity 的响应，不允许未保护旧接口降级。

浏览器只得到精确签名 URL，不返回可复用的临时角色凭据对象、SecretKey、任意前缀写权限或账号隐私。URL 本身可能带 COS 验签所需的 q-ak 和 session token；它们不提供客户端为其他 Key 签名的能力。真实 IAM/CORS/SCF 部署必须另行验证并获得生产操作确认。

## 8. 旧路由兼容与边界

- /event/:id 前端旧链接与 /events/:id 别名读取同一 ID。
- GET /api/events/:id/attendees 现在只允许管理员，返回已通过 members/attendees 与分页；不返回旧内部 RSVP 敏感字段。
- POST /api/events/:id/calendar 先检查活动可读性，返回 title/description/start/end/location/空 attendees；不能读取草稿绕过详情权限。
- POST /api/events/:id/checkin/:userId 仅管理员、已通过申请；重复签到幂等，不重复计数；返回 checkedInAt。
- GET /api/events/user/mine 与 /user/recommended 保留安全 DTO；推荐使用近期列表规则。新前端主流程使用当前活动/个人 rsvp 接口，不依赖旧 RSVP 写模型。
- GET /api/past-events 保留 success/data 格式，新增分页：page 默认1、上限10000；limit 默认50、上限100；按 date/_id 倒序。旧 /past-events/:id/poster 与 gallery/:index 继续原存储/公开读取语义，未自动转入新私有相册。

## 9. 主要错误与客户端处理

| HTTP / code | 处理含义 |
| --- | --- |
| 400 INVALID_ID / INVALID_ACTIVITY / INVALID_TYPE | ID、时间、字段、类型或链接无效；修正表单 |
| 400 INVALID_FIELDS / INVALID_MEDIA_TYPE / INVALID_MEDIA_ORDER / INVALID_IMAGE / INVALID_IMAGE_SIZE / INVALID_FILENAME | 非允许媒体字段、错误真实内容/大小/文件名；重新选择 |
| 401 | 缺登录、JWT过期、账号不存在或 tokenVersion 失效 |
| 403 ADMIN_REQUIRED / MEMBERSHIP_REQUIRED | 真实账号权限不足；不能通过角色声明重试 |
| 404 NOT_FOUND / EVENT_NOT_FOUND / MEDIA_NOT_FOUND | 不存在、不可见或跨活动/已删图片；不要泄漏草稿存在性 |
| 409 REGISTRATION_CLOSED | 结束、截止、未发布或取消；显示后端业务原因 |
| 409 VERSION_CONFLICT | 报名或活动已变化；刷新当前版本，不覆盖新审批 |
| 409 CAPACITY_FULL / CAPACITY_TOO_LOW | 最终批准数满，或容量拟低于已批准数 |
| 409 ACTIVITY_NOT_ENDED / INVALID_TRANSITION / ACTIVITY_HIDDEN / EVENT_HIDDEN / NOT_APPROVED | 生命周期操作不符合当前状态 |
| 409 LEDGER_LIMIT / LEGACY_DUPLICATES | 账本安全上限/旧重复申请；人工核对，不能截断或自动合并 |
| 409 MEDIA_VERSION_CONFLICT / MEDIA_CONFLICT / PHOTO_LIMIT / PENDING_MEDIA_LIMIT | 媒体版本冲突、当前照片/会话上限 |
| 409 MEDIA_UPLOAD_EXPIRED | 会话过期，重新初始化；不得把本地上传成功当成已发布 |
| 400/409 OBJECT_MISMATCH | 实际 COS 内容与本次会话不一致，不保存展示引用 |
| 429 RATE_LIMITED / MEDIA_UPLOAD_LIMIT | 已验证账号频率限制，稍后再试 |
| 503 ACTIVITY_UNAVAILABLE / ACTIVITY_STORAGE_UNCONFIGURED / ACTIVITY_SCF_UPGRADE_REQUIRED | 数据/受保护存储未可用；不能显示成功 |
| 500 ACTIVITY_MEDIA_FAILED / 502 SCF_UNAVAILABLE、SCF_CONTRACT 等 | 媒体或SCF暂时失败，保留旧状态并给重试提示；不返回内部云错误或密钥 |

批准/上传/排序失败后重新读取当前状态；不要用前端计数代替后端确认。批量 results 逐项反馈。图片上传后的 HTTP PUT 成功只是传输完成，必须 complete 成功才作为业务发布完成。
