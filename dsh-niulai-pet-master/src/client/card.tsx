/**
 * 设置卡片（dsh rc.7+ 设置页 · 插件配置区）：牛来桌宠的命名空间卡片。
 *
 * 与官方卡片同一配对机制：host 半 installSettingsSection 注册命名空间，
 * 本半以同名字符串 key 注册进 `settings.plugin.item` slot，设置页自动配对。
 * 控件（switch/步进/下拉）自绘、即时写入（scope.set 自带 revision 乐观围栏，
 * 离散控件不需要官方 CardForm 的 staged/save 模型）；与浮层菜单共读同一份
 * ConfigStore，任一端改动经 subscribe 双向反映。
 *
 * React 由 dsh 运行时模块表提供（platform seed，构建时 external）。
 * @module dsh-niulai-pet/card
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import type { ActionName } from './pet.js'
import { ACTION_ORDER } from './pet.js'
import { REPLY_MATCH, REPLY_REF } from './skins.js'
import { defaultActionsFor, PackParseError } from './packs.js'
import type { CharacterDef, RegistrySnapshot } from './packs.js'
import { decodeToPcm16k, encodeWav16kDataUrl, applySoftGain, FRAME_LEN, frameRmsSeries, FRAME_STEP, LiveMatcher, mfccFrames, resampleTo16k, trimByEnergy } from './voice.js'
import { createKwsMatcher, KWS_KEYWORD_PRESETS, kwsKeywordLabel, kwsKeywordsKey } from './kws.js'
import type { ConfigStore, PetConfig, PetConfigPatch, SettingsScopeLike } from './config.js'
import type { VoiceDebugBus, VoiceDebugState } from './voice-debug.js'
import type { HighlightBus } from './highlight.js'

/** 卡片编辑的命名空间（与 host 半 settingsNamespace('niulai-pet') 配对，改名两边同步）。 */
export const CARD_NS = 'niulai-pet'

/** 卡片字典（zh/en 双语，locale 服务要求两全）。 */
const zh = {
  title: '牛来桌宠',
  description: '右下角桌宠的叫声、气泡唠叨与动作绑定',
  sound: '声音',
  volume: '音量',
  shoutOnDone: '完成时提示',
  shoutCount: '连播次数',
  doneDelay: '完成延迟（秒）',
  shoutLoop: '循环提示到互动停止',
  customSound: '自定义提示音',
  customSoundHint: '支持 mp3 / wav / ogg（m4a / flac 部分浏览器可用），≤1MB；只接管完成提示，戳/表演仍用角色叫声',
  customSoundImport: '导入音频',
  customSoundTest: '试听',
  customSoundClear: '清除',
  customSoundTooBig: '文件超过 1MB，换个小点的',
  tabPet: '当前桌宠',
  tabGlobal: '通用',
  tabCustom: '自定义',
  tabAdvanced: '高级',
  sleepEnabled: '闲置打盹（变灰变矮）',
  walkEnabled: '随意走动（闲置游走）',
  groundOffset: '离地高度（px）',
  groundOffsetHint: '负值表示沉入地面以下，正值抬高离地（上下不设限）',
  physics: '物理碰撞（互相挤/弹飞）',
  maxPets: '桌宠数量上限',
  replyNiulai: '妈妈回应「牛来」',
  voiceControl: '语音停喊（喊「牛来」）',
  voiceEngine: '识别引擎',
  voiceEngineKws: '模型识别（推荐，更准）',
  voiceEngineTemplate: '模板匹配（零下载）',
  voiceEngineHint: '模型引擎首次启用需加载约 17MB 模型（同源伺服 + 浏览器缓存，之后秒开）；加载失败自动回落模板匹配',
  voiceKeywords: '指令词（喊任一即停）',
  micKwsLoading: '模型加载中（首次约 17MB）…',
  micKwsListening: '识别中…喊指令词试试',
  micKwsFailed: '模型加载失败——正式监听会自动回落模板匹配',
  micTestHitKw: '识别到「{keyword}」！',
  voiceUnsupported: '当前访问方式不支持麦克风（需 https 或 localhost 打开）',
  voiceDenied: '麦克风授权被拒——若在 cenacle 内嵌窗口里，请换独立标签页打开 dsh 再开',
  voiceNoMic: '没检测到麦克风设备，语音停喊未开启',
  micDevice: '麦克风设备',
  micGain: '麦克风增益',
  micGainHint: '声音小识别不到时调大（浏览器自动增益已开，这里再叠加软件增益，软削波防爆音；正式监听热生效）',
  micDefault: '系统默认',
  micTest: '测试',
  micTestStop: '停止',
  micTestHint: '说句话，电平条应起伏',
  voiceDbgOff: '识别状态：未在听（循环喊进行时才开麦）',
  micTestScore: '喊一声「牛来」：识别得分 {score}（越小越像；连续过阈即中）',
  micRecord: '录我的「牛来」',
  micRecording: '录音中…对着麦喊「牛来」',
  micRecordClear: '清除',
  micRecordDone: '已录我的模板（优先匹配它）',
  micRecordNone: '未录时用电音原声模板',
  micRecordFail: '没录到声音，靠近麦克风再试',
  micTestHit: '识别到「牛来」！',
  voiceThreshold: '识别阈值',
  voiceThresholdHint: '喊「牛来」和别的词各试几次，阈值取两组得分之间（越小越严）',
  voiceDbgOn: '识别状态：监听中，最近得分 {score}（越小越像「牛来」；连续过阈才停）',
  voiceDbgHit: '识别状态：刚才识别到「牛来」！',
  voiceGranted: '状态：已授权（仅循环喊期间开麦）',
  voiceIdle: '状态：未授权',
  talkative: '气泡',
  heatEnabled: '连戳红温',
  mute: '静音',
  hideAll: '隐藏全部桌宠',
  quips: '唠叨语录',
  quipsHint: '一行一条；设置后替换内置通用语录（皮肤专属语录不受影响），留空恢复内置。',
  skin: '皮肤',
  petTarget: '配置对象',
  petTargetHint: '点我高亮这只桌宠',
  petMain: '主宠',
  petN: '桌宠',
  petSize: '桌宠大小',
  petSizeReset: '重置',
  petHue: '色相',
  petHueCycle: '流光变色',
  petOpacity: '不透明度',
  doneAction: '完成时动作',
  pokeAction: '戳我动作',
  packs: '自定义角色',
  packsHint: '导入 .nlpack.zip 角色包；不会做包？看',
  packsSamplePre: '，或下个',
  packsSample: '示例包',
  packsSamplePost: '先试导入流程。',
  packsGuide: '制作指南',
  packsAssist: '让 dsh 帮我做',
  packsAssistDone: '已填进输入框，去发送吧',
  packsAssistBusy: '输入框已有内容，未覆盖——清空后再点',
  packsAssistCopied: '没找到输入框，prompt 已复制——到任意会话里粘贴发送',
  packsAssistCopyFail: '没找到输入框，复制也失败了——请手动复制指南链接给 AI',
  packImport: '导入角色包',
  packImporting: '解析中…',
  packDelete: '删除',
  packWarningsTitle: '可以导入，但有以下提醒：',
  packConfirm: '仍然导入',
  packCancel: '取消',
  packErrorsTitle: '导入失败，请修正以下问题：',
  packEmpty: '还没有自定义角色',
  packSkinCount: '{n} 个皮肤',
  packVariantOf: '派生自 {base}',
  readOnly: '当前 dsh 以只读模式运行，配置不可修改。',
  expand: '展开',
  collapse: '收起',
  'action.signature': '签名动作',
  'action.fly': '飞行',
  'action.dance': '摇摆舞',
  'action.spin': '转圈',
  'action.hops': '连跳',
  'action.roll': '翻滚',
  'action.breach': '跃出水面',
  'action.sway': '摇摆',
  'action.split': '分裂',
  'action.drive': '开过去',
  'action.random': '随机',
}

const en: Record<keyof typeof zh, string> = {
  title: 'Niulai Pet',
  description: 'Voice, chatter bubbles, and per-skin action bindings of the corner pet',
  sound: 'Sound',
  volume: 'Volume',
  shoutOnDone: 'Notify on task done',
  shoutCount: 'Notify repeats',
  doneDelay: 'Done delay (s)',
  shoutLoop: 'Loop notify until touched',
  customSound: 'Custom notify sound',
  customSoundHint: 'mp3 / wav / ogg supported (m4a / flac on some browsers), ≤1MB; only replaces the done-notify, poke/perform still use the character voice',
  customSoundImport: 'Import audio',
  customSoundTest: 'Play',
  customSoundClear: 'Clear',
  customSoundTooBig: 'File exceeds 1MB',
  tabPet: 'Current pet',
  tabGlobal: 'General',
  tabCustom: 'Custom',
  tabAdvanced: 'Advanced',
  sleepEnabled: 'Idle nap (dims & squashes)',
  walkEnabled: 'Wander (idle walk)',
  groundOffset: 'Ground height (px)',
  groundOffsetHint: 'Negative sinks below ground, positive lifts up (unbounded)',
  physics: 'Pet physics (jostle & bounce)',
  maxPets: 'Max pets on screen',
  replyNiulai: 'Mom answers "Niulai!"',
  voiceControl: 'Voice stop (shout "Niulai!")',
  voiceEngine: 'Recognition engine',
  voiceEngineKws: 'Model (recommended, more accurate)',
  voiceEngineTemplate: 'Template (zero download)',
  voiceEngineHint: 'The model engine loads ~17MB on first use (served same-origin, then cached by the browser); falls back to template matching if loading fails',
  voiceKeywords: 'Wake words (any match stops)',
  micKwsLoading: 'Loading model (~17MB first time)…',
  micKwsListening: 'Listening… shout a wake word',
  micKwsFailed: 'Model failed to load — live listening falls back to template matching',
  micTestHitKw: 'Heard "{keyword}"!',
  voiceUnsupported: 'Microphone is unavailable on this origin (needs https or localhost)',
  voiceDenied: 'Microphone permission denied — if inside an embedded (cenacle) window, open dsh in its own tab and retry',
  voiceNoMic: 'No microphone device detected; voice stop stays off',
  micDevice: 'Microphone',
  micGain: 'Mic gain',
  micGainHint: 'Turn up when your voice is too quiet to be recognized (browser AGC is already on; this stacks software gain with soft clipping — applies live to active listening)',
  micDefault: 'System default',
  micTest: 'Test',
  micTestStop: 'Stop',
  micTestHint: 'Say something — the level bar should move',
  voiceDbgOff: 'Voice match: idle (mic opens only while loop-shouting)',
  micTestScore: 'Shout "Niulai!": match score {score} (lower = closer)',
  micRecord: 'Record my "Niulai!"',
  micRecording: 'Recording… shout "Niulai!" now',
  micRecordClear: 'Clear',
  micRecordDone: 'Custom template recorded (matched first)',
  micRecordNone: 'falling back to the movie template when absent',
  micRecordFail: 'Nothing captured — get closer and retry',
  micTestHit: 'Heard "Niulai!"',
  voiceThreshold: 'Match threshold',
  voiceThresholdHint: 'Test both "Niulai" and other words; pick a threshold between the two score ranges (lower = stricter)',
  voiceDbgOn: 'Voice match: listening, last score {score} (lower = closer to "Niulai")',
  voiceDbgHit: 'Voice match: heard "Niulai!" just now',
  voiceGranted: 'Status: granted (mic is live only while loop-shouting)',
  voiceIdle: 'Status: not granted',
  talkative: 'Bubbles',
  heatEnabled: 'Poke heat-up',
  mute: 'Mute',
  hideAll: 'Hide all pets',
  quips: 'Chatter lines',
  quipsHint: 'One per line; replaces the built-in shared pool when non-empty (skin-specific lines always stay). Clear to restore defaults.',
  skin: 'Skin',
  petTarget: 'Configure',
  petTargetHint: 'Click to highlight this pet',
  petMain: 'Main pet',
  petN: 'Pet',
  petSize: 'Pet size',
  petSizeReset: 'Reset',
  petHue: 'Hue',
  petHueCycle: 'Color cycle',
  petOpacity: 'Opacity',
  doneAction: 'Action on done',
  pokeAction: 'Action on poke',
  packs: 'Custom characters',
  packsHint: 'Import .nlpack.zip character packs; new to pack authoring? See the',
  packsSamplePre: ', or grab the ',
  packsSample: 'sample pack',
  packsSamplePost: ' to try the import flow.',
  packsGuide: 'authoring guide',
  packsAssist: 'Let dsh build it',
  packsAssistDone: 'Prompt filled into the input — go send it',
  packsAssistBusy: 'Input has content — not overwritten; clear it and retry',
  packsAssistCopied: 'No input found — prompt copied to clipboard; paste it into any session',
  packsAssistCopyFail: 'No input found and copy failed — copy the guide link to your AI manually',
  packImport: 'Import pack',
  packImporting: 'Parsing…',
  packDelete: 'Delete',
  packWarningsTitle: 'Importable, with notices:',
  packConfirm: 'Import anyway',
  packCancel: 'Cancel',
  packErrorsTitle: 'Import failed — fix these issues:',
  packEmpty: 'No custom characters yet',
  packSkinCount: '{n} skins',
  packVariantOf: 'Derived from {base}',
  readOnly: 'This dsh instance runs read-only; configuration cannot be changed.',
  expand: 'Expand',
  collapse: 'Collapse',
  'action.signature': 'Signature',
  'action.fly': 'Fly',
  'action.dance': 'Dance',
  'action.spin': 'Spin',
  'action.hops': 'Hops',
  'action.roll': 'Roll',
  'action.breach': 'Breach',
  'action.sway': 'Sway',
  'action.split': 'Split',
  'action.drive': 'Drive across',
  'action.random': 'Random',
}

/** 卡片渲染快照：scope 可用性/可写性 + 生效配置。 */
export interface NiulaiCardState {
  /** false = 命名空间未被 Host serve（rc.6 形态）：卡片不渲染。 */
  ready: boolean
  writable: boolean
  cfg: PetConfig
}

/** 角色包注册表面（自定义角色管理 + 皮肤选择器数据源）。 */
export interface PacksFace {
  getSnapshot(): RegistrySnapshot
  subscribe(fn: () => void): () => void
  preview(file: File): Promise<{ def: CharacterDef; warnings: string[] }>
  install(def: CharacterDef): Promise<void>
  remove(charId: string): Promise<void>
}

/** slot 注入面（hooks 由渲染器绑定成 useNiulaiPet 选择器 hook，其余透传）。 */
export interface NiulaiCardFace {
  hooks: { niulaiPet: { getSnapshot(): NiulaiCardState; subscribe(fn: () => void): () => void } }
  set(patch: PetConfigPatch): void
  setSkinAction(skin: string, event: 'done' | 'poke', action: ActionName): void
  /** 语音停喊调试状态（识别分/是否在听/命中时刻），pet 侧 publish。 */
  voiceDebug?: { getSnapshot(): VoiceDebugState; subscribe(fn: () => void): () => void }
  packs?: PacksFace
  /** 点预览图高亮对应桌宠 + 「当前桌宠」tab 驻留高亮（pet.ts 认领）。 */
  highlight?: {
    emit(petId: string): void
    setHold?(petId: string | null): void
    releaseHold?(petId: string): void
  }
}

/** 组件 props（框架 t 座 + 注入面绑定后的形态，结构化自描）。 */
export interface NiulaiCardProps {
  t(key: string, params?: Record<string, unknown>): string
  useNiulaiPet<S>(selector: (state: NiulaiCardState) => S): S
  set(patch: PetConfigPatch): void
  setSkinAction(skin: string, event: 'done' | 'poke', action: ActionName): void
  voiceDebug?: { getSnapshot(): VoiceDebugState; subscribe(fn: () => void): () => void }
  packs?: PacksFace
  /** 点预览图高亮对应桌宠 + 「当前桌宠」tab 驻留高亮（pet.ts 认领）。 */
  highlight?: {
    emit(petId: string): void
    setHold?(petId: string | null): void
    releaseHold?(petId: string): void
  }
  /** 悬浮设置面板形态：初始展开（设置页卡片默认收起）。 */
  defaultOpen?: boolean
  /** 初始配置对象（右键菜单从哪只桌宠开来就选哪只；缺省 main）。 */
  initialPet?: string
}

/** 卡片状态源：合并 ConfigStore（生效配置）与 scope（ready/writable）为一个 observable。 */
class CardController {
  private state: NiulaiCardState
  private readonly listeners = new Set<() => void>()
  private readonly disposers: Array<() => void> = []

  constructor(
    private readonly store: ConfigStore,
    scope: SettingsScopeLike,
    private readonly voiceDebug?: VoiceDebugBus,
    private readonly packs?: PacksFace,
    private readonly highlight?: HighlightBus,
  ) {
    this.state = this.project(scope)
    const rebuild = (): void => {
      this.state = this.project(scope)
      for (const fn of this.listeners) fn()
    }
    this.disposers.push(store.subscribe(rebuild), scope.subscribe(rebuild))
  }

  private project(scope: SettingsScopeLike): NiulaiCardState {
    const snap = scope.getSnapshot()
    return { ready: snap.status === 'ready', writable: snap.writable, cfg: this.store.getSnapshot() }
  }

  readonly observable = {
    getSnapshot: (): NiulaiCardState => this.state,
    subscribe: (fn: () => void): (() => void) => {
      this.listeners.add(fn)
      return () => { this.listeners.delete(fn) }
    },
  }

  inject(): NiulaiCardFace {
    return {
      hooks: { niulaiPet: this.observable },
      set: (patch) => { this.store.set(patch) },
      voiceDebug: this.voiceDebug,
      packs: this.packs,
      highlight: this.highlight,
      setSkinAction: (skin, event, action) => { this.store.setSkinAction(skin, event, action) },
    }
  }

  dispose(): void {
    for (const d of this.disposers) d()
  }
}

// ---- 自绘控件（贴官方卡片的 --dsw-* 令牌观感，全部带回退色）----

const colors = {
  border: 'var(--dsw-alias-border-l2, rgba(255,255,255,.12))',
  bgCard: 'var(--dsw-alias-bg-layer-3, rgba(255,255,255,.03))',
  labelPrimary: 'var(--dsw-alias-label-primary, #e4e4e7)',
  labelTertiary: 'var(--dsw-alias-label-tertiary, #8b8b94)',
  brand: 'var(--dsw-alias-brand-primary, #3b82f6)',
  trackOff: 'var(--dsw-alias-bg-module-platform, #52525b)',
}

function Switch(props: { on: boolean; disabled: boolean; label: string; onChange(on: boolean): void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={() => { props.onChange(!props.on) }}
      style={{
        width: 36, height: 20, borderRadius: 10, border: `1px solid ${colors.border}`, padding: 0, flex: 'none',
        boxSizing: 'border-box',
        position: 'relative', transition: 'background .15s',
        cursor: props.disabled ? 'default' : 'pointer',
        background: props.on ? 'var(--dsw-alias-state-success-primary, #22c55e)' : colors.trackOff,
        opacity: props.disabled ? 0.4 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: props.on ? 18 : 2, width: 16, height: 16,
        borderRadius: '50%', background: '#fff', transition: 'left .15s',
        // 浅色主题下轨道近白，白圆球会融进去：描边+投影保证两主题都可见。
        boxShadow: '0 0 0 1px rgba(0,0,0,.18), 0 1px 2px rgba(0,0,0,.25)',
      }} />
    </button>
  )
}


const selectStyle = (disabled: boolean): React.CSSProperties => ({
  appearance: 'none', border: `1px solid ${colors.border}`, borderRadius: 8,
  background: 'transparent', color: colors.labelPrimary, font: 'inherit', fontSize: 13,
  padding: '4px 10px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
  colorScheme: 'dark light',
})

/**
 * 下拉展开列表是原生控件：背景随系统/浏览器主题走，而 option 文字默认继承
 * select 的前景 → 主题不匹配时白字白底看不见。option 跟随 dsh 主题令牌
 * （亮色/暗色主题各自定义了这组值，自定义属性可继承进 option），
 * 无令牌环境（demo 页）回退深字浅底。
 */
const optionStyle: React.CSSProperties = {
  color: 'var(--dsw-alias-label-primary, #18181b)',
  backgroundColor: 'var(--dsw-alias-bg-layer-2, #fff)',
}

function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '9px 0' }}>
      <span style={{ fontSize: 13, color: colors.labelPrimary }}>{props.label}</span>
      {props.children}
    </div>
  )
}

/** 数值输入（范围大的步进器要点几十下不现实）：本地草稿 + blur/Enter 提交并夹取。float=true 时按两位小数。 */
function NumberField(props: { value: number; min: number; max: number; disabled: boolean; label: string; float?: boolean; onCommit(n: number): void }) {
  const shown = (v: number): string => (props.float === true ? v.toFixed(2) : String(v))
  const [draft, setDraft] = useState(shown(props.value))
  const [focused, setFocused] = useState(false)
  if (!focused && draft !== shown(props.value)) setDraft(shown(props.value))
  const commit = (): void => {
    let n = Number(draft)
    if (!Number.isFinite(n)) { setDraft(shown(props.value)); return }
    n = Math.min(props.max, Math.max(props.min, n))
    if (props.float !== true) n = Math.round(n)
    props.onCommit(n)
  }
  // ±Infinity 表示不设限：HTML 属性省略（input 不接受 Infinity），JS 钳制自然放行
  const minAttr = Number.isFinite(props.min) ? props.min : undefined
  const maxAttr = Number.isFinite(props.max) ? props.max : undefined
  return (
    <input
      type="number"
      min={minAttr}
      max={maxAttr}
      step={props.float === true ? 0.01 : 1}
      aria-label={props.label}
      style={{
        width: 72, font: 'inherit', fontSize: 13, padding: '4px 10px', borderRadius: 8,
        border: `1px solid ${colors.border}`, background: 'transparent',
        color: colors.labelPrimary, opacity: props.disabled ? 0.4 : 1,
      }}
      value={draft}
      disabled={props.disabled}
      onFocus={() => { setFocused(true) }}
      onBlur={() => { setFocused(false); commit() }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      onChange={(e) => { setDraft(e.target.value) }}
    />
  )
}

/** 音量滑杆：拖动中本地预览（不刷 RPC），松手/失焦才提交。 */
function VolumeField(props: { value: number; disabled: boolean; label: string; onCommit(n: number): void }) {
  const [draft, setDraft] = useState(props.value)
  const [dragging, setDragging] = useState(false)
  if (!dragging && draft !== props.value) setDraft(props.value)
  const commit = (): void => {
    setDragging(false)
    if (draft !== props.value) props.onCommit(draft)
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label={props.label}
        disabled={props.disabled}
        value={draft}
        style={{ width: 110, accentColor: 'var(--dsw-alias-brand-primary, #3b82f6)', opacity: props.disabled ? 0.4 : 1 }}
        onChange={(e) => { setDragging(true); setDraft(Number(e.target.value)) }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span style={{ fontSize: 12, color: colors.labelTertiary, minWidth: 30, textAlign: 'right' }}>{draft}%</span>
    </span>
  )
}

/** 麦克风增益滑杆（1.0-4.0×，松手提交；样式同 VolumeField，标签 ×N.N）。 */
function MicGainField(props: { value: number; disabled: boolean; label: string; onCommit(n: number): void }) {
  const [draft, setDraft] = useState(props.value)
  const [dragging, setDragging] = useState(false)
  if (!dragging && draft !== props.value) setDraft(props.value)
  const commit = (): void => {
    setDragging(false)
    if (draft !== props.value) props.onCommit(draft)
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
      <input
        type="range"
        min={1}
        max={4}
        step={0.1}
        aria-label={props.label}
        disabled={props.disabled}
        value={draft}
        style={{ width: 110, accentColor: 'var(--dsw-alias-brand-primary, #3b82f6)', opacity: props.disabled ? 0.4 : 1 }}
        onChange={(e) => { setDragging(true); setDraft(Number(e.target.value)) }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span style={{ fontSize: 12, color: colors.labelTertiary, minWidth: 30, textAlign: 'right' }}>×{draft.toFixed(1)}</span>
    </span>
  )
}

/** 桌宠大小滑杆（72-200px，松手提交；样式同 VolumeField，标签 Npx）。 */
function SizeField(props: { value: number; disabled: boolean; label: string; onCommit(n: number): void }) {
  const [draft, setDraft] = useState(props.value)
  const [dragging, setDragging] = useState(false)
  if (!dragging && draft !== props.value) setDraft(props.value)
  const commit = (): void => {
    setDragging(false)
    if (draft !== props.value) props.onCommit(draft)
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
      <input
        type="range"
        min={72}
        max={200}
        step={1}
        aria-label={props.label}
        disabled={props.disabled}
        value={draft}
        style={{ width: 110, accentColor: 'var(--dsw-alias-brand-primary, #3b82f6)', opacity: props.disabled ? 0.4 : 1 }}
        onChange={(e) => { setDragging(true); setDraft(Number(e.target.value)) }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span style={{ fontSize: 12, color: colors.labelTertiary, minWidth: 34, textAlign: 'right' }}>{draft}px</span>
    </span>
  )
}

/** 数值滑杆（松手提交；样式同 SizeField，标签带单位）。 */
function SliderField(props: { value: number; min: number; max: number; unit: string; disabled: boolean; label: string; onCommit(n: number): void }) {
  const [draft, setDraft] = useState(props.value)
  const [dragging, setDragging] = useState(false)
  if (!dragging && draft !== props.value) setDraft(props.value)
  const commit = (): void => {
    setDragging(false)
    if (draft !== props.value) props.onCommit(draft)
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={1}
        aria-label={props.label}
        disabled={props.disabled}
        value={draft}
        style={{ width: 110, accentColor: 'var(--dsw-alias-brand-primary, #3b82f6)', opacity: props.disabled ? 0.4 : 1 }}
        onChange={(e) => { setDragging(true); setDraft(Number(e.target.value)) }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span style={{ fontSize: 12, color: colors.labelTertiary, minWidth: 34, textAlign: 'right' }}>{draft}{props.unit}</span>
    </span>
  )
}

/** 自定义提示音：导入（≤1MB audio/*）/ 试听 / 清除。 */
function CustomSoundField(props: {
  value: string
  disabled: boolean
  labels: { import: string; test: string; clear: string; tooBig: string }
  onSet(v: string): void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState('')
  const btnStyle = {
    font: 'inherit', fontSize: 12, padding: '3px 10px', borderRadius: 7,
    border: `1px solid ${colors.border}`, background: 'none',
    color: colors.labelPrimary, cursor: props.disabled ? 'default' : 'pointer',
    opacity: props.disabled ? 0.4 : 1,
  } as const
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f === undefined) return
          if (f.size > 1024 * 1024) { setErr(props.labels.tooBig); return }
          setErr('')
          const rd = new FileReader()
          rd.onload = () => { if (typeof rd.result === 'string') props.onSet(rd.result) }
          rd.readAsDataURL(f)
        }}
      />
      <button type="button" style={btnStyle} disabled={props.disabled} onClick={() => { inputRef.current?.click() }}>
        {props.labels.import}
      </button>
      {props.value !== ''
        ? (
          <>
            <button type="button" style={btnStyle} disabled={props.disabled}
              onClick={() => { void new Audio(props.value).play().catch(() => {}) }}>
              {props.labels.test}
            </button>
            <button type="button" style={btnStyle} disabled={props.disabled} onClick={() => { props.onSet('') }}>
              {props.labels.clear}
            </button>
          </>
        )
        : null}
      {err !== '' ? <span style={{ fontSize: 12, color: 'var(--dsw-alias-state-danger-primary, #ef4444)' }}>{err}</span> : null}
    </span>
  )
}

/**
 * 语录编辑：本地草稿 + blur 提交（逐键入直接 scope.set 会把半个句子落盘，
 * 且每键一次 RPC）。外部变更（菜单端/另一设备）在非聚焦时同步进草稿。
 */
function QuipsField(props: { value: string[]; disabled: boolean; placeholder: string; onCommit(quips: string[]): void }) {
  const joined = props.value.join('\n')
  const [draft, setDraft] = useState(joined)
  const [focused, setFocused] = useState(false)
  if (!focused && draft !== joined) setDraft(joined) // render 期同步（React 支持的模式）
  return (
    <textarea
      rows={4}
      style={{
        width: '100%', boxSizing: 'border-box', resize: 'vertical', font: 'inherit', fontSize: 13,
        lineHeight: 1.6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${colors.border}`,
        background: 'transparent', color: colors.labelPrimary, opacity: props.disabled ? 0.4 : 1,
      }}
      value={draft}
      disabled={props.disabled}
      placeholder={props.placeholder}
      onFocus={() => { setFocused(true) }}
      onBlur={() => {
        setFocused(false)
        const next = draft.split('\n').map((q) => q.trim()).filter((q) => q.length > 0)
        if (next.join('\n') !== joined) props.onCommit(next)
      }}
      onChange={(e) => { setDraft(e.target.value) }}
    />
  )
}

const noopSubscribe = (): (() => void) => () => {}
const nullSnapshot = (): null => null
/** packs 缺位时的稳定空快照（useSyncExternalStore 要求 getSnapshot 引用稳定）。 */
const EMPTY_PACKS_SNAPSHOT: RegistrySnapshot = { characters: [], skins: [], skinIds: [] }
const EMPTY_PACKS = (): RegistrySnapshot => EMPTY_PACKS_SNAPSHOT

/** 麦克风可用性：非安全上下文（局域网 http）下 getUserMedia 直接不存在，只能禁用说明。 */
function micSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext
    && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

/** 已授权的麦克风设备列表（label 要授权后才拿得到，未授权时只剩 deviceId）。 */
function useMicDevices(active: boolean): Array<{ deviceId: string; label: string }> {  const [devices, setDevices] = useState<Array<{ deviceId: string; label: string }>>([])
  useEffect(() => {
    if (!active || !micSupported()) return
    let stale = false
    const load = (): void => {
      navigator.mediaDevices.enumerateDevices().then((all) => {
        if (stale) return
        setDevices(all.filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` })))
      }, () => {})
    }
    load()
    navigator.mediaDevices.addEventListener?.('devicechange', load)
    return () => {
      stale = true
      navigator.mediaDevices.removeEventListener?.('devicechange', load)
    }
  }, [active])
  return devices
}

/** 麦克风电平测试：开测后 RMS 电平条实时起伏；关测/换设备/卸载即停流。 */
function MicTest(props: {
  deviceId: string
  micGain: number
  engine: 'kws' | 'template'
  keywords: string[]
  threshold: number
  template: string
  onTemplate(t: string): void
  labels: {
    test: string; stop: string; hint: string; score: string; hit: string
    record: string; recording: string; clear: string; done: string; none: string; fail: string
    kwsLoading: string; kwsListening: string; kwsFailed: string; hitKw: string
  }
}) {
  const [testing, setTesting] = useState(false)
  const [level, setLevel] = useState(0)
  const [score, setScore] = useState<number | null>(null)
  const [hit, setHit] = useState(false)
  const [hitKw, setHitKw] = useState<string | null>(null)
  const [kwsPhase, setKwsPhase] = useState<'loading' | 'listening' | 'failed' | null>(null)
  const [recording, setRecording] = useState(false)
  const [recFailed, setRecFailed] = useState(false)
  const keywordsDep = JSON.stringify(props.keywords)
  useEffect(() => {
    if (!testing) return
    let stop = false
    let stream: MediaStream | null = null
    let actx: AudioContext | null = null
    let proc: ScriptProcessorNode | null = null
    let lastLevelAt = 0
    let matcher: { feed(chunk: Float32Array): void; destroy?(): void } | null = null
    let rearmTimer = 0
    void (async () => {
      let s: MediaStream
      try {
        s = await navigator.mediaDevices.getUserMedia({
          audio: { autoGainControl: true, ...(props.deviceId !== '' ? { deviceId: { exact: props.deviceId } } : {}) },
        })
      } catch {
        setTesting(false)
        return
      }
      if (stop) { for (const t of s.getTracks()) t.stop(); return }
      stream = s
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AC === undefined) { setTesting(false); return }
      actx = new AC()
      const rate = actx.sampleRate
      if (props.engine === 'kws') {
        // KWS 真实识别测试：与生产同一条 createKwsMatcher 链（worker 多路复用，
        // 这里只开自己的 stream；空闲时 worker 由 kws.ts 自动 terminate）
        setKwsPhase('loading')
        const onHitOnce = (kw: string): void => {
          setHitKw(kwsKeywordLabel(kw))
          // 命中后 1.2s 重新布防：同一声不重复触发，用户可接着再喊
          rearmTimer = window.setTimeout(() => {
            if (stop) return
            matcher?.destroy?.()
            matcher = null
            setHitKw(null)
            void arm()
          }, 1200)
        }
        const arm = async (): Promise<void> => {
          try {
            const m = await createKwsMatcher(kwsKeywordsKey(props.keywords), onHitOnce)
            if (stop) { m.destroy(); return }
            matcher = m
          } catch {
            setKwsPhase('failed')
          }
        }
        await arm()
        if (stop) return
        if (matcher !== null) setKwsPhase('listening')
      } else {
        // 识别测试与生产同构：同一对模板、同一条 decode→mfcc→谱减→裁剪链
        const tplSrcs = [props.template !== '' ? props.template : undefined, REPLY_MATCH, REPLY_REF]
          .filter((x): x is string => x !== undefined)
        const templates: number[][][] = []
        for (const tpl of tplSrcs) {
          try {
            const pcm = await decodeToPcm16k(tpl)
            templates.push(trimByEnergy(mfccFrames(pcm, true), frameRmsSeries(pcm), 0.08))
          } catch { /* 模板解码失败则只做电平 */ }
        }
        matcher = templates.length > 0
          ? new LiveMatcher(templates, () => { setHit(true) }, props.threshold, (sc) => { setScore(sc) })
          : null
      }
      const srcNode = actx.createMediaStreamSource(s)
      proc = actx.createScriptProcessor(4096, 1, 1)
      proc.onaudioprocess = (e) => {
        if (stop) return
        const ch = e.inputBuffer.getChannelData(0)
        // 电平与识别都走增益后信号（显示的就是识别器听到的）
        const gained = applySoftGain(resampleTo16k(ch, rate), props.micGain)
        let acc = 0
        for (let i = 0; i < gained.length; i++) acc += gained[i] * gained[i]
        const now = Date.now()
        if (now - lastLevelAt > 80) {
          lastLevelAt = now
          setLevel(Math.min(1, Math.sqrt(acc / gained.length) * 4)) // RMS ×4 视觉增益
        }
        try { matcher?.feed(gained) } catch { /* 单帧异常不挡 */ }
      }
      srcNode.connect(proc)
      proc.connect(actx.destination) // 不写输出，只为让 ScriptProcessor 跑起来
    })()
    return () => {
      stop = true
      window.clearTimeout(rearmTimer)
      matcher?.destroy?.()
      if (proc !== null) { proc.onaudioprocess = null; proc.disconnect() }
      if (stream !== null) for (const t of stream.getTracks()) t.stop()
      if (actx !== null) void actx.close().catch(() => {})
      setLevel(0)
      setScore(null)
      setHit(false)
      setHitKw(null)
      setKwsPhase(null)
    }
  }, [testing, props.deviceId, props.threshold, props.template, props.engine, props.micGain, keywordsDep])
  const recordTemplate = (): void => {
    if (recording) return
    setRecording(true)
    setRecFailed(false)
    void (async () => {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { autoGainControl: true, ...(props.deviceId !== '' ? { deviceId: { exact: props.deviceId } } : {}) },
        })
      } catch {
        setRecording(false)
        setRecFailed(true)
        return
      }
      const actx = new AudioContext()
      const rate = actx.sampleRate
      const chunks: Float32Array[] = []
      const srcNode = actx.createMediaStreamSource(stream)
      const proc = actx.createScriptProcessor(4096, 1, 1)
      proc.onaudioprocess = (e) => { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))) }
      srcNode.connect(proc)
      proc.connect(actx.destination)
      await new Promise((r) => setTimeout(r, 1900))
      proc.onaudioprocess = null
      proc.disconnect()
      srcNode.disconnect()
      for (const t of stream.getTracks()) t.stop()
      void actx.close().catch(() => {})
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const all = new Float32Array(total)
      let off = 0
      for (const c of chunks) { all.set(c, off); off += c.length }
      const pcm = applySoftGain(resampleTo16k(all, rate), props.micGain) // 模板与正式监听同管线（增益一致）
      // 能量裁首尾（15% 峰值门 + 前后 5 帧气息），再峰值归一到 0.9
      const rms = frameRmsSeries(pcm)
      const peak = Math.max(0, ...rms)
      if (peak < 0.01) { setRecording(false); setRecFailed(true); return }
      let lo = 0
      let hi = rms.length - 1
      while (lo < hi && rms[lo] < peak * 0.15) lo++
      while (hi > lo && rms[hi] < peak * 0.15) hi--
      lo = Math.max(0, lo - 5)
      hi = Math.min(rms.length - 1, hi + 5)
      const out = pcm.slice(lo * FRAME_STEP, hi * FRAME_STEP + FRAME_LEN)
      let pk = 0
      for (const v of out) pk = Math.max(pk, Math.abs(v))
      if (pk > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.9 / pk
      props.onTemplate(encodeWav16kDataUrl(out))
      setRecording(false)
    })()
  }

  return (
    <div style={{ padding: '2px 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          style={{
            font: 'inherit', fontSize: 12, padding: '3px 12px', borderRadius: 7, cursor: 'pointer',
            border: `1px solid ${colors.border}`, background: 'none', color: colors.labelPrimary,
          }}
          onClick={() => { setTesting(!testing) }}
        >{testing ? props.labels.stop : props.labels.test}</button>
        {testing
          ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1 }} title={props.labels.hint}>
              <span style={{ flex: 1, maxWidth: 220, height: 8, borderRadius: 4, border: `1px solid ${colors.border}`, overflow: 'hidden', display: 'inline-block' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.round(level * 100)}%`, background: 'var(--dsw-alias-state-success-primary, #22c55e)', transition: 'width .06s' }} />
              </span>
            </span>
          )
          : null}
      </div>
      {testing
        ? (
          <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: (hit || hitKw !== null) ? 'var(--dsw-alias-state-success-primary, #22c55e)' : kwsPhase === 'failed' ? 'var(--dsw-alias-state-error-primary, #ef4444)' : colors.labelTertiary }}>
            {props.engine === 'kws'
              ? kwsPhase === 'loading' ? props.labels.kwsLoading
                : kwsPhase === 'failed' ? props.labels.kwsFailed
                  : hitKw !== null ? props.labels.hitKw.replace('{keyword}', hitKw)
                    : props.labels.kwsListening
              : hit ? props.labels.hit : props.labels.score.replace('{score}', score === null ? '—' : score.toFixed(2))}
          </div>
        )
        : null}
      {props.engine === 'template'
        ? (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={recording}
          style={{
            font: 'inherit', fontSize: 12, padding: '3px 12px', borderRadius: 7,
            cursor: recording ? 'default' : 'pointer', opacity: recording ? 0.5 : 1,
            border: `1px solid ${colors.border}`, background: 'none', color: colors.labelPrimary,
          }}
          onClick={recordTemplate}
        >{recording ? props.labels.recording : props.labels.record}</button>
        {props.template !== '' && !recording
          ? (
            <button
              type="button"
              style={{ font: 'inherit', fontSize: 12, padding: '3px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${colors.border}`, background: 'none', color: colors.labelTertiary }}
              onClick={() => { props.onTemplate('') }}
            >{props.labels.clear}</button>
          )
          : null}
        <span style={{ fontSize: 11, color: recFailed ? 'var(--dsw-alias-state-error-primary, #ef4444)' : colors.labelTertiary }}>
          {recording ? '' : recFailed ? props.labels.fail : props.template !== '' ? props.labels.done : props.labels.none}
        </span>
          </div>
        )
        : null}
    </div>
  )
}

/** 制作指南地址（AI 辅助按钮把它喂给 dsh agent；hint 里也做可点链接）。 */
const GUIDE_URL = 'https://github.com/whitefirer/dsh-niulai-pet/blob/master/SKIN_AUTHORING.md'
/** 最小示例包（robot）：给想先试导入流程的用户。 */
const SAMPLE_URL = 'https://github.com/whitefirer/dsh-niulai-pet/raw/master/docs/assets/robot.nlpack.zip'

/** 喂给 dsh 首页输入框的预制 prompt（指南自足，agent 读完即可带用户做包）。 */
const ASSIST_PROMPT = `我想做一个 dsh 牛来桌宠的自定义角色包。请先读制作指南：${GUIDE_URL} ，然后一步步带我做：先问我角色叫什么、长什么样、要什么声音文案和动作；素材（透明底 png、mp3）你帮我生成和处理，逐张给我过目；最后打出 .nlpack.zip 给我，并告诉我去「设置 → 插件配置 → 牛来桌宠 → 自定义角色 → 导入角色包」。`

/** 自定义角色管理：导入（预览→警告确认→落库）、列表、删除、dsh 辅助制作。 */
function PackManager(props: { packs: PacksFace; disabled: boolean; t: NiulaiCardProps['t'] }) {
  const { packs, t } = props
  const snap = useSyncExternalStore(packs.subscribe, packs.getSnapshot)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[] | null>(null)
  const [pending, setPending] = useState<{ def: CharacterDef; warnings: string[] } | null>(null)
  const [assistMsg, setAssistMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const customs = snap.characters.filter((c) => c.custom === true)

  /** 把预制 prompt 填进 dsh 输入框（React 受控组件要走原生 setter + input 事件）。
   *  候选链：首页新会话框（placeholder 含「构建」且可见）→ 任何可见输入框
   *  （会话页追问框——prompt 发进当前会话一样干活）→ 都没有则复制到剪贴板。 */
  const assist = (): void => {
    const tas = [...document.querySelectorAll('textarea')]
      .filter((x): x is HTMLTextAreaElement => x instanceof HTMLTextAreaElement)
      // 排除自己卡片里的输入框（语录框）——曾经把 prompt 填进语录框（踩过）
      .filter((x) => x.closest('[data-niulai-card]') === null)
    const el = tas.find((x) => x.placeholder.includes('构建') && x.offsetParent !== null)
      ?? tas.find((x) => x.offsetParent !== null)
    const flash = (msg: string): void => {
      setAssistMsg(msg)
      setTimeout(() => { setAssistMsg(null) }, 5000)
    }
    if (el === undefined) {
      void navigator.clipboard.writeText(ASSIST_PROMPT).then(
        () => { flash(t('packsAssistCopied')) },
        () => { flash(t('packsAssistCopyFail')) },
      )
      return
    }
    if (el.value.trim() !== '') {
      flash(t('packsAssistBusy'))
      return
    }
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(el, ASSIST_PROMPT)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.focus()
    // 关掉设置弹窗让输入框露出来（dsh 弹窗关闭钮内嵌 visually-hidden 文本「关闭」；
    // 只按文本匹配，不用 aria-label——顶栏还有个 aria-label=关闭 的整窗按钮，点错完蛋）
    const closeBtn = [...document.querySelectorAll('button')].find((b) => ['关闭', 'Close'].includes(b.textContent.trim()))
    closeBtn?.click()
    flash(t('packsAssistDone'))
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0]
    e.target.value = '' // 同名文件再选也要触发 change
    if (f === undefined) return
    setBusy(true)
    setErrors(null)
    setPending(null)
    void packs.preview(f).then(async (r) => {
      if (r.warnings.length > 0) setPending(r) // 有提醒先让用户过目
      else await packs.install(r.def)
    }).catch((err: unknown) => {
      setErrors(err instanceof PackParseError ? err.issues : [String(err)])
    }).finally(() => { setBusy(false) })
  }
  const confirmInstall = (): void => {
    if (pending === null) return
    setBusy(true)
    void packs.install(pending.def).then(() => { setPending(null) }).finally(() => { setBusy(false) })
  }
  const remove = (c: CharacterDef): void => {
    if (!window.confirm(`${t('packDelete')}「${c.name}」?`)) return
    void packs.remove(c.id)
  }

  const smallBtn: React.CSSProperties = {
    font: 'inherit', fontSize: 12, padding: '3px 12px', borderRadius: 7,
    border: `1px solid ${colors.border}`, background: 'none', color: colors.labelPrimary,
    cursor: props.disabled ? 'default' : 'pointer', opacity: props.disabled ? 0.4 : 1,
  }
  return (
    <div style={{ padding: '9px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ fontSize: 13, color: colors.labelPrimary }}>{t('packs')}</span>
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".zip,.nlpack.zip" style={{ display: 'none' }} onChange={onFile} />
          <button type="button" style={smallBtn} disabled={props.disabled} onClick={assist} title={GUIDE_URL}>
            {t('packsAssist')}
          </button>
          <button type="button" style={smallBtn} disabled={props.disabled || busy} onClick={() => { fileRef.current?.click() }}>
            {busy ? t('packImporting') : t('packImport')}
          </button>
        </span>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: colors.labelTertiary, marginTop: 6 }}>
        {t('packsHint')}
        <a href={GUIDE_URL} target="_blank" rel="noreferrer" style={{ color: colors.brand, textDecoration: 'none', margin: '0 2px' }}>{t('packsGuide')}</a>
        {t('packsSamplePre')}
        <a href={SAMPLE_URL} target="_blank" rel="noreferrer" style={{ color: colors.brand, textDecoration: 'none', margin: '0 2px' }}>{t('packsSample')}</a>
        {t('packsSamplePost')}
        {assistMsg !== null ? <span style={{ color: colors.labelTertiary }}>{assistMsg}</span> : null}
      </div>
      {errors !== null
        ? (
          <div role="alert" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-state-error-primary, #ef4444)' }}>
            {t('packErrorsTitle')}
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )
        : null}
      {pending !== null
        ? (
          <div role="status" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-state-warning-primary, #eab308)' }}>
            {t('packWarningsTitle')}
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {pending.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
            <span style={{ display: 'inline-flex', gap: 8, marginTop: 6 }}>
              <button type="button" style={smallBtn} disabled={busy} onClick={confirmInstall}>{t('packConfirm')}</button>
              <button type="button" style={smallBtn} disabled={busy} onClick={() => { setPending(null) }}>{t('packCancel')}</button>
            </span>
          </div>
        )
        : null}
      {customs.length === 0 && errors === null
        ? <div style={{ marginTop: 8, fontSize: 12, color: colors.labelTertiary }}>{t('packEmpty')}</div>
        : null}
      {customs.map((c) => {
        const thumb = c.skins[0]?.images.stand ?? ''
        const sig = c.skins[0]?.signature ?? 'hops'
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 12 }}>
            {thumb !== ''
              ? <img src={thumb} alt={c.name} style={{ width: 30, height: 30, objectFit: 'contain', flex: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.3))' }} />
              : null}
            <span style={{ color: colors.labelPrimary, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.name}
              <span style={{ color: colors.labelTertiary }}>
                {' '}v{c.version ?? '?'} · {t('packSkinCount', { n: c.skins.length })} · {t(`action.${sig}`)}
                {c.author !== undefined ? ` · ${c.author}` : ''}
                {c.extendedFrom !== undefined ? ` · ${t('packVariantOf', { base: c.extendedFrom })}` : ''}
              </span>
            </span>
            <button type="button" style={smallBtn} disabled={props.disabled} onClick={() => { remove(c) }}>{t('packDelete')}</button>
          </div>
        )
      })}
    </div>
  )
}

/** 设置卡片组件：命名空间未 serve 时不渲染（与官方卡片同语义）。 */
export function NiulaiCard(props: NiulaiCardProps) {
  const [open, setOpen] = useState(props.defaultOpen === true)
  // 语音开关的失败原因分态：denied=授权被拒/iframe 策略；no-mic=无设备（NotFoundError）
  const [voiceIssue, setVoiceIssue] = useState<'denied' | 'no-mic' | null>(null)
  // 配置对象选择（主宠/额外表；皮肤/大小按只）——hook 必须在 ready 早退前
  const [petSel, setPetSel] = useState(props.initialPet ?? 'main')
  const [tab, setTab] = useState<'pet' | 'global' | 'custom' | 'advanced'>('pet')
  // 「当前桌宠」tab 展开期间持续高亮选中桌宠；切 tab/换对象/收起/卸载（关面板）即恢复。
  // 必须在 ready 早退前挂 hook（该早退是既有模式，hook 顺序不能被打乱）。
  const hl = props.highlight
  useEffect(() => {
    if (!open || tab !== 'pet' || hl?.setHold === undefined) return
    hl.setHold(petSel)
    return () => { hl.releaseHold?.(petSel) }
  }, [open, tab, petSel, hl])
  const { t } = props
  const state = props.useNiulaiPet((s) => s)
  if (!state.ready) return null
  const { cfg, writable } = state
  const disabled = !writable
  const micOk = micSupported()
  // 语音停喊开关：打开前先真试一次授权（浏览器原生授权框），拿到流才写入 true；
  // 被拒则不落配置，受控开关自然弹回关位。试授权的流立即停掉，不常驻。
  const onVoice = (on: boolean): void => {
    if (!on) {
      setVoiceIssue(null)
      props.set({ voiceControl: false })
      return
    }
    navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: true } }).then(
      (stream) => {
        for (const track of stream.getTracks()) track.stop()
        setVoiceIssue(null)
        props.set({ voiceControl: true })
      },
      (err: unknown) => {
        // NotFoundError/OverconstrainedError = 没有可用设备；NotAllowedError 才是
        // 真的被拒（含 iframe 未放麦克风权限的策略拒绝）。分态提示，别一律说被拒。
        const name = (err as DOMException | null)?.name
        console.warn('[dsh-niulai-pet] mic request failed:', name, err)
        setVoiceIssue(name === 'NotFoundError' || name === 'OverconstrainedError' ? 'no-mic' : 'denied')
      },
    )
  }
  const voiceNote = !micOk ? t('voiceUnsupported')
    : voiceIssue === 'no-mic' ? t('voiceNoMic')
      : voiceIssue === 'denied' ? t('voiceDenied')
        : cfg.voiceControl ? t('voiceGranted') : t('voiceIdle')
  const micDevices = useMicDevices(micOk && cfg.voiceControl)
  const vdbg = props.voiceDebug
  const vdbgState = useSyncExternalStore(
    vdbg !== undefined ? vdbg.subscribe : noopSubscribe,
    vdbg !== undefined ? vdbg.getSnapshot : nullSnapshot,
  )
  const dbgHit = vdbgState?.matchedAt != null && Date.now() - vdbgState.matchedAt < 15000
  const voiceDbgText = dbgHit
    ? t('voiceDbgHit')
    : vdbgState?.listening === true
      ? t('voiceDbgOn', { score: vdbgState.lastScore?.toFixed(2) ?? '—' })
      : t('voiceDbgOff')
  // 角色包注册表（内置+自定义）；卡片总是由入口传入，空快照只是类型兜底
  const packs = props.packs
  const packSnap = useSyncExternalStore(
    packs !== undefined ? packs.subscribe : noopSubscribe,
    packs !== undefined ? packs.getSnapshot : EMPTY_PACKS,
  )
  // 配置对象：主宠或某只额外表（皮肤/大小/色相按只存；动作绑定按皮肤全局共享）
  // 额外表透明度缺省回皮肤包声明的默认（如史莱姆 90%），再缺省 100——与 pet.ts myOpacity 同语义
  const skinDefOpacity = (skinId: string): number =>
    packSnap.skins.find((s) => s.id === skinId)?.defaultOpacity ?? 100
  const skinDefHue = (skinId: string): number =>
    packSnap.skins.find((s) => s.id === skinId)?.defaultHue ?? 0
  const skinDefHueCycle = (skinId: string): boolean =>
    packSnap.skins.find((s) => s.id === skinId)?.defaultHueCycle ?? false
  const petList = [{ id: 'main', skin: cfg.skin, size: cfg.petSize, hue: cfg.petHue, hueCycle: cfg.petHueCycle, opacity: cfg.petOpacity, walk: cfg.walkEnabled }, ...cfg.extraPets.map((p) => ({ id: p.id, skin: p.skin, size: p.size ?? cfg.petSize, hue: p.hue ?? skinDefHue(p.skin), hueCycle: p.hueCycle ?? skinDefHueCycle(p.skin), opacity: p.opacity ?? skinDefOpacity(p.skin), walk: p.walkEnabled ?? cfg.walkEnabled }))]
  const target = petList.find((p) => p.id === petSel) ?? petList[0]
  const targetSkinName = packSnap.skins.find((s) => s.id === target.skin)?.name ?? target.skin
  /** 当前对象皮肤的默认大小/不透明度/色相（重置按钮目标值）。 */
  const targetDefaultSize = packSnap.skins.find((s) => s.id === target.skin)?.defaultSize ?? 120
  const targetDefaultOpacity = skinDefOpacity(target.skin)
  const targetDefaultHue = skinDefHue(target.skin)
  const targetDefaults = defaultActionsFor(packSnap.characters, target.skin)
  const targetDone = cfg.actions[target.skin]?.done ?? targetDefaults.done
  const targetPoke = cfg.actions[target.skin]?.poke ?? targetDefaults.poke
  const setTargetSkin = (v: string): void => {
    // 换皮肤大小/透明度/色相/流光/走动落到新皮肤的默认（与 pet.ts 菜单换肤同语义）
    const def = packSnap.skins.find((s) => s.id === v)
    const size = def?.defaultSize ?? 120
    const opacity = def?.defaultOpacity ?? 100
    const hue = def?.defaultHue ?? 0
    const hueCycle = def?.defaultHueCycle ?? false
    const walkEnabled = def?.defaultWalkable ?? true
    if (target.id === 'main') props.set({ skin: v, petSize: size, petOpacity: opacity, petHue: hue, petHueCycle: hueCycle, walkEnabled })
    else props.set({ extraPets: cfg.extraPets.map((p) => p.id === target.id ? { ...p, skin: v, size, opacity, hue, hueCycle, walkEnabled } : p) })
  }
  const setTargetSize = (v: number): void => {
    if (target.id === 'main') props.set({ petSize: v })
    else props.set({ extraPets: cfg.extraPets.map((p) => p.id === target.id ? { ...p, size: v } : p) })
  }
  const setTargetHue = (v: number): void => {
    if (target.id === 'main') props.set({ petHue: v })
    else props.set({ extraPets: cfg.extraPets.map((p) => p.id === target.id ? { ...p, hue: v } : p) })
  }
  const setTargetHueCycle = (on: boolean): void => {
    if (target.id === 'main') props.set({ petHueCycle: on })
    else props.set({ extraPets: cfg.extraPets.map((p) => p.id === target.id ? { ...p, hueCycle: on } : p) })
  }
  const setTargetOpacity = (v: number): void => {
    if (target.id === 'main') props.set({ petOpacity: v })
    else props.set({ extraPets: cfg.extraPets.map((p) => p.id === target.id ? { ...p, opacity: v } : p) })
  }
  return (
    <li data-niulai-card style={{
      listStyle: 'none', border: `1px solid ${colors.border}`, borderRadius: 12,
      background: colors.bgCard, transition: 'border-color .16s',
    }}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
        onClick={() => { setOpen(!open) }}
        style={{
          width: '100%', appearance: 'none', border: 0, background: 'none', font: 'inherit',
          color: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: colors.labelPrimary }}>🐮 {t('title')}</span>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: colors.labelTertiary }}>{t('description')}</span>
        </span>
        <span style={{
          flex: 'none', color: colors.labelTertiary, transition: 'transform .16s',
          transform: open ? 'rotate(180deg)' : undefined,
        }}>▾</span>
      </button>
      {open
        ? (
          <div style={{ borderTop: `1px solid ${colors.border}`, margin: '0 16px', padding: '4px 0 12px' }}>
            {!writable ? <p role="status" style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.5, color: colors.labelTertiary }}>{t('readOnly')}</p> : null}
            <div style={{ display: 'flex', gap: 6, margin: '10px 0 2px' }}>
              {(['pet', 'global', 'advanced', 'custom'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setTab(id) }}
                  style={{
                    font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                    // 不用 brand 填充：dsh 的 brand 变量是浅色，白字压上去直接隐形（踩过）
                    border: `1px solid ${tab === id ? 'var(--dsw-alias-brand-primary, #3b82f6)' : colors.border}`,
                    background: 'none',
                    fontWeight: tab === id ? 600 : 400,
                    color: tab === id ? 'var(--dsw-alias-brand-primary, #3b82f6)' : colors.labelPrimary,
                  }}
                >
                  {t(id === 'pet' ? 'tabPet' : id === 'global' ? 'tabGlobal' : id === 'custom' ? 'tabCustom' : 'tabAdvanced')}
                </button>
              ))}
            </div>
            {tab === 'global'
              ? (
                <>
            <Row label={t('hideAll')}>
              <Switch on={cfg.hidden} disabled={disabled} label={t('hideAll')} onChange={(on) => { props.set({ hidden: on }) }} />
            </Row>
            <Row label={t('sound')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {/* 静音按钮 + 音量滑杆合并：静音仅显示 0（音量值保留，解除恢复）；滑到 0 自动静音、拉高自动解除 */}
                <button type="button" disabled={disabled} aria-label={t('mute')}
                  onClick={() => { props.set({ muted: !cfg.muted }) }}
                  style={{
                    font: 'inherit', fontSize: 16, width: 34, height: 28, borderRadius: 7,
                    border: `1px solid ${cfg.muted ? 'var(--dsw-alias-brand-primary, #3b82f6)' : colors.border}`,
                    background: 'none', cursor: disabled ? 'default' : 'pointer',
                    lineHeight: 1, color: cfg.muted ? 'var(--dsw-alias-brand-primary, #3b82f6)' : colors.labelPrimary,
                  }}>{cfg.muted ? '🔇' : '🔊'}</button>
                <VolumeField value={cfg.muted ? 0 : cfg.volume} disabled={disabled} label={t('volume')}
                  onCommit={(n) => { props.set({ volume: n, muted: n === 0 }) }} />
              </span>
            </Row>
            <Row label={t('shoutOnDone')}>
              <Switch on={cfg.shoutOnDone} disabled={disabled} label={t('shoutOnDone')} onChange={(on) => { props.set({ shoutOnDone: on }) }} />
            </Row>
            <Row label={t('shoutCount')}>
              <NumberField value={cfg.shoutCount} min={1} max={99} disabled={disabled} label={t('shoutCount')} onCommit={(n) => { props.set({ shoutCount: n }) }} />
            </Row>
            <Row label={t('doneDelay')}>
              <NumberField value={cfg.doneDelaySec} min={0} max={120} disabled={disabled} label={t('doneDelay')}
                onCommit={(n) => { props.set({ doneDelaySec: n }) }} />
            </Row>
            <Row label={t('shoutLoop')}>
              <Switch on={cfg.shoutLoop} disabled={disabled} label={t('shoutLoop')} onChange={(on) => { props.set({ shoutLoop: on }) }} />
            </Row>
            <Row label={t('sleepEnabled')}>
              <Switch on={cfg.sleepEnabled} disabled={disabled} label={t('sleepEnabled')} onChange={(on) => { props.set({ sleepEnabled: on }) }} />
            </Row>
            <Row label={t('walkEnabled')}>
              <Switch on={cfg.walkEnabled} disabled={disabled} label={t('walkEnabled')} onChange={(on) => { props.set({ walkEnabled: on }) }} />
            </Row>
            <Row label={t('physics')}>
              <Switch on={cfg.physics} disabled={disabled} label={t('physics')} onChange={(on) => { props.set({ physics: on }) }} />
            </Row>
            <Row label={t('replyNiulai')}>
              <Switch on={cfg.replyNiulai} disabled={disabled} label={t('replyNiulai')} onChange={(on) => { props.set({ replyNiulai: on }) }} />
            </Row>
            <Row label={t('talkative')}>
              <Switch on={cfg.talkative} disabled={disabled} label={t('talkative')} onChange={(on) => { props.set({ talkative: on }) }} />
            </Row>
            <Row label={t('heatEnabled')}>
              <Switch on={cfg.heatEnabled} disabled={disabled} label={t('heatEnabled')} onChange={(on) => { props.set({ heatEnabled: on }) }} />
            </Row>
                </>
              )
              : null}
            {tab === 'custom'
              ? (
                <>
            <Row label={t('customSound')}>
              <Switch on={cfg.customSoundOn} disabled={disabled} label={t('customSound')} onChange={(on) => { props.set({ customSoundOn: on }) }} />
            </Row>
            {cfg.customSoundOn
              ? (
                <>
                  <Row label="　">
                    <CustomSoundField value={cfg.customSound} disabled={disabled}
                      labels={{ import: t('customSoundImport'), test: t('customSoundTest'), clear: t('customSoundClear'), tooBig: t('customSoundTooBig') }}
                      onSet={(v) => { props.set({ customSound: v }) }} />
                  </Row>
                  <div style={{ margin: '-4px 0 4px', fontSize: 12, lineHeight: 1.5, color: colors.labelTertiary }}>{t('customSoundHint')}</div>
                </>
              )
              : null}
            {packs !== undefined ? <PackManager packs={packs} disabled={disabled} t={t} /> : null}
                </>
              )
              : null}
            {tab === 'advanced'
              ? (
                <>
            <Row label={t('groundOffset')}>
              <NumberField value={cfg.groundOffset} min={-Infinity} max={Infinity} disabled={disabled} label={t('groundOffset')}
                onCommit={(n) => { props.set({ groundOffset: n }) }} />
            </Row>
            <div role="status" style={{ margin: '-4px 0 4px', fontSize: 12, lineHeight: 1.5, color: colors.labelTertiary }}>{t('groundOffsetHint')}</div>
            <Row label={t('maxPets')}>
              <NumberField value={cfg.maxPets} min={1} max={Infinity} disabled={disabled} label={t('maxPets')}
                onCommit={(n) => { props.set({ maxPets: n }) }} />
            </Row>
            <Row label={t('voiceControl')}>
              <Switch on={cfg.voiceControl} disabled={disabled || !micOk} label={t('voiceControl')} onChange={onVoice} />
            </Row>
            <div role="status" style={{ margin: '-4px 0 4px', fontSize: 12, lineHeight: 1.5, color: colors.labelTertiary }}>{voiceNote}</div>
            {micOk && cfg.voiceControl
              ? <div role="status" style={{ margin: '0 0 4px', fontSize: 12, lineHeight: 1.5, color: dbgHit ? 'var(--dsw-alias-state-success-primary, #22c55e)' : colors.labelTertiary }}>{voiceDbgText}</div>
              : null}
            {micOk && cfg.voiceControl
              ? (
                <>
                  <Row label={t('voiceEngine')}>
                    <select
                      style={selectStyle(disabled)}
                      value={cfg.voiceEngine}
                      disabled={disabled}
                      onChange={(e) => { props.set({ voiceEngine: e.target.value as 'kws' | 'template' }) }}
                    >
                      <option value="kws" style={optionStyle}>{t('voiceEngineKws')}</option>
                      <option value="template" style={optionStyle}>{t('voiceEngineTemplate')}</option>
                    </select>
                  </Row>
                  {cfg.voiceEngine === 'kws'
                    ? <div style={{ margin: '-4px 0 4px', fontSize: 12, lineHeight: 1.5, color: colors.labelTertiary }}>{t('voiceEngineHint')}</div>
                    : null}
                  <Row label={t('micDevice')}>
                    <select
                      style={selectStyle(disabled)}
                      value={cfg.micDeviceId}
                      disabled={disabled}
                      onChange={(e) => { props.set({ micDeviceId: e.target.value }) }}
                    >
                      <option value="" style={optionStyle}>{t('micDefault')}</option>
                      {micDevices.map((d) => <option key={d.deviceId} value={d.deviceId} style={optionStyle}>{d.label}</option>)}
                    </select>
                  </Row>
                  <Row label={t('micGain')}>
                    <MicGainField value={cfg.micGain} disabled={disabled} label={t('micGain')} onCommit={(n) => { props.set({ micGain: n }) }} />
                  </Row>
                  <div style={{ margin: '-4px 0 4px', fontSize: 12, lineHeight: 1.5, color: colors.labelTertiary }}>{t('micGainHint')}</div>
                  {cfg.voiceEngine === 'kws'
                    ? (
                      <Row label={t('voiceKeywords')}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {KWS_KEYWORD_PRESETS.map((p) => {
                            const on = cfg.voiceKeywords.includes(p.id)
                            return (
                              <label key={p.id} style={{ fontSize: 13, color: colors.labelPrimary, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: disabled ? 'default' : 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={on}
                                  disabled={disabled}
                                  onChange={() => {
                                    const next = on ? cfg.voiceKeywords.filter((k) => k !== p.id) : [...cfg.voiceKeywords, p.id]
                                    if (next.length === 0) return // 至少留一个词
                                    props.set({ voiceKeywords: next })
                                  }}
                                />
                                {p.label}
                              </label>
                            )
                          })}
                        </div>
                      </Row>
                    )
                    : null}
                  <MicTest deviceId={cfg.micDeviceId} micGain={cfg.micGain} engine={cfg.voiceEngine} keywords={cfg.voiceKeywords} threshold={cfg.voiceThreshold} template={cfg.voiceTemplate}
                    onTemplate={(tpl) => { props.set({ voiceTemplate: tpl }) }}
                    labels={{ test: t('micTest'), stop: t('micTestStop'), hint: t('micTestHint'), score: t('micTestScore', { score: '{score}' }), hit: t('micTestHit'), record: t('micRecord'), recording: t('micRecording'), clear: t('micRecordClear'), done: t('micRecordDone'), none: t('micRecordNone'), fail: t('micRecordFail'), kwsLoading: t('micKwsLoading'), kwsListening: t('micKwsListening'), kwsFailed: t('micKwsFailed'), hitKw: t('micTestHitKw', { keyword: '{keyword}' }) }} />
                  {cfg.voiceEngine === 'template'
                    ? (
                      <>
                        <Row label={t('voiceThreshold')}>
                          <NumberField value={cfg.voiceThreshold} min={0.3} max={0.85} float disabled={disabled} label={t('voiceThreshold')}
                            onCommit={(n) => { props.set({ voiceThreshold: n }) }} />
                        </Row>
                        <div style={{ margin: '-4px 0 4px', fontSize: 12, lineHeight: 1.5, color: colors.labelTertiary }}>{t('voiceThresholdHint')}</div>
                      </>
                    )
                    : null}
                </>
              )
              : null}
                </>
              )
              : null}
            {tab === 'pet'
              ? (
                <>
            {petList.length > 1
              ? (
                <Row label={t('petTarget')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      const img = packSnap.skins.find((s) => s.id === target.skin)?.image ?? ''
                      return img !== ''
                        ? (
                          <img src={img} alt="" title={t('petTargetHint')}
                            style={{ height: 32, display: 'block', cursor: 'pointer' }}
                            onClick={() => { props.highlight?.emit(target.id) }} />
                        )
                        : null
                    })()}
                    <select
                      style={selectStyle(disabled)}
                      value={target.id}
                      disabled={disabled}
                      onChange={(e) => { setPetSel(e.target.value) }}
                    >
                      {petList.map((p, i) => (
                        <option key={p.id} value={p.id} style={optionStyle}>
                          {i === 0 ? t('petMain') : `${t('petN')} ${i + 1}`} · {packSnap.skins.find((s) => s.id === p.skin)?.name ?? p.skin}
                        </option>
                      ))}
                    </select>
                  </span>
                </Row>
              )
              : null}
            <Row label={petList.length > 1 ? `${t('skin')} · ${targetSkinName}` : t('skin')}>
              <select
                style={selectStyle(disabled)}
                value={target.skin}
                disabled={disabled}
                onChange={(e) => { setTargetSkin(e.target.value) }}
              >
                {packSnap.skins.map((s) => <option key={s.id} value={s.id} style={optionStyle}>{s.name}</option>)}
              </select>
            </Row>
            <Row label={petList.length > 1 ? `${t('petSize')} · ${targetSkinName}` : t('petSize')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <SizeField value={target.size} disabled={disabled} label={t('petSize')}
                  onCommit={setTargetSize} />
                {target.size !== targetDefaultSize
                  ? (
                    <button type="button" disabled={disabled}
                      style={{
                        font: 'inherit', fontSize: 12, padding: '3px 10px', borderRadius: 7,
                        border: `1px solid ${colors.border}`, background: 'none',
                        color: colors.labelPrimary, cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.4 : 1,
                      }}
                      onClick={() => { setTargetSize(targetDefaultSize) }}>
                      {t('petSizeReset')}
                    </button>
                  )
                  : null}
              </span>
            </Row>
            <Row label={petList.length > 1 ? `${t('petHue')} · ${targetSkinName}` : t('petHue')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <SliderField value={target.hue} min={0} max={360} unit="°" disabled={disabled} label={t('petHue')}
                  onCommit={setTargetHue} />
                {target.hue !== targetDefaultHue
                  ? (
                    <button type="button" disabled={disabled}
                      style={{
                        font: 'inherit', fontSize: 12, padding: '3px 10px', borderRadius: 7,
                        border: `1px solid ${colors.border}`, background: 'none',
                        color: colors.labelPrimary, cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.4 : 1,
                      }}
                      onClick={() => { setTargetHue(targetDefaultHue) }}>
                      {t('petSizeReset')}
                    </button>
                  )
                  : null}
              </span>
            </Row>
            <Row label={petList.length > 1 ? `${t('petHueCycle')} · ${targetSkinName}` : t('petHueCycle')}>
              <Switch on={target.hueCycle} disabled={disabled} label={t('petHueCycle')} onChange={setTargetHueCycle} />
            </Row>
            <Row label={petList.length > 1 ? `${t('petOpacity')} · ${targetSkinName}` : t('petOpacity')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <SliderField value={target.opacity} min={20} max={100} unit="%" disabled={disabled} label={t('petOpacity')}
                  onCommit={setTargetOpacity} />
                {target.opacity !== targetDefaultOpacity
                  ? (
                    <button type="button" disabled={disabled}
                      style={{
                        font: 'inherit', fontSize: 12, padding: '3px 10px', borderRadius: 7,
                        border: `1px solid ${colors.border}`, background: 'none',
                        color: colors.labelPrimary, cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.4 : 1,
                      }}
                      onClick={() => { setTargetOpacity(targetDefaultOpacity) }}>
                      {t('petSizeReset')}
                    </button>
                  )
                  : null}
              </span>
            </Row>
            <Row label={petList.length > 1 ? `${t('walkEnabled')} · ${targetSkinName}` : t('walkEnabled')}>
              <Switch on={target.walk} disabled={disabled} label={t('walkEnabled')}
                onChange={(on) => {
                  if (target.id === 'main') props.set({ walkEnabled: on })
                  else props.set({ extraPets: cfg.extraPets.map((p) => p.id === target.id ? { ...p, walkEnabled: on } : p) })
                }} />
            </Row>
            <Row label={`${t('doneAction')} · ${targetSkinName}`}>
              <select
                style={selectStyle(disabled)}
                value={targetDone}
                disabled={disabled}
                onChange={(e) => { props.setSkinAction(target.skin, 'done', e.target.value as ActionName) }}
              >
                {ACTION_ORDER.map((a) => <option key={a} value={a} style={optionStyle}>{t(`action.${a}`)}</option>)}
              </select>
            </Row>
            <Row label={`${t('pokeAction')} · ${targetSkinName}`}>
              <select
                style={selectStyle(disabled)}
                value={targetPoke}
                disabled={disabled}
                onChange={(e) => { props.setSkinAction(target.skin, 'poke', e.target.value as ActionName) }}
              >
                {ACTION_ORDER.map((a) => <option key={a} value={a} style={optionStyle}>{t(`action.${a}`)}</option>)}
              </select>
            </Row>
            <div style={{ padding: '9px 0' }}>
              <div style={{ fontSize: 13, color: colors.labelPrimary, marginBottom: 6 }}>
                {petList.length > 1 ? `${t('quips')} · ${targetSkinName}` : t('quips')}
              </div>
              <QuipsField
                value={target.id === 'main' ? cfg.quips : (cfg.extraPets.find((p) => p.id === target.id)?.quips ?? cfg.quips)}
                disabled={disabled} placeholder={t('quipsHint')}
                onCommit={(quips) => {
                  // 语录按只存：额外表写自己条目（清空=跟随全局链），主宠写全局 quips
                  if (target.id === 'main') props.set({ quips })
                  else props.set({ extraPets: cfg.extraPets.map((p) => p.id === target.id ? { ...p, quips } : p) })
                }} />
              <div style={{ fontSize: 12, lineHeight: 1.5, color: colors.labelTertiary, marginTop: 6 }}>{t('quipsHint')}</div>
            </div>
                </>
              )
              : null}
          </div>
        )
        : null}
    </li>
  )
}

/** 卡片半需要的 client ctx 面（cordis 子 fiber 注入后保证在场，结构化自描）。 */
interface CardCtx {
  settingsScope: { bind(spec: { namespace: string }): SettingsScopeLike }
  locale: { register(ns: string, dicts: Record<string, Record<string, string>>): () => void }
  slots: {
    inject(key: string, callback: () => (() => void)): () => void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
  effect(fn: () => void | (() => void), label?: string): void
}

/**
 * 注册设置卡片：bind 命名空间 scope（ConfigStore 切换后端 + 旧值迁移）、
 * 注册双语字典、按 slot 声明生命周期注册卡片。rc.6 无这些服务时
 * 本函数所在的 ctx.inject 子 fiber 永不激活，什么都不会发生。
 */
export function registerSettingsCard(ctx: CardCtx, store: ConfigStore, voiceDebug?: VoiceDebugBus, packs?: PacksFace, highlight?: HighlightBus): void {
  const scope = ctx.settingsScope.bind({ namespace: CARD_NS })
  ctx.effect(() => store.attachScope(scope), 'niulai-pet settings scope')
  ctx.effect(() => ctx.locale.register(CARD_NS, { zh, en }), 'niulai-pet card locales')
  const controller = new CardController(store, scope, voiceDebug, packs, highlight)
  ctx.effect(() => () => { controller.dispose() }, 'niulai-pet card controller')
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: CARD_NS,
    locale: CARD_NS,
    inject: () => controller.inject(),
  }, NiulaiCard))
}

/**
 * 悬浮设置面板（右键菜单「⚙️ 设置」）：同一个 NiulaiCard 渲染进任意容器——
 * 宿主没有「打开设置页并定位」的 API，面板绕过设置页原地开合，改完立即看桌宠反应。
 * scope 伪装常驻 ready/writable（面板态没有命名空间配对一说）；
 * t 座用内置字典（zh/en 按 navigator.language）。返回销毁函数。
 */
export function mountCardPanel(
  container: HTMLElement,
  store: ConfigStore,
  voiceDebug?: VoiceDebugBus,
  packs?: PacksFace,
  highlight?: HighlightBus,
  initialPet?: string,
): () => void {
  const fakeScope: SettingsScopeLike = {
    getSnapshot: () => ({ status: 'ready', writable: true }),
    subscribe: () => () => {},
    set: () => Promise.resolve(),
  }
  const controller = new CardController(store, fakeScope, voiceDebug, packs, highlight)
  const zhMode = typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
  const dict = (zhMode ? zh : en) as Record<string, string>
  const t = (key: string, params?: Record<string, unknown>): string => {
    const raw = dict[key] ?? (zh as Record<string, string>)[key] ?? key
    return raw.replace(/\{(\w+)\}/g, (_m, k: string) => String(params?.[k] ?? `{${k}}`))
  }
  const useNiulaiPet = <S,>(selector: (state: NiulaiCardState) => S): S =>
    useSyncExternalStore(controller.observable.subscribe, () => selector(controller.observable.getSnapshot()))
  const face = controller.inject()
  const root = createRoot(container)
  root.render(
    <NiulaiCard
      t={t}
      useNiulaiPet={useNiulaiPet}
      set={face.set}
      setSkinAction={face.setSkinAction}
      voiceDebug={face.voiceDebug}
      packs={face.packs}
      highlight={face.highlight}
      defaultOpen
      initialPet={initialPet}
    />,
  )
  return () => {
    root.unmount()
    controller.dispose()
  }
}
