# ClassHub 前端设计系统

状态：用户已确认；2026-09-30 开始实施。

## 设计方向
中文班级刊物 × 孔版印刷。参考 [Riso 01](https://www.usehallmark.com/examples/riso-01/) 的纸面、套色和刊头语法；使用原创书页图形，保留真实班级数据与现有功能。

首页采用内容索引结构，公告、日程、文章、文件目录和动态各自采用合适的阅读结构。管理后台使用工作台布局。所有页面共用根目录 tokens.css 与 src/styles/editorial.css。

## 配色与排版
暖桃纸、深棕墨、青蓝操作色；黄和洋红只用于印刷图形。语义颜色映射为兼容 Tailwind 3 / shadcn 的 HSL 变量。正文和小字号标签的对比度至少 4.5:1，控件边界和大字至少 3:1。

自托管 Noto Sans SC 400–900、Noto Serif SC 400–600，按 Unicode 分片加载，OFL 授权文件位于 public/fonts。黑体用于标题与功能，宋体用于文章；日期采用系统等宽字体。font-display: swap，系统字体为可靠回退。

标题直立，中文按语义换行；套色仅用于刊头与首页大标题。阅读正文 17–18px / 1.85，功能文本 14–16px；内容最大宽度 78rem，文章 46rem。间距 4/8/12/16/24/32/48/64px。控件最低 44px；圆角 2–4px，细线与双线组织层级。

## 交互
导航当前状态可见，滚动收紧刊头，移动端五入口与更多菜单。统一搜索通过 Cmd/Ctrl+K 打开，服务器结果按类型分组，方向键选择、Enter 打开、Esc 关闭和焦点归还。

列表筛选与显示模式保存在会话中，后退恢复滚动。活动提供列表/月历和服务器报名状态。点赞、收藏展示待处理状态、禁止重复提交、失败恢复并提示。资源显示真实文件信息；图片与 PDF 在接口提供文件地址时可预览。相册提供键盘、触屏、缩放及焦点管理。

所有数据区域显示加载、空数据、失败与重试。表单使用中文标签、autocomplete、字段校验与提交状态。暗色模式延续暖墨纸面。

## 动效
微交互 160ms，弹层 240ms，仅 opacity / transform / 明确的颜色过渡。每项一种主要悬停反馈。焦点立即显示。prefers-reduced-motion 关闭动效，内容始终可见。静态纹理不阻挡输入。

## 实施与验收

2026-09-30：已实施统一设计系统与全部业务页面。当前验收结果和实际截图见《UniClub前端重设计-实施与验收.md》；.hallmark/log.json 保存检查摘要。
原位更新全部业务页面，保留路由、API、登录、权限、审核和真实内容。使用既有依赖，不升级框架，不删除源文件。

TypeScript、ESLint、生产构建及真实浏览器验证；320/375/414/768/1280/1440px 检查溢出、导航、图片、键盘、焦点、触屏与减少动态。实际结果记录在实施报告与 .hallmark/log.json。

## 量化材料与功能目录（2026-09-30）

主导航在班级动态后新增“功能”，包含已接入的量化上传和明确标注待开放的收班费。量化页使用说明栏与提交工作台，状态、日期、文件大小和真实上传进度清晰可读；管理页沿用后台布局。复用既有纸面、字体、语义颜色、44px 控件和减少动态规则，不另建配色系统。模块样式位于 src/styles/quantification.css。

## Exports

### tokens.css（当前项目使用）

根目录 tokens.css 是完整变量来源，包含纸面、墨色、操作色、字体、字号、间距与动效。src/styles/editorial.css 引入该文件。

### Tailwind v4 @theme（仅用于未来迁移参考）

当前项目继续使用 Tailwind 3。下面是便携映射示例，不参与当前构建。

```css
@theme inline {
  --color-background: hsl(var(--paper));
  --color-foreground: hsl(var(--ink));
  --color-primary: hsl(var(--action));
  --color-primary-foreground: hsl(var(--on-action));
  --font-sans: var(--font-body);
  --font-serif: var(--font-reading);
  --font-mono: var(--font-mono);
}
```

### DTCG tokens.json（便携示例）

```json
{
  "color": {
    "paper": { "$type": "color", "$value": "#f5d9d1" },
    "ink": { "$type": "color", "$value": "#2a1109" },
    "action": { "$type": "color", "$value": "#006485" }
  },
  "duration": { "micro": { "$type": "duration", "$value": "160ms" }, "panel": { "$type": "duration", "$value": "240ms" } },
  "fontFamily": { "display": { "$type": "fontFamily", "$value": ["Noto Sans SC", "PingFang SC", "Microsoft YaHei", "sans-serif"] }, "reading": { "$type": "fontFamily", "$value": ["Noto Serif SC", "Songti SC", "SimSun", "serif"] } }
}
```

### shadcn/ui CSS 变量（当前映射）

```css
--background: var(--paper);
--foreground: var(--ink);
--card: var(--paper-raised);
--card-foreground: var(--ink);
--primary: var(--action);
--primary-foreground: var(--on-action);
--muted-foreground: var(--ink-muted);
--border: var(--line);
--input: var(--line-strong);
--ring: var(--action);
```

这些变量的值为 HSL 三元组，由 Tailwind 3 的 hsl(var(--…)) 读取。深色模式在 .dark 中覆盖相同角色。
