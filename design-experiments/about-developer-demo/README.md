# ClassHub About 动效 Demo

独立预览，不接入正式 `/about`。沿用项目 React、TypeScript、Vite 和 GSAP，无新增 npm 依赖。

```sh
cd design-experiments/about-developer-demo
../../node_modules/.bin/vite --host 127.0.0.1 --port 9189
```

预览：<http://127.0.0.1:9189/>

## 参考站已确认的实现

- [Noomo 首页](https://noomoagency.com/)大文字采用 Neue Machina Regular（400），行高 100%；正文采用 Neue Haas Display Roman。两段大文字配合右侧 263px 的小段落，桌面边距 40px。
- [公开首页 JavaScript](https://noomoagency.com/_nuxt/index.9a78ca5f.js)显示：桌面评价卡片使用 WebGL 模型、评价贴图和透射材质，每张独立沿右侧低点→中央高点→左侧低点的路径移动。路径跟随 ScrollTrigger，位置 ease:none，姿态 power2.out；不是桌面 Swiper。
- 触屏使用 Swiper FreeMode，自由滑动，无固定吸附。
- 动态背景由带贴图的 3D 模型和滚动镜头形成。背景模型的滚动段使用 scrub:true、power2.inOut，位置 (4,-25,-20)→(16,-16,-20)、Y 旋转约 -50°。并非单纯 CSS 渐变。

## Demo 的实现与差异

- `DeveloperFloat.tsx`：桌面固定一屏舞台，三张原创几何占位卡片分别从屏幕右外侧入场，沿抛物线移动并完全从左外侧离场。没有只移动整组几百像素的短轨道。反向滚动可倒放。
- `motion.ts`：中文注释集中提供滚动长度、卡片错开、弧线高度、屏外余量、卡片宽度和平滑时间。飞行坐标只在 refresh 读取尺寸；每帧只更新 transform。
- 触屏使用原生横向惯性滑动，桌面可用方向键、Home / End 控制舞台进度；reduced-motion 使用静态可滚动列表，不固定、不漂浮。
- `AmbientBackground.tsx`：固定底色和原创蓝、粉、银色柔光渐变。周期漂移与滚动位移先合成数值，每层每帧只更新一次平移；不旋转或放大全屏纹理。滚动范围使用页面最大滚动距离。后台标签页暂停漂移，恢复时限制时间增量；卸载或 reduced-motion 时清理 ticker、GSAP 实例和变换样式。是轻量观感近似，不宣称复刻参考站的 3D 材质。
- 大段英文采用自托管 Space Grotesk Regular，字体 42 KB。Neue Machina 是商业字体，未复制参考站字体。开放字体来源：[官方仓库](https://github.com/floriankarsten/space-grotesk)，许可见 `src/assets/fonts/OFL.txt`。
- 用户提供的六组 About 中文正文与登录、项目仓库、隐私和首页链接均保留。不读取成员或内部数据。

## 最小检查

```sh
../../node_modules/.bin/tsc --project tsconfig.json --noEmit
../../node_modules/.bin/vite build
```

浏览器检查桌面完整进出场、弧线中段、手机自由滑动、减少动态效果及控制台。
