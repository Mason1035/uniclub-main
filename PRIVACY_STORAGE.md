# ClassHub 浏览器存储审计

审计日期：2026-10-04。范围：应用源码、前后端依赖及当前浏览器请求代码；不包含托管平台或外部服务自身设置的 Cookie。

## 必要

- JWT 认证：`localStorage.token`、`authUser`；兼容路径使用 `authToken`（local/session）与后台 `sessionStorage.user`。未改动认证、数据库或业务 API 权限。
- 选择记录：`localStorage.classhub_cookie_consent`，版本 1，仅包含必要、偏好、统计的布尔值和更新时间。不可用时仅在当前页面会话中生效。
- 未登录首页不请求公告、新闻、活动、资源、动态、相册或精选内容。它只展示品牌、介绍和登录入口。

## 可选偏好（默认关闭）

| 内容 | 存储 | 控制点 |
| --- | --- | --- |
| 头像缓存 | localStorage `userProfileImage` | UserContext |
| 筛选/列表视图 | sessionStorage `classhub:view:*` | usePageViewState |
| 返回页面滚动位置 | sessionStorage `classhub:scroll:*` | ScrollToTop |
| 每个账号的桌宠位置 | localStorage `classhub:pet-position:<userId>` | pet-storage |
| 侧栏展开状态（当前组件未使用） | Cookie `sidebar:state`，7 天 | ui/sidebar |

网站统一使用浅色外观，不再跟随系统或保存主题选择。ThemeContext 启动时清除旧版 `theme` 偏好。上述可选偏好的读取和写入均要求偏好许可。撤回清除以上缓存，不清除认证，也不删除数据库的个人设置。当前 React 状态仍可使用；滚动位置可保留在当前页面内存。

## 可选资源统计（默认关闭）

ResourceDetailPage 的资源打开/预览/下载会单独提交 `/api/resources/:id/view` 或 `/download`。服务器现有 UserEngagement 存账号、资源与操作时间；并非匿名统计。本次只在这些计数请求前检查许可，不修改文件访问或后端业务。撤回仅阻止后续请求，不删除历史服务器记录。

## 未发现

应用没有登录 Set-Cookie、GA/GTM、Meta Pixel、广告 SDK、自动页面浏览上报或活跃的 sendBeacon/web-vitals 集成。不要据此宣称所有第三方都不处理数据。

## 外部服务

API 提供的远程图片、YouTube 缩略图；用户发起的腾讯云 COS 上传/下载；后台 AI 请求。原生 Capacitor 推送不在网页端初始化。字体在本地自托管。

## 路由边界

仅 `/`、`/privacy` 和原有 `/auth` 不需要成员会话；其他普通页面继续经过 Layout，后台继续经过 AdminGuard/服务端管理员校验。本次没有扩大任何 API 权限。会话变化取消并清空账户查询缓存；同源其他标签页的退出或切换账号同步触发现有认证校验。

注意：原有已发布公告/新闻/活动/资源等读取 API 本就有公开读取路径。页面登录守卫不是服务端权限；若这些已发布内容也要定义为成员私有，需要另行评审现有 API 访问策略。本轮首页不调用这些端点。

## 加载与版本

界面与悬浮入口仅在 ≥768px 展示。所有设备的可选用途默认关闭；已有同源有效选择在浏览器中继续适用。重大用途变化提升 `CONSENT_VERSION`，旧版本不再授权可选用途。没有引入 CMP 或新增追踪脚本。

## 本轮修改文件

- `src/App.tsx`：全局 Cookie 挂载、会话缓存清理和跨标签页同步。
- `src/routes.tsx`：公开隐私路由。
- `src/components/Layout.tsx`：仅首页与隐私页放行；成员验证后呈现内部控件。
- `src/components/SiteHeader.tsx`、`SiteFooter.tsx`：访客登录入口、隐私入口。
- `src/pages/Homepage.tsx`：访客六模块介绍、禁用访客数据请求、账户查询键。
- `src/pages/AuthPage.tsx`：登录回跳与公开首页入口。
- `src/context/AuthContext.tsx`：验证期间清除旧身份。
- `src/pages/admin/AdminGuard.tsx`：会话变化后重校验管理员身份，拒绝旧会话响应。
- `src/lib/session.ts`：存储不可用时安全读取和退出。
- `src/lib/privacy/consent.ts`：版本化选择、订阅、授权、撤回与缓存清理。
- `src/components/privacy/CookieConsent.tsx`：桌面卡片、设置、选择及焦点。
- `src/components/privacy/CookieIllustration.tsx`：原创 SVG。
- `src/components/privacy/cookie-consent.css`：桌面位置、紧凑模式、隐藏及 reduced motion。
- `src/pages/PrivacyPage.tsx`、`src/pages/privacy.css`：隐私说明与阅读样式。
- `src/context/UserContext.tsx`：头像缓存授权；ThemeContext 统一浅色并移除旧主题缓存。
- `src/hooks/usePageViewState.ts`、`src/components/ScrollToTop.tsx`：筛选、视图、滚动位置授权。
- `src/features/pet/pet-storage.ts`：每账号桌宠位置授权。
- `src/components/ui/sidebar.tsx`：闲置组件的侧栏 Cookie 也受授权控制。
- `src/pages/ResourceDetailPage.tsx`：资源计数请求授权，访问不变。
- `src/styles/editorial.css`、`src/styles/homepage.css`：克制登录入口与访客状态样式。
- `test/petStore.test.ts`：五项本轮相关存储回归用例。
- `PRIVACY_STORAGE.md`：本审计和实现说明。

## 验证记录

真实本地 Vite：访客 `/`、完整 Hero 与六卡片、390px 无浮层且无横向溢出、`/settings` 进入登录、`/admin` 仅管理员登录、公开 `/privacy` 均通过。

实际生产构建配隔离接口（不连接真实数据库）：初始访客零业务 API 请求；仅必要刷新不再弹出；自选偏好及全部接受保存成功；登录回跳、成员公告、搜索/资料控件、成员桌宠、跨标签页退出同步通过。资源预览在拒绝统计时不发送计数，开启后发送一次 `/view`。成员验证未使用真实账号，未验证线上服务器。

相关 ESLint、TypeScript、Vite build 与五项针对性测试通过；浏览器检查无 error/warn。保留原有构建的大包体提示。未执行无关全站回归，未部署。
