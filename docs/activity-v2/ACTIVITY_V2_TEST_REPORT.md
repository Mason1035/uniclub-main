# ClassHub Activities V2 验收报告

日期：2026-10-08 至 2026-10-09。项目：/Users/alexmason/Desktop/uniclub-main。

## 1. 结论与验收边界

**本地代码/隔离业务闭环：PASS。云集成受控实网验收：PASS。活动V2全量生产上线：NOT READY。**

2026-10-09（北京时间）已完成受控备份、生产后端仅服务端secret/header两处补丁及配置、两个V2 SCF部署；用户在执行时确认的活动PutObject IAM已追加，CORS已保存。鉴权报告 **12 checks PASS**，媒体报告 **46 checks PASS**；正式前端XHR→真实COS→现有确认服务→独立Mongo发布引用→管理员与成员相册显示通过，合法10MiB PNG实网传输/哈希/解码通过。详见第10节。

最终边界报告 **6 checks PASS**：COS Date为2026-10-09 06:28:01Z（北京时间14:28:01），旧300秒签名403、新GET206且哈希/ETag一致。浏览器10MiB图片及封面完整保存；独立DB为3 READY（PHOTO2、COVER1）。临时运行角色凭据自然轮换/续期仍 **NOT TESTED**，GET续签不代表角色凭据轮换。

未部署活动V2全量release，未主动执行生产数据库迁移；未永久删除云对象、未提交或推送代码。真实浏览器使用独立数据库 `classhub_activity_cloud_browser_20261009`，不代表生产活动已迁移。正式迁移/全量部署仍需按具体动作提供备份、影响和回滚方案，并取得明确确认。

## 2. 已执行本地自动验证（历史记录）

以下命令从仓库根目录运行，Python/量化测试按后端目录执行。Mongo 27187/27188 均为临时 standalone 进程，使用随机隔离数据库，已清理；不能直接拿已关闭端口运行。需要重新启动专用测试 Mongo，禁止把测试 URI 指向真实业务数据库。

| 验证 | 实际命令 | 结果 |
| --- | --- | --- |
| 活动策略+真实 Mongo/HTTP | ACTIVITY_TEST_MONGO_URI=mongodb://127.0.0.1:27188 node --test uniclub-backend/test/activityPolicy.test.js uniclub-backend/test/activityMongo.integration.js | PASS：27，FAIL：0 |
| 活动媒体真实 Mongo/HTTP | ACTIVITY_TEST_MONGO_URI=mongodb://127.0.0.1:27187 node --test uniclub-backend/test/activityMediaMongo.integration.js | PASS：15，FAIL：0 |
| 真实 sharp / SDK / 模拟 SCF | node --test uniclub-backend/test/activityMediaStorage.test.js | PASS：6，FAIL：0 |
| Python SCF | 后端目录：python3 -m unittest discover -s cloud-functions/quantification/upload-token -p 'test_*.py' | PASS：5，FAIL：0 |
| 活动限定权限回归 | node --test --test-name-pattern='event\|activity' uniclub-backend/test/security.test.js | PASS：25，FAIL：0 |
| 活动首页回归 | node --test --test-name-pattern='eventRouter' uniclub-backend/test/homePreview.test.js | PASS：2，FAIL：0 |
| 活动搜索/现有搜索权限 | node --test uniclub-backend/test/search.test.js | PASS：11，FAIL：0 |
| 量化兼容（涉及共享存储） | node --test uniclub-backend/test/quantification.test.js uniclub-backend/test/quantificationConfig.test.js | PASS：61，FAIL：0 |
| 前端活动类型/上传边界 | node scripts/test-activity-frontend.mjs | PASS：6，FAIL：0 |
| 新路由/实际临时 Nginx响应 | node scripts/test-seo-serving.cjs | PASS：6，FAIL：0 |
| 活动相关 TSX/TS ESLint | npx eslint 活动页面/组件/types/activity.ts/lib/activity*.ts --max-warnings 0（实际路径见下节） | PASS |
| TypeScript | npm run typecheck（包含于 build，两个 tsconfig） | PASS |
| 生产构建+既有静态生成 | npm run build | PASS |

测试条目数包含 Node 父测试/子测试，不代表同样数量的独立业务用例。只执行本轮涉及的活动、相关读权限/路由与共享存储回归，没有运行全站几百项测试。

搜索测试有一次普通沙箱执行无法监听本地 HTTP 端口，before hook 读不到 port 导致 11 条未能运行；授权本地端口后同命令 11/11 PASS。这是测试环境失败，不是搜索实现异常。构建有既有 Browserslist 数据过旧提示，无新增依赖或锁文件升级。

实际 ESLint 文件：

```text
src/pages/admin/ActivityEditor.tsx
src/pages/admin/ActivityMediaManager.tsx
src/pages/admin/ActivityRegistrations.tsx
src/pages/admin/AdminEventDetail.tsx
src/pages/admin/AdminEvents.tsx
src/pages/EventsPage.tsx
src/pages/EventDetailPage.tsx
src/components/ActivityAlbum.tsx
src/components/EventGallery.tsx
src/components/CalendarView.tsx
src/components/cards/EventCard.tsx
src/lib/activityApi.ts
src/lib/activityMeta.ts
src/lib/activityMediaPolicy.ts
src/lib/activityUpload.ts
src/types/activity.ts
```

## 3. 用户指定的 28 个 CASE

PASS（本地）表示真实业务代码/实际 Mongo 与 HTTP，或必要纯策略/SDK测试通过；下表保留本地阶段证据与测试数量。2026-10-09真实云受控验收与浏览器隔离DB闭环见第10节；不把本地结果或云受控PASS写成全量生产上线。

| CASE | 场景 | 实际证据 | 状态 |
| --- | --- | --- | --- |
| 01 | 管理员创建活动 | HTTP+Mongo 创建；浏览器保存草稿，稳定 ID | PASS |
| 02 | 普通成员不能创建 | 实际 JWT/DB admin 拒绝，包括伪造 role claim | PASS |
| 03 | 封面上传成功 | 浏览器真实 XHR 本机私有票据 PUT→sharp确认→数据库发布→封面显示；真实SDK签名 | PASS（本地）；真实COS封面上传/确认发布PASS（独立DB，第10节）；全量生产未上线 |
| 04 | 错误类型拒绝 | MIME/字节签名/sharp假图/HEIC/尺寸边界 | PASS |
| 05 | 封面失败无错误引用 | 未上传/缩略图异常/DB关联失败不显示，幂等确认恢复 | PASS |
| 06 | 普通成员报名 | HTTP+Mongo；浏览器等待审核 | PASS |
| 07 | 重复报名不污染 | 并发重复请求仅同一用户当前行 | PASS |
| 08 | 管理员待审名单 | 后端筛选和浏览器待审记录 | PASS |
| 09 | 管理员批准 | 原子审核人/时间/版本；浏览器确认批准 | PASS |
| 10 | 刷新看到批准 | 成员重新登录并刷新历史详情，报名已通过 | PASS |
| 11 | 拒绝报名 | 真实HTTP，拒绝历史与再申请同一身份 | PASS |
| 12 | 拒绝不误算未报名 | 真实名册/统计/筛选断言 | PASS |
| 13 | 全部未报名成员 | roster无账号行也保留；浏览器显示未报名两人 | PASS |
| 14 | 班级管理员计入 | roster管理员包含，非班级平台管理员排除；浏览器管理员未报名 | PASS |
| 15 | 并发容量 | standalone Mongo 多管理员并发批准、容量编辑不超额 | PASS |
| 16 | 结束后不接受报名 | 服务端拒绝；浏览器结束后无申请/取消可用操作 | PASS |
| 17 | 结束仍在往期 | 后端past过滤；浏览器2026年份+班会筛选可见 | PASS |
| 18 | 往期相册 | 真实HTTP上传/确认/私有短签名；浏览器两缩略图和大图 | PASS（本地）；真实COS相册读取与成员预览PASS（隔离DB，第10节） |
| 19 | 总结保存展示 | 独立summary与description；浏览器保存/成员读取 | PASS |
| 20 | 历史报名保留 | 结束/归档/隐藏/恢复/离班历史；浏览器管理员归档后批准记录仍在 | PASS |
| 21 | 名单API权限 | 普通成员不能全班名单/admin详情/审核/summary/旧attendees | PASS |
| 22 | 跨活动照片隔离 | A不能确认/排序/删除B；精确绑定activityId+mediaId | PASS |
| 23 | 替换显示新封面 | 两会话竞争/重复旧确认/删除tombstone；旧对象保留 | PASS（本地） |
| 24 | 旧活动兼容 | 原ID/类型/封面/RSVP哈希、计数回滚、未知分类可编辑 | PASS；未远程逐条核对生产旧数据 |
| 25 | 修改类型不丢数据 | explicit reclass保留legacyEventType，稳定ID和报名/封面 | PASS |
| 26 | 后台标题预览 | 浏览器标题点击进入真实独立详情tab | PASS |
| 27 | 不泄露密钥/隐私 | 安全DTO/间接读守卫/精确SDK签名/SCF服务secret只后端；新增云端鉴权见第10节 | PASS（本地）；SCF鉴权与限定IAM实网PASS；角色真实轮换NOT TESTED |
| 28 | 量化不受影响 | 61条原共享存储/配置回归；保持量化ZIP流程；新增token/list/旧ZIP Range检查见第10节 | PASS（本地）；限定量化读取实网PASS；完整云端上传回归NOT TESTED |

最终已执行用例无剩余 FAIL。真实云/生产未完成项明确保留，不以本地 PASS 覆盖。

## 4. 本地对象模拟浏览器业务闭环（历史记录）

使用专用127.0.0.1:9188 Vite→5068 Express→27186 standalone Mongo，测试库 classhub_activity_test_browser_20261008。三个虚构临时测试账号；不使用生产用户、生产 .env 或真实 COS。现有 Auth/Router/模型/ActivityService/ActivityMediaService 都是真实代码。

图片是本地生成的两张纯色 PNG，仅用于检查传输与引用，不是生产素材。对象 transport 是 test/fixtures/activityMediaMemory.js 的内存 HTTP PUT/GET，包含精确会话、私有头、禁止覆盖、上传ID及过期限制；确认检查实际大小。浏览器fixture在最终Content-Length绑定改动前启动，最终长度绑定/拒额外字节由重新启动的15条媒体Mongo/HTTP测试证明，当时真实浏览器云端验签尚未执行；2026-10-09正式XHR→真实COS新增结果见第10节。

正式前端只接受指定HTTPS COS域名；一开始本机存储URL被正确拒绝，草稿仍保留。为测试制作了仅 /private/tmp 的 serve 插件，限定 http://127.0.0.1:5068/test-storage/48hex 票据，保留 PUT/媒体ID/四项头/私有ACL/禁止覆盖/过期校验，拒绝 JWT 和其他域名路径。正式源码和生产构建没有该放宽规则。

按真实页面操作完成：

1. 管理员创建“活动 V2 隔离验收”，班会，容量2、截止留空、两段介绍。
2. 选本地封面→上传/确认→保存，详情封面加载成功。
3. 从后台标题点开预览→发布，页面显示已发布。
4. 成员通过现有登录页进入旧 /event/:id→提交申请→等待审核。
5. 管理员登录→待审→批准→成功1/失败0，已通过1；未报名显示管理员和另一测试同学。
6. 编辑开始/结束为已过去日期→即刻显示已结束。
7. 相册添加两张图→队列进度→已保存→相册两图。
8. 独立总结保存→归档，提示报名和照片继续保留。
9. 管理员切已通过筛选，仍有历史姓名/申请时间/审核时间。
10. 成员重新登录→往期2026/班会→稳定 /events/:id；原介绍、总结、已通过和两图俱在。
11. 刷新后已通过仍在；结束后申请关闭。
12. 点第一张大图→ArrowRight到2/2→Escape关闭。
13. 390×844布局与1280×900布局检查，DOM scrollWidth=clientWidth，无横向溢出；封面与两个缩略图 naturalWidth>0。

鼠标按钮/键盘大图已实测；真实触摸滑动、真实手机Safari、暗色设备与三年实际数据增长：NOT TESTED，触摸/缩放复用代码已审阅。

隔离服务中未实现无关新闻/公告/社交数据，部分首页请求会无结果。互动/评论计数 stub 与其现有 response shape 不完全一致，浏览器记录了这些模拟计数查询的 undefined 提示；它们不来自活动 API，未为此修改无关实现，也不声称整个fixture零console错误。相关活动权限间接读/实际搜索另有后端测试覆盖。

隔离验收已清理：测试 API 5068 正常退出并删除专用测试数据库；测试 Mongo 27186 与 Vite 9188 均正常退出（exit 0）；专用 Mongo 数据目录已删除，测试浏览器页已关闭。截图已复制到项目文档目录。未停止或修改用户原有 8081 开发服务。

## 5. 截图与自审

以下三张为原本地隔离验收的虚构测试数据：

- screenshots/admin-historical-registration.jpg：已归档、审核通过、申请/审核时间和名单统计。
- screenshots/member-archive-desktop.jpg：1280px历史详情，原介绍、本人通过、总结和相册。
- screenshots/member-archive-mobile.jpg：390px详情和两图。

2026-10-09新增五张云配置与虚构测试账号的真实COS浏览器证据，已复制到同一截图目录：

- screenshots/classhub-activity-iam-granted.png：活动上传策略与唯一关联角色。
- screenshots/classhub-activity-cors-saved.png：已保存的限定来源CORS。
- screenshots/classhub-activity-browser-cloud-saved.png：真实COS相册确认保存。
- screenshots/classhub-activity-browser-10mib-saved.png：浏览器10MiB图片完整保存。
- screenshots/classhub-activity-member-cloud-read.png：成员端真实COS图片读取。

界面延续现有 Header、银灰背景、宋体内容标题；未新增复杂控制面板或第二个基础编辑系统。发现中等窄屏报名筛选行搜索按钮文字换行，最终补充按钮不收缩/不换行及容器换行规则；浏览器复核搜索按钮white-space=nowrap、宽58px，最终截图已更新；没有新设计语言。

工程自审发现并修复的业务问题详见 DESIGN第10节，包括CAS容量、同名ID、离班历史、间接读泄露、封面迟到覆盖、删除复活、DB关联失败、201照片竞态、换桶/共享锁竞态及迁移原计数保护。

## 6. 最终验收清单

| 要求 | 状态 |
| --- | --- |
| 标题可预览、完整名单、未报名、审批/拒绝/批量、成员自身状态 | COMPLETED，隔离验证通过 |
| 五类新建、历史类型兼容、稳定ID、结束/年份回溯/总结/历史报名 | COMPLETED，隔离验证通过 |
| 媒体模型/API、同桶activity Prefix、精确签名、缩略图、相册管理 | COMPLETED（代码、本地验证） |
| 两个V2 SCF部署、鉴权及限定量化读取实网 | COMPLETED，12 checks PASS；不代表量化完整云端上传回归 |
| 活动IAM/CORS、PNG/JPEG/WebP真实图片直传/私有GET/缩略图 | 受控验收PASS，媒体报告46 checks PASS，已授权并保存配置 |
| 正式前端XHR长度、确认服务、隔离Mongo引用、管理员/成员相册 | PASS，真实COS与独立测试DB闭环 |
| 10MiB边界 | 合法10MiB PNG实网PUT/哈希/解码PASS；10MiB+1本地400 |
| 300秒签名到期与GET续签 / 临时角色凭据自然轮换续期 | PASS（旧403、新206且哈希/ETag一致） / NOT TESTED |
| 权限、重复/并发、跨活动照片隔离、软隐藏保留 | COMPLETED，隔离验证通过 |
| 增量迁移与回滚实现 | COMPLETED（本地验证） |
| 服务端鉴权补丁/配置与两个SCF部署 | 已执行；backend health 200，仅限定鉴权接入 |
| 活动V2生产数据库迁移/全量release部署 | 未主动迁移 / NOT DEPLOYED，等待后续明确确认 |
| focused lint/typecheck/build、文档 | COMPLETED |
| 生产操作边界 | 已按执行时确认完成鉴权/IAM/CORS及限定云验收；全量release与主动生产迁移未执行 |

## 7. 需要明确确认的生产步骤

先受控备份 Event/EventRSVP/新ActivityMedia、原配置、SCF代码/IAM/CORS；记录原数量/分类/封面/哈希和恢复步骤。先后端server auth兼容→新版SCF相同secret/固定桶与历史量化目录→验证未授权403和量化兼容→增量activity IAM/CORS→限定测试前缀真实验收→迁移dry-run审阅→正式apply/部署。

2026-10-09已完成备份、backend服务端鉴权补丁/配置、两个新版SCF部署、用户在执行时确认的活动PutObject IAM与CORS保存；鉴权、媒体、正式XHR→真实COS→隔离Mongo发布闭环和合法10MiB边界受控验收通过。签名到期及GET续签已PASS，临时角色凭据自然轮换/续期仍NOT TESTED；生产迁移dry-run审阅、正式apply与活动V2全量部署未执行。详见第10节。

不得把扩权角色连接到旧开放凭证函数。不得用生产学生测试；不得为了验收放宽业务Key到任意Prefix；不得删除历史COS文件。具体动作与维护/回滚次序见 COS 文档。

## 8. 修改文件清单（本轮）

仓库此前已有其他任务改动；以下只列本轮活动相关新增或编辑文件，不能把 git status 全部计入本任务。

### 前端与共享契约

```text
shared/activity-v2.json
src/types/activity.ts
src/lib/activityApi.ts
src/lib/activityMeta.ts
src/lib/activityMediaPolicy.ts
src/lib/activityUpload.ts
src/lib/contentFormat.ts
src/utils/eventTransform.ts
src/routeConfig.tsx
src/pages/EventsPage.tsx
src/pages/EventDetailPage.tsx
src/pages/admin/AdminEvents.tsx
src/pages/admin/AdminEventDetail.tsx
src/pages/admin/ActivityEditor.tsx
src/pages/admin/ActivityRegistrations.tsx
src/pages/admin/ActivityMediaManager.tsx
src/pages/admin/adminApi.ts
src/pages/admin/contentValidation.ts
src/components/ActivityAlbum.tsx
src/components/EventGallery.tsx
src/components/CalendarView.tsx
src/components/cards/EventCard.tsx
```

### 后端、共享存储与云函数源码

```text
uniclub-backend/models/Event.js
uniclub-backend/models/ActivityMedia.js
uniclub-backend/services/ActivityService.js
uniclub-backend/services/EventService.js
uniclub-backend/services/ActivityMediaService.js
uniclub-backend/services/storage/ActivityMediaStorage.js
uniclub-backend/services/storage/ScfStorageAdapter.js
uniclub-backend/services/QuantificationRepository.js
uniclub-backend/services/QuantificationStorageSettings.js
uniclub-backend/services/QuantificationService.js
uniclub-backend/services/GlobalSearchService.js
uniclub-backend/services/ContentCurationService.js
uniclub-backend/services/EngagementService.js
uniclub-backend/utils/activityPolicy.js
uniclub-backend/utils/activityMediaPolicy.js
uniclub-backend/middleware/activityReadAccess.js
uniclub-backend/routes/eventRouter.js
uniclub-backend/routes/activityMediaRouter.js
uniclub-backend/routes/adminRouter.js
uniclub-backend/routes/commentRouter.js
uniclub-backend/routes/engagementRouter.js
uniclub-backend/routes/curationRouter.js
uniclub-backend/routes/featuredRouter.js
uniclub-backend/routes/pastEventRouter.js
uniclub-backend/migrations/20261008_activity_v2.js
uniclub-backend/cloud-functions/quantification/upload-token/index.py
uniclub-backend/cloud-functions/quantification/upload-token/test_index.py
uniclub-backend/cloud-functions/quantification/download/src/app.js
uniclub-backend/cloud-functions/quantification/README.md
```

### 路由服务、测试与文档

```text
deploy/ecs/update-seo-nginx.cjs
deploy/ecs/nginx.conf
deploy/ecs/nginx-https.conf
vercel.json
scripts/test-seo-serving.cjs
scripts/test-activity-frontend.mjs
test/activityFrontend.test.ts
uniclub-backend/test/activityPolicy.test.js
uniclub-backend/test/activityMongo.integration.js
uniclub-backend/test/activityMediaStorage.test.js
uniclub-backend/test/activityMediaMongo.integration.js
uniclub-backend/test/fixtures/activityMediaMemory.js
uniclub-backend/test/security.test.js
uniclub-backend/test/homePreview.test.js
uniclub-backend/test/search.test.js
docs/activity-v2/ACTIVITY_V2_AUDIT.md
docs/activity-v2/ACTIVITY_V2_DESIGN.md
docs/activity-v2/ACTIVITY_V2_API.md
docs/activity-v2/ACTIVITY_V2_TEST_REPORT.md
docs/activity-v2/ACTIVITY_V2_COS.md
docs/activity-v2/screenshots/
```

临时浏览器fixture、Vite serve插件与纯色测试图仅在 /private/tmp，非正式应用文件。构建 dist 是生成输出，不单独视为源码变更。没有新增依赖。

## 9. 上线判断

**活动V2全量生产：NOT READY。云集成受控实网验收：PASS。** 已授权活动PutObject、保存CORS，并通过12项鉴权、46项媒体、正式XHR→COS→确认服务→隔离Mongo引用/管理员与成员相册及合法10MiB PNG验收。最终边界报告6 checks PASS（旧300秒签名403，新GET206且哈希/ETag一致），浏览器10MiB与封面完整保存；临时角色凭据自然轮换/续期仍NOT TESTED，GET续签不代表角色轮换。活动V2全量release未部署，未主动生产迁移；受控云集成验收已完成；正式迁移/全量发布尚未执行，需完成后重新判断生产就绪。

## 10. 2026-10-09 真实云受控验收与浏览器闭环

以下为已执行事实，时间按北京时间记录；本节不改变第2至第5节的历史本地测试结果。

| 项目 | 已执行结果 / 当前边界 |
| --- | --- |
| 服务器受控备份 | `/opt/classhub/backups/cloud-20261009-130946` |
| 旧SCF代码与云配置备份 | 两个旧函数代码ZIP及配置/IAM/CORS保存于 `/Users/alexmason/Documents/Codex/.classhub-cloud-20261009` |
| 生产backend补丁 | 仅安装 `ScfStorageAdapter` 服务端secret/header两处补丁并配置secret；health 200；无活动V2全量release部署、无主动生产DB migration |
| SCF配置/部署 | 用户亲自保存两个函数secret；两SCF V2部署成功；Python 3.12 / `index.main_handler` 与 WebNode18 保留 |
| 实网鉴权检查 | `auth-verification-1.json`，12 checks PASS |
| 拒绝检查 | 未授权upload/health/list/download 403；错误鉴权403；非固定Bucket/Region 403；量化/活动业务越界400 |
| 量化兼容读取 | 已授权token/list及旧ZIP 1字节Range读取PASS；没有验证完整量化云端上传流程 |
| 历史路径只读核验 | 真实旧桶列举41个ZIP，父目录均为 `quantification/`；DB引用也使用该Prefix |
| 桶配置 | 私有读写，无lifecycle；CORS已保存：来源仅 `https://csrg3b.top`、`http://localhost:8081`、`http://127.0.0.1:9188`；PUT/GET/HEAD/POST、Allowed-Headers `*`、ETag、600秒、Vary |
| 当前IAM | `ClassHubActivityUpload`（policy `289056588`）仅关联 `QuantificationUploadRole`，仅 `name/cos:PutObject`，资源 `qcs::cos:ap-guangzhou:uid/1306497854:lianghuacailiao-2026-1306497854/activity/*`；下载角色保留原 `QcloudCOSReadOnlyAccess`，未新增下载授权 |
| IAM截图 | `docs/activity-v2/screenshots/classhub-activity-iam-granted.png` |
| 媒体实网报告 | `/Users/alexmason/Documents/Codex/.classhub-cloud-20261009/media-verification-1.json`，46 checks PASS；PNG/JPEG/WebP共3个新原图+3个新缩略图 |
| 长度/覆盖/私有性 | 同一签名URL长度+1为403、正确长度200；覆盖409；匿名GET/HEAD403；元数据、原图哈希、缩略图私有读取PASS；旧ZIP Range读取206 |
| 真实浏览器确认发布 | 正式前端XHR→真实COS→现有 `ActivityMediaService.complete`→独立Mongo `classhub_activity_cloud_browser_20261009` 发布引用→相册“已保存”；DOM图片complete、400×300、来自真实COS；成员端preview正常相册1张 |
| 浏览器截图 | `docs/activity-v2/screenshots/classhub-activity-browser-cloud-saved.png`、`docs/activity-v2/screenshots/classhub-activity-browser-10mib-saved.png`、`docs/activity-v2/screenshots/classhub-activity-member-cloud-read.png` |
| 10MiB边界 | 合法10MiB PNG实网PUT200/读取哈希/完整解码PASS；10MiB+1本地上传授权边界400；最终 `boundary-state-1.json.report.json` 为6 checks PASS |
| 300秒签名到期与GET续签 | PASS；实际COS Date 2026-10-09 06:28:01Z（北京时间14:28:01），旧300秒签名403、新GET206，哈希/ETag一致 |
| 浏览器10MiB与封面 | 完整保存；`browser-cloud-verification.json`：独立DB Media3 READY、PHOTO2/COVER1、fileSize 2476/10485760/2476、mediaVersion3 |
| focused存储回归 | `activityMediaStorage.test.js` 再运行6 PASS；首次普通沙箱监听失败，授权重试PASS；不重复累计第2节的6项 |
| 临时角色凭据自然轮换/续期 | NOT TESTED；GET签名到期重签不代表运行角色凭据自然轮换 |
| 新测试对象留存 | 13个新私有云测试对象保留；清单 `/Users/alexmason/Documents/Codex/.classhub-cloud-20261009/retained-cloud-test-objects.json`；不删除历史对象 |
| 自有测试环境清理 | API5068正常exit0并drop专用DB；Mongo27186/Vite9188均exit0；测试端口全部释放 |
| 本地配置恢复 | 原后端`.env`缺SCFsecret，受控备份 `local-backend.env.before-scf-auth` 后配置与服务器一致的secret，权限0600；不记录值 |
| 本地开发服务 | 后端5050重启恢复、Mongo已连接、API health200，现有API开发会话保留；前端8081及/admin/events HTTP200 |
| 最终受控状态 | `CONTROLLED_REAL_CLOUD_VERIFICATION_COMPLETE`；自有Mongo数据目录 `/private/tmp/classhub-cloud-validation/mongo-browser` 在进程exit0后已清理 |

本节受控云集成验收PASS / COMPLETED；网站确认发布使用独立测试数据库及虚构用户，没有写生产活动数据。13个新私有测试对象保留，历史对象未改写或清理；临时运行角色凭据自然轮换/续期NOT TESTED。活动V2全量release未部署、未主动生产迁移，整体生产结论仍为 **NOT READY**。
