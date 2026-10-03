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

`nginx-https.conf` 同步最终生产配置；`nginx.conf` 的初始 HTTP 模板包含正确域名。正常发布脚本不会覆盖服务器 Nginx 配置。每次修改先备份，只有 `nginx -t` 成功才 reload。

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
