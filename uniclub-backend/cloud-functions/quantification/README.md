# ClassHub 量化材料云函数接入

> Activities V2 安全扩展：新版网站可用服务器专用 `CLASSHUB_SCF_AUTH_SECRET` 调用两个函数。启用该变量后所有调用均校验 `X-ClassHub-Service-Auth` 和固定 Bucket / Region；活动图片必须启用鉴权且返回 `secured: true`。下文的开放量化模式只为原部署兼容，不能用于具有 `activity/` 权限的角色。部署顺序、IAM、CORS、历史目录白名单及真实云端 **NOT TESTED** 边界见 [活动媒体技术说明](../../../docs/activity-v2/ACTIVITY_V2_COS.md)。

## 管理员如何配置

打开网站 **管理后台 → 量化材料 → 存储配置**，填写并保存：

| 网页字段 | 对应参数 |
| --- | --- |
| 存储桶 | `COS_CONFIG.Bucket` / `COS_BUCKET` |
| 地域 | `COS_CONFIG.Region` / `COS_REGION` |
| COS 地址 | `COS_CONFIG.Endpoint` / `COS_ENDPOINT` |
| 上传目录 | `COS_CONFIG.UploadDirectory`、`DIRECTORY_PREFIX` / `COS_UPLOAD_DIRECTORY` |
| 上传凭证云函数 | `TOKEN_ENDPOINT` / `SCF_TOKEN_ENDPOINT` |
| 下载云函数根地址 | `FUNCTION_URL` / `SCF_FUNCTION_URL` |

下载根地址无需附加路径；网站自动调用 `/list` 与 `/download`。上传 Endpoint 必须是所填桶和地域对应的 HTTPS COS 域名。目录支持最多 4 层 ASCII 字母、数字、下划线和短横线。

网站将配置原子保存到 `uniclub-backend/.quantification-storage.json`，文件权限为 0600，并已加入 `.gitignore`。保存后立即生效，重启网站也会保留。原有 `.env` 不会被改写。旧配置中已经停用的云函数鉴权字段在读取时忽略，下次正常保存时只写入六项存储配置；无需数据库迁移。部署或迁移网站时应将这个私有文件纳入受控备份，并赋予后端账号读取/写入权限。

当前部署应由一个网站后端进程管理配置；已有文件或未清理上传时不允许直接更换桶/地域。修改目录只作用于新上传，确认旧上传及下载旧材料时使用数据库记录中的旧目录；云角色应仍允许访问这些历史目录。

## Function URL 调用与本地云函数源码

SCF Function URL 的腾讯云传输授权方式沿用现有部署；应用层支持服务器共享密钥校验。未配置 `CLASSHUB_SCF_AUTH_SECRET` 时，量化调用保留旧普通 GET 接口兼容；配置后网站发送 `X-ClassHub-Service-Auth`，两个函数校验后才允许访问。活动业务必须采用该受保护模式并返回 `secured: true`，不能在旧开放模式下追加活动权限。量化原响应仍不要求 `integrationVersion`。

在网站填写六项配置，保存后点击“检查已保存配置”。检查只读取接口，不上传或删除真实文件。通过表示凭证及列表接口可访问；实际 ZIP 上传、确认和下载还依赖运行角色权限及 COS 跨域配置。

仓库源码支持上述受保护模式，并保留未配置新 secret 时的量化兼容分支。重新部署时先按活动媒体技术说明完成 server auth、固定 Bucket/Region 与实际历史目录白名单：

- 上传凭证函数使用 `upload-token/index.py`，Python 入口 `index.main_handler`，无第三方依赖。
- 下载函数使用 Node.js Web 函数；部署包根目录包含 `scf_bootstrap`、`package.json`、`package-lock.json`、`src/app.js`、`node_modules/`。在 `download/` 运行 `npm ci --omit=dev`、`chmod +x scf_bootstrap`，再打包目录内文件，避免多套一层目录。

桶、地域和目录通过网站服务器的请求参数传给 SCF。运行角色提供的 `TENCENTCLOUD_SECRETID`、`TENCENTCLOUD_SECRETKEY` 和 `TENCENTCLOUD_SESSIONTOKEN` 保留，用于访问 COS。SCF 的 IAM、运行环境以及 COS 跨域规则仍在腾讯云控制台配置。

## 上传、确认与下载流程

学生上传继续使用上传凭证函数的 COS 临时凭证，网站服务器只向已登录且拥有本次上传会话的用户签发精确 PUT/分片地址。新材料以 `上传目录/原文件名.zip` 保存，不再写入多层 ID/staging 路径。上传角色只执行写入和分片操作。

确认提交通过下载函数 `/download` 的签名地址执行有界 Range GET，取得总大小、ETag 和 ZIP 目录结构；GET 签名不用于 HEAD。读取由下载角色授权，不再要求上传角色具有 HeadObject、GetObject 或 PutObjectCopy 权限。平铺文件已经位于正式路径，核验后直接保存网站提交记录。

旧版本的 staging 上传仍可重新确认：网站流式读取下载签名地址，再使用上传角色签名的 PUT 恢复到原文件名。旧对象保留；确认成功后材料列表不重复显示旧副本。没有批量迁移、删除或修改原有学生材料。

COS 中已有同名文件时提示修改文件名；网站签名带 `x-cos-forbid-overwrite`，保护原材料。上传对象绑定本次上传编号，避免其他账号通过同名文件冒认提交。分片初始化同样绑定该编号并设置禁止覆盖。

后台“存储桶材料”直接通过 `/list` 获取当前目录全部 ZIP，支持刷新、搜索、排序、选择和单个/批量下载。文件列表无需班级名单、注册账号映射或数据库提交记录。名单提交情况单独显示，用于统计已提交和未提交人数；桶内历史文件不会按文件名被自动认定为某位学生的正式提交。

## 运行角色与 COS 跨域

- 上传角色：PutObject，以及 InitiateMultipartUpload、UploadPart、ListParts、CompleteMultipartUpload、AbortMultipartUpload 等已有上传操作。无需为确认提交添加读取、复制或删除权限。
- 下载角色：GetBucket、HeadObject、GetObject，覆盖当前目录和保留的历史目录。
- 腾讯云运行角色提供的三项临时环境凭证保持原机制。
- COS 维持私有读写；浏览器跨域规则允许实际网站 Origin、PUT，以及 Content-Type、x-cos-acl、x-cos-forbid-overwrite、x-cos-meta-classhub-upload。继续使用原 COS SDK 模式时保留 Authorization、x-cos-security-token 的允许规则。
- SCF 模式“清理过期上传”处理网站过期会话与未完成分片，COS 中的材料保留。原 COS 模式的清理和封存逻辑保留。

## 请求及响应

所有云函数请求都由网站服务器发起。配置 `CLASSHUB_SCF_AUTH_SECRET` 后通过专用 header 传递应用层鉴权，不在 URL/query/body 暴露密钥；未配置时仅量化旧兼容调用不添加该 header。ClassHub 登录 JWT 用于网站自身 API，COS 临时凭据用于对象签名；二者均不替代 SCF 的应用层鉴权。

### 上传凭证 GET 根地址

参数：`bucket`、`region`、`prefix`。

```json
{"success":true,"bucket":"example-1234567890","region":"ap-guangzhou","credentials":{"TmpSecretId":"临时值","TmpSecretKey":"临时值","Token":"临时值"}}
```

该响应只在网站服务器内使用。学生初始化/刷新接口返回 `mode: "signed"` 和时间信息，不返回 SecretKey。每个 PUT/分片经登录用户身份、收集期和会话校验后，网站签发 300 秒 URL，绑定方法、对象键、分片编号、UploadId、Content-Type；单文件上传还绑定私有 ACL、禁止覆盖和上传编号。文件字节直传 COS，继续显示进度和支持取消。

### GET /list

参数：`bucket`、`region`、`prefix`，可选 `limit`（1–1000）、`marker`。

```json
{"success":true,"prefix":"quantification/","count":0,"files":[],"nextMarker":""}
```

返回一页 ZIP 文件；`nextMarker` 非空时可请求下一页。旧 staging 文件可兼容读取；网站会标记旧临时路径，并对已恢复的副本去重。网站连接检查使用 `limit=1`；名单、已提交/未提交统计继续以网站数据库中的真实用户及已确认提交为准，不将桶内文件名视为身份。

### GET /download

参数：`bucket`、`region`、`prefix`、完整 `key`，可选 `filename`。检查目标存在后返回 300 秒 COS URL。

```json
{"success":true,"name":"学号_姓名.zip","url":"https://对应COS域名/对象路径?签名参数"}
```

网页使用提交编号请求网站 API，后端从数据库取存储键并执行本人/管理员权限校验；学生不能指定任意桶或 key。返回 URL 再次检查桶、地域、对象路径和签名参数。

## 验证范围

配套自动化测试使用临时配置文件、内存数据、模拟 COS 和真实 COS SDK 签名，不访问真实 Mongo 或腾讯云。涵盖站内权限、六项配置持久化、旧配置字段兼容、三个普通 SCF GET 请求、无版本标记的原接口响应、并发/过期配置版本拒绝、地址校验、COS 分片签名、ZIP 确认以及历史目录下载。真实 SCF 部署、运行角色、COS 跨域和真实大文件上传需在部署后验收。
