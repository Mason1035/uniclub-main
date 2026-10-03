# 角色包 / 皮肤包格式草案（v1 · 送审稿）

> 状态：**v1 已实现**（2026-08-22）。实现期两个补充决策：
> ①内置皮肤的全局 id 沿用历史扁平值（`niulai/orig/young/cow/panda/whale/nailong`），
> 存量配置零迁移；自定义包皮肤 id 按本规范 `角色id/皮肤id` 组合。
> ②多皮肤角色的运行态显示名 = `角色名·皮肤名`（选择器/菜单直接展示）。
>
> 两级模型：**角色（character）= 声音 + 动作 + 事件 + 语录；皮肤（skin）= 外观**。
> 角色可含多个皮肤（如牛来：萌化/原皮/小黄），皮肤间共享角色级素材，零重复存储。
> 内置角色与自定义包同构——内置即预装包。

## 1. 包结构与分发

单文件 zip，建议扩展名 `.nlpack.zip`（双击关联友好，本质普通 zip）：

```
robot.nlpack.zip
├── pack.json              # 角色清单（唯一定义入口）
├── assets/                # 角色级共享素材（声音等）
│   ├── laugh.mp3
│   └── reply.mp3
└── skins/                 # 皮肤素材，按皮肤 id 分目录
    └── default/
        ├── stand.png
        ├── blink.png
        └── anim.webp
```

约束：

- 包内所有素材必须经 `pack.json` 引用，未引用文件导入时警告并忽略（防夹带）。
- 单包体积软上限 **8MB**（超出警告）；单张图软上限 2MB。 IndexedDB 存储无硬问题，
  但过大包拖慢首次加载（全部转 dataurl 进内存表）。
- 声音格式 mp3（兼容性最稳）；图片 png（透明底）或 webp；帧动画**动画 webp 单文件**
  （奶龙管线同款：抽帧→清洗→合成，原生播放，无需逐帧时间轴）。

## 2. pack.json schema

```jsonc
{
  "spec": 1,                      // 必填，schema 版本。加载器只认它懂的 spec
  "type": "character",            // character=完整角色；variant=派生覆盖包（见 §4）
  "id": "robot",                 // 必填，角色 id。[a-z0-9-]，2~32 字符，全局唯一（别撞内置 id：niulai/orig/young/panda/whale/nailong/dagou/cat/xiaonailong）
  "name": "机器人",                // 必填，显示名
  "version": "1.0.0",             // 必填，包版本（semver 字符串，仅展示与升级比对用）
  "author": "whitefirer",         // 可选
  "description": "自定义角色包导入演示样例",  // 可选，一句话介绍
  "minEngine": "0.4.11",          // 可选，插件版本门槛（x.y.z）。低于它导入仍成功，
                                  // 但提示「新特性可能不生效」——老引擎本来就忽略未知字段，
                                  // 特性只是降级。用了 jelly/splitCount（0.4.10+）、
                                  // walkable（0.4.11+）这类新字段时写上

  "voice": {                      // 必填。声音策略
    "type": "samples",            // samples=自带音频 | synth=内置合成音色
    // type=samples：
    "samples": ["assets/laugh.mp3"],  // 完成/喊叫音，≥1 个，多个时随机播放
    "reply": "assets/reply.mp3",      // 可选：语音停喊成功后角色的回应音
    // type=synth（仅限内置音色名，自定义包不可用新合成音——合成器是代码）：
    // "preset": "moo"              // moo | squeak | whale
  },

  "events": {                     // 可选，事件→动作 的默认绑定（用户可在设置里改）
    "done": "signature",          // 任务完成。缺省 signature
    "poke": "hops"                // 戳一下。缺省 hops
  },

  "quips": ["我才是奶龙！"],       // 可选，角色级唠叨语录（与皮肤级合并抽取）

  "skins": [                      // 必填，≥1 个
    {
      "id": "default",            // 皮肤 id（角色内唯一，[a-z0-9-]）
      "name": "标准",              // 显示名
      "default": true,            // 可选，仅一个；缺省取数组第一个
      "images": {
        "stand": "skins/default/stand.png",   // 必填，站立图（透明底 png）
        "blink": "skins/default/blink.png",   // 可选，闭眼图（眨眼）
        "shout": "skins/default/shout.png",   // 可选，张嘴图（喊叫嘴型）
        "fly": "skins/default/fly.png",       // 可选，fly 动作图（缺省用 stand）
        "flyShout": "skins/default/fly_shout.png", // 可选，飞行中喊叫
        "spout": "skins/default/spout.png",   // 可选，breach 弧顶特效图
        "sleep": "skins/default/sleep.png"    // 可选，打盹专睡图（配了它换图不压扁；
                                        // 若与 stand 同图 = 趴睡常态皮肤：平时趴着，
                                        // 喊叫才切 shout 图站起，声止再站 2.5s 趴回）
      },
      // 可选，喊叫演出。配置后喊叫不走「开-合-开」嘴型，改按时间线切帧。
      // src 可以是帧图序列，也可以是单个动画 webp（at:0 一帧到底，推荐）。
      "shoutAnim": [
        { "src": "skins/default/anim.webp", "at": 0 }
        // { "src": ".../f2.png", "at": 0.4, "rock": true }  // rock=附加倒地摇摆
      ],
      "signature": "sway",        // 可选，签名动作。缺省 hops
      "shoutBubble": "哈~哈~",     // 可选，喊叫气泡文案。缺省角色名
      "quips": [],                // 可选，皮肤级语录
      "size": 100,                // 可选，默认显示高度 px（72~200 整数）。缺省 120；
                                  // 选用该皮肤时大小滑杆落到它，用户另行调整优先
      "walkable": false           // 可选，false=禁止走动（选用该皮肤时走动开关落到关，
                                  // 用户另行调整优先；缺省走动，适合植物/静物类）
    }
  ]
}
```

### 动作名表（v1 闭集，包只能绑定不能新增——动作是代码）

`signature`（占位符，运行时解析为当前皮肤的签名动作）、`fly`、`dance`、`spin`、
`hops`、`roll`、`breach`、`sway`、`random`。

选动作时注意素材配套：`fly` 建议配 `images.fly`；`breach` 建议配 `images.spout`；
缺配套也能跑（回落站立图），但效果打折——导入校验时对此给出**提示级**警告，不拦截。

### 与现状 SkinDef 的映射

现有 7 个扁平皮肤重构成 5 个角色包：

| 角色 | 皮肤 | 角色级素材 | 备注 |
|---|---|---|---|
| niulai 牛来 | default（萌化）/ orig（原皮）/ young（小黄） | mama1/2.mp3、reply.mp3 | 三皮肤共享声音，签名/气泡/语录各不同（在皮肤层） |
| panda 熊猫 | default | —（synth squeak） | |
| whale 蓝鲸 | default | —（synth whale） | |
| nailong 奶龙 | default | nailong_laugh.mp3 | shoutAnim 动画 webp |
| dagou 大狗 | default | dagou_call.mp3 | 立绘自带 alpha（Dagou-Tap-New） |
| cat 赛博猫 | default | cat_meow.mp3 | 趴睡常态（stand=sleep 同图），喊叫站立 |

## 3. 加载与校验

导入流程（本地文件导入：文件选择或拖入 zip）：

1. 解 zip（JSZip），读 `pack.json`，spec 版本检查（高于加载器版本→明确报「插件太旧」）。
2. schema 校验：必填字段、id 字符集、动作名闭集、声音/图片格式与体积。
3. 素材引用检查：每个引用路径存在且类型匹配；未引用文件警告。
4. 素材配套提示：bind 了 fly 但没有 fly 图之类，列警告清单，用户确认后仍可导入。
5. 全部素材转 dataurl，写入 IndexedDB（`niulai-packs` 表），皮肤选择器即刻可选。

错误报告必须**具体到字段和文件**（`skins[0].images.stand: 文件 skins/default/stand.png 不存在`），
不允许「导入失败」一句话——AI 辅助定制链路靠这个错误信息自愈。

## 4. 派生覆盖包（variant）

「改内置皮肤」以派生形式支持，内置本体只读：

```jsonc
{
  "spec": 1,
  "type": "variant",
  "extends": "niulai",           // 目标角色 id（内置或已安装自定义角色）
  "id": "niulai-xmas",
  "name": "圣诞牛来",
  "version": "1.0.0",
  // 顶层字段（voice/events/quips）写了就覆盖；skins 数组内同 id 皮肤深合并、新 id 追加
  "skins": [
    { "id": "default", "images": { "stand": "skins/default/xmas.png" } }
  ]
}
```

加载时 deep merge 到目标角色上，运行态呈现为一个新角色（id 是派生包自己的）。
删除派生包 → 目标角色立刻恢复原样。

## 5. 明确不做（v1）

- **新动作/新合成音色**：动作与 synth 音色是代码，包只能绑定。想要新动作走插件版本迭代。
- **远程 URL 导入 / 市场对接**：roadmap 后排。
- **包签名/审核机制**：本地导入即本地信任，同浏览器扩展模型。
- **AI 生成做进插件**：AI 辅助走「外部生成 + 本地导入」，插件只消费（见 roadmap）。

## 6. 实现步骤（定稿后）

1. `assets/` 按角色分目录重构 + 内置角色改为 pack 格式定义（`src/client/packs/`）。
2. 包加载器：zip 解析、校验、IndexedDB 存取、运行时与内置角色合并进皮肤选择器。
3. 设置卡片加「自定义角色」管理区（导入/删除/查看警告）。
4. 「让 dsh 帮我做皮肤」按钮（预填 prompt 进 dsh 聊天框）。
5. `SKIN_AUTHORING.md` 制作指南（schema + 素材规格 + AI 生成提示词附录）。
6. 小奶龙包实做验证全流程；大狗包验证 AI 素材生成链路。
