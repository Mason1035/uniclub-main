# Activities V2：COS / SCF 安全接入与媒体留存

## 实施与验收边界

2026-10-08 至本地隔离验收结束的阶段只修改本地源码、测试和文档，没有云端部署或生产迁移。下文保留该阶段的测试记录。

2026-10-09（北京时间）已完成真实云端受控接入：生产后端仅安装 `ScfStorageAdapter` 的服务端 secret/header 两处补丁并配置 secret，两个 V2 SCF 已部署；IAM 经用户在执行时确认后已追加，CORS 已保存。鉴权报告 **12 checks PASS**，媒体报告 **46 checks PASS**；正式前端 XHR → 真实 COS → 现有确认服务 → 隔离 Mongo 发布引用 → 相册显示的闭环通过，合法 10MiB PNG 实网传输/哈希/解码通过。

**云集成受控实网验收：PASS；活动 V2 全量生产：NOT READY。** 300秒签名到期与重新签发GET验证 **PASS**（COS Date为2026-10-09 06:28:01Z，即北京时间14:28:01；旧签名403，新GET206且哈希/ETag一致）；临时运行角色凭据自然轮换/续期仍为 **NOT TESTED**，GET续签不代表角色凭据轮换。活动 V2 全量 release 尚未部署，未主动执行生产数据库迁移；真实图片闭环使用独立测试数据库，不表示生产活动数据已迁移。

## 2026-10-09 真实云接入进度

- 服务器受控备份：`/opt/classhub/backups/cloud-20261009-130946`。两个旧 SCF 的代码 ZIP、配置及原 IAM/CORS 受控备份：`/Users/alexmason/Documents/Codex/.classhub-cloud-20261009`。
- 生产后端仅安装上述服务端鉴权补丁和 secret 配置，health 返回 200；未部署活动 V2 全量 release，未主动执行生产数据库迁移。
- 用户亲自保存两个函数的 secret；两个 V2 SCF 部署成功。上传函数保持 Python 3.12 / `index.main_handler`，下载函数保持 WebNode18。
- 实网报告 `auth-verification-1.json`：12 checks PASS。未授权 upload/health/list/download 为 403，错误鉴权为 403，非固定 Bucket/Region 为 403，量化与活动业务越界为 400；已授权量化 token/list 及旧 ZIP 的 1 字节 Range 读取通过。没有把此读取检查写成量化完整上传回归通过。
- 真实旧桶只读列举到 41 个 ZIP，父目录均为 `quantification/`；数据库引用也使用该 Prefix。桶为私有读写，未配置 lifecycle。
- 用户在执行时确认后，`ClassHubActivityUpload`（policy `289056588`）已仅关联 `QuantificationUploadRole`，仅新增 `name/cos:PutObject`，资源为同一桶的 `activity/*`。下载角色保留原 `QcloudCOSReadOnlyAccess`，未新增下载角色授权；原量化权限保留。
- CORS 已保存：来源限定 `https://csrg3b.top`、`http://localhost:8081`、`http://127.0.0.1:9188`；保留 PUT/GET/HEAD/POST、Allowed-Headers `*`、Expose-Headers ETag、Max-Age 600、Vary: Origin。未开放所有来源。
- `media-verification-1.json`：46 checks PASS，PNG/JPEG/WebP 各1个新原图及1个新缩略图；同一 PUT 签名的长度+1返回403、正确长度返回200；重复写入409，匿名 GET/HEAD 403；元数据、原图哈希、缩略图私有读取通过；旧ZIP 1字节Range读取206。测试对象由随机活动/媒体ID生成，未写历史对象。
- 真实浏览器使用正式前端 XHR 直传 COS，现有 `ActivityMediaService.complete` 核验后向独立 Mongo 数据库 `classhub_activity_cloud_browser_20261009` 发布引用；相册显示“已保存”，DOM 图片 complete、400×300、来自真实COS；成员预览正常显示1张相册图。截图：`docs/activity-v2/screenshots/classhub-activity-browser-cloud-saved.png`。
- 合法10MiB PNG实网PUT200、读取哈希及完整解码PASS；10MiB+1本地上传授权边界400。最终 `boundary-state-1.json.report.json` 为6 checks PASS：COS Date 2026-10-09 06:28:01Z，旧300秒签名403、新GET206，哈希与ETag一致。
- 浏览器10MiB图片与封面均完整保存；`browser-cloud-verification.json`记录独立DB中Media 3 READY（PHOTO 2、COVER 1），fileSize分别2476、10485760、2476，mediaVersion=3。新增截图：`docs/activity-v2/screenshots/classhub-activity-browser-10mib-saved.png`、`docs/activity-v2/screenshots/classhub-activity-member-cloud-read.png`。
- 受控云集成验收已完成；临时运行角色凭据自然轮换/续期仍NOT TESTED，不能把GET续签称为凭据轮换。13个新私有云测试对象保留，清单为 `/Users/alexmason/Documents/Codex/.classhub-cloud-20261009/retained-cloud-test-objects.json`，未删除历史对象。测试API5068正常exit0并drop专用DB，Mongo27186与Vite9188均exit0，三处测试端口全部释放。
- 五张真实云配置/浏览器截图已归档到 `docs/activity-v2/screenshots/`：`classhub-activity-iam-granted.png`、`classhub-activity-cors-saved.png`、`classhub-activity-browser-cloud-saved.png`、`classhub-activity-browser-10mib-saved.png`、`classhub-activity-member-cloud-read.png`。
- 本地后端原`.env`缺少SCF服务端secret，已先受控备份为 `local-backend.env.before-scf-auth`，再写入与服务器一致的secret，文件权限0600；文档不保存值。本地后端重启恢复5050、Mongo已连接且API health200，现有API开发会话保留；前端8081及/admin/events均HTTP200。专用Mongo退出后，自有数据目录 `/private/tmp/classhub-cloud-validation/mongo-browser` 已清理。
- 活动V2全量生产应用未部署、未主动生产迁移，仍为 **NOT READY**。

## 现有架构与安全问题

唯一存储配置来源是 `QuantificationStorageSettings.environment()`，读取原有 `.quantification-storage.json` 及服务器环境；新增媒体复用当前桶 `lianghuacailiao-2026-1306497854`、地域 `ap-guangzhou` 和现有上传/下载 SCF，不创建第二个桶。

现有量化材料 SCF 模式使用 `quantification/原文件名.zip`；旧 ID / staging / submitted 路径保持兼容。量化 ZIP 上传、分片和确认校验没有改成图片流程。

原 upload-token 函数允许开放 GET 返回运行角色凭据；download 函数允许开放列表与 ZIP 签名。网站自身 JWT 校验不能保护直接访问云函数的请求。若在这个状态下扩充角色的 `activity/` 权限，会扩大原有暴露面。本次源码提供服务端鉴权与固定资源检查，**必须先部署并验证鉴权，再增加活动 IAM 权限**。

旧量化调用在没有新 secret 时保留原兼容行为；活动调用在同一模式明确拒绝。这个兼容分支是部署过渡机制，不能作为启用活动存储的生产配置。

## 服务端配置

网站后端及两个 SCF 使用同一个服务器专用 `CLASSHUB_SCF_AUTH_SECRET`，至少 32 个字符，建议运维生成随机 32 字节以上的值。它只存在受控环境变量中，不能放入 `VITE_*`、前端、网页存储配置、测试结果、请求日志或 URL。

两个 SCF 的安全配置还需要：

```dotenv
CLASSHUB_SCF_AUTH_SECRET=
COS_BUCKET=lianghuacailiao-2026-1306497854
COS_REGION=ap-guangzhou
COS_QUANTIFICATION_PREFIXES=quantification/
```

`COS_QUANTIFICATION_PREFIXES` 是逗号分隔的显式量化目录白名单。若已有历史材料使用其他原目录，先把实际历史目录加入白名单，再开启鉴权；不要为了收窄权限使旧材料无法下载。该白名单不能包含 `activity/`。

网站后端向 SCF 的 HTTPS 请求发送 `X-ClassHub-Service-Auth`。SCF 使用常量时间比较；启用 secret 后所有凭证、列表、签名请求均须通过鉴权。Bucket / Region 必须与固定配置一致；量化与活动参数互相隔离。旧 `SCF_AUTH_TOKEN` / `SCF_SHARED_TOKEN` 等已停用字段仍被忽略，本次没有重新启用它们。

活动上传 adapter 要求本地 secret 已配置，并验证 SCF 返回 `secured: true`、`business: activity` 以及正确的 Bucket / Region。旧云函数响应不能被当作已安全升级。响应缺字段、地址错误或配置不完整时拒绝上传，不降级为开放上传。

## 对象布局与稳定引用

```text
activity/{eventId}/cover/{mediaId}.jpg|png|webp
activity/{eventId}/cover/{mediaId}-thumb.webp
activity/{eventId}/photos/{mediaId}.jpg|png|webp
activity/{eventId}/photos/{mediaId}-thumb.webp
```

两个 ID 均为稳定 Mongo ObjectId；Key 完全由服务器生成。原文件名仅作内部业务元数据，不能决定 Key，不会产生同名覆盖。每个活动最多公开 200 张 PHOTO；当前封面独立。图片只支持单张 JPEG / PNG / WebP，10MiB 上限；不支持 HEIC、SVG、GIF 或多页图片。服务端还有 4000 万像素解码上限。

`ActivityMedia` 保存 Key、MIME、字节数、尺寸、上传人、确认时间、ETag、会话和辅助删除审计。`Event.mediaRefs` 是媒体发布、顺序、删除的唯一真相，`coverMediaId` 与封面 ref 同一次原子修改。`mediaVersion` 为比较更新版本；`mediaTombstones` 防止删除后的迟到确认重新发布。

旧 `Event.imageUrl` 原值不被删除或覆盖。新封面优先读取；`legacyCoverHidden` 表示管理员已替换/移除旧封面的显示。删除新封面不会突然恢复旧 URL。旧独立 `PastEvent` Base64 档案与其相册入口保留。

## 上传与确认流程

1. 管理员先保存草稿活动，取得稳定活动 ID。
2. `POST /api/events/:id/media/init` 独立查询数据库管理员权限；校验用途、MIME、文件名和大小；创建持久上传会话。
3. 后端使用现有 COS SDK 与受保护 SCF 角色签发单个对象的 PUT URL，最长 300 秒；只把精确 URL 和所需四个请求头交给浏览器。
4. 签名绑定方法、Host、完整 Key、Content-Type、Content-Length、`private` ACL、禁止覆盖和上传编号。Content-Length 由浏览器对已知 File/Blob 自动发送，前端不设置这个浏览器禁止手工设置的请求头。该浏览器自动长度行为已在2026-10-09真实前端XHR→COS闭环验证；服务器同一URL的长度+1负例也返回403。
5. XHR 将原始字节直传 COS；ClassHub JWT、SCF service secret、SecretKey 不发送到 COS。URL 中的临时 `q-ak` 与 session token 属于 COS 验签格式，不能据此生成其他 Key 的签名；签名 SecretKey 不返回前端。
6. `POST /api/events/:id/media/:mediaId/complete` 从服务器会话取 Key，不接受客户端 Key / Bucket。服务器经受保护下载函数获得 GET URL，执行有界 Range GET，核对实际字节数、MIME、ETag、上传编号，再以 If-Match 绑定读取完整图片。
7. 图片签名与完整 sharp 解码通过后生成最长 640×480 的 WebP 缩略图；缩略图移除 EXIF，原图保留原始字节。缩略图由服务器写入独立私有 Key，支持幂等重试。
8. `ActivityMedia.READY` 只代表文件已验证。随后通过 Event 单文档精确版本 CAS 发布 ref；独立 MongoDB standalone 同样支持，不依赖副本集事务。
9. 所有读取与签名只取已经授权活动的 Event ref 白名单和 READY 媒体交集；验证完成但发布失败的 READY 行不可见，可使用同一 mediaId 重试确认。

封面上传保存初始化时的 mediaVersion。版本变化时旧会话不能覆盖新封面；已经发布的同一 ID 重复确认不会再次替换；被移除或替换的 ID 被 tombstone 拒绝。相册追加和 200 张上限在同一次 Event CAS 内判断，两个管理员不会并发发布第 201 张照片。排序接受当前页面的 PHOTO 子集和明确版本，保留其余照片位置，不需要下载全部原图。

## 媒体读取、性能与权限

`GET /api/events/:id/media?page&limit` 要求登录、当前班级成员身份或真实管理员身份，并复用活动可见性规则。普通成员不能读取草稿、隐藏活动或后台名单。响应包含稳定媒体 ID、尺寸、说明、缩略图 / 原图短期 URL、过期时间与分页；不包含存储 Key、Base64、邮箱、电话、完整角色凭据。

当前封面和 PHOTO 元数据按需分页返回，最大 50 条；生成 URL 的并发数限制为 6。普通活动列表只请求当前封面缩略图，不取相册原图。前端缩略图 Lazy Loading，大图在打开图库时才加载。签名链接最长 300 秒有效；API 响应为 `no-store, private`，前端需要在过期前刷新或在图片错误时重新读取。

短期 URL 本身持有对象读取能力。删除/隐藏后不会再生成新 URL，但之前签发的 URL 可在剩余 300 秒内使用；这是本方案的有限撤销延迟。管理员不应把签名链接公开转发。原图可能含拍摄设备/位置 EXIF；如果班级政策禁止保留这类信息，应在管理员提供照片时移除，或另行确认将原图统一重编码的策略。

## IAM 最小增量

2026-10-09已按用户在执行时确认的范围授权：`ClassHubActivityUpload`（policy `289056588`）仅关联 `QuantificationUploadRole`，仅新增 `name/cos:PutObject`，限定当前桶的 `activity/*`。原量化PutObject/分片权限保留。实网原图及缩略图上传携带private ACL成功，不需要追加独立 `PutObjectACL` 权限。

| 角色 | 当前活动权限 / 结果 | 范围 |
| --- | --- | --- |
| 上传 SCF 运行角色 | 已新增 `name/cos:PutObject`；原图和服务器缩略图写入PASS | 当前桶 `activity/*` |
| 下载 SCF 运行角色 | 保留原 `QcloudCOSReadOnlyAccess`；HEAD/GET与私有签名读取PASS，未新增策略 | 既有只读策略范围 |

已生效的活动上传增量如下，未替换现有量化声明：

```json
{
  "version": "2.0",
  "statement": [{
    "effect": "allow",
    "action": ["name/cos:PutObject"],
    "resource": ["qcs::cos:ap-guangzhou:uid/1306497854:lianghuacailiao-2026-1306497854/activity/*"]
  }]
}
```

此次仅新增上述上传声明。下载角色使用既有只读权限，真实对象HEAD/GET已通过；未新增列桶、删除、复制、ACL管理或桶管理授权。PUT/HEAD/GET与独立ACL接口的操作映射见 [COS API 授权指引](https://cloud.tencent.com/document/product/436/31923)、[PUT Object acl](https://cloud.tencent.com/document/product/436/7748)。临时运行角色凭据真实轮换/续期仍未测试。

## COS 私有 ACL 与 CORS

2026-10-09已确认桶为私有读写且无lifecycle；CORS已保存并通过实网预检及真实前端XHR上传。当前配置：

- Origin：`https://csrg3b.top`、`http://localhost:8081`、`http://127.0.0.1:9188`，没有所有来源通配符。
- Methods：PUT、GET、HEAD、POST，保留原量化所需项；OPTIONS由COS处理。
- Allowed-Headers：`*`，覆盖活动四项请求头及原量化SDK头；这一配置没有放开来源或对象权限。
- Expose-Headers：ETag。
- Max-Age：600；开启 `Vary: Origin`；XHR不发送COS Cookie。

原图和缩略图匿名读取均被拒绝；受保护下载函数签发的URL可以读取并通过哈希校验。

CORS 只是浏览器访问规则，不替代身份和对象签名。COS 配置项的含义见 [腾讯云设置跨域访问](https://cloud.tencent.com/document/product/436/13318)。

## 三年留存与失败恢复

- 活动结束、归档、标题/类型修改都不会更改 ID、Key 或删除照片。
- 删除/替换只修改 Event ref / tombstone；COS 原图和缩略图保留。ActivityMedia 的 deletedAt 是附属审计，后续审计写失败不会使照片重新显示。
- 上传、缩略图、确认或 DB 发布失败不会创建错误显示引用。待上传会话保存 2 小时；失败与过期行不会被 TTL 删除，Key 保留供核对。
- 保留的 UPLOADING / FAILED / READY 未发布对象可能占用存储；本次不安排自动清理活动对象。运维应基于这些持久会话和 Event refs 做只读盘点，任何永久清理都需要另行确认和备份策略。
- 每个活动同时有效待确认会话软上限 30；管理员上传 API 每账号每小时 120 次。公开照片 200 张上限由可靠 CAS 控制。
- 共享存储配置禁止在存在任意 ActivityMedia 记录时改 Bucket / Region，即使量化记录为空、媒体软删除或确认失败。否则三年稳定引用会被配置切换破坏。
- 默认量化与活动服务共享同一个 StorageSettings 操作锁，首次上传尚未创建记录时也不能并发切换存储配置。该部署沿用单后端进程管理私有配置文件；多进程存储配置管理需要另行设计跨进程操作租约。
- 不为 `activity/` 配置对象到期删除；保留原量化材料、原云函数分片清理规则。数据库与 COS 元数据应纳入现有受控备份。

## 生产执行顺序：须用户明确确认

1. 先报告数据库迁移、备份、影响和回滚；备份 Event、历史 RSVP、ActivityMedia、配置文件及现有 SCF / IAM / CORS 设置。2026-10-09 已完成上述服务器与云配置受控备份；生产数据库迁移仍未主动执行，正式迁移前仍需审阅数据库备份、原值核对和恢复方案。
2. 在维护计划中部署能发送新服务端 auth header 的后端，并配置新 secret。旧函数忽略新增 header，量化兼容仍可继续；活动 adapter 在旧契约下拒绝开启。
3. 部署两个新版 SCF，配置相同 secret、固定 Bucket / Region、全部实际历史量化 Prefix 白名单。此时保持原 IAM，不增加 activity 权限。
4. 检查未经授权的凭据/列表/签名请求全部 403，受保护量化完整流程仍可用。验证时不得输出真实凭据或签名链接到日志。
5. 确认鉴权生效后，增量追加上述 activity 对象 IAM，再合并 CORS；维持私有 ACL，禁止新增自动过期规则。
6. 在已确认范围内使用新生成的合法活动Key与虚构账号联调，不放宽业务接口到任意Key。此次媒体脚本生成随机 `activity/{eventId}/photos/{mediaId}` 对象，浏览器闭环使用独立测试数据库；没有使用历史对象作为写目标。当前业务接口不接受任意 `activity/_test/` Key，未为验收放宽。测试对象清理仍需遵循已确认范围。
7. 实测 JPEG / PNG / WebP、长度验签、10MiB 边界、nonce、私有 GET、签名失效与续期、覆盖拒绝、缩略图、失败恢复及量化回归。记录真实云结果，再判断部署就绪。

回滚应关闭活动媒体入口并保留新数据/对象；不要把拥有activity权限的角色重新连接到开放凭据函数。回滚云函数源码前，必须先撤回已追加的活动IAM增量，再按维护计划恢复；量化历史Prefix、已确认材料和新活动对象不得删除。2026-10-09已执行备份、服务端鉴权补丁/配置、两个SCF部署、用户确认的上传IAM及CORS配置，并通过真实图片/浏览器受控验收。签名到期及重新签发GET已PASS，临时角色凭据自然轮换/续期仍NOT TESTED；正式生产迁移及活动V2全量部署未执行。

## 已执行本地验证（历史记录）

2026-10-09对 `activityMediaStorage.test.js` 再次执行focused unit回归，6 tests PASS。首次普通沙箱无法监听本地端口，按授权方式重试通过；不把环境失败记为实现失败，不重复累计下表的6项。

| 命令 | 实际结果 | 边界 |
| --- | --- | --- |
| `node --test test/activityMediaStorage.test.js` | PASS，6 tests | 真实 sharp + COS SDK 签名；本机模拟 SCF；无真实云 |
| `node --test test/quantification.test.js test/quantificationConfig.test.js` | PASS，61 tests | 量化原测试、内存仓库/对象、模拟 SCF、真实 SDK 签名 |
| `python3 -m unittest discover -s cloud-functions/quantification/upload-token -p 'test_*.py'` | PASS，5 tests | Python 凭据函数原兼容、无 secret 拒活动、auth/固定目标 |
| `ACTIVITY_TEST_MONGO_URI=mongodb://127.0.0.1:27187 node --test test/activityMediaMongo.integration.js` | PASS，15 tests | 临时 standalone Mongo、真实模型/JWT/HTTP PUT/GET、模拟对象存储；随机测试库与临时服务已清理 |

上表保留本地隔离阶段的既有结果。2026-10-09新增鉴权报告12 checks PASS、媒体报告46 checks PASS、真实浏览器正式XHR/确认服务/独立Mongo相册发布闭环PASS，以及合法10MiB PNG实网传输/哈希/解码PASS；10MiB+1本地授权边界400。最终边界报告6 checks PASS，旧300秒签名403、新GET206且哈希/ETag一致；浏览器10MiB图片及封面保存、独立DB3 READY通过。临时运行角色凭据自然轮换/续期NOT TESTED，GET续签不等同角色轮换。云集成受控实网验收PASS；活动V2全量生产应用未部署、未主动生产迁移，仍为 **NOT READY**。
