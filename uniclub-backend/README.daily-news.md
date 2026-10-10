# ClassHub AI 每日新闻

每日新闻复用 `DeepSeekAssistant`、现有 `AiSettings` 加密密钥与 `NewsAPIService` 联网检索。共享搜索层先使用原有 `NEWS_API_KEY` 请求 NewsAPI；合格来源不足时，由 `PublisherFeedSearch` 读取固定发布者的实时 RSS 补充。新闻问答与每日新闻共用这套检索和安全来源读取能力，没有新增 AI 客户端、AI API Key、Base URL、模型配置、搜索密钥或依赖。固定 RSS 无需密钥；NewsAPI 未配置或暂不可用时仍可使用实时 RSS，但来源和事实校验必须通过。

正式生成仍严格使用过去 24 小时的真实来源，未扩大窗口或使用模型记忆补足新闻。当前完整实网 dry-run 已成功生成两篇并通过事实审核，`persist: false`，没有修改真实新闻。下方原始失败验收保留为历史记录；本次结果见文末「手动生成 Bug 修复与补充验收」。

## 后台与权限

后台 AI 助手中的「AI 每日新闻」区域使用现有管理员权限。配置与状态：

- `GET /api/admin/ai/daily-news`
- `PUT /api/admin/ai/daily-news`
- `GET /api/admin/ai/daily-news/history`
- `POST /api/admin/ai/daily-news/run`，必须提交 `{ "confirm": true, "force": false }`
- 今天已经成功时，确认重新生成后提交 `force: true`。
- `POST /api/admin/ai/daily-news/dry-run`，管理员确认后真实联网和调用 AI，但不保存/归档任何新闻。

默认启用，执行时间 `19:00`，固定 `Asia/Shanghai`，每日 2 篇。数量允许 1–5 篇。类别为人工智能、科技、软件工程、科学、教育；来源不足时失败，不使用模型记忆凑数。

## 迁移

先备份，再在后端目录执行：

```sh
node migrations/20261006_daily_ai_news.js
```

迁移只给未标注 origin 的历史新闻设置 `manual`、补充缺失的每日新闻设置、创建批次/任务索引；不删除文章，不修改 AI 密钥，不创建班级用户。迁移可重复执行。未执行回填时，读取逻辑仍将缺少 origin 的新闻视为人工新闻。

## 调度与部署

当前正式架构为 ECS 上单个 systemd Node 进程。数据库连接完成后，生产模式启动一分钟一次的调度检查，并在启动时立即检查是否错过当天执行时间。每次从数据库读取时间设置，通过 Asia/Shanghai 判断当天日期与时间，不依赖服务器本地时区。

开发模式不会在重载时自动调用付费 AI，避免调试启动意外产生费用；管理员手动执行、显式启动调度 CLI 与鉴权 Cron 均可运行。

旧 `jobs/midnightCuration.js` 现在是统一每日新闻调度的兼容入口，不再运行 Dallas 午夜 Gemini importer。通常 ECS 主进程已经运行调度，不需要再启动该 daemon；即使重复启动，数据库锁仍阻止重复生成。

Vercel 配置使用 `/api/cron/daily-news`，每五分钟唤醒检查数据库设置；需要部署计划支持该 Cron 频率。北京时间 19:00 对应 11:00 UTC，业务判断仍集中在服务层。修改成非五分钟整数的时间时，Vercel 最迟下一次 tick 执行；ECS 的检查间隔是一分钟。Vercel 函数时长必须容纳完整任务，Cron handler 会等待执行结束，不依赖函数响应后的后台运行。

Cron 沿用已有 `CRON_SECRET`，缺失时 503，错误时 401；请求头必须是 `Authorization: Bearer <CRON_SECRET>`。旧 `/api/cron/news-curation` 是受同样保护的兼容别名。普通用户不能调用管理员生成接口。

## 幂等性与发布

`DailyNewsJob` 使用唯一日期 jobKey。管理员明确确认的重新生成使用独立 revision key。`AiSettings` singleton 上的原子租约跨进程互斥，owner token、过期时间及发布 CAS 防止旧进程在租约失效后发布。

生产与本地 MongoDB 均可能是 standalone，不能假定多文档事务可用。文章先作为不可公开的 staging batch 全部保存，确认完整数量后，单次 singleton CAS 同时切换 activeBatchId、成功日期与已提交批次。公开列表、首页、搜索只读取活动 AI 批次；详情只允许已提交批次。失败/中断的 staging 不公开，不替换上一批。

旧 AI 新闻在成功切换后逻辑归档，保留内容与讨论及旧链接。归档操作只匹配 `origin: ai_daily`、更早日期；管理员强制重新生成时，仅归档当日其他已提交 AI 批次。人工新闻及缺少 origin 的历史新闻永不参与自动归档。旧 importer 的不安全 createdAt 删除已经停用。

自动失败重试最多当天 3 次，间隔至少 15、30 分钟；真实搜索与共享 AI 请求另有有限重试。管理员可确认手动重试。失败记录只保存安全代码与提示，不包含密钥或完整 prompt。

## 本地明确运行

在后端目录使用已有环境：

```sh
node manual-curation.js --dry-run
node manual-curation.js
node manual-curation.js --force
```

`--dry-run` 会产生真实搜索和 AI 费用但不会修改新闻；`--force` 明确确认替换今天成功的批次。CLI 仅对拥有服务器/项目访问权限的操作员开放，不是公开调试 API。日志仅输出任务、来源和生成结果元数据。

正式服务器上的迁移、代码发布与搜索/AI 密钥可用性需要上线时实际验证。本地完成代码不会自动修改正式服务器。

## 历史实施与验收报告（2026-10-06，修复前）

> 本节保留修复前的架构、失败诊断及当时测试结果，不代表当前状态。其中 Everything-only 搜索、Auto 选题 reasoning、fake-IP 阻塞和实网生成未通过等结论，已由文末「手动生成 Bug 修复与补充验收」中的修复与实际验证替代。

代码、兼容迁移和相关自动测试已完成。真实互联网检索、原 AI 连接均已得到验证；**两篇当天新闻的完整实网生成仍未通过，不能认定全部验收完成**。当前来源时效和本机来源网页 DNS 是剩余限制。

### 1. 本轮文件

以下只列本轮相关文件；仓库中此前已有的字体、404、首页优化等其他修改保留。

| 范围 | 文件 |
| --- | --- |
| 后台与新闻前端 | `src/pages/admin/ai/DailyNewsSettings.tsx`、`src/pages/admin/ai/dailyNews.ts`、`src/pages/admin/AdminAi.tsx`、`src/pages/admin/AdminNews.tsx`、`src/pages/admin/adminApi.ts`、`src/pages/Homepage.tsx`、`src/pages/ArticlePage.tsx`、`src/components/cards/NewsCard.tsx`、`src/types/content.ts` |
| 共享 AI 与搜索 | `services/DeepSeekAssistant.js`、`services/NewsAPIService.js`、`services/WebPageFetcher.js`、`utils/webSafety.js`、`utils/newsAiContext.js` |
| 每日生成与发布 | `services/DailyAiNewsService.js`、`services/DailyNewsRepository.js`、`utils/dailyNewsPrompts.js`、`utils/dailyNewsErrors.js`、`utils/dailyNewsSchedule.js`、`utils/dailyNewsVisibility.js` |
| 模型与迁移 | `models/AiSettings.js`、`models/News.js`、`models/DailyNewsJob.js`、`migrations/20261006_daily_ai_news.js` |
| 路由、调度、旧入口保护 | `routes/admin/dailyNews.js`、`routes/adminRouter.js`、`routes/cronRouter.js`、`routes/newsRouter.js`、`routes/featuredRouter.js`、`routes/chatRouter.js`、`services/GlobalSearchService.js`、`services/ContentCurationService.js`、`services/NewsCurationService.js`、`jobs/dailyNewsScheduler.js`、`jobs/midnightCuration.js`、`manual-curation.js`、`index.js`、根目录 `vercel.json` |
| 验证与说明 | `scripts/check-daily-news.js`、`test/dailyAiNews.test.js`、`test/dailyNewsRepository.test.js`、`test/webSearch.test.js`、`test/security.test.js`、根目录 `scripts/test-daily-news-ui.mjs`、本文件 |

表中无 `src/` 或根目录标记的文件位于 `uniclub-backend/`。没有新增依赖。

### 2. 当前 AI Assistant 架构

React 管理员助手、新闻问答分别经现有 Express API 调用同一个 `DeepSeekAssistant`。该服务负责数据库配置读取、密钥解密、DeepSeek HTTP、reasoning、SSE、有限重试及错误映射。每日任务调用其结构化 JSON 方法；新闻问答继续复用原流式方法。

### 3. Daily AI News 如何复用

```text
ECS scheduler / authenticated Cron / confirmed admin run
    → DailyAiNewsService
        → NewsAPIService.search → real SearchResult[]
        → DeepSeekAssistant.structured → select events
        → WebPageFetcher → selected public source text
        → DeepSeekAssistant.structured → write each article + batch fact check
        → DailyNewsRepository → stage all rows → atomic active-batch commit
```

没有复制 DeepSeek HTTP 请求代码，也没有独立每日新闻 Provider Client。

### 4. 实际 DeepSeek 配置

使用已有 `AiSettings` 中 `_id = deepseek` 的加密密钥和原服务的 Base URL / Model 策略。实际本地连接检查使用 `deepseek-flash`，请求到原 `https://api.deepseek.com`，成功耗时约 333ms。每日设置只显示该配置，不允许录入第二套配置。

### 5. 是否新增 AI API 环境变量

**NO。** 没有新增任何每日新闻专用 AI Key、Base URL、Model 或 reasoning model 环境变量。

### 6. Web Search 工作方式

共享搜索层真实请求 NewsAPI `/v2/everything`，按类别查询，返回标题、URL、摘要、发布者、发布时间。先按 24 小时时效与 URL 去重形成最多 30 个候选；仅抓取最终选题的正文，不把全部候选全文送入模型。新闻问答继续使用同一个搜索层，未给 DeepSeek 填写未经证实的原生 `web_search` 参数。

### 7. 实际搜索 Provider

`newsapi`，沿用项目现有 `NEWS_API_KEY`。没有新增第二个搜索 Provider。

### 8. 真实联网证据

北京时间 2026-10-06 21:47 的开发诊断，实际调用共享搜索层，显式扩大到 48 小时用于检查供应商延迟：返回 5 条真实 HTTP(S) 来源，`searchPerformed = true`，`persist = false`。其中最新来源为 Fortune：

- 标题：‘Did they achieve their goal? Partially’: Putin admits weakness as Ukraine claims 51% hit to Russia’s oil refining capacity
- 发布时间：`2026-10-05T13:42:40.000Z`
- URL：<https://fortune.com/2026/10/05/ukraine-russia-oil-refining-gdp/>
- 这 5 条中符合 24 小时条件的来源：**0**。

这是搜索供应商接通的证据，不是事件适合 ClassHub、事实审核或当天发布成功的证据。48 小时诊断不会改变生成服务的 24 小时要求。此前 24 小时检索也曾得到 HTTP 200、0 条结果，48 小时查询有实际结果；旧密钥 401 已非最新状态。

### 9. 搜索失败

搜索不可用、空结果、证据不足分别标记安全错误码；不会让模型用训练记忆继续编新闻。任务失败时保留当前成功批次，后台显示联网失败，Cron 已执行的失败任务也返回 `success: false`。

### 10. 每天 19:00 触发

默认配置启用、19:00、2 篇。ECS 单个持久 Node 进程生产启动后每分钟检查数据库设置，重启时立即检查。Vercel 使用同一个受保护 Cron tick。开发环境保持前后端运行，但不在热重载时自动调用付费 AI；手动运行需管理员确认。

### 11. Asia/Shanghai

任务日期通过指定 `Asia/Shanghai` 的日期格式化取得；计划时间明确转换为 UTC+08:00，不依赖执行机器时区。19:00 北京时间对应 11:00 UTC。相关跨午夜与执行时刻测试通过。

### 12. 一天不重复生成

唯一日期 jobKey、数据库原子租约、owner token、租约过期检查及发布 CAS 共同保护。成功日期在切换活动批次的同一次数据库操作中登记。普通重复触发跳过；明确确认的 force 才允许当天重新生成。自动失败最多当天三次，带 15/30 分钟间隔。

### 13. 人工与 AI 新闻区分

同一 `News` 集合中的 `origin: manual | ai_daily`，新增 automationDate、generationBatchId、generatedAt、sourceReferences 和提交/归档时间。缺少 origin 的旧记录仍按人工新闻读取。

### 14. 人工新闻保护

归档查询必须匹配 `origin: ai_daily` 及已提交的旧批次；不会依据创建时间、标题、作者推断来源。旧 `clearOldArticles()` 广泛删除已停用，旧采集入口返回 410。真实数据库集成测试核对人工文章完整数据不变。

### 15. 昨天新闻保护与原子切换

当前 MongoDB 是 standalone，没有假定支持多文档事务。全部新文章先保存为隐藏 staging，核对数量，再一次 singleton CAS 切换活动批次及成功账本。公开列表、首页、搜索只读取活动批次；详情/问答只读取已提交批次。部分插入失败、租约失效、提交后状态写入失败均经过真实 standalone MongoDB 测试。旧批次逻辑归档，旧链接与讨论保留。

### 16. Citation

模型只能返回检索 ID。服务端校验 ID 属于实际检索/成功读取的来源，再映射 URL；模型输出 URL 或未知 ID 均拒绝。每篇至少两个独立发布者，或一个权威一手来源；公司社区、论坛、大学个人页面不能仅凭官方父域获得单来源例外。前端来源链接拒绝非 HTTP(S)、带凭据 URL。

### 17. Reasoning

复用同一个客户端的 thinking / reasoning_effort 和兼容降级。Auto：选题低强度 reasoning，写作与审核普通模式；High：选题和写作使用 high，审核普通模式。供应商明确拒绝 thinking 参数才兼容降级，最多两次请求。默认两篇共四次 AI 调用，五篇共七次，不含有限重试。

### 18. 后台设置

在现有 `/admin/ai#daily-news` 增加设置、任务状态、搜索诊断、最近十条记录和确认运行。复用已有 Panel、Field、Input、Button、Modal、Badge、Toast。运行时轮询四秒，空闲三十秒；保留未保存编辑，防重复点击。首页仍只显示一篇，优先最新成功 AI 批次，从未成功则沿用人工新闻。

### 19. 全部新增环境变量

**无。** 搜索沿用 `NEWS_API_KEY`，Cron 沿用 `CRON_SECRET`，AI 沿用原服务器配置及加密体系。没有新增 Secret，没有将 Key 放入浏览器。

### 20. 实际 migration

已在当前本地数据库运行兼容迁移。2 条历史新闻补充 `origin: manual`；迁移前后均为 2 条。忽略新增 origin 后的完整文章数据哈希一致，原 AI 配置哈希一致。缺失每日配置补为默认值，并创建批次文章唯一索引、任务唯一索引和查询索引。迁移可重复执行，相关集成测试通过。备份在本机临时目录 `classhub-daily-news-migration-cYFb6i`，文件权限 0600；上线仍须对正式数据库单独备份和运行迁移。

### 21. 实际 dry run 与其他验证

最新完整实网 dry-run：

```text
Search Provider: newsapi
Search Performed: true
Queries: artificial intelligence / technology / software engineering / science / higher education
Results: 0
Selected Topics: none
AI Provider: existing AI Assistant / deepseek / deepseek-flash
Result: SEARCH_UNAVAILABLE (search provider failure, no generated batch)
Persist: false
News Count Before: 2
News Count After: 2
```

此前严格 24 小时 full dry-run 结果为 `SEARCH_NO_RESULTS`。两次都没有发布文章。用户已确认当前为 **Developer 免费套餐**，官方说明文章检索有 24 小时延迟，且该套餐仅适用于开发测试环境。[NewsAPI 官方套餐说明](https://newsapi.org/pricing)

另外实际核查同一密钥的 `/v2/top-headlines?country=us&category=technology`：HTTP 200，totalResults 69，读取的 10 条中 2 条在过去 24 小时内。它们分别是智能自行车评测和 Apple Intelligence 移除工具报道，未能构成两篇符合选题与独立证据要求的当天精选；不能据此宣称完成整批生成。未将这些少量头条绕过来源核验发布，也没有改用另一搜索 Provider。[NewsAPI 头条接口文档](https://newsapi.org/docs/endpoints/top-headlines)

验证结果：

- 每日服务 14、真实 MongoDB/权限 12、共享搜索/AI 14、原管理助手 13、新闻问答 17：**70/70**。
- Cron/旧入口相关安全测试：**7/7**。
- 每日后台前端测试：**8/8**；原新闻 SSE/Markdown 前端测试：**10/10**。
- 修改文件 ESLint：通过。
- `npm run build`：通过，包含完整 typecheck。
- `npm run lint`：未通过；原 V2 实验 `.vite-cache` 缺少 `react-internal/safe-string-coercion` 规则 1 个错误，V2 快速刷新/缓存 4 个警告。本轮没有修改该实验。
- 本地前端 8081、后端 5050 health、首页新闻 API：HTTP 200；未登录后台设置：HTTP 401。

### 22. 已知限制与未完成验收

1. 现有 Everything 搜索没有足够的 24 小时内来源，完整两篇当天新闻实网验收未完成。当前 key 已有效，用户确认是 Developer 免费套餐；该套餐的延迟和适用环境不满足正式每日实时新闻需求。头条接口虽返回少量较新条目，仍未得到足够的合格证据。没有扩大正式生成窗口、另加 Provider、购买套餐或伪造来源。
2. 本机来源网页测试出现 DNS `198.18.0.77`，属于 fake-IP/benchmark 地址，被 SSRF 校验拒绝。没有放宽防护；实际公网正文读取仍需在正常公共 DNS 环境验证。
3. 没有已登录的自动化后台浏览器会话，因此后台登录后的视觉验收尚未完成；未注入 token 或绕过权限。组件/交互测试通过。
4. 事实核验包含严格来源契约和 AI 审核，但不能保证模型从不误判；证据不足会失败，不自动凑数。
5. 未部署正式服务器，也未修改正式环境密钥。Vercel Cron 频率与完整任务运行时长需要对应部署计划支持；当前主部署为 ECS。

本地查看入口：<http://localhost:8081/admin/ai#daily-news>。前后端保持运行。

## 手动生成 Bug 修复与补充验收（2026-10-06）

本节记录修复后的当前实现、真实 dry-run，以及随后读取数据库确认的既有手动任务结果；上一节的失败状态作为历史诊断保留。dry-run 与真实发布是两个不同的验证记录。

### 1. 失败原因与修复

- **搜索套餐与时效窗口不相容。** 原实现仅调用 NewsAPI `/v2/everything`；Developer 免费套餐的 24 小时延迟使严格 24 小时查询缺少可用来源。重复相同空查询不会改变供应商延迟。现改为一次有界 `NewsAPIService.searchBatch()`，合格来源不足时由共享 `PublisherFeedSearch` 读取 BBC、The Guardian、NASA、Ars Technica、ScienceDaily 的固定 RSS。无需新增搜索密钥或购买套餐，仍保持 24 小时要求。
- **原始条数不等于合格来源数。** 新增 `validRecentSource()`，统一 URL 安全检查、去追踪参数、日期及基本标题/摘要质量。按规范化 URL 去重后的合格数量决定实时补充；重复或低质量结果不能阻止补充。主检索没有有效来源且实时补充失败时显示 `SEARCH_UNAVAILABLE`，不误报为 `SEARCH_NO_RESULTS`。
- **本机 fake-IP DNS 阻止正文读取。** 只有系统 DNS 的全部返回值均属于 `198.18.0.0/15` 时，来源读取器才通过固定 HTTPS Cloudflare DoH 获取真实公网 IP。不会直接连接 fake-IP；普通私网或公私混合解析仍拒绝。URL 校验、返回 IP 校验、逐跳重验、socket DNS pinning、MIME 和字节上限均保留。
- **Auto 推理预算可能耗尽 JSON 输出。** 原 Auto 选题强制 thinking，4096 token 预算可能全部用于推理而没有结构化结果。Auto 现在使用普通结构化选题、写作及审核；High 仍沿用显式启用 thinking 的策略，未在本次实网验收中验证 High。
- **问答使用同源实时补充。** 最新问题的主检索限制在过去 24 小时，非空陈旧结果不能阻止 RSS 补充。原检索超时或用户取消后立即结束，不再启动另一轮检索。DeepSeek 和新闻问答的既有客户端、权限及密钥体系继续共用。

### 2. 当前数据链路

```text
confirmed admin run / ECS scheduler / authenticated Cron
    → DailyAiNewsService
        → NewsAPIService.searchBatch
            → NewsAPI /v2/everything
            → PublisherFeedSearch → fixed publisher RSS when evidence is insufficient
        → shared validRecentSource → canonical, recent, qualified candidates
        → existing DeepSeekAssistant.structured → select distinct events
        → WebPageFetcher → validated public source text
        → existing DeepSeekAssistant.structured → write articles + batch fact check
        → DailyNewsRepository → stage all rows → atomic active-batch commit
```

RSS 和网页仍是不可信资料，不能作为系统指令执行。模型只返回来源 ID，由服务器映射实际检索且成功读取的 URL。每篇必须有两个独立发布者或权威一手来源；没有降低这个门槛，也没有为凑数添加无关来源。来源不足、正文不可用或事实审核失败时继续保留上一批。

### 3. 真实 dry-run 结果

本次使用已有 AI Assistant 配置和真实互联网来源，未使用测试 fixture 代替检索、网页或模型回答。

```text
Search Provider: newsapi + publisher-rss
Search Performed: true
Freshness Window: 24 hours
Qualified Candidates: 30
Generated Articles: 2
Read Sources Used: 5
Each Article: 2 independent publishers
Reasoning Mode: Auto (thinking disabled)
Fact Check: both supported=true, original=true
Persist: false
Real News Count Before: 2
Real News Count After: 2
```

| 选题 | 摘要字符数 | 正文字符数 | 来源与审核 |
| --- | ---: | ---: | --- |
| OpenAI 代理未经授权访问事件 | 89 | 829 | 两个独立发布者；`supported: true`、`original: true` |
| Ofcom 调查 Instagram Instants | 105 | 1218 | 两个独立发布者；`supported: true`、`original: true` |

此次验证确认实时补充、正文读取、两篇原创生成及事实审核完整运行。它不会证明所有日期都必然有足够证据；不足时仍应安全失败。由于 `persist: false`，这次 dry-run 没有更换活动批次、归档旧新闻或新增真实文章。下面的真实保存记录来自另一项既有手动任务，不能归因于这次 dry-run。

### 4. 相关验证

- 相关后端测试：**85/85 通过**。
- 每日新闻前端测试：**8/8 通过**。
- 修改范围 ESLint：通过。
- Typecheck：通过。
- Build：通过。
- 没有新增环境变量、密钥或依赖，没有为了本次修复执行数据库迁移。

测试包含重复/低质量来源触发实时补充、陈旧来源过滤、检索故障语义、私网/重绑定与 fake-IP 公网重解析保护、取消和超时，以及原每日新闻来源与发布契约。部署和正式数据库验收仍需在正式环境执行；本节只陈述当前本地实际验证结果。

### 5. 既有手动任务的真实保存与重复触发验证

修复后再次调用不带 `force` 的 `requestRun()`，任务按防重规则安全跳过，没有另行替换当天新闻。随后读取当前本地数据库，确认当天已有手动任务成功保存；这项任务开始于北京时间 **2026-10-06 22:23:22**，完成于 **22:23:50**。

```text
Trigger: manual
Status: success
Article Count: 2
Search Result Count: 30
Sources Used: 4
Active Date: 2026-10-06
Current Search Error Code: null
Repeated Run Without Force: skipped
Original Manual Articles: 2, unchanged
```

| 当前有效 AI 新闻选题 | 正文字符数 | 已保存的真实来源 |
| --- | ---: | --- |
| OpenAI 代理相关新闻 | 973 | Ars Technica + The Guardian |
| Ofcom / Instagram Instants | 1054 | The Guardian + BBC |

两篇均引用过去 24 小时内的真实来源，每篇满足两个独立发布者要求。本轮比较原人工新闻数据哈希一致，原 `manual` 新闻仍为两条。上述正文长度和四个来源属于成功保存的手动任务，与前面 dry-run 的正文长度和五个已读取来源是不同运行的结果。

本地可用性检查：前端 `http://localhost:8081/admin/ai` 和后端 `http://localhost:5050/api/health` 均返回 HTTP 200。没有为验证重复执行使用 `force`，也没有额外替换已成功的本地批次。当时正式服务器尚未发布；后续发布记录见第 6 节。

### 6. 生产环境来源故障修复（2026-10-06）

线上手动任务只返回 10 个候选，最后因 `INSUFFICIENT_SOURCES` 失败。本机与线上核心源文件 SHA 在修复前一致；差异来自 RSS 网络可达性和解析行为：BBC 与 Guardian 在生产网络连接被重置；NASA 的 RSS 正文包含作为 CDATA 文本的 HTML `DOCTYPE`，解析器却将它误认为 XML DTD 并拒绝整条一手来源。旧逻辑还会在摘要质量检查和来源多样性处理前截取结果，短摘要可能占掉有效候选名额。

修复包含：只拒绝 XML CDATA/注释之外的实际 DTD/ENTITY；先按过去 24 小时及摘要质量过滤再限量，并轮换发布者保留多样性；把单源超时上限从 8 秒调整到 15 秒；增加线上已实测可读的 NVIDIA、Google 官方 RSS；将每个固定来源的安全状态和候选数传到管理诊断；当来源池只有一个二手发布者且无法支持目标篇数时，在调用 AI 前明确报告原因。没有放宽 24 小时时效、来源独立性或 URL/SSRF 校验，也未添加环境变量、依赖或数据库迁移。

用修复后的代码、线上现有配置及 High 深度思考模式完成了一次真实 dry-run：**19 条合格候选，4/8 个订阅读取成功，4 个独立发布者，9 条一手来源，生成并核验 2 篇新闻**（NVIDIA 官方来源与 NASA 官方来源各一篇）。dry-run 前后线上新闻数和任务数均为 **1 / 1**，没有发布或创建任务。随后在正式运行版本上单独只读检索，得到 **30 条合格候选、5/8 个订阅可读、5 个发布者、20 条一手来源**；BBC/Guardian 仍受生产网络连接限制，但可访问来源已足以满足任务。

后端热修复已发布到 `/opt/classhub/releases/20261006-151829-daily-news-source-fix`，切换前版本仍保留在 `/opt/classhub/releases/20261006-224634` 以便回退。仅替换每日新闻相关的三个服务文件，没有运行 `npm install`、迁移或更换线上配置。重启后服务为 active，`/api/health` 返回 HTTP 200。

本次相关后端测试 **76/76**、每日新闻前端交互测试 **9/9** 通过；两份管理页面文件 ESLint 通过，前端 typecheck 和 production build 通过。上述测试与 dry-run均未覆盖每个时间窗口或所有源站的长期可用性；最近一次实际来源状态应以管理页诊断为准。
