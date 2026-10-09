# ClassHub 正式字体系统

本次仅迁移正式前端字体系统。React / Vite / Tailwind、现有品牌图片、纸面配色、路由、布局、数据、交互和部署配置继续使用原实现。Typography Lab 保持独立；实验控件与样例数据没有加入网站。本轮设计与验收只采用 frontend-design skill。

## 1. 字体角色与实际使用

| 原始字体 | 正式衍生字族 | 真实字重 | 使用位置 |
|---|---|---|---|
| Source Han Serif SC / 思源宋体 | `ClassHub Han Serif` | variable `wght` 250–900 | 首页中文引言与叙事性分区标题、登录页中文 Hero、新闻列表/详情标题、往期活动故事标题、编辑式阅读正文 |
| Source Han Sans SC / 思源黑体 | `ClassHub Han Sans` | variable `wght` 250–900 | 导航、默认说明、按钮、表单、设置、通知、活动日程、资源列表、后台及表格 |
| Smiley Sans / 得意黑 v2.0.1 | `ClassHub Pulse` | 400，真实单字重 | 保留 Signature 字族与工具类；当前首页、班级动态栏目已采用 Editorial，Guest 首页不请求此字族 |
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
- 源文件版权元数据：© 2017–2024 Adobe，Reserved Font Name `Source`。
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

子集不是未经修改的官方字体包。内部 family、full name、PostScript、variable prefix 与思源 named-instance PostScript 名称均使用 ClassHub 衍生命名；版权与 OFL 文本保留原作者信息。构建显式保留全部原始 name 元数据及语言记录，包括版权、作者、商标与 OFL（name ID 0、7–9、13–14），修正 fonttools 默认 name 子集会移除许可证记录的问题。不得在修改后的主要字体名中沿用保留名。网站文档使用原字体名称说明字形来源。

## 4. 覆盖、分片与 fallback

正式覆盖不局限于 Lab 的 GB2312 实验子集：

- 思源宋体：30,628 个源字体支持的字符。
- 思源黑体：30,624 个源字体支持的字符。
- 得意黑：9,055 个源字体支持的字符。
- Latin：462 个字符，包含英语/扩展 Latin、数字、常用数学符号等。

中文包排除已交给 Latin 的重复字符以及私用区和控制字符。中文/全角标点、弯引号、破折号及省略号由中文字族提供。每个子集的准确 `unicode-range` 与文件实际 cmap 一致，同一字族的 core / common / tail 范围互不重叠。保留 GSUB / GPOS、真实 variable axes、数字特性与必要字形闭包。

- 黑体 core 为 Layout/跳过导航链接、Header、Footer、底部导航、共享加载状态、Cookie（含偏好设置及 CSS 生成内容）、Homepage（含全部 Guest 卡片说明）及 iPhone 安装卡源文案中的汉字与实际标点，共 **284 字**；「嗨、决、私、川、师、跳」及 Cookie 列表生成的 `–`、加载状态 `…` 已纳入。没有把全站后台/表单文案一并塞进公共 preload。
- 宋体 core 为首页 Hero 中文引言、栏目标题及 iPhone 安装卡/引导的 Editorial 标题，共 **82 字**；新闻正文与其他页面按内容请求其余分片。
- 其余正式 `src/**/*.ts(x)` 静态汉字按源码出现频率排序，每 **96 个字符** 放入 common 分片；剩余全部源支持字符按 Unicode 顺序、每 **384 个字符** 放入 tail。取消将完整 GB2312 集合从 tail 抽走的分组，减少两边互相挖洞造成的范围碎片；覆盖集合保持相同。
- Latin core 为 ASCII、公共文案的中点与箭头，共 **97 字**；其余 **365 字** 保留在一份按需 tail，扩展 Latin 姓名、数学符号等仍可用。
- 得意黑 core 保留「班级动态」四个字，其余字形按 384 个字符分片，仅在实际使用 Signature 样式时请求。
- 未包含在 core 的动态新闻、姓名和输入文字，浏览器按 `unicode-range` 请求相应分片；不会因只覆盖实验文字而混用常见字形。
- 原始官方字体本身不覆盖所有 Unicode 汉字/IVS/emoji。`喆、祎、彧、玥、龘` 由正式思源分片提供；`𠮷` 在本次 macOS Chrome 验证中由 PingFang SC 回退，无缺字方框。其他系统的极生僻字仍取决于系统 fallback，不能宣称全 Unicode 覆盖。

所有资源位于 `public/fonts/classhub/`，仅本地 WOFF2，统一 `font-display: swap`。文件名含内容 SHA-256 前 10 位；更新字形后 URL 随内容变化，避免长期缓存串版本。文件 644 / 目录 755。大体积官方源文件不进入 `public`。

## 5. 加载与缓存策略

`index.html` 的字体二进制只 preload `latin-core.*.woff2` 与 `sans-core.*.woff2`（crossorigin），合计 **109,684 B**。宋体、Signature 与全部 tail 根据实际样式/文字按需加载。

- `editorial.css` 只引入 `fonts-core.css`，四个 core face 经 Vite 合并到首屏样式入口；字体描述 **3,370 B raw / 1,266 B gzip6**。Guest 当前文案不依赖其他 face 注册。
- 其余 **195 个 face** 在 `fonts-extended.5b6e6f7943.css`，完整精确范围仍存在；**108,051 B raw / 27,366 B gzip6**。HTML 用低优先级 `preload as="style"` 及 `media="print"` stylesheet 提前下载，避免此样式表阻塞初始屏幕绘制。浏览器只下载命中字符的 WOFF2，不会因为注册 face 下载全部字形。
- 同源 `fonts-loader.cd129072cf.js`（235 B raw / 188 B gzip6）以 `defer` 执行，将已完成加载的 stylesheet 的 media 改为 `all`；也处理样式表先于脚本完成的情况。没有 inline onload，不要求 CSP 的 `unsafe-inline`。严格 `script-src 'self'; style-src 'self'; font-src 'self'` 的独立字体夹具验证通过。
- JavaScript 禁用时，`noscript` 内正常 stylesheet 保留完整字体覆盖；专项夹具观察到全部 199 face，以及生僻中文与扩展 Latin 的 tail 请求。动态姓名/正文在 extended CSS 完成注册前短暂使用现有系统 fallback，之后按 `swap` 替换；其他系统极生僻字仍受原源字体及系统 fallback 限制。
- extended CSS、loader JS 和每个 WOFF2 均按内容 SHA-256 前 10 位命名，适合匹配内容哈希资源的长期 immutable 缓存。`fonts-core.css` 由 Vite 编入带 hash 的共享 CSS；其固定 public 路径不要单独设一年 immutable。

旧 Noto / Geist 文件保留在原目录以保护既有资源与未提交文件，但正式加载入口不再引用；浏览器验证没有请求这些旧字体。没有增加字体切换动画或字体加载状态控件。

## 6. 重建

正常 `npm run build` 使用已经生成的 WOFF2，不需 Python、不新增 npm 依赖、不需访问外网。

只有调整字体子集时才需独立 Python 环境 `fonttools==4.66.1`、`brotli==1.2.0`。将官方文件置于源目录，命名为 `serif.woff2`、`sans.woff2`、`smiley.woff2`、`smiley.zip`、`latin.ttf`：

```bash
python scripts/build-fonts.py /path/to/official-font-sources
# 可选：只重建指定字体，保留其他字族资源
python scripts/build-fonts.py /path/to/official-font-sources --only=smiley,latin
# 只按当前已校验 manifest 重新输出 CSS/loader/HTML（不重建字形）
python scripts/build-fonts.py /path/to/official-font-sources --metadata-only
```

脚本校验官方源文件哈希，生成互斥分片、内容哈希文件名、manifest、core/extended CSS、loader 并更新 HTML 加载引用与必要 preload。每片检查实际 cmap 与分配字符完全一致、真实 variable axes/HVAR/gvar 表和字体内版权/OFL 记录。保留既有文件时先校验 manifest 中的字节数与 hash。源字体 timestamp 固定，避免仅因构建时间改变缓存 URL。重建后应一起提交字体文件、CSS/loader、manifest 与 index.html。改变公共首页文案或字体角色后应重建并复核真实字体请求。

## 7. 原字体迁移的验证记录与限制

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

全部单文件的路径、大小、SHA-256、字符数与 Unicode 范围见 `public/fonts/classhub/manifest.json`，加载文件见其中 `stylesheets` 记录。

| 字族 | WOFF2 文件数 | 字体资源总量 | core/Latin 文件 | core/Latin 大小 | core 字符数 |
|---|---:|---:|---|---:|---:|
| ClassHub Han Serif | 87 | 13,270,492 B / 12.66 MiB | `serif-core.c5d9e7b48a.woff2` | 29,788 B / 29.09 KiB | 82 |
| ClassHub Han Sans | 85 | 9,826,180 B / 9.37 MiB | `sans-core.2b88dea1fa.woff2` | 77,540 B / 75.72 KiB | 284 |
| ClassHub Pulse | 25 | 1,301,108 B / 1.24 MiB | `signature-core.6f80d4cdb1.woff2` | 1,760 B / 1.72 KiB | 4 |
| ClassHub Grotesk | 2 | 70,080 B / 0.07 MiB | `latin-core.87db008acf.woff2` | 32,144 B / 31.39 KiB | 97 |

- 全部 **199 个 WOFF2：24,467,860 B / 23.33 MiB**，**不是首次访问下载量**。字体内保留许可证记录；完整动态覆盖相同。
- 两个 preload 合计 **109,684 B / 107.11 KiB**，原为 324,892 B，减少 **215,208 B / 66.2%**。
- Guest 首页实际所需 Sans/Serif/Latin 三份 core 合计 **139,472 B / 136.20 KiB**；Cookie、Footer、跳过导航链接及加载状态当前文案均命中 core。与审计的 mobile 545,612 B / desktop 635,988 B 比较，core 场景分别减少 **406,140 B / 74.4%**、**496,516 B / 78.1%**。这是资源合计与当前文案分配的核对，页面冷请求和时间收益仍须用最终生产构建复测，不将字节变化当作 LCP 毫秒保证。
- 字体描述 **291 → 199 faces**；首屏共享样式中仅留 **4 face / 3,370 B raw / 1,266 B gzip6**，原全 face 描述为 243,072 B minified / 79,984 B gzip6。其余 195 face 的独立 stylesheet 为 27,366 B gzip6；这些元数据仍下载，但以独立非阻塞请求加载。上述是各字体文件/样式的字节口径，shared CSS 总压缩量应以最终 Vite 产物复测，不能重复计入字体二进制收益。
- 下表保留上一次字体迁移的历史网络场景，不代表当前产物。统计 WOFF2 原始字节，不含 CSS、图片、JS 或 HTTP 头。

| 场景 | 字体请求数 | 实际字体体积 |
|---|---:|---:|
| 首页静态文案（空内容列表） | 4 | 518,728 B / 506.57 KiB / 0.49 MiB |
| 首页静态文案 + 两条代表性新闻 + 活动/姓名文案 | 18 | 1,216,652 B / 1188.14 KiB / 1.16 MiB |

常用分片从 384 缩小为 96 字后，同一代表性内容场景由 2,072,736 B 降至 1,216,652 B（约减少 41.3%）；请求数由 15 增为 18，以较小传输量换取少量额外请求。字体按内容哈希 URL 复用浏览器缓存。若真实新闻文案或姓名不同，命中分片与请求量也会不同。

## 9. 本轮修改文件

正式项目根目录：`/Users/alexmason/Desktop/uniclub-main`。

### 字体与构建

- `public/fonts/classhub/fonts-core.css`
- `public/fonts/classhub/fonts-extended.*.css`
- `public/fonts/classhub/fonts-loader.*.js`
- `public/fonts/classhub/manifest.json`
- `public/fonts/classhub/licenses/（四份 OFL 原文）`
- `public/fonts/classhub/*.woff2（199 个生成文件）`
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

## 10. 2026-10-05 性能优化验证

- 从相同已固定 hash 的官方完整源重建；没有合并 variable 分片、改变字体家族/字重或缩减动态覆盖。
- 对全部 199 WOFF2 核对实际 cmap 与 manifest/CSS 范围一致、同族互斥，合并字符集合与原 291 片完全相同；检查文件 hash 与内容 hash 名称、真实 `wght` 范围及 `gvar` / `HVAR`。
- 每片内版权/商标/作者/OFL 元数据与官方源一致；衍生主要字体名无保留名称。四份原始 OFL 文件继续保留。
- 对代表字符（含「嗨、决、私、川、师、跳」、`–`、`…`、`喆祎彧玥龘`、Signature 与 Latin 数字）在 min / 中间 / max 字重做 **109 次源与衍生轮廓及 advance 比较**，全部一致；Latin core 保留真实 `tnum`。
- 隔离 headless Chrome 字体夹具验证严格 self CSP、已先加载 stylesheet 的 loader 场景、全部 199 face 注册及动态中文/扩展 Latin 字形。CDP 明确禁用页面 JS 时，media 仍为 print、页面脚本未执行，noscript stylesheet 仍注册 199 face 并请求相应 tail。没有访问业务 API 或写入业务记录。
- 这部分验证不替代正式首页 cold network、CLS/LCP 或成员态场景复测；扩展 face 注册前的动态字形可能短暂显示系统 fallback。Windows / iOS 实机仍未验证。
