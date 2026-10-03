# 本地 GSAP 安装包

这个目录保留从 npm 官方源下载的完整安装包：

- `gsap-3.15.0.tgz`：GSAP 核心、插件、类型定义和源码。
- `gsap-react-2.1.2.tgz`：React 的 `useGSAP` 集成。

`package.json` 和 `package-lock.json` 使用 `file:vendor/...` 引用这些安装包。
请将这个目录和源码一起保存、提交或上传。安装 GSAP 时无需再次从网络下载这两个包；项目的其他依赖仍按原有方式安装。

## 开发

依赖已经安装。组件统一使用：

```tsx
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
```

`src/lib/gsap.ts` 已注册 ScrollTrigger 和 useGSAP，并由应用入口加载。
使用 `useGSAP` 时给组件设置 scope；响应式动画和减少动态效果偏好可通过 `gsap.matchMedia()` 处理。
其他 GSAP 插件也在安装包中，按需导入并注册。

## 上线

执行 `npm run build` 后，GSAP 随网站打包到 `dist/assets` 的 JavaScript 文件中。
上传 `dist` 即可提供前端动画；浏览器加载本站文件，无需外部 GSAP CDN，也无需在运行静态网站的服务器上单独安装 GSAP。

如果在服务器或部署平台从源码构建，仍需按项目原有流程安装依赖（通常为 `npm ci`），再执行 `npm run build`。GSAP 会从此目录的本地安装包读取，无需额外执行 `npm install gsap`。
