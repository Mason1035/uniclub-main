# Roadmap — dsh-niulai-pet

> 规划备忘，非承诺。变动时同步本文件。

## 一、自定义皮肤（用户素材包）

> 2026-08-22 更新：**核心链路已落地**——两级模型（角色=声音/动作/事件/语录，
> 皮肤=外观变体），格式规范 `docs/skin-pack-schema.md`（送审稿已定），
> zip 本地导入（fflate 解 + 逐字段校验 + 警告确认）、IndexedDB 持久化、
> 派生覆盖包（variant/extends，内置本体只读）、设置卡片管理区（PackManager）、
> 皮肤列表热更新（pet subscribeSkins / card useSyncExternalStore /
> ConfigStore.updateSkinIds 三路）。assets/ 已按角色分目录，内置角色与包同构。
>
> - ✅「让 dsh 帮我做皮肤」按钮（预制 prompt 填进 dsh 首页输入框，有关弹窗/草稿保护）
> - ✅ `SKIN_AUTHORING.md` 制作指南（schema + 素材规格 + AI 生成提示词附录）
> - ✅ 小奶龙包实做验证全流程（含逐帧 shoutAnim、警告确认流、刷新恢复、删除回落）
> - ✅ 预览件：设置卡片包列表缩略图+属性摘要；demo 试玩页导入 zip 即时预览（不落库）
> - 大狗包：不做内置，留给点菜用户用新链路自制（正好检验 AI 辅助实战）
> - 远程 URL 导入 / 插件市场对接（后排）

关联讨论：自定义颜色（纯色/渐变剪影皮肤，无需素材即可个性化）。

## 二、语音控制（语音输入 → 控制 dsh / OS）

> 2026-08-21 更新：最小闭环「语音停喊」已落地（v0.3 预计）——循环喊期间喊
> 一声「牛来」即停（语音停不再播录音回应——用户亲自扮演了妈妈；互动打断
> 才回一句，钩子 stopShoutLoop(withReply) 区分两条路径）。
> 方案选型：**零模型浏览器内模板匹配**（MFCC + 一阶 delta + 子序列 DTW，
> `src/client/voice.ts`），模板直接复用妈妈的回应音 reply.mp3——口令恰好固定
> 且模板音现成，零下载零依赖、音频不出浏览器；对比 sherpa-onnx KWS（更准、
> 可自定义唤醒词，但要下模型/起 sidecar），单口令场景用它是杀鸡用牛刀，
> 留给二期全量口令。阈值由 `test/voice-matcher.mts` 离线标定（0.57，
> 正样本 max 0.447 / 负样本 min 0.706；宁紧勿松——宠物自己喊的「妈妈」
> 被误认成「牛来」会让循环自己停掉）。真人嗓音召回率需真机麦克风验证微调。
> 不常驻：只在循环喊进行中开麦，循环停立即关麦停流；安全上下文限制见下。

### 结论先行

控制面是现成的，难点在 STT（语音转文字）选型。

- **控制 dsh 会话**：dsh 客户端有官方 prompt API
  `sessions.prompt({ sessionId, mode: 'queue'|'steer', content })`，
  桌宠已 inject `sessions` 服务，直接调，无需 DOM hack
- **控制 dsh 界面**：客户端 runtime 有 `session.create` / `startSession` 等现成动作
- **控制 OS**：不自建执行器。语音文本发给 agent，复用 agent 自带的
  shell 工具 + dsh 权限确认流程，安全模型现成

### 分期

1. **一期 · 语音输入**：按住宠物 500ms 进入录音 → 松手识别 → 文本发给当前
   会话（上滑取消）。录音时倾听动画，识别中气泡显示进度。STT 做成可插拔。
2. **二期 · 口令控制**：固定口令操作界面（"新会话""切到 XX"）；
   TTS 让宠物开口回话（语音反馈）。
3. **三期 · 存疑**：唤醒词（openWakeWord / Porcupine）、连续对话。
   常驻麦克风有隐私和功耗成本，再议。

### 硬约束

- **安全上下文**：`getUserMedia` 只在 https / localhost 可用。
  局域网 `http://192.168.x.x` 访问下麦克风直接不可用
  （与之前 `crypto.randomUUID` 同类问题）
- **测试**：开发 VM 无麦克风，管线可用假音频流测，
  真实识别效果必须本机浏览器验

### STT 选型（见下方调研）

- 默认零依赖：Web Speech API —— 但 Chromium 走 Google 服务，国内不可用，
  华为等移动端浏览器支持参差，只能当"有就用"的兜底
- 浏览器本地：whisper 系 wasm/WebGPU（browser-whisper 等），
  首次下载 120~590MB，中文可用但非最优
- 服务端 sidecar：sherpa-onnx + SenseVoice-Small（中文最优解，见调研）。
  **形态必须是独立微服务，插件只当客户端**——模型 int8 ≈ 234MB +
  运行时 ~50-150MB 磁盘、常驻内存 ~0.4-0.6GB，打包进插件不合理；
  参考 OVOS 的 ovos-stt-http-server 模式，按需启停
- 云 ASR：用户自配 OpenAI 兼容 key，轻量但依赖网络

## 三、同类开源项目的语音识别方案（2026-08 调研）

### 浏览器端

| 方案 | 语言 | 模型体积 | 特点 |
| --- | --- | --- | --- |
| transformers.js Whisper | 99 | 40MB~3GB | 最常见起点，WebGPU；主线程阻塞长音频 |
| browser-whisper 1.1 | 99 | ~120~590MB | worker 化 + 流式 + fp32 编码器混合量化，生产向 |
| whisper.cpp | 99 | 39MB~3GB | 原生 CPU 之王；wasm 版无 GPU 加速 |
| Moonshine | 仅英文 | 6~61MB | 专为端侧流式设计，亚秒延迟 |
| Distil-Whisper | 仅英文 | 185~760MB | 英文 5-6x 提速 |

要点：编码器怕量化（保 fp32）、解码器耐量化（q4）；
WebGPU 比 WASM 快 5-10 倍但 Safari/Firefox 不行，须自动降级；
30 秒分窗 + 重叠步长处理长音频，注意幻觉 token 抑制。

来源：[OfflineTTS: Browser Speech Recognition: Whisper STT Guide](https://offlinetts.com/blog/browser-speech-recognition-whisper-comparison/)

### 中文场景

- **SenseVoice**（阿里 FunAudioLLM）：多语言识别 + 情感 + 声学事件，
  SenseVoice-Small 快且中文好，[github](https://github.com/FunAudioLLM/SenseVoice)
- **FunASR**（阿里达摩院）：工业级中文 ASR 全链路（VAD/标点/时间戳），
  [github](https://github.com/modelscope/FunASR)，15k+ star
- **sherpa-onnx**（k2-fsa/新一代 Kaldi）：ONNX 跨平台部署框架，
  支持 SenseVoice / Paraformer / Qwen3-ASR，有 wasm 和服务端两种形态，
  国内模型镜像在 ModelScope，[github](https://github.com/k2-fsa/sherpa-onnx)

### 语音助手生态（服务端方案参照）

- **Home Assistant Assist**：Whisper（STT）+ Piper（TTS）+ openWakeWord（唤醒词）
  三件套，是全栈本地语音助手的事实标准组合
- **OpenVoiceOS**（Mycroft 后继）：STT 全插件化——faster-whisper、whisper.cpp、
  vosk、onnx-asr 可互换，另有 ovos-stt-http-server 把任意插件变微服务
- 云端兜底常见：OpenAI Whisper API / Groq / Mistral（HACS 有现成集成）

### 对我们的启示

- 中文为主 → 服务端路线首选 **sherpa-onnx + SenseVoice-Small**：
  234M 参数，int8 ≈ 234MB，~170x 实时速度，中文/粤语/英日韩五语种；
  dsh host 插件 spawn sidecar 或独立微服务，**插件本体不打包模型**，
  用户按需安装启动（我们 6G 内存的 VM 上尤其要按需）
- 浏览器路线选 browser-whisper + whisper-base 混合量化
- 唤醒词如果要上，openWakeWord（本地、可自定义词）优于 Porcupine（商用授权）
- TTS 二期若做，Piper（本地）或浏览器 speechSynthesis（零依赖）二选一

## 三、设置卡片（dsh rc.7+ 插件设置页）✅ 已完成

已实现（dsh rc.7+）：host 半注册 settings 命名空间 `niulai-pet`，浏览器半
往 `settings.plugin.item` 注册同名卡片，设置页「插件 → 插件配置」自动配对。
卡片与浮层菜单共读同一份 ConfigStore，即时写 + subscribe 双向反映。

- 配置项：静音 / 完成时喊 / 连喊 1-3 声 / 气泡唠叨 / 皮肤；完成与戳一下的
  动作绑定**按皮肤记**（`actions` 字典以皮肤 id 为键，切皮肤互不清空，
  没配过的皮肤回落默认：签名动作 / 连跳）
- 配置存哪（更正此前预判）：**dsh host 持久化** `~/.dsh/settings.yaml`
  （schema 默认 < cordis entry < user 文档三层），不是 localStorage；
  localStorage 只剩两条尾巴——rc.6 及更早的回退后端，和按设备的位置 `x`
  （永久留本地，不进设置）
- 降级：rc.6 及更早无 settingsScope 服务，卡片注册在可选注入子 fiber 里
  静默跳过，桌宠与菜单照常；旧 localStorage 配置在 scope 首次就绪时按
  字段 seed 进 user 层（不覆盖设置页已改过的值）

## 四、图片识别协同（依赖 browser-fs + dsh rc.8）

dsh rc.8 的 deepseek-official 适配器支持 `inputModalities: [text, image]`
原生图片请求（含工具结果图片：tool 消息保持纯字符串，图片合并进随后的
user 消息）。browser-fs 按计划返回 ImageBlock 后，agent 可「读用户手机/
另一台电脑上的截图 → DeepSeek 原生视觉排障」。本插件侧无需改动，
仅在此登记联动场景（拍桌宠截图吐槽它自己？）。
