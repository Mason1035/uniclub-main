# ClassHub SEO / GEO 审计与实施记录

日期：2026-10-08。范围：当前真实仓库与 https://csrg3b.top/ 的公开 HTTP 行为。本轮修改保留现有设计、路由组件、成员业务和技术栈；没有部署到正式服务器。

## 1. 已确认的架构与公开边界

| 项目 | 审计结果 |
| --- | --- |
| 前端 | React 18.3.1、React Router 6.26.2、TypeScript 5.9.3、Vite 5.4、Tailwind 3.4；客户端 createRoot 渲染，成员页面按需加载 |
| 后端 | Express / MongoDB，现有 JWT、账号存在检查和 tokenVersion 校验；管理员路由另有权限保护 |
| 渲染 | 原为纯 CSR；本轮仅在构建时静态渲染三个经过审核的公开页面，运行时保持原有 CSR 与交互 |
| 公开页面 | 原为首页、隐私说明、登录与 404；本轮新增项目介绍。可索引页面仅 `/`、`/privacy`、`/about` |
| 私有页面 | 公告、新闻、活动、资源、动态、成员资料、缴费、材料、AI、后台等沿用成员或管理员 UI 门禁，不生成公开正文 |
| Metadata | 原为共用 title / description 与不完整 OG，无 canonical / JSON-LD / 路由级 robots；本轮统一静态与客户端元数据 |
| 部署 | ECS Nginx 静态前端与 `/api` 反向代理，仓库另有 Vercel legacy routes；正常 ECS 发布用配置补丁而非直接替换模板 |
| CDN / WAF | 本地配置未发现按爬虫 UA 拒绝的规则。未检查云控制台安全策略，不能断言所有爬虫来源 IP 均可达 |
| 主题 | 当前代码固定浅色主题；本轮没有新增或改变主题系统 |

正式站点检查（从现有 ECS 发起，只读取状态与公开文档）：首页 200；`/sitemap.xml` 为 text/html 首页、200；`/hello/world` 同样 200；robots 对所有路径 Allow；www HTTP/HTTPS 均 308 至主域名。模拟 OAI-SearchBot 的首页请求为 200，这不等于验证官方爬虫 IP。匿名 `/api/social/posts` 当前正式站点返回 200，未收集其成员内容。

## 2. 问题清单与优先级

| 优先级 | 问题 / 原因 | 本轮状态 |
| --- | --- | --- |
| P0 | 动态详情 populate 完整 User，并直接返回作者，可能包含密码散列、邮箱、会话版本和私人设置 | 已限制为原界面使用的作者字段，并验证原权限规则 |
| P0 | 客户端门禁与 API 不一致：部分内部 JSON 允许匿名读取；社交列表与评论缺少与详情一致的私有/好友可见性判断 | **未完全修复**。收紧鉴权的原方案被自动审批拒绝，原因是可能改变现有匿名调用行为；已提供未应用补丁，等待所有者确认 |
| P0 | `/uploads`、头像、相册 poster/gallery 可通过直接 URL 获取，robots 无法提供访问保护 | **未修复**。直接给图片加 Bearer 校验会破坏当前 `<img>` 传输；需要单独设计经过权限校验的媒体获取或签名 URL，并处理历史缓存/COS 链接 |
| P1 | 未知地址返回 HTTP 200，造成软 404；所有成员 URL 都拿到首页外壳 | 已分离公开 HTML、私有 app.html、真实 404；同步正常部署流程 |
| P1 | 公开正文依赖 JS，非 JS 抓取方只能看到空根节点 / noscript | 已用真实组件静态生成访客 HTML，无数据库、账号、令牌或成员记录参与 |
| P1 | 没有 route metadata、canonical，OG 信息不完整；私有页继承公开元数据 | 已统一 title、description、robots、canonical、OG、Twitter；私有 / 错误页清除公开 schema / 分享元数据 |
| P1 | robots 无条件开放所有路径，缺少 Sitemap，API / 媒体无索引响应头 | 已限制公开路径与必要渲染资产，添加 Sitemap；API / 媒体加 noindex 指令；这些指令不代替鉴权 |
| P1 | 公开内容无法完整解释用途、真实功能和使用步骤 | 新增一个 `/about`，复用 Header、Footer 和隐私说明排版；不增加大量 SEO 页面 |
| P2 | IP HTTPS origin 仍可服务重复站点 | public canonical 固定主域名；IP 全局重定向待确认旧客户端 API 依赖后实施 |
| P2 | README 有旧 Uniclub / UTD / Gemini / Demo 说明，与现有实现不一致；缺少根 LICENSE 与正式 CHANGELOG | 未擅自选许可证或重写历史；需维护者核实后更新 |
| P2 | 未验证 Search Console / Bing 所有权与索引、真实爬虫访问 | 提供手动方案，未登录账号、提交站点或变更 DNS |

## 3. 已实施的优化与原因

### 公开 HTML 与一致元数据

- `shared/seo.json` 是公开 URL / title / description 白名单，防止意外把业务数据加入 Sitemap 或 schema。
- `src/seo/renderPublic.tsx` 使用原 Layout、Header、Footer、Homepage、PrivacyPage、AboutPage、NotFound，显式提供无认证访客状态。成员 query 的 enabled 为 false，不读取数据库、不生成真实班级内容。
- `scripts/build-seo.mjs` 在既有 Vite 构建后生成 `index.html`、`privacy.html`、`about.html`、`app.html`、`404.html`、`sitemap.xml`、`seo-routes.json`；复用相同 JS/CSS/Logo 与启动动画。
- 原有 createRoot 继续接管根节点；没有改成复杂 SSR 服务或引入新依赖。公开正文直接存在于 HTML，浏览器启用 JS 后保持原有交互。
- 每个公开页自引用 HTTPS canonical；忽略 query / hash / 大小写 / 尾斜杠变体。私有页与 404 没有指向首页的错误 canonical。
- 首页使用 WebSite，项目介绍使用 WebApplication；只描述可见真实功能。不添加 Organization、个人作者、评分、评价、虚构人数或受保护搜索的 SearchAction。
- OG / Twitter 使用已存在的本地 ClassHub Logo。未添加远程图片或大型图片依赖。
- NotFound 不再自行恢复旧 document.title，避免与统一路由 metadata 互相覆盖。

### 爬取范围与训练策略

- robots 仅允许三个公开页面及静态脚本、字体、Logo 等必要资产，拒绝业务路径、API、上传媒体和后台。
- OAI-SearchBot 与通用爬虫使用同一公开范围，没有 UA 专属正文、伪装或鉴权例外。
- 原站没有 GPTBot / Google-Extended 等训练专属授权规则。本轮不新增训练专属允许或拒绝规则；所有 agent 都只受到相同公开范围限制。是否单独拒绝训练抓取由网站所有者决定。
- Sitemap 只包含真实公开 canonical，不含成员/新闻/公告/缴费 URL；未把构建时间冒充内容 lastmod。
- 已收录的私有 URL 可能因 robots 限制无法重新看到 noindex，需要所有者在搜索平台使用移除工具并检查索引。robots 也不能保证外部平台删除已有副本。

OpenAI 区分 OAI-SearchBot 搜索发现与 GPTBot 训练，用户触发的 ChatGPT-User 访问也不能由 robots 充当访问控制。[官方爬虫说明](https://developers.openai.com/api/docs/bots)

### HTTP / 部署

- Nginx 优先精确提供公开 HTML，成员 / auth / admin / 合法内容 ID 路由仅提供私有外壳；未知地址和格式非法 ID 返回构建的 404 内容及真实 404 状态。
- Nginx 私有路由不区分大小写，与既有 Router 一致；公开大小写和尾斜杠变体 308 归一，保留 query。
- Vercel 复用其 routes 默认大小写不敏感匹配；公开大小写/尾斜杠变体返回 200 加小写 canonical，而不是 Nginx 的 308。配置契约测试通过，尚无 Vercel 实际部署验证。
- 已接入 ECS activate 的备份、nginx -t、配置恢复与重载流程，避免“模板改了但上线仍用旧配置”。保留 TLS、代理、上传大小限制、流式超时和哈希资产缓存。
- 格式合法但数据库中不存在的**私有**内容 ID 仍返回 200 应用外壳，由现有鉴权 API 返回 404；外壳禁止索引。没有为此引入数据库渲染服务。
- API / uploads 默认添加 noindex、private/no-store 与 Vary Authorization；个别现有图片路由仍可覆盖缓存设置，索引禁止头保留。不能据此宣称图片或匿名 API 已受保护。

## 4. 本轮修改文件

| 文件 | 修改原因 |
| --- | --- |
| `shared/seo.json` | 公开路由和 SEO 事实白名单 |
| `src/lib/seo.ts` | 元数据、canonical、schema 与安全 JSON-LD 序列化 |
| `src/components/PageMetadata.tsx`、`src/App.tsx` | 客户端路由切换时同步 / 清除元数据 |
| `src/seo/renderPublic.tsx`、`scripts/build-seo.mjs` | 构建时渲染原有公开组件 |
| `src/pages/AboutPage.tsx`、`src/routeConfig.tsx`、`src/components/Layout.tsx`、`src/components/SiteFooter.tsx` | 最小公开产品说明、路由与内部链接，匹配大小写语义 |
| `src/pages/PrivacyPage.tsx` | 说明新增的公开项目介绍页 |
| `src/pages/NotFound.tsx` | 消除标题恢复与统一 metadata 的竞争 |
| `index.html` | 默认私有 noindex 外壳；无 JS 时隐藏品牌遮罩，供公开 SSG 替换 |
| `vite.config.ts`、`package.json` | 生成 manifest、公开页 CSS 与完整 SEO 构建 / 测试命令 |
| `public/robots.txt` | 公开抓取范围和 Sitemap 地址 |
| `deploy/ecs/update-seo-nginx.cjs`、`deploy/ecs/nginx.conf`、`deploy/ecs/nginx-https.conf` | HTTP 路由、状态、canonical redirect 和索引头 |
| `deploy/ecs/activate.sh`、`deploy/ecs/README.md` | 确保常规部署应用 SEO 配置，记录回滚和限制 |
| `vercel.json` | 正确提供 XML / 静态公开 HTML / 私有外壳 / 404 |
| `uniclub-backend/index.js`、`uniclub-backend/middleware/privateResponseHeaders.js` | API / 媒体响应索引与缓存指令 |
| `uniclub-backend/middleware/privacy.js` | 限制作者数据投影，排除敏感字段 |
| `scripts/test-seo.mjs`、`scripts/test-seo-serving.cjs`、`uniclub-backend/test/seoPrivacy.test.js` | 公开数据、路由、真实 HTTP 与作者隐私专项验证 |
| `docs/SEO_GEO_AUDIT.md`、`docs/proposals/seo-member-api.md`、`docs/proposals/seo-member-api.patch` | 审计结果与未应用鉴权方案 |

以上只列本次任务触及的文件。仓库已有其他未提交修改，未重置、提交、发布或并入本报告的改动。

## 5. 验证结果

- `npm run build`：通过，包含 TypeScript app / node typecheck、Vite 客户端构建和公开页生成。
- `npm run test:seo`：11 项通过，包含实际临时 Nginx 的 HTTP 200 / 308 / 404、私有响应头、API 状态、大小写、Sitemap、资源路径与部署幂等性。
- `node scripts/test-not-found.mjs`：10 项通过；`node scripts/test-preloader.mjs`：22 项通过。
- 新增后端隐私测试 5 项通过；连同直接相关的既有鉴权 / 隐私 / 搜索测试共 106 项通过。未运行全站大型回归。
- `npx eslint src vite.config.ts --max-warnings 0`：通过。完整 `npm run lint` 仍被既有 V2 设计实验缓存中的不存在规则与旧 warning 阻塞，未修改无关实验。
- 浏览器核验：首页 → 项目介绍 → 登录 → 首页；公开 canonical / schema 恢复正确，登录时公开 canonical / schema / OG 被清除；404 页面正常，控制台无捕获的错误。直接 HTML 检查确认正文不在 noscript 内、资源均存在、没有成员记录或凭据。
- Nginx 测试需要脱离 macOS 沙箱读取系统网络参数，临时配置/日志仅在临时目录，本机监听；没有更改正式 Nginx。

## 6. 需要所有者手动完成

1. **部署与验收：** 使用当前完整构建与现有部署流程，检查三个公开 HTML、robots 与 Sitemap MIME，再检查未知地址 404、成员路由 noindex、正常登录、图片和管理员操作。当前正式站点仍是旧版本。
2. **鉴权决策：** 查看 `docs/proposals/seo-member-api.md`。补丁未应用；确认后再关闭匿名内部 JSON，并独立修复动态可见性及媒体授权。优先于扩大任何公开页面范围。
3. **Google Search Console：** 所有者登录后添加 `csrg3b.top` Domain property，按平台提供的实际值在 DNS 添加 TXT 并验证。也可选 HTTPS URL-prefix 的真实 meta 验证标签，放进源 `index.html` head，不使用示例假 token。[所有权验证](https://support.google.com/webmasters/answer/9008080)
4. **Bing Webmaster Tools：** 所有者可授权从已验证的 Search Console 导入，或按平台实际值做 DNS CNAME / meta 验证。导入涉及账号授权，应由所有者完成。[添加与验证站点](https://www2.bing.com/webmasters/help/add-and-verify-site-12184f8b)
5. **提交 Sitemap：** 部署后在两平台提交 `https://csrg3b.top/sitemap.xml`，URL 检查 `/`、`/about`、`/privacy` 的抓取 HTML、用户 canonical / 搜索引擎 canonical、索引资格与状态。检查私有 URL 移除情况。
6. **爬虫访问：** 在云控制台核查 WAF / Bot protection。需要允许搜索抓取时校验官方 IP 范围与身份，不能仅因自报 UA 放宽 API 或登录权限。当前本地 TLS 请求失败不构成真实机器人被拦证据。
7. **项目可信度：** 维护者核实个人作者归属、根许可证、README 旧功能与截图，再补充与真实实现一致的文档、版本记录及经过脱敏的公开截图。未擅自改变 GitHub 可见性或挑选许可证。

## 7. 效果监测与后续 GEO 建议

- Google：记录索引状态、展示、点击、CTR、查询词、公开页与 canonical 异常；AI Overviews / AI Mode 表现计入 Search Console 的 Web 搜索统计，不能把普通流量直接等同于 AI 引用。[Google AI 网站指南](https://developers.google.com/search/docs/appearance/ai-features)
- Bing：使用搜索表现、URL Inspection、crawl / sitemap 状态；账号具备 AI Performance 时检查 cited URLs、citation trends 与 grounding queries。数据只覆盖平台支持的 Microsoft / 合作方体验，不等于全网 AI 引用。[Bing AI Performance](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/)
- ChatGPT / Perplexity：在合规保留的服务器日志中观察公开路径的爬虫访问、HTTP 错误和可识别的 referral；人工抽样保存真实引用 URL、查询、日期与原始回答。referrer 可能缺失，UA 可伪造；抓取、访问和引用不是同一指标。未新增用户追踪 SDK 或把成员数据发送到分析服务。
- 维护 `/about` 中真实功能、限制和使用步骤；核实作者后再公开署名。优先修复 API / 媒体权限，不以公开班级内容换取索引。
- 只有出现真实公开文档需求时再增加少量使用说明；后续 public 内容需独立公开数据投影、授权和下架机制。无需向量库、第二套 AI API 或全站 SSR 重构。
- 未新增 llms.txt、虚构 FAQ / 评价 / schema 或大量 SEO 页面。Google 明确说明 AI 搜索没有额外专用 schema 或机器可读文件要求；基础可访问、真实文本和一致结构化数据优先。
- 不承诺收录、排名、AI 引用或流量增长。本轮没有新增依赖、环境变量、数据库 migration、训练授权例外或业务数据公开导出。
