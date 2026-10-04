# Homepage concept / verification

日期：2026-10-03。范围仅为 `design-experiments/homepage-v2-concept`。

## 结果

| 检查 | 结果与证据 |
| --- | --- |
| 启动 | 项目内独立目录的 `npm run dev` 正常启动，地址 `127.0.0.1:5177`；最终预览来自该目录 |
| TypeScript / build | `npm run build` 包含 `tsc --noEmit`；31 modules；JS 164.76 kB / gzip 55.02 kB；CSS 28.22 kB / gzip 6.57 kB |
| 配置隔离 | Vite 显式使用空的本地 PostCSS 插件配置，阻止上级正式项目 PostCSS / Tailwind 配置影响本实验；缓存写入实验 `.vite-cache` |
| 九段完整 | 四个目标视口均包含 9 个叙事段落，全部 img 完成加载 |
| 1440 / 1280 / 768 / 390 | DOM 边界检查均无 main 内容超出可用视口，见 `screenshots/viewport-checks.json` |
| Light / Dark | 实际切换正常，分别保存桌面与手机截图；专属 localStorage key，不使用生产主题 key |
| Full / Reduced | 切换 Reduced 后，实际计算样式中年份 animation 为 `none`，导航 transition 为 `0s`；内容完整 |
| 系统 reduce 优先级 | 临时测试页在 React 启动前注入 `matchMedia` 的 reduce 信号；选择 Full 后有效模式仍为 Reduced，年份与对话框 animation 均为 `none` |
| 网格 | 12 / 8 / 4 栏随断点切换；各次检查 overlay 与正文 wrap 的边界相同；默认关闭 |
| 字体 | 面板显示 4 / 4 本地字体已加载；浏览器资源清单观察到 serif / sans / latin / smiley 四个 WOFF2 |
| 字形与字节数 | 字体工具检查当前文案，无缺失汉字；思源各 455 字形，得意黑 11 字形，Latin 208 字形；合计 319,940 B，约 312.44 KiB |
| 影像 | 三张本地 SVG 合计 3,795 B；没有网络摄影或人物隐私；caption / alt 标明占位 |
| Timeline | 自然滚动 / 记忆跳转后，大年份变为 2026，当前 step 为 2026.04；position 为 sticky；手机使用行内年份 |
| 本地交互 | 活动、故事、资源摘要与目录可操作；页角伙伴点击后显示“明天见。” |
| 键盘 | Escape 关闭并返回触发按钮；首尾 Tab / Shift+Tab 循环复核通过；跳到正文后 activeElement 为 main；手机目录跳转后焦点位于目标 section |
| Console | 修正 React 18 的图片属性告警后，从最终项目内服务打开的新预览 error 日志为空，见 `screenshots/console-final.json` |
| 正式 runtime | git 已跟踪文件 diff 为空；本轮项目中只新增独立 experiment 目录，原有未跟踪文件保留 |

## 四个目标尺寸

最终检查使用有 15px 竖向滚动条的浏览器，以 `documentElement.clientWidth` 判断越界，没有使用根节点 overflow 裁切来隐藏问题。

| 目标宽度 | 可用内容宽度 | scrollWidth | main 内容越界 |
| ---: | ---: | ---: | --- |
| 1440 | 1425 | 1425 | 无 |
| 1280 | 1265 | 1265 | 无 |
| 768 | 753 | 753 | 无 |
| 390 | 375 | 375 | 无 |

## 配色计算

按 sRGB 相对亮度计算主要 token。文字未用透明度降低对比。

| 关系 | Light | Dark |
| --- | ---: | ---: |
| Ink / Paper | 12.70:1 | 12.59:1 |
| Muted / Paper | 5.34:1 | 7.62:1 |
| Accent / Paper | 7.24:1 | 7.54:1 |
| Muted / Timeline field | 4.65:1 | 5.65:1 |
| Accent / Timeline field | 6.29:1 | 5.59:1 |

主要操作目标至少 44px 高；导航也设置至少 44px 宽。原生 dialog 提供模态语义，首尾焦点循环由少量键盘处理补足。

## 检查边界与限制

- 系统减少动态效果检查使用**模拟 OS 信号的临时测试页**，没有修改 macOS 设置。验证的是应用处理该信号与 CSS 禁用动效的分支。测试页已从原型移除，证据截图保留。
- 没有独立屏幕阅读器、其他浏览器兼容性认证、设备帧率或正式性能评分。字体及 bundle 大小不等于已测得的 LCP / INP。
- 没有运行 ClassHub 全站回归、业务测试、后端、Auth 或正式部署。
- 没有使用 Hallmark、hash baseline、preflight 或全站验证。

## 项目状态

开始时已有未跟踪 `CLASSHUB_V2_CREATIVE_DIRECTION.md` 和 `运维/`。结束时额外存在 `design-experiments/`。正式 runtime 的已跟踪文件没有本轮变更。

Typography Lab 的源码、tokens、字体资产与依赖文件没有编辑；新字形子集、缓存、构建产物都写入本实验。

**STOP — 等待人工 ART DIRECTION REVIEW。**
