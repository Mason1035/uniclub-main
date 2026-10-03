# AGENTS.md — dsh-niulai-pet

> 桌宠插件的完整维护手册。用户面介绍看 README.md；本文件写给改代码的人/agent。
> 未来规划（自定义皮肤、语音控制、设置卡片、图片识别协同）与 STT 选型调研见 `docs/roadmap.md`。

## 是什么

dsh（DeepSeek Harness）web 的桌宠插件：右下角 fixed 浮层，7 个内置角色 9 个皮肤
（牛来/原皮/小黄/熊猫/鲸鱼/奶龙/大狗/赛博猫/小奶龙）+ 用户自定义角色包（zip 导入），
订阅 sessions 服务在 agent 任务完成时庆祝（喊声+气泡+动作）。
- **client 半**（`lib/client.js`）：桌宠本体 + 设置卡片（dsh rc.7+ 设置页
  「插件配置」区，React 组件，react 由宿主模块表提供、构建时 external）。
- **host 半**（`index.js`）：仅注册 settings 命名空间 `niulai-pet`
  （`installSettingsSection`，schemastery schema）——这是设置卡片的配对键，
  持久化由 dsh host 白拿（`~/.dsh/settings.yaml`）。rc.6 无 settings 服务时
  installSettingsSection 内部 inject 永远等不到，静默跳过。
`dsh.bundle` manifest + `cordis.patch.yml` 同时满足官方 CLI 安装识别
（awesome 收录硬性要求）。**若早期经 pnpm file + market client-only shim
装过，需用官方 CLI 重装一次**（`dsh plugin --profile web add file:...`）
让它进 bundles 层栈。

## 构建与调试

```sh
npm run build      # esbuild → lib/client.js + demo/niulai-standalone.js（素材 dataurl 内联）
npm run typecheck  # tsc --noEmit
```

- **standalone 试玩页**：`demo/index.html` + `niulai-standalone.js`（同一套 pet.ts +
  SKINS，sessions 订阅换成 `src/client/demo.ts` 的模拟任务卡片）。本地直接
  浏览器打开 `demo/index.html` 即可玩；线上部署 = 把 demo/ 两文件拷到任意静态目录
  （当前挂在博客 `static/niulai-pet/` → whitefirer.org/niulai-pet/）。
- 安装调试：`cd ~/.dsh/profiles/web && pnpm add file:<本仓库路径>`，首次重启一次
  dsh web；之后 `build + 刷新页面`即可（lib/client.js 与注入副本是同一 inode
  硬链，esbuild 原地写自动同步）。**注意 pnpm file: 注入缓存**：改了
  `index.js` / `cordis.patch.yml` / `package.json`（非构建产物）pnpm 不会重同步
  （2026-08-21 踩过：注入目录残留 0.1.0 的 package.json），要手动
  `cp index.js cordis.patch.yml package.json ~/.dsh/profiles/web/node_modules/dsh-niulai-pet/`
  再重启 dsh web（host 半改动必须重启才加载）。新 dependencies 由 pnpm 正常解析
  进 profile 顶层 node_modules，无需手动管。
- 验证钩子：页面 URL 加 `?petdebug=1` → `window.__niulai`（PetHandle）。
- playwright 可用，从绝对路径 import：
  `/home/tenbox/Desktop/Devspace/cenacle/web/node_modules/playwright/index.mjs`。
  dsh web 直连 `http://127.0.0.1:3080/`。**别用 `waitUntil:'networkidle'`**
  （ws 长连接永不 idle），用 `domcontentloaded` + 固定等待。
- 冒烟脚本范式在 /tmp/niulai/smoke*.mjs（临时目录，不保证还在）：
  按 `z-index=99999` 找桌宠 root，菜单是 `min-width:170px` 的子 div。

## 发布

推 `v*` tag 触发 GitHub Action 自动发 npm（`.github/workflows/publish.yml`，
secret `NPM_TOKEN`）：先改 package.json 版本号并合入主干，再打同号 tag——
workflow 会校验 tag 与版本号一致，不符直接失败。手动兜底：本机 `npm publish`
（`publishConfig` 已钉官方源，provenance 只有 CI 路径有）。

## 架构

src/client/index.ts   入口：PackRegistry/ConfigStore 创建、sessions 订阅（含忙闲沿）、卡片子 fiber、
                      插件侧全家福管理器（主宠菜单入口；均匀/层次/收起循环，钉住+置顶+原位恢复）
src/client/packs.ts   角色包核心：两级模型（角色=声音/动作/事件/语录，皮肤=外观）、内置包定义、
                      zip 解析校验（PackParseError 逐条字段级错误）、派生合并（variant）、
                      IndexedDB 存取、PackRegistry 可观察门面
src/client/skins.ts   兼容层：SKINS=内置包展开 + 语音模板（assets/voice/）导出，消费面不变
src/client/pet.ts     桌宠本体：DOM + 状态机 + 动画 + 菜单 + 叫声（皮肤列表经 subscribeSkins 热更新）
src/client/config.ts  ConfigStore：localStorage / settings scope 双后端 + 旧版迁移（updateSkinIds 动态白名单）
src/client/card.tsx   设置卡片：React 组件 + CardController + 自定义角色管理（PackManager）
src/client/demo.ts    standalone 试玩页入口：复用 SKINS + mountPet，模拟任务驱动庆祝（全员广播）、
                      角标区（一起飞/全家福/包试玩/语音/隐藏/静音）
src/client/family.ts  全家福排布共享模块：阵容常量 + layoutUniform/layoutLayered（demo 与插件共用）
src/client/highlight.ts 预览图高亮总线（card 点预览图 → 对应 pet 发光+小跳，按 petId 认领；
                      另有 setHold/releaseHold 驻留高亮：卡片「当前桌宠」tab 展开期间选中桌宠
                      持续金色发光，切 tab/换对象/收起/关面板即 release 恢复默认投影）
```

**SkinDef（pet.ts）**：`{ id, name, image, imageBlink?, imageShout?, shoutAnim?, imageFly?,
imageFlyShout?, imageSpout?, imageSleep?, voice, sounds?, signature, shoutBubble, quips?,
defaultSize?, defaultOpacity?, defaultHue?, defaultHueCycle?, splitCount?, driveStyle?,
doneVoice?, doneSounds?, jelly? }`。
PetHandle 公开面：`celebrate/poke/fly/setBusy/setMuted/isMuted/destroy`
+ `bounds()`（位姿 x/y/w）、`place(x)`（摆位，非展示挂载落盘）、`setVisible()`
（先隐挂载防闪）、`setPinned()`（钉住不游走）、`setTopmost()`（置顶压层）；
demo 导演专用（不影响插件路径）：`act(name)`（直走 runAction，守卫同源）、
`shout()`（只喊不出动作）、`face(dir)`（转身，走 setFacing 统一入口）。
demo 页 `?petdebug=1` 额外挂 `window.__director`（list/spawn/act/poke/celebrate/
shout/place/face/pin/show/remove/removeAll）：spawn 走 forceSkin/forceSize 展示性
挂载（演员表独立管理，removeAll 只清自己挂的），该模式下模拟任务卡片不再自动
跑（防随机庆祝搅分镜）。视频导演脚本不入本仓（playwright 步进驱动 + 逐场录制拼接）。
PetAssets 可选钩子：`forceSkin/forceSize`（展示性挂载：不写位置记忆、不进物理、
不游走）、`onFlightEnd`（飞行落地回调，与 flight 收尾同同步段=零闪烁）、
`onFamilyToggle`（主宠菜单全家福入口）、`highlight`（预览高亮总线）。
`shoutAnim` = 喊叫帧序列（`{src, at, rock?}[]`，at 为占喊声全长比例）——配了它喊叫
不走「开-合-开」嘴型，改按时间线逐帧演出；帧可以是**动画 webp**（奶龙：157 帧
10fps 单文件循环≈15.7s 与笑声音频等长——原 111 帧 11.1s 对不上 15.65s 完整笑声，
打滚段乒乓补帧 + 画布顶裁 7px 归一（曾裁 22px 把仰头帧头顶切了；全帧内容顶 y=9，
安全值裁完站姿笑占画布 92%），at:0 一帧挂整场演出，
原生播放最平滑，循环喊时持续滚放）。帧尺寸
按「统一物理缩放」换算（帧高/序列最高帧 × PET_H，倒地不再巨大），宽帧以站立帧中心
锚定并钳进视口；循环喊的两声间隙演出帧保持滚放（animRolling 标记挡住眨眼/sleep
抢图，打断路径由 stopShoutLoop/cutPlayingShout 归位）；演出期间移动类动作让位
（animTakesOver，静音兜底才跑 done/poke 绑定动作）。注意 `img.style.height` 只能设具体 px，置 `''` 会清掉内联高度让图按
自然尺寸炸开（踩过）；拖拽拎起只在飞行中才换站立图，无差别换图会把演出画面掐了
笑声还在放（踩过）。

**角色包（packs.ts）**：两级模型——角色（声音/动作/事件/语录）+ 皮肤（外观），
格式规范与导入校验规则见 `docs/skin-pack-schema.md`。要点：内置皮肤全局 id 沿用
历史值（niulai/orig/young/panda/whale/nailong/dagou/cat/xiaonailong，存量配置零迁移；
奶牛 0.4.7 移除，存量 cow 回落默认），自定义包皮肤
id = `角色id/皮肤id`；多皮肤角色的显示名组合为 `角色名·皮肤名`。加内置角色 =
assets/<角色>/ 放素材 + BUILTIN_PACKS 注册一条；用户角色走 zip 导入（fflate 解、
逐字段校验、素材转 dataurl 进 IndexedDB），host 半 skin 字段已是自由字符串
演示样例包 = `docs/assets/robot.nlpack.zip`（单帧+一声最小包，试玩页拖入即验流程）。
（合法性由 client 白名单围栏）。

**语音停喊双引擎**（voice.ts + kws.ts）：`voiceEngine` 配置二选一。
（演进/数据/复跑脚本单一来源 = `docs/voice-stop-engine.md`，改动同步它。）
template=本文件的 MFCC+DTW（零下载）；kws=sherpa-onnx zipformer
（wenetspeech-3.3M int8）wasm，判别力远超模板。**kws 跑在 Web Worker**
（kws/kws-worker.js，postMessage 协议见文件头：init/open/feed/hit/close，
stream id 多路复用，卡片测试与正式监听共存）——wasm 线性内存
（INITIAL_MEMORY=32MB——实测高水位：16MB 不够、32MB 全程不涨；ALLOW_MEMORY_GROWTH 兜底）只涨不缩，
`worker.terminate()` 是唯一可证明的物理释放：kws.ts 引用计数归零且空闲
10s 即 terminate，下次监听重建（wasm/HTTP 缓存秒级），推理顺带离主线程。
wasm/模型不在 bundle 里——随 npm 包的
`kws/` 目录分发，**host 半 index.js 注册了 `/niulai-kws/<file>` 前缀路由**
（`ctx.inject(['webServer'])` + 白名单五文件，dsh 只伺服 client.js 其余
得自己开路由），client 半 `Module.locateFile` 指过去（`?v=__NIULAI_VERSION__`
破缓存）。kws 装载失败 voice.ts 自动回落 template。注意：**kws/ 目录也要
手动同步**进 profile（同 index.js 的 pnpm file: 缓存坑）：
`mkdir -p .../dsh-niulai-pet/kws && cp -l kws/* .../dsh-niulai-pet/kws/`。
指令词 = `KWS_KEYWORD_PRESETS` 预设表（id/label/音素变体行，变体 @词+字母、
显示按 label 前缀归并）；**加新词 = 表里加一条 + 跑交叉验证**
（/tmp/niulai-stt/kws-multi-test.js：四词共存零串词、负样本零误报；
重口音/超速漏检是已知限制，声调/鼻音变体猜修无效别堆）。
thr 0.1/score 1.5 与 wasm 构建+冒烟见
`/home/tenbox/wasm-build/BUILD-NOTES.md`；同源 e2e 复跑：
`node /home/tenbox/resize-diag/kws-e2e-worker.js`（worker 协议全链路）。
已知限制：「你又来」近音会误触发；INITIAL_MEMORY=512MB，低端移动浏览器
可能实例化失败（回落模板兜底）。

**pet.ts 状态机**：`mood ∈ idle/walk/drag/celebrate/sleep/fly`。
行为循环只在 `idle` 触发；动作派发 `runAction(name)` 解析
`signature→当前皮肤签名`、`random→ACTION_POOL 现场抽`。
**喊声是独立状态**：`shouting` 旗标（mouthShout 置位/复归）——sleep、眨眼等
idle 行为必须查它让位（喊声不改 mood，只查 mood 会演出"边喊边趴下变暗"）。
**趴睡常态皮肤**（`isLaydown()`：常态图==专睡图且有 shout 图，如赛博猫）喊叫
不走「开-合-开」嘴型——没有"站着闭嘴"帧，合嘴相位会闪回趴睡图；改为全程
站图，声止后再站 2.5s 才趴回（`lingerTimer`，拖拽/飞行/新喊叫打断）。

**多只与物理**（physics.ts + pet.ts）：额外表由 index.ts 的 syncExtraPets 盯
配置 `extraPets` 增删实例（皮肤/大小/语录按只分存——语录链=本只专属→全局
自定义→内置池，位置按只分存，行为配置全局共享）。设置卡片「配置对象」
选择器带皮肤预览图，**点预览图对应桌宠发光+小跳**（highlight.ts 总线，
card→pet 按 petId 认领）。皮肤列表热更新重解析必须走 `mySkinId`（曾错用
全局 skin 字段，包一变更额外表全变成主宠皮肤，刷新才恢复）。
物理世界是**地面一维 + 高度门槛**：重叠分离只看 x 区间，且要求垂直搭界
（`getLiftY` 底边离地 + `getH` 身高求重叠——拎着越过头顶不推人）；
`held()`（拖拽/坠落中）的一方不被推只推人。坠落（startFall）松手带水平
抛掷初速度，坠落期按 vx 顺势倾斜、落定才回正；首次触地 `impactAt` 判砸落
（受害只 bump，强度按**头顶上方落差**算），压实在别只头上（水平重叠过
窄者 45%）则不定落、朝空隙侧弹开滑下（上限 2 次防夹缝卡死）——堆叠试过
不做（实现复杂度跳档）。
拎起时 z-index 99999→100000 压过其他桌宠，落定还原。物理 setX 钳位用实际
渲染宽（硬编码 60 会把大个子推进墙，踩过）。落地/重撞有 WebAudio 闷响
（`synthThud`，跟主音量/静音）。**大小**：皮肤可声明 `defaultSize`
（奶龙 155，其余内置 120；自定义包 pack.json 皮肤级 `size` 字段），
换皮肤（菜单/卡片同语义）大小落到新皮肤默认，用户再调优先；设置卡片
大小是滑杆（72-200），多只时「配置对象」选择器带皮肤预览图选按只调。
**不透明度**：皮肤可声明 `defaultOpacity`（自定义包 `opacity` 字段，20-100；
如史莱姆 90），换皮肤/新建额外表时透明度落到它（额外表条目缺省也回退它），
用户再调优先；滑杆/重置按钮同样以皮肤默认值为基准。**色相**同理：
`defaultHue`（自定义包 `hue` 字段，0-360，缺省 0=原色），换肤即落。
**流光变色**：按只开关（主宠 `petHueCycle` / 额外表条目 `hueCycle`，默认关），
90ms 推进 1.5° 相位（~22s 一圈），生效色相 = 配置基底色 + 滚动相位——
**纯显示不落盘**（否则每帧一次配置写），关掉即回基底色；分裂克隆取当时相位色。
**连戳红温**：总开关 `heatEnabled`（通用 tab，默认开；关掉戳不积火、现有红立即褪）。
戳一下积 0.15 火气（heat），同一 90ms 拍里 0.003/拍消退；**忍耐期 heat≤0.45 不显红**
（前 3 戳像在忍），dHeat=(heat-0.45)/0.55 驱动视觉 = 轻度 sepia/saturate 暖化 + 红色辉光
+ **heatLayer 红色剪影层**（当前图作 alpha 蒙版 + `mix-blend-mode:color` 盖红——
只换色相保明暗，蓝皮也变"真红"而非平红膜；蒙版与透明度**同帧**装上（否则闪红板），
几何跟随 img 实时 height/left（shoutAnim 倒地宽帧不改就留站高红影子——踩过），
分裂隐身时同步隐）；heat≥1（快戳 7 下）爆发：哼「再戳我急了！」+ 扭头背过去 +
4s 气头冷却（期间戳也白戳不理人）；**爆发不清火**，旧火按原速自然消退。
分裂克隆取红温快照（dHeat 进克隆滤镜）。

**动作 `split`（分裂）**：史莱姆签名动作，轻量克隆版——主图一压隐身
（根节点拒拖），2~3 个纯 DOM 克隆（身高 = 原高/√n：2 只≈71%、3 只≈58%，
面积守恒，合体视觉还原；不挂状态机/不进物理/不写配置）
错峰散开三连跳（落地压扁空中拉长），眨眼=定时换 src，再聚拢缩小合体，
主图走 landSquash 果冻弹回；裂开/合体各放一声角色音。克隆全部挂载在
`splitClones`，destroy/中途异常走 `cleanupSplit` 兜底还原（可见性/拖拽/计时器）。
注意：分裂中主宠 root 也是 `body>div` + pointer-events:none + 有 img，
写 DOM 探测脚本时会被误判成克隆（按 img 高度 ≠ 主宠高区分）。
**开场压扁动画绝不能加 `fill:'forwards'`**——WAAPI 前向填充永久压内联样式，
没人取消会把主图钉死在趴扁态，之后的走路/跳跃动画只是暂时盖过它，
停下又趴回去（用户报「一会正常一会趴着」翻出来的，铁律#1 的翻版）。
分裂数可被皮肤 `splitCount`（2-6）覆盖（史莱姆王 5 只）。

**动作 `drive`（开过去）**：车系签名，地面横穿——引擎声（voice）起哮，
加速冲出本侧屏幕 → 从另一侧杀回 → 减速滑回原位（~3.6s，方向随机）。
演出风格走皮肤 `driveStyle`（wheelie=全程抬前轮 / wiggle=摇头晃脑 / random 每次抽）；
镜像父级内 rotate 同样不乘 dir（动车类继承铁律#2）。随机池剔除 drive
（牛来随机抽到开车很出戏）；wheelie 前轮抬统一 rotate(-24deg)。

**完成庆祝三件套**：`fireCelebrate` 在皮肤声明 `halo:true`（幽灵系）时发**完成光环**
（金色光圈浮现头顶，3.6s；气泡 bottom 已抬到 103%+30px 给光环让位——同一位置
气泡会在层级上盖掉环，踩过）；
完成叫声走 `playNotify` 优先级：自定义提示音 → 皮肤 `doneVoice`（合成预设，
警车 'siren'）→ 皮肤 `doneSounds`（采样，todo）→ 普通叫声；
shoutAnim 皮肤的「帧演出即本体」让位逻辑在 `animAllows`——**先解析
signature 占位符再判**（否则皮名下的 split 被吞，火史莱姆戳=喷火+分裂
就是翻这坑），split 例外放行（分裂自身就是完整演出）。

**警灯交替 / 卷球滚动**：警车类皮肤配 `images.lampA/lampB` 后，lampTimer
480ms 翻相位，`skinIdle()` 返回当前相位灯帧（喊叫/演出期不动 src）；
犰狳类配 `images.roll` 后，**roll 动作全地滚过**（卷球图 + 轮转角=行程/半径：
冲出本侧→另一侧杀回→滑回原位，~3.6s，镜像父级内不乘 dir）——
**mouthShut 必须给 rollingBall 让位**（喊叫计时器会在 240ms 处把 src 踩回
站姿图，球图瞬间消失，踩过；先有 rotate 无球图就是这么来的）。

**气泡耗时已知限制（2026-08-25）**：宿主会话快照不含起跑时间，客户端只能
观测到 running 时起算（种子/订阅点），dsh 侧约 60s 更新一次 → 展示耗时稳定
少 ~1 分钟。正确修法在 dsh 上游：session 摘要加 startedAt（pending）。

**持久化**（ConfigStore，config.ts）：行为键 muted/shoutOnDone/shoutCount/
talkative/skin 全局通用；动作绑定按皮肤记（`actions: { [skinId]: {done,poke} }`，
缺配回落 done=签名/poke=连跳）。dsh rc.7+ 走 settings scope（Host 持久化，
scope.set 乐观回显 pending 层）；更老版本回退 localStorage
（`dsh-niulai-pet:state-v1`）。位置 `x` 按设备永远留 localStorage，pet.ts 直读直写。
旧文档迁移：全局 doneAction/pokeAction 一次性改写为全皮肤 actions，
`classic` 皮肤 id 改写为默认皮肤。

## 动画的三条铁律（都踩过坑）

1. **WAAPI 的 pause 不等于移除**：暂停的 breathe 动画仍然压着 `img.style.transform`
   （WAAPI 在级联里压内联样式）。凡是写内联 transform 的（flight 旋转、roll、
   拖拽倾斜），必须 `breathe.cancel()`，完事 `breathe.play()` 重启。
   用 `img.animate` 的（hop/dance/spin/sway）后启动者天然覆盖，pause 即可。
2. **镜像父级内的 rotate 不要乘方向 dir**：root 有 `scaleX(facing)`，镜像会把
   精灵图和旋转一起翻转，两个方向自洽。乘了 dir 会底朝天（v5 实测）。
3. **协程收尾不得无条件重置 mood**：walkTo/sleepFor 尾部只在自己仍是
   `walk`/`sleep` 时才置回 `idle`，否则会把并发启动的 fly 绞杀在半路。

## 自动化测试的边界（2026-08-24 踩过）

playwright 每次开**全新临时浏览器**：角色包存 IndexedDB，临时浏览器里是空的
——在脚本里"导入/删除/恢复用户已装的包"全发生在临时环境，**用户真实浏览器
的包从不受影响**（别据此宣称"已恢复/已删除"）；但**配置写是互通的**
（dsh settings scope 落服务端 settings.yaml），脚本里的换肤/滑杆会真写用户
配置，测完必须恢复现场。验证包行为（导入/换肤/包级默认值）在同一个临时
会话内闭环即可，结论只对引擎有效，不涉及用户已装的包。

## 嘴型与叫声

- 嘴型时间线（mouthShout）：开 240ms → 合 120ms → 开并保持到音频结束
  （「妈~~」尾音是开口音，全程打机关枪是错的）。时长来自挂载时预读的
  mp3 metadata（soundDur map），不是写死的。
- 飞行中喊叫用 `imageFlyShout`（飞行张嘴帧）；没有张嘴图的皮肤跳过嘴型。
- 连喊（shoutCount 1-3）：chain 递归，一声放完接下声（mouthShout 的 onDone）。
- 合成叫声（moo/whale/squeak/meow/crackle/engine/motor/siren）是 WebAudio 实时合成，参数在 pet.ts 顶部
  `synth*` 函数；AudioContext 在首次 pointerdown 暖场（自动播放策略）。
- **叫声时长缓存 soundDur 是模块级共享**（2026-08-29）：曾每实例各一份、每只宠物全量探测
  所有皮肤的 mp3（N 宠 × M 声个 Audio 探针），30 只合影撞 Chromium WebMediaPlayer 上限
  （≈75，probe 被静默拦、时长全丢）；共享后探针总量与宠物数无关。
- **setValueCurveAtTime 的「钉末值」锚点不能按旧 t0 算**（2026-08-29 冒烟踩过）：同步函数里的
  重活（十几万样本的噪声缓冲填充、GC 停顿）会让捕获的 t0 过期——Chrome 把过期曲线起点钳到
  currentTime、有效终点后移，按 t0+dur 排的锚点落进曲线区间抛 NotSupportedError；曲线终点
  还会向上取整到渲染量子（128 样本≈2.9ms），正好踩 t0+dur 也判 overlap。规矩：曲线起点现取
  `Math.max(t0, ctx.currentTime)`，锚点排 `ts+dur+0.01`（engine/motor/siren 三处全这么写）。

## 素材管线（tools/）

assets/ 与 lib/ 均入库。
重建/修改素材的脚本全在 tools/：

- `tools/cutout/`（牛来/小黄系，PIL+numpy，路径内的 /tmp/niulai 需自备源帧）：
  cutout2.py（源帧抠图，犄角暗色阈值）→ repair_hooves.py（腿部重建+蹄冠：
  微梯形+分趾缝+渐变+微外八）→ make_shout.py（张嘴：口腔+舌头+高光）、
  make_young.py（去角+抛物线削顶+HSV 黄亮调色）、make_blink.py（闭眼帧）、
  cutout_fly.py（-70° 旋转出飞行图）。pitch.py 是音频基频分析（鉴别变调段）。
  **顺序敏感**：pet.png 是链根，改它必须重跑全部派生。
- `tools/cutout/cutout_orig_db.py` + `variants_orig_db.py`（牛来原皮系，独立短链）：
  源是 AI 生图三视图（正面全身白底，用户提供）——近白阈值抠图 +
  腿部以下阴影区规则（防蹄底搭桥封腿缝）+ 腿缝泛洪清除（全填孔保嘴套高光），
  派生张嘴/眨眼。无角是设定：牛来幼时无角，勿当缺陷修掉。
- `tools/drawn/`（熊猫/鲸鱼等原创 SVG，含已移除奶牛的存档）：`node render.mjs x.svg out.png W H`
  渲染 + `python3 post.py` 预乘 alpha 降采样去白边；*.snip 是 blink/spout
  变体补丁；whale 参考图抓取 grab_ref.mjs。
- 喊声降噪链（F 档，从原始 cut 重新生成）：
  `ffmpeg -i in.mp3 -af "highpass=f=280,highpass=f=280,afftdn=nr=22:nf=-32,lowpass=f=6200,volume=5dB" out.mp3`
  背景音焊死在音轨里，更强会出"水下音"，F/G 档已对比选定 F。

## 演示视频制作（带声）

系统 PulseAudio monitor 抓取在本机实测**拿不到数据**（record 流 0 字节，
挂起疑与管道/PipeWire 有关，未解），所以走后期配音：

1. Xvfb 虚拟屏：`Xvfb :99 -screen 0 1920x1080x24`
2. ffmpeg 纯画面：`x11grab -i :99 -c:v libx264 -preset ultrafast`（先保流畅）
3. playwright headed（`env DISPLAY=:99`）跑编排，**每次开喊记 `Date.now()`**
4. 后期对齐混音：`adelay=ms|ms` 每声一条 + `amix=normalize=0` + `apad/atrim`，
   再 `-preset slow -crf 20` 精编码。成品：Workspace/niulai-pet-demo.mp4。

## 其它坑

- **设置卡片配对**：host 半 `installSettingsSection(ctx, NS, …)` 注册的命名空间
  与浏览器半 `settings.plugin.item` 的 `key` 以字符串配对（都是 `niulai-pet`），
  设置页自动配对渲染；被 serve 却无人认领的命名空间不渲染，反之亦然。
  dsh vendored cordis **没有** `{required:false}` 可选注入语法——可选 = 顶层
  `inject` 保持空，apply 内 `ctx.inject([...], cb)` 子 fiber 等服务
  （settingsScope/slots/locale/connection/remote 缺一即永不激活，rc.6 静默无卡片）。
  卡片控件即时写（离散控件不套官方 CardForm 的 staged/save）；读侧是
  ConfigStore 的 subscribe，uSES 要求 getSnapshot 稳定引用（不变时同一对象）。
- 菜单行点击曾被 root 的 `setPointerCapture` 截胡成 poke——root 的 pointerdown
  对 menu/about 区域直接 return。
- `ctx.effect(fn)` 立即执行；清理函数要 `() => () => cleanup()`。
- body 直挂节点会被 dsh 首屏 React 清掉：MutationObserver 守灵重挂。
- 气泡/菜单文字在 `scaleX` 根下会镜像：用 `scaleX(var(--face))` 抵消，
  flight 改朝向时记得同步 `--face`。
- 候选音频段有加速变调（音调升高失真），用基频甄别（pitch.py：800-889Hz
  为正常奶声，516-552Hz 为变调段，已弃用）。
- **自渲染 React 面板（悬浮设置面板）**：宿主没有「打开设置页并定位」API
  （SPA 无路由、URL 不变），`mountCardPanel`（card.tsx）把同一个 NiulaiCard
  用 createRoot 渲进桌宠旁浮层。react-dom 打包进 bundle（只 external
  `react`/`react/jsx-runtime`，单 react 实例多 root 合法）；**build.mjs 必须
  define `process.env.NODE_ENV=production`**——否则吃进 dev 版 react-dom，其
  act() 环境检测读平台 prod react 没有的 `ReactCurrentActQueue.current` 直接炸
  （isConcurrentActEnvironment TypeError，踩过）。t 座/uSES hook 在
  mountCardPanel 里手工适配，scope 伪装常驻 ready/writable。
- 右键菜单（2026-08-24 瘦身）只留高频：声音/气泡/🌈色相滑杆/皮肤/动作/设置/
  关于；低频配置全归设置面板。滑杆行拖动只预览（直接改 petHue+applyImgFilter），
  change 或菜单关闭（closeMenu→commitHuePreview）才落盘 ConfigStore——拖动中
  写 store 会触发菜单就地重建、input 被销毁断拖。
- **悬浮设置面板两个坑**：① createRoot 会接管并清空容器——面板外壳的 ✕ 按钮
  必须和 React 挂载点做兄弟节点，不能先塞进同一容器（按钮被吞过）；② tab 激活态
  别用 dsw brand 变量做填充底——dsh 的 brand 是浅色，白字压上直接隐形，改描边+
  文字着色。z 序是全局认领制（zCounter 取号，抓起永久置顶），面板 z 用
  10000002 永远压桌宠。
