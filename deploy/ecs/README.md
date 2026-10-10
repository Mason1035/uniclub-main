# ClassHub 阿里云 ECS 部署

当前网站：https://csrg3b.top

原 IP 入口 `https://47.95.157.51` 保留兼容访问。

本次已完成部署，日常更新使用下面的脚本。服务器使用 Ubuntu、Nginx、Node.js 22、systemd 和 MongoDB 8.3.11。

## 从 Mac 更新网站

```bash
bash /Users/alexmason/Desktop/uniclub-main/deploy/ecs/push.sh
```

脚本在 Mac 构建前端，通过 SSH 上传，服务器检查 JS/CSS 文件是否存在、安装后端生产依赖，备份数据库/配置/上传目录，保留当前版本，再切换版本并重启后端。健康检查失败时自动恢复上一版本。前端新增依赖时先在项目目录执行 `npm install`。

默认读取专用密钥 `/Users/alexmason/Documents/Codex/.classhub-ssh/id_ed25519`。其他电脑可通过 `CLASSHUB_SSH_KEY` 和 `CLASSHUB_SSH_HOST` 指定已授权的密钥和主机。脚本不会上传 `.env`、COS 私有配置或 SSH 私钥。

## 正式域名接入

正式主域名为 `https://csrg3b.top`。此前 HTTP 虚拟主机误写为 `csg3b.top`，使正确域名落入默认 IP 站点并被重定向到 IP；现已纠正拼写并移除该错误域名入口。

2026-10-03 从 ECS 向 `223.5.5.5` 和 `1.1.1.1` 查询，`csrg3b.top` 与 `www.csrg3b.top` 的 A 记录均为 `47.95.157.51`。已通过公网 HTTP ACME challenge 验证，并使用现有 `certbot/certbot:v5.4.0` Docker 工具申请两个域名的独立证书：

- 证书：`/etc/letsencrypt/live/csrg3b.top/fullchain.pem`
- 私钥：`/etc/letsencrypt/live/csrg3b.top/privkey.pem`（不得输出或上传）
- 初始有效期：2026-10-03 17:39:47 至 2027-01-01 17:39:46（Asia/Shanghai）；续签后有效期会更新。

Nginx 实际配置为 `/etc/nginx/sites-available/classhub`，由 `/etc/nginx/sites-enabled/classhub` 链接启用。配置保留原 IP HTTP/HTTPS 虚拟主机和 `classhub-ip` 证书，并增加：

- HTTP `csrg3b.top www.csrg3b.top`：308 到 `https://csrg3b.top$request_uri`。
- HTTPS `csrg3b.top`：完整沿用原前端目录、API 代理、SPA fallback、上传限制、Streaming 和缓存配置。
- HTTPS `www.csrg3b.top`：308 到 `https://csrg3b.top$request_uri`，保留路径和查询参数。

所有 HTTP 虚拟主机保留 `/.well-known/acme-challenge/`，复用 `/var/www/classhub-acme`，不强制重定向 challenge。Certbot 容器内 webroot 为 `/var/www/acme`，挂载服务器 `/var/www/classhub-acme`。

生产 `/opt/classhub/shared/backend.env` 仅将 `BACKEND_URL` 改为 `https://csrg3b.top`，并向 `CORS_ORIGINS` 添加两个 HTTPS 域名，保留原 IP 来源；其他环境值不变。前端构建使用相对 API URL，SSH/部署目标仍为服务器 IP。没有重新部署应用或修改业务代码。

这两个公开配置项已保存于 [`domain.env.example`](domain.env.example)。配置生产环境时，将其中两项合并到服务器现有 `backend.env`，保留数据库、密钥及其他环境变量。

`nginx-https.conf` 为 HTTPS 模板；`nginx.conf` 为初始 HTTP 模板。发布脚本只更新 ClassHub 管理的上传、静态性能与 SEO 配置块，保留域名、证书和 API 代理。每次修改先备份，只有 `nginx -t` 成功才 reload；失败恢复原配置。

### 公开页面与索引边界（2026-10-08，本地待部署）

`update-seo-nginx.cjs` 仅处理 root 为 `/opt/classhub/current/dist` 的应用 server 块，不修改重定向站点、TLS 证书、API Streaming、上传限额或已有静态缓存规则。重复发布不会重复添加规则。它区分：

- `/`、`/privacy`、`/about`：直接提供构建时生成的匿名公开 HTML，保留现有网站 Shell 与样式；不从业务数据库生成成员信息。
- 已声明的登录、成员、后台路由及合法格式的内容 ID：提供 `app.html`，保持前端鉴权，并附加 `X-Robots-Tag: noindex, nofollow, noarchive` 与 `Cache-Control: private, no-store`。
- 未声明路由、错误格式的内容 ID：以真实 HTTP 404 提供现有 404 页面，地址保持原路径。合法 ID 是否存在继续由受鉴权保护的业务 API 判断，静态服务器不会查询数据库。
- `/api/` 与 `/api/social/posts`：保持原代理规则，增加禁止索引与不缓存响应头；`/uploads/` 增加禁止索引响应头，保留媒体缓存行为。响应头与 robots.txt 均不替代鉴权。
- `/robots.txt`、`/sitemap.xml`：按静态资源返回，Sitemap 使用 `application/xml`；`.html` 公开页面别名重定向到干净 URL，私有应用文件不作为独立页面对外访问。

发布包必须包含 `index.html`、`privacy.html`、`about.html`、`app.html`、`404.html`、`robots.txt` 和 `sitemap.xml`。缺失文件会在切换版本前停止发布。回滚至尚未包含 `app.html` 的旧版本时，成员路由兼容回退至旧 `index.html`，仍保留 `noindex` 头；404 响应同样可回退旧 HTML 并保持 404 状态。

本次没有执行正式发布。下一次授权发布后，应检查实际 Nginx 与 CDN 响应，不能只根据本地模板判断线上已经生效：

```bash
curl -I https://csrg3b.top/
curl -I https://csrg3b.top/privacy
curl -I https://csrg3b.top/about
curl -I https://csrg3b.top/settings
curl -I https://csrg3b.top/api/health
curl -I https://csrg3b.top/news/not-exist-page
curl https://csrg3b.top/sitemap.xml
curl https://csrg3b.top/robots.txt
```

相关本地验证：`node --test scripts/test-seo-serving.cjs scripts/test-performance-nginx.cjs`。若本机安装 Nginx，该测试会启动临时本地实例验证真实 HTTP 状态与响应头；未安装时仅跳过该集成项。私有路由不区分大小写，保持现有 React Router 行为；Nginx 将 `/About`、`/Privacy` 等公开大小写变体以 308 归一到小写。

Vercel 的 `vercel.json` 使用同一公开/私有路由边界。根据 [Vercel 官方 routes 说明](https://vercel.com/docs/project-configuration/vercel-json#routes)，其 `src` 默认不区分大小写，因此私有路由变体同样返回禁止索引的应用 Shell。Vercel 上公开 `/About`、`/Privacy` 变体直接返回对应静态页面并使用小写 canonical，而非 Nginx 的 308；本次未为此引入重复重定向系统。正式 Vercel 响应仍需在实际部署后检查。

### 静态性能配置（2026-10-05）

`update-performance-nginx.cjs` 将 gzip 级别设为 6，并启用 `Vary: Accept-Encoding`。仅带内容 hash 的 `/fonts/classhub/` 字体、补充字体 CSS/loader 与 `/branding/` 图片设置一年 immutable 缓存；HTML 继续 `no-cache`，旧的无 hash 资源不会被错误缓存一年。此模块只修改 root 为 `/opt/classhub/current/dist` 的 server 块。

HTTPS 模板使用兼容旧版 Nginx 的 `listen ... ssl http2`。激活脚本先检查 `nginx -V` 的 `--with-http_v2_module`；没有该模块则仅应用压缩与缓存。`nginx -t` 是上线前的实际配置验证门槛。这些本地配置修改须通过发布脚本上线后才生效，性能修复任务不会自行登录或改动正式服务器。

本次修复前备份：

- `/etc/nginx/sites-available/classhub.bak-20261003-183716`
- `/opt/classhub/shared/backend.env.bak-20261003-183716`（仅 root 可读）

启用域名 HTTPS 前另有一组备份：

- `/etc/nginx/sites-available/classhub.bak-20261003-184056`
- `/opt/classhub/shared/backend.env.bak-20261003-184056`（仅 root 可读）

现有 `classhub-cert-renew.timer` 每天检查两次，Certbot `renew` 会读取 `/etc/letsencrypt/renewal/` 中包括新域名在内的证书配置。续签后先检查 Nginx 语法，再 reload；不重复创建定时任务。 本次新域名证书的 `renew --cert-name csrg3b.top --dry-run` 模拟续签已经成功。

## 本次域名接入验证

2026-10-03 已完成以下专项检查：

- 两个公共 DNS 均将主域名与 www 解析到 `47.95.157.51`。
- Nginx 语法检查通过，HTTP 与 www 的跳转均指向 `https://csrg3b.top`，保留路径和查询参数。
- HTTPS 首页返回 200；浏览器正常显示登录页，地址保持 `https://csrg3b.top/auth`。
- `/settings` 返回 SPA 页面，刷新不产生 Nginx 404。
- `/api/health` 返回 `status: ok`，正式域名 Origin 的 CORS 响应正确。
- 实际 TLS 证书包含两个域名，模拟续签成功。
- 原 IP HTTPS 入口正常，应用版本未切换。

## 服务器目录

```text
/opt/classhub/
  current -> releases/已验证版本
  previous -> 最近的已验证版本
  releases/                 前端构建和后端代码
  shared/backend.env        生产环境变量及应用数据库连接
  shared/config/quantification-storage.json
  shared/uploads/           需要保留的上传文件
  shared/db-secrets.json     root 管理凭据，仅 root 可读
  shared/mongo.env           MongoDB 初始化环境，仅 root 可读
  backups/                  数据库、配置和上传目录备份
```

MongoDB 数据存放在 Docker 卷 `classhub-mongo-data`。桌宠设置仍在用户的 `settings` 字段，桌宠位置仍由浏览器按用户 ID 保存。数据库结构和用户权限机制沿用 ClassHub；本次没有新增表或执行批量设置迁移。

后端通过非登录系统账号 `classhub` 运行，只监听 `127.0.0.1:5050`。数据库只映射 `127.0.0.1:27017`，开启认证；网站账号只有 `uniclub` 的 `readWrite` 权限。只有 Nginx 的 80/443 对公网提供网站服务。

## 动态图片上传修复

动态附件保存在 `shared/uploads/social/`，通过每个版本的 `uniclub-backend/public/uploads` 软链接访问。发布包不包含本地上传文件。`activate.sh` 在切换版本前创建上传目录，并设置为 `classhub:classhub`、0750；后端在每次有附件的请求中也会创建缺失的子目录、检查可写权限，不再仅在开发环境创建目录。

图片仍限制为每张 10 MiB，视频每个 50 MiB，后端最多 5 个附件（当前界面最多 4 个）。Nginx 仅对 `/api/social/posts` 及其子路径放宽整个 multipart 请求至 251 MiB，容纳现有后端附件限额和请求开销，其他 API 保持 10 MiB。下一次执行 `push.sh` 时，发布脚本会给现有 `/etc/nginx/sites-enabled/classhub` 指向的配置补充此路由，保留域名、证书和其他设置；先备份原配置，再 `nginx -t` 和 reload，失败恢复原配置并停止发布。重复部署不会重复添加配置块。自定义站点文件名时，需要手动应用模板中的 `CLASSHUB SOCIAL UPLOAD` 配置块。

前端附件请求超时调整为 120 秒，并区分文件过大、格式错误、目录不可写及网络超时，失败保留输入。目录错误的服务端日志只记录错误代码（如 `EACCES`、`ENOENT`），不向浏览器暴露服务器文件路径。

针对性回归：`node --test uniclub-backend/test/socialUpload.test.js`。测试使用临时目录，不连接业务数据库或服务器。

## SSH 与常用维护

```bash
ssh classhub-ecs
systemctl status classhub nginx --no-pager
journalctl -u classhub -n 60 --no-pager
curl --fail http://127.0.0.1:5050/api/health
bash /opt/classhub/current/deploy/ecs/backup.sh
bash /opt/classhub/current/deploy/ecs/rollback.sh
```

首次正式上线没有更早的可用业务版本，因此 `previous` 暂时指向当前已验证版本；下一次成功发布后会指向真实上一版。回滚只切换代码，不自动回退数据库；涉及结构迁移时要单独规划数据恢复。

每次更新自动生成备份，本次也保留了从 Mac 导出的原始数据库备份。备份包含个人数据和配置，权限为 0700/0600；应定期保存到受控的异地备份位置。本次未配置周期性数据库备份任务。

## HTTPS

已经取得 Let's Encrypt 正式域名证书，主域名为 `https://csrg3b.top`；域名 HTTP 与 www 均跳转到主域名，保留路径和查询参数。原 IP 短期证书与入口保留。`classhub-cert-renew.timer` 每天检查两次，续签成功后先执行 `nginx -t`，再 reload。

```bash
systemctl list-timers classhub-cert-renew.timer --no-pager
journalctl -u classhub-cert-renew.service --no-pager
```

Certbot 由官方 `certbot/certbot:v5.4.0` 镜像执行，证书放在 `/etc/letsencrypt`。正式域名的 DNS、证书、Nginx `server_name`、`BACKEND_URL` 与 `CORS_ORIGINS` 已配置。本次未修改 COS 配置。

## MongoDB 内核兼容配置

服务器内核为 7.0.0。该 MongoDB 构建的 per-CPU 缓存在此版本范围存在兼容问题。容器设置 `GLIBC_TUNABLES=glibc.pthread.rseq=1`，实测 `serverStatus().tcmalloc.usingPerCPUCaches === false`，数据库持续运行及恢复数据正常。本次没有更换内核或重启服务器。容器使用 0.3GB WiredTiger 缓存及 900MB 内存上限；服务器另配置 2GB swap。

旧的失败容器保留在停止状态，以便查证。数据库版本与 Mac 的 8.3.11 一致，采用 `mongodump` / `mongorestore` 逻辑迁移。

## AI

AI 每日新闻的本地实现沿用统一 DeepSeek Assistant 与 NewsAPI 搜索；本次代码没有自动发布到正式服务器。部署前按 [`README.daily-news.md`](../../uniclub-backend/README.daily-news.md) 执行可重复迁移、检查既有 AI 密钥与 `NEWS_API_KEY`。生产主进程会按 Asia/Shanghai 每分钟检查持久化设置，默认每天 19:00 执行。数据库租约及批次提交防止重复运行并保护人工新闻；旧 createdAt 自动删除已停用。开发模式默认不自动调用付费 AI。

保留现有尚未完成的 Gemini 代码。按本次沟通，AI 服务后续改接 DeepSeek；本次不把它计为已上线功能。

## 验证范围

- 前端 build / TypeScript / lint 通过。
- 后端 267 项测试、桌宠 14 项测试通过。
- 线上 15 项只读 API 检查通过，包括成员设置、班费、量化材料、管理员权限和跨用户查询拒绝。
- 线上桌面/手机浏览器 7 项检查通过，登录页面正常、SPA 路由可访问、未登录不显示桌宠、手机无横向溢出、没有运行错误。
- 21 个集合及文档数量与 Mac 备份一致，保留 50 个账号和 49 条班级名单。
- 腾讯云上传凭证/下载列表连接检查通过；COS 对 HTTPS Origin 的 PUT 预检通过。
- HTTPS 公网验证、证书模拟续期、一键发布和发布前备份已实际执行。
- 生产库未执行测试账号创建、设置修改或真实材料上传/删除。账号写入和桌宠交互由本地测试覆盖。

现有登录流程使用学号和密码；新名单账号的初始密码遵循原项目规则。正式使用时请让成员在个人设置中修改初始密码。

参考：
- [MongoDB 兼容性检查源码](https://github.com/mongodb/mongo/blob/r8.3.11/src/mongo/db/startup_check_rseq.cpp)
- [Let's Encrypt 的 IP 证书说明](https://letsencrypt.org/2026/03/11/shorter-certs-certbot)
