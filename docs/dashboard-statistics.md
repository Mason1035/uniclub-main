# 数据概览统计与图表

`/admin` 保留现有后台外壳和四身份权限。页面使用 React、TypeScript、SVG/CSS 和已有 GSAP，不新增图表或 WebGL 依赖。指标卡、图表、业务入口和请求状态分为独立组件。样式仅在 `.ch-dashboard` 内生效，包含深色主题、320px 手机布局、键盘焦点和减少动态效果。

## 接口

`GET /api/admin/stats?days=7|30|90`，默认 30 天。与原接口相同，班委、老师和管理员可访问，学生不能访问；身份来自数据库，令牌中的角色字段不授予权限。响应设为 `private, no-store`。

保留字段：`users`、`events`、`news`、`resources`、`breakdown.admins`、`breakdown.pendingResources`、`breakdown.pendingNews`、`generatedAt`。新增：

- `roles: [{role, label, count}]`：固定学生、班委、老师、管理员四类，互斥且加总等于用户数。有效 `role` 优先，缺少有效角色时兼容旧 `isAdmin` 字段。
- `timeline: {days, timeZone, basis, startDate, endDate, points, undated}`：时区 `Asia/Shanghai`，口径 `createdAt`；`points` 是精确 days 个日历日的 `{date, news, events, resources}`，包含今天并补零，排除当前时刻之后的时间戳。`undated` 记录没有有效创建时间的历史内容数量。

创建时间是用户确认的趋势口径，因此页面标题为“内容新增情况”。此数据不是首次发布时间或事件发生时间。图中至多 7 组相邻日历区间，Tooltip 明确起止日期、类型和数量；展开的数据表保留每一天。

总量继续包含当前数据库保存的全部状态记录，包括草稿、待审和已归档；保留原统计语义。软删除活动也遵循该口径。物理删除内容会使当前总量及历史创建分布改变，这不是持久化的历史快照。未建立可靠的周期对比快照，因此不展示指标涨跌。

“平台内容构成”展示新闻、活动、资源条数，绝非存储容量。所有类别为零时显示空状态，单一非零类别使用完整圆形；零类别不画虚构扇区。系统状态仅显示已验证身份、查询时间与权限说明，不宣称已检测服务器健康。

统计逻辑位于 `uniclub-backend/services/DashboardStatsService.js`。4 个只读聚合查询返回计数及分组，每个查询上限 5 秒，不返回用户资料或文档正文，不进行迁移及真实业务写入。

## 验证

- `npm run test:dashboard`：几何/整数刻度/分桶守恒、真实 React 组件交互（隔离 DOM 和接口）、日期边界、身份任免及统计路由权限。复用已安装的后台 JSDOM；没有新增依赖。
- `npm run typecheck`。
- `npx eslint src/pages/admin/AdminDashboard.tsx src/pages/admin/adminApi.ts src/pages/admin/dashboard --max-warnings 0`。
- `npm run build`。

浏览器实屏的视觉对照、触摸、控制台和性能检查仍需在浏览器工具被允许时补做；DOM 交互测试不能替代实屏响应式验收。全项目 Lint 原有的实验目录缓存错误和其他页面警告不在本次范围内，不修改规则或删除测试绕过。
