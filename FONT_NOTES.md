# ClassHub 正式字体系统

本次仅迁移正式前端字体系统。React / Vite / Tailwind、现有品牌图片、纸面配色、路由、布局、数据、交互和部署配置继续使用原实现。Typography Lab 保持独立；实验控件与样例数据没有加入网站。本轮设计与验收只采用 frontend-design skill。

## 1. 字体角色与实际使用

| 原始字体 | 正式衍生字族 | 真实字重 | 使用位置 |
|---|---|---|---|
| Source Han Serif SC / 思源宋体 | `ClassHub Han Serif` | variable `wght` 250–900 | 首页中文引言与叙事性分区标题、登录页中文 Hero、新闻列表/详情标题、往期活动故事标题、编辑式阅读正文 |
| Source Han Sans SC / 思源黑体 | `ClassHub Han Sans` | variable `wght` 250–900 | 导航、默认说明、按钮、表单、设置、通知、活动日程、资源列表、后台及表格 |
| Smiley Sans / 得意黑 v2.0.1 | `ClassHub Pulse` | 400，真实单字重 | 首页与班级动态页现有的「班级动态」短标题，共两处 |
| Schibsted Grotesk | `ClassHub Grotesk` | variable `wght` 400–900 | 当前英文 Hero、可编辑文本品牌标识、英文、日期、年份、数字与 Metadata |

图片 Logo 的内嵌字形保持原样；字体栈不修改 PNG。现有 Hero 文案与打字/光标行为不在本轮改写范围。代码块与技术标识保留系统 monospace。

得意黑使用原生斜势，CSS `font-style: normal; font-weight: 400; font-synthesis: none`，不合成粗体、不额外倾斜。未为字体增加新的模块、宣传内容或动画。`font-signature` 工具类也执行相同限制。

## 2. 语义 tokens 与排版

统一定义在 `tokens.css`，Tailwind 只引用这些变量：

- `--font-latin`：Schibsted Grotesk。
- `--font-ui`：Latin → 思源黑体 → PingFang SC / Microsoft YaHei / Noto Sans CJK SC / system-ui。
- `--font-editorial`：Latin → 思源宋体 → Songti SC / STSong / SimSun / PingFang SC / serif。
- `--font-signature`：ClassHub Pulse → UI stack。
- `--font-display`、`--font-body`：兼容既有工具类，默认指向 UI。
- `--font-reading`：编辑式阅读；`--font-mono`：既有代码/技术标识。

全局 h1–h4 仍默认 UI 字体。`PageHeading` 用 `tone="editorial"` / `tone="signature"` 显式选择语义，避免把后台与设置标题统一变成宋体。原 `font-inter` / `font-sf` / `font-avigea` 映射至 UI stack，不再请求这些旧字族。

Hero、Display、H1–H3、功能正文、阅读正文采用集中管理的 `clamp()` scale。Caption 12px、Metadata 13px、常用小 UI 14px 保持稳定。正文约 16–17px，阅读正文约 17–19px / 1.95 行高；阅读容器保留 46rem 上限。390px 继续沿用项目响应式布局与语义换行。

日期、日程与设置序号、表格和设置数值使用 Schibsted 的真实 `tnum` 特性。浏览器实测 0–9 在 16px 下宽度均为 10.15625px。英文与中文使用同一字号/基线，不对中文做缩放或额外拉伸。

## 3. 官方来源与 OFL 1.1

四款字体均沿用 Typography Lab 已核对的官方源文件，不使用第三方字体镜像或外部字体 CSS。所有衍生文件继续以 SIL Open Font License 1.1 分发，原始版权、商标及许可证元数据保留；不得将字体单独出售。

### Source Han Serif SC

- [Adobe 官方项目](https://github.com/adobe-fonts/source-han-serif)
- [固定源文件](https://raw.githubusercontent.com/adobe-fonts/source-han-serif/7889f11bf31170b5d092a083b357c8c8130f89e0/Variable/WOFF2/TTF/Subset/SourceHanSerifCN-VF.ttf.woff2)
- 官方 CN region subset，SC 字形；11,035,128 B。
- SHA-256：`556749ba783b148fa1f48644e8883e5b9351f01abd0d1faad0ba24a21185e76a`。
- 版权：Copyright 2017–2022 Adobe，Reserved Font Name `Source`。
- 许可证：`public/fonts/classhub/licenses/source-han-serif.txt`。

### Source Han Sans SC

- [Adobe 官方项目](https://github.com/adobe-fonts/source-han-sans)
- [固定源文件](https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/Variable/WOFF2/TTF/Subset/SourceHanSansCN-VF.ttf.woff2)
- 官方 CN region subset，SC 字形；7,711,988 B。
- SHA-256：`f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799`。
- 原始版权及保留字体名见 `public/fonts/classhub/licenses/source-han-sans.txt`。

### Smiley Sans / 得意黑

- [atelierAnchor 官方项目](https://github.com/atelier-anchor/smiley-sans)
- [官方 v2.0.1 release ZIP](https://github.com/atelier-anchor/smiley-sans/releases/download/v2.0.1/smiley-sans-v2.0.1.zip)
- ZIP：5,781,344 B，SHA-256：`299c0be6c960ae37361762eca76f7d0cd516615435bb96c0d4b98a1e70178a07`。
- 实际使用 ZIP 内 `SmileySans-Oblique.ttf.woff2`：1,150,924 B，SHA-256：`731f22973349404b15a88a99ef3b5dd4104c0965c23b7e485c1f11e84fea99e2`。
- Lab 说明将后者的大小/哈希标作 ZIP，本说明区分二者，源文件已逐字节核对。
- Copyright 2022–2024 atelierAnchor；Reserved Font Names `Smiley`、`得意黑`。正式衍生内部字族改名为 `ClassHub Pulse`，避免沿用 Lab 的 `Lab Smiley` 命名。
- 许可证：`public/fonts/classhub/licenses/smiley-sans.txt`。

### Schibsted Grotesk

- [Google Fonts 官方目录](https://github.com/google/fonts/tree/main/ofl/schibstedgrotesk)
- [已固定哈希的源 TTF](https://raw.githubusercontent.com/google/fonts/main/ofl/schibstedgrotesk/SchibstedGrotesk%5Bwght%5D.ttf)
- 176,068 B，SHA-256：`6ceeadf6be8e1fd7687011c7fa38ed0edd1abe967a0b73d97caec183552e823d`。
- Copyright 2023 The Schibsted-Grotesk Project Authors。
- 许可证：`public/fonts/classhub/licenses/schibsted-grotesk.txt`。

子集不是未经修改的官方字体包。内部 family、full name、PostScript、variable prefix 与思源 named-instance PostScript 名称均使用 ClassHub 衍生命名；版权与 OFL 文本保留原作者信息。不得在修改后的主要字体名中沿用保留名。网站文档使用原字体名称说明字形来源。

## 4. 覆盖、分片与 fallback

正式覆盖不局限于 Lab 的 GB2312 实验子集：

- 思源宋体：30,628 个源字体支持的字符。
- 思源黑体：30,624 个源字体支持的字符。
- 得意黑：9,055 个源字体支持的字符。
- Latin：462 个字符，包含英语/扩展 Latin、数字、常用数学符号等。

中文包排除已交给 Latin 的重复字符以及私用区和控制字符。中文/全角标点、弯引号、破折号及省略号由中文字族提供。每个子集的准确 `unicode-range` 与文件实际 cmap 一致，同一字族的 core / common / tail 范围互不重叠。保留 GSUB / GPOS、真实 variable axes、数字特性与必要字形闭包。

- 黑体 core 覆盖正式 `src/**/*.ts(x)` 静态汉字文案及中文标点；宋体 core 根据现有编辑式页面文案与常用正文字符生成；不是照搬实验文案。
- 思源字体其余 GB2312 常用字符每 **96 个字符** 分片；源字体其余字符每 **384 个字符** 分片。常用短标题无需为一个字下载一大块 384 字文件。
- 得意黑 core 只包含两处实际短标题所需的「班级动态」四个字，其余字形按 384 个字符分片，仅在未来实际使用时请求。
- 未包含在 core 的动态新闻、姓名和输入文字，浏览器按 `unicode-range` 请求相应分片；不会因只覆盖实验文字而混用常见字形。
- 原始官方字体本身不覆盖所有 Unicode 汉字/IVS/emoji。`喆、祎、彧、玥、龘` 由正式思源分片提供；`𠮷` 在本次 macOS Chrome 验证中由 PingFang SC 回退，无缺字方框。其他系统的极生僻字仍取决于系统 fallback，不能宣称全 Unicode 覆盖。

所有资源位于 `public/fonts/classhub/`，仅本地 WOFF2，统一 `font-display: swap`。文件名含内容 SHA-256 前 10 位；更新字形后 URL 随内容变化，避免长期缓存串版本。文件 644 / 目录 755。大体积官方源文件不进入 `public`。

## 5. 加载与缓存策略

`index.html` 只 preload `latin.*.woff2` 与 `sans-core.*.woff2`（crossorigin）。宋体与 Signature 根据实际样式/文字按需加载。全部 CSS face 描述由 Vite 合并到正常样式入口，浏览器仅下载有字符命中的字体文件。

旧 Noto / Geist 文件保留在原目录以保护既有资源与未提交文件，但正式加载入口不再引用；浏览器验证没有请求这些旧字体。没有增加字体切换动画或字体加载状态控件。

## 6. 重建

正常 `npm run build` 使用已经生成的 WOFF2，不需 Python、不新增 npm 依赖、不需访问外网。

只有调整字体子集时才需独立 Python 环境 `fonttools==4.66.1`、`brotli==1.2.0`。将官方文件置于源目录，命名为 `serif.woff2`、`sans.woff2`、`smiley.woff2`、`smiley.zip`、`latin.ttf`：

```bash
python scripts/build-fonts.py /path/to/official-font-sources
# 可选：只重建指定字体，保留其他字族资源
python scripts/build-fonts.py /path/to/official-font-sources --only=smiley,latin
```

脚本校验官方源文件哈希，生成互斥分片、内容哈希文件名、manifest、fonts.css 并更新必要 preload。源字体 timestamp 固定，避免仅因构建时间改变缓存 URL。重建后应一起提交字体文件、CSS、manifest 与 index.html。

## 7. 本轮验证与限制

- `npm run build` 含项目 typecheck，通过。未运行无关业务回归。
- 使用本地产物预览和隔离浏览器视觉夹具，未读写真实业务记录；实验样例没有进入正式代码。
- 检查 Hero / 新闻阅读 / 活动列表 / 设置 / 班级动态 / 后台新闻表格及新闻表单。
- 1440、1280、1024、768、390px 的关键排版，Light / Dark，共 46 项布局观测通过；另验证中文登录 Hero。
- 无页面横向溢出；后台表格保留自身横向滚动容器。390px 按钮与导航未异常换行；保留触控目标、focus-visible 和 reduced motion。
- 浏览器字体面板证实实际使用各衍生字族，而非仅声明 CSS family。中文、全角标点、英语、数字与生僻姓名已检查。
- 正文/背景对比度约 13.37:1（Light）、13.45:1（Dark）；辅助文字约 5.82:1、8.11:1。未修改色板。
- 验证平台为 macOS Chrome；Windows / iOS 实机尚未验证。极生僻字/emoji 依赖系统字体。
- 当前图片 Logo 保留原字形；当前英文 Hero 由 Schibsted 渲染，中文引言与中文登录 Hero 由思源宋体渲染。若以后修改 Hero 文案，属于独立内容决定。
- 初始字体流量随真实动态内容增加；下面统计是明确文案场景的冷加载观测，不是所有账号/所有新闻内容的固定上限。


## 8. 正式资源实测清单

全部单文件的路径、大小、SHA-256、字符数与 Unicode 范围见 `public/fonts/classhub/manifest.json`，CSS 在相邻 `fonts.css`。

| 字族 | WOFF2 文件数 | 字体资源总量 | core/Latin 文件 | core/Latin 大小 | core 字符数 |
|---|---:|---:|---|---:|---:|
| ClassHub Han Serif | 135 | 13,401,628 B / 12.78 MiB | `serif-core.e67263be13.woff2` | 192,524 B / 188.01 KiB | 490 |
| ClassHub Han Sans | 130 | 9,928,980 B / 9.47 MiB | `sans-core.addfeeae45.woff2` | 261,916 B / 255.78 KiB | 923 |
| ClassHub Pulse | 25 | 1,290,380 B / 1.23 MiB | `signature-core.cde5a5deb2.woff2` | 1,312 B / 1.28 KiB | 4 |
| ClassHub Grotesk | 1 | 62,976 B / 0.06 MiB | `latin.06f626d915.woff2` | 62,976 B / 61.50 KiB | 462 |

- 全部 291 个 WOFF2：24,683,964 B / 23.54 MiB，**不是首次访问下载量**。
- 两个 preload 合计：324,892 B / 317.28 KiB。
- 下表来自生产构建预览、空浏览器缓存、1440px 初始渲染的实际字体请求；统计 WOFF2 原始字节，不含 CSS、图片、JS 或 HTTP 头。浏览器也会加载首屏下方已存在的文字字形。

| 场景 | 字体请求数 | 实际字体体积 |
|---|---:|---:|
| 首页静态文案（空内容列表） | 4 | 518,728 B / 506.57 KiB / 0.49 MiB |
| 首页静态文案 + 两条代表性新闻 + 活动/姓名文案 | 18 | 1,216,652 B / 1188.14 KiB / 1.16 MiB |

常用分片从 384 缩小为 96 字后，同一代表性内容场景由 2,072,736 B 降至 1,216,652 B（约减少 41.3%）；请求数由 15 增为 18，以较小传输量换取少量额外请求。字体按内容哈希 URL 复用浏览器缓存。若真实新闻文案或姓名不同，命中分片与请求量也会不同。

## 9. 本轮修改文件

正式项目根目录：`/Users/alexmason/Desktop/uniclub-main`。

### 字体与构建

- `public/fonts/classhub/fonts.css`
- `public/fonts/classhub/manifest.json`
- `public/fonts/classhub/licenses/（四份 OFL 原文）`
- `public/fonts/classhub/*.woff2（291 个生成文件）`
- `scripts/build-fonts.py`
- `FONT_NOTES.md`

### Tokens 与入口

- `tokens.css`
- `tailwind.config.ts`
- `index.html`
- `src/index.css`

### 排版样式

- `src/styles/editorial.css`
- `src/pages/home-hero.css`
- `src/features/settings/settings.css`
- `src/features/pet/pet.css`
- `src/styles/quantification.css`

### 语义标题引用

- `src/components/PageHeading.tsx`
- `src/components/ArticleContent.tsx`
- `src/pages/Homepage.tsx`
- `src/pages/NewsPage.tsx`
- `src/pages/ArticlePage.tsx`
- `src/pages/PastEventDetailPage.tsx`
- `src/pages/SocialPage.tsx`

未提交的实验目录、既有品牌素材与其他业务代码未由本轮迁移改写。未提交 Git commit、未推送到服务器。现有常规部署脚本继续适用。
