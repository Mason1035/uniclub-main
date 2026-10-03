# ClassHub 网页桌宠

## 入口与生命周期

`App.tsx` 在现有认证和 Popup Provider 内挂载一个 `PetProvider` 和 `PetLayer`。
Provider 使用服务器验证后的账号身份；页面路由切换共用同一个 Store 和 Engine。
未登录、认证检查未完成、配置加载失败、用户关闭桌宠时不挂载。
`/admin` 及其子路由不显示桌宠；管理员访问普通成员页面时仍使用自己的偏好。

Engine 是 React 管理的可选懒加载组件内部的独立实例，拥有自己的 DOM、
Web Animations、requestAnimationFrame、超时、监听和 AudioContext。
退出、切换账号或关闭组件时全部释放。没有 DSH runtime 或 body MutationObserver。
资源与懒加载错误由局部降级和 Error Boundary 隔离。

## 账号配置与位置

前后端共享 `shared/pet-settings.json` 定义默认值、范围和允许的皮肤/动作。
MongoDB `users` 集合沿用 `User.settings`，新增：

| 字段 | 默认 | 范围 / 说明 |
| --- | --- | --- |
| petEnabled | true | 开关 |
| petSkin | panda | panda / whale |
| petSize | 120 | 72–200 px |
| petOpacity | 1 | 0.2–1 |
| petMuted | false | 静音 |
| petVolume | 35 | 0–100 |
| petTalkative | true | 气泡 |
| petWalkable | true | 自动散步 |
| petHue | 0 | 0–360° |
| petPokeAction | hops | 点击动作 |
| petCelebrateAction | signature | 庆祝动作 |

支持动作：signature、fly、dance、spin、hops、roll、breach、sway、random。
熊猫招牌动作是翻滚，蓝鲸是跃出水面并喷水。

角色共 9 个：熊猫、蓝鲸、牛来 · 萌化、牛来 · 原皮、牛来 · 小黄、奶龙、
赛博猫、大狗、小奶龙。新增角色来自用户提供的 `new-pets.zip`；奶龙保留连续
WebP 动画，小奶龙保留按音效时长调度的四帧动作，牛来保留飞行和飞行喊叫帧。
静音时仍播放互动动作，换角色或卸载时停止音效并取消旧角色的帧计时器。
角色切换保留账号选定的大小；所有姿势限制在相同桌宠边界内并保持素材比例。

设置页、右键/长按菜单与 Engine 共用 `ClassHubPetConfigStore`。
本地变化立即发布，连续修改用 600ms debounce 合并保存，写请求串行化，
服务器的旧响应不会覆盖更新的本地输入。保存失败保留当前预览并显示重试入口。
每个 Store 捕获其账号 Token，退出时的剩余写请求仍属于原账号。

位置仅存于 `classhub:pet-position:<userId>`，内容是 `x`、`viewportWidth`、`facing`。
刷新按视口宽度缩放 X 并重新限制边界；松手重力落回安全底线，所以不保存悬空 Y。
位置、账号 Token 和偏好不混存；不会使用 `dsh-niulai-pet:state-v1`。
存储失败被捕获，桌宠仍可使用。

## 个人设置 API

| Method | Path | 权限 |
| --- | --- | --- |
| GET | /api/users/me/settings | 已验证 JWT，对应账号 |
| PATCH | /api/users/me/settings | 已验证 JWT，只修改该账号 |

返回 `{ success: true, settings: {...} }`。PATCH body 使用平铺字段，例如
`{ "petSkin": "whale", "petMuted": true }`；通过 `$set settings.<key>` 更新，
保留既有隐私/通知字段。禁止 userId、位置、未知字段、Mongo 运算符和非法类型/范围。
管理员遵循同一身份限制。响应使用 `Cache-Control: private, no-store`。

## 后续业务事件

在 `PetProvider` 下使用现有 facade，无桌宠时调用会安全忽略：

```tsx
import { usePet } from '@/features/pet/PetContext';

const { pet } = usePet();
pet.poke();
pet.celebrate();
pet.say('提交成功啦！');
pet.setBusy(true, '正在处理…');
pet.setBusy(false);
pet.perform('dance');
```

本版尚未把班费、量化、公告或 AI 业务自动连接到这些事件。
后续皮肤需同时更新静态皮肤定义、共享白名单及有许可的资源；自定义包不在本版。

## 手机、层级与动画

桌宠位于 `--z-pet: 35`，头部 30、底部导航 40、Modal 50。
现有 Dialog/AlertDialog 打开时隐藏桌宠。菜单支持键盘、右键及 550ms 触摸长按。
手机按账号尺寸乘 0.8，再依据视口宽高限制；保留底部导航空间，避开可见按钮/表单。
手机内容区域使用可释放的 ResizeObserver，覆盖懒加载和请求后出现的控件；不观察 body。
表单编辑、软键盘缩小视口和隐藏页面时暂停并让位。
`prefers-reduced-motion` 禁用持续动作；互动、气泡与设置仍可用。

## 部署与迁移

无需新增 npm 依赖或环境变量。构建静态资源已经位于 `public/pet-assets/`，
Vercel 的专用静态路由也包含 LICENSE 与 NOTICE。部署后端时应包含仓库根的
`shared/pet-settings.json`，当前整体项目结构会自动满足这一点。

旧账号无须先迁移即可使用：API 读取时补齐默认值，用户修改时正常写回现有文档。
如需把全部旧账号缺省字段补齐，可从仓库根执行：

```sh
node uniclub-backend/migrations/20261001_pet_settings.js
```

脚本读取既有 `uniclub-backend/.env` 的 MONGODB_URI；重复执行无副作用，
保留已有设置，不创建新集合、不修改角色/密码、不写位置。

验证命令：

```sh
npm run typecheck
npm run lint
npm run build
npm test
npm run test:pet
```

## 来源与许可

核心逻辑改写自 `dsh-niulai-pet v0.4.13`，Copyright (c) 2026 whitefirer，MIT。
完整许可证及说明在 `public/pet-assets/LICENSE`、`public/pet-assets/NOTICE.md`，
改写的核心模块保留简洁来源注释。熊猫/蓝鲸是 README 明确允许自由取用的手绘素材，
声音来自原工程合成算法。新增 7 种皮肤与 6 个 MP3 来自用户提供的 `new-pets.zip`。
ZIP 没有附加素材许可，MIT 代码许可不自动覆盖第三方角色形象或录音权利；
相关状态及来源单独记录在 NOTICE。没有迁移自定义包导入或角色商店。
DSH 设置卡片、sessions/AI 任务监听、host/connection/remote/slots/locale、
KWS/语音识别/WASM/麦克风、多桌宠碰撞、全家福及角色包商城均未迁移。
