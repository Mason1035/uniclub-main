# ClassHub / Homepage V2 concept

**状态：STOP — 等待人工 ART DIRECTION REVIEW。**

使用 frontend-design 制作的独立首页视觉原型。九段叙事完整：Arrival → NOW → Class Pulse → Upcoming → Class Life → Knowledge → Living Timeline → People → Ending。

## 路径与启动

项目中的独立目录：

```text
/Users/alexmason/Desktop/uniclub-main/design-experiments/homepage-v2-concept
```

本次交付还保留一份源码在：

```text
/Users/alexmason/Documents/Codex/2026-10-03/files-pasted-by-the-user-classhub/outputs/design-experiments/homepage-v2-concept
```

本机已有依赖，可以直接运行：

```sh
cd /Users/alexmason/Desktop/uniclub-main/design-experiments/homepage-v2-concept
npm run dev
```

预览：<http://127.0.0.1:5177/>。只启动本原型的 Vite 服务。

```sh
npm run typecheck
npm run build
```

从交付 ZIP 解压到其他位置时，先在解压目录运行 `npm ci`，再运行 `npm run dev`。ZIP 不包含 node_modules。

本机 node_modules 通过路径链接复用 Typography Lab 已安装的 React / Vite / TypeScript 依赖。Vite 缓存写入本目录 `.vite-cache`。若要在本机重装依赖，先移除链接本身，再安装独立依赖。字体、影像和运行内容全部包含在本目录，不依赖 Typography Lab 的资源服务。

## 评审操作

- 右下角小型「评审」按钮打开面板。
- Light / Dark：首次跟随系统，之后记住本实验的选择。
- Full / Reduced：系统 `prefers-reduced-motion: reduce` 始终优先。Reduced 下所有内容完整显示。
- Grid：默认关闭。12 / 8 / 4 栏随断点切换，显示边距与 gutter。
- 目录、活动、故事、资源摘要：本地对话框；Escape 关闭，Tab 首尾循环，关闭后返回触发位置。
- Ending 的页角伙伴：点击打招呼。仅此一处，没有正式桌宠引擎。

所有数据为静态示例。原型日期固定为 2026-10-03。Pulse 的 03 / 12 / 08 来自 `src/content.ts` 中三组样本的长度。时间记录不是已核实的班级历史。没有真实成员、账户、权限或业务接口。

## 交付内容

- [REVIEW.md](REVIEW.md)：16 项汇报、五个重点评审问题与现阶段不足。
- [DESIGN_NOTES.md](DESIGN_NOTES.md)：两轮设计计划、复核与构图原则。
- [FONT_NOTES.md](FONT_NOTES.md)：字体来源、角色、子集与许可证。
- [VERIFICATION.md](VERIFICATION.md)：仅限本原型的验证记录。
- `screenshots/`：桌面、平板、手机、主题、网格、Timeline 与验证证据。

## 边界

实验只在本目录运行。正式 ClassHub 的页面、Layout、导航、样式、tokens、后端、Auth、API、Admin、AI、班费、量化、桌宠和部署配置均未接入。

本轮没有使用 Hallmark。没有迁移生产 UI、继续 Phase 1 或建立完整设计系统。
