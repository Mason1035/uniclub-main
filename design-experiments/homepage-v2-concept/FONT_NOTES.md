# Fonts / cached sources, compact page subsets

## 同一批 Typography Lab 字体

| 原始字体 | 浏览器中的子集名称 | 角色 | CSS 字重 |
| --- | --- | --- | --- |
| Source Han Serif SC / 思源宋体 | Concept Han Serif | 中文开场、叙事标题 | 250–900 |
| Source Han Sans SC / 思源黑体 | Concept Han Sans | 中文 UI、正文、目录 | 250–900 |
| Schibsted Grotesk | Concept Grotesk | Latin、日期、数字、文字标识 | 400–900 |
| Smiley Sans / 得意黑 | Concept Smiley | Ending 的一句短语 | 400 |

Latin 优先，中文由对应的思源字体补足。没有合成粗体、伪斜体或水平压缩中文字形。得意黑本身的倾斜保留。

字体来自 Typography Lab 已缓存的官方字体源：

```text
/Users/alexmason/Documents/Codex/2026-10-03/an-z/work/font-sources
```

没有重复下载完整中文字体。`scripts/subset-fonts.py` 为当前静态页面制作四个本地 WOFF2，保留可变轴及 GSUB / GPOS，改名为 Concept 系列。权利声明和 OFL 元数据保留，四份许可证位于 `public/fonts/licenses/`。

`public/fonts/manifest.json` 记录最终字节数、字形数和可变轴。本页全部中文文案的思源字形覆盖在构建子集时检查；缺少汉字时脚本会停止。

## 加载策略

宋体、黑体与 Latin 预加载；得意黑文件极小，通过本地 FontFaceSet 请求加载。所有 face 使用 `font-display: swap`。系统回退字体仍可阅读。

页面不提供任意文案编辑器。未来修改中文文案时，需要从同一份缓存源重建子集；这四个文件不声称覆盖所有汉字。

## 可选的本机重建

运行页面不需要 Python。仅重建字体时可用现有字体工具环境：

```sh
PYTHONDONTWRITEBYTECODE=1 \
  /Users/alexmason/Documents/Codex/2026-10-03/an-z/work/font-tools/bin/python \
  scripts/subset-fonts.py \
  /Users/alexmason/Documents/Codex/2026-10-03/an-z/work/font-sources
```

该命令只把字体输出写入当前实验，不写入 Typography Lab 或字体源缓存。
