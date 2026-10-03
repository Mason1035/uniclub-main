/**
 * 桌宠本体：fixed 浮层 + Web Animations 状态机 + 数据驱动皮肤系统。
 *
 * 皮肤（SkinDef）：牛来三皮肤（抠图+真声）、熊猫（翻滚）、蓝鲸（跃出水面）、
 * 奶龙（帧演出大笑）、大狗（张嘴喊）、赛博猫（趴睡图），各带叫声（mp3 或 WebAudio 合成）。
 *  - idle：呼吸 + 随机小跳/踱步/趴睡/扭一扭 + 眨眼，偶尔气泡唠叨
 *  - walk / drag / sleep / fly（含 dive/arc 两种航迹）
 *  - celebrate：任务完成 —— 叫声 + 气泡（受开关/静音约束）+ 事件绑定动作
 *  - 喊叫期间嘴部张合（有张嘴图的皮肤）；2.5~6s 随机眨眼（有闭眼图的皮肤）
 *
 * 交互：点击=戳（喊+绑定动作）；拖拽=换位（localStorage 记忆，按设备）；右键=菜单
 * （声音 / 完成时喊 / 气泡唠叨为胶囊开关；动作与皮肤为循环项；另有飞一圈 /
 * 只喊不跳的喊一声 / 关于面板）。
 * 动作可绑定到事件，「签名」= 跟随当前皮肤的招牌动作，「随机」= 现场抽；
 * 绑定按皮肤记（config.ts 的 ConfigStore：dsh rc.7+ 走 settings scope，
 * 更老版本回退 localStorage），切换皮肤不清空另一皮肤的绑定。
 */

import { ConfigStore, loadPersisted, savePersisted, type Persisted, type PetConfig } from './config.js'
import { startVoiceStop, type VoiceStopHandle } from './voice.js'
import { createKwsMatcher, kwsKeywordsKey } from './kws.js'
import { REPLY_MATCH, REPLY_REF } from './skins.js'
import { impactAt, registerBody } from './physics.js'
import type { VoiceDebugBus } from './voice-debug.js'

/** 叫声：mama=牛来真声 mp3；其余为 WebAudio 合成；null=无声。 */
export type VoiceName = 'mama' | 'moo' | 'whale' | 'squeak' | 'meow' | 'crackle' | 'engine' | 'motor' | 'siren' | null

/** 可绑定到事件的动作。signature=当前皮肤签名动作。 */
export type ActionName =
  | 'signature' | 'fly' | 'dance' | 'spin' | 'hops' | 'roll' | 'breach' | 'sway' | 'split' | 'drive' | 'random'

/** 喊叫动画帧：at = 起始时刻（占喊声全长比例 0..1，升序）；rock = 该帧期间附加倒地摇摆。 */
export interface ShoutFrame {
  src: string
  at: number
  rock?: boolean
}

/** 全局 z 序认领计数器：挂载/抓起/置顶都取号，取过号的永远压过没取的——
 *  抓起过的桌宠松手后仍保持在前（窗口式焦点序），不再是「后挂载恒在上」。 */
let zCounter = 99999

export interface SkinDef {
  id: string
  /** 菜单显示名。 */
  name: string
  /** 站立图（dataurl）。 */
  image: string
  /** 闭眼图（眨眼用，可选）。 */
  imageBlink?: string
  /** 张嘴图（喊叫嘴部张合用，可选）。 */
  imageShout?: string
  /** 喊叫动画帧序列（可选；配置后喊叫不再走「开-合-开」嘴型，改按时间线切帧，如奶龙笑到弯腰/倒地）。 */
  shoutAnim?: ShoutFrame[]
  /** 飞行/俯冲图（fly 动作用，缺省用站立图）。 */
  imageFly?: string
  /** 飞行张嘴图（飞行中喊叫用，可选）。 */
  imageFlyShout?: string
  /** 喷水图（鲸鱼 breach 弧顶喷水，可选）。 */
  imageSpout?: string
  /** 专睡图（可选；配了它打盹换图不压扁——横躺姿态压扁反而怪）。 */
  imageSleep?: string
  /** 警灯甲/乙帧（可选，成对出现；待机时 480ms 交替闪，如警车红蓝警灯）。 */
  imageLampA?: string
  imageLampB?: string
  /** 警灯待机交替开关（默认 true 开；设 false = 平时不闪、仅 drive 时快速交替）。 */
  lampIdle?: boolean
  /** drive 时灯帧快速交替（图片的警灯闪，180ms 翻相位）。 */
  /** drive 期间专属声（如 'siren' 警笛；无则按 voice 拉长做引擎低吼）。 */
  driveSound?: VoiceName
  /** 卷形图（可选；roll 动作专用——犰狳卷成球滚动时换成它，车轮式旋转）。 */
  imageRoll?: string
  /** drive 动作图（可选；开车横穿时换它——如火焰骷髅骑士第二帧狂焰状态，平时用站姿）。 */
  imageDrive?: string
  voice: VoiceName
  /** voice=mama 时的喊声 mp3（dataurl）若干。 */
  sounds?: string[]
  /** 妈妈的回应「牛来！」mp3（dataurl，可选；仅牛来系皮肤有）。 */
  replySound?: string
  /** 签名动作。 */
  signature: ActionName
  /** 喊叫/戳戳气泡文案。 */
  shoutBubble: string
  /** 皮肤专属唠叨语录（与全局语录合并）。 */
  quips?: string[]
  /** 默认显示高度 px（角色包声明；选用该皮肤时大小落到它，用户另行调整优先）。 */
  defaultSize?: number
  /** 默认不透明度 %（角色包声明，20-100；选用该皮肤时透明度落到它，用户另行调整优先；缺省 100）。 */
  defaultOpacity?: number
  /** 默认色相旋转 °（角色包声明，0-360；选用该皮肤时色相落到它，用户另行调整优先；缺省 0=原色）。 */
  defaultHue?: number
  /** 默认流光变色开关（角色包声明；选用该皮肤时自动开，用户另行调整优先；缺省关）。 */
  defaultHueCycle?: boolean
  /** 分裂克隆数（2-6；仅 split 动作，覆盖引擎默认的随机 2-3，如史莱姆王 5 只）。 */
  splitCount?: number
  /** drive 的演出风格：normal 直开 / wheelie 抬前轮 / wiggle 摇头晃脑 / random 每次随机。 */
  driveStyle?: 'normal' | 'wheelie' | 'wiggle' | 'random'
  /** 完成路径专属叫声（doneSounds，mp3 dataurl；如警车警笛——完成时替代普通叫声）。 */
  doneSounds?: string[]
  /** 完成路径专属合成音色（如 'siren' 警笛；优先级 doneVoice → doneSounds → 普通叫声）。 */
  doneVoice?: VoiceName
  /** 完成庆祝光环（可选；幽灵系配置它，任务完成时头顶金环浮现 3.6s；缺省无）。 */
  halo?: boolean
  /** 默认禁止走动（角色包声明；选用该皮肤时走动开关落到 false，用户另行调整优先；缺省走动，适合植物/静物）。 */
  defaultWalkable?: boolean
  /** 果冻体质：落地多段阻尼弹跳（替代单次压扁）+ 走路身体挤压摆动（替代左右倾）。 */
  jelly?: boolean
}

export interface PetAssets {
  skins: SkinDef[]
  defaultSkin: string
  /** 实例 id：'main'（缺省）= 主宠；额外表为各自 id。皮肤/位置按 id 分存。 */
  petId?: string
  /** 额外表的初始 x（无位置记忆时；主宠右侧错位摆开）。 */
  defaultX?: number
  /** 皮肤列表热更新通道（自定义角色包装载/增删时推送新列表；不订阅则静态）。 */
  subscribeSkins?: (fn: (skins: SkinDef[]) => void) => () => void
  /** 皮肤的事件默认绑定（角色包 events 声明；缺省 done=signature / poke=hops）。 */
  defaultActions?: (skinGid: string) => { done: ActionName; poke: ActionName }
  /** 「点预览图高亮」事件通道（设置卡片发，按 petId 认领）。 */
  highlight?: {
    subscribe(fn: (petId: string) => void): () => void
    /** 驻留高亮通道（卡片「当前桌宠」tab 期间持续发光；null=解除）。 */
    subscribeHold?(fn: (petId: string | null) => void): () => void
  }
  /** 强制皮肤/大小（demo 全家福等展示性挂载：绕开配置解析，直接长这样）。 */
  forceSkin?: string
  forceSize?: number
  /** 飞行正常结束（落回原位）时回调——demo「一起飞」靠它在落地瞬间藏宠，零闪烁。 */
  onFlightEnd?: () => void
  /** 提供后右键菜单出现「👪 全家福」项（仅主宠传；插件入口/dsh 侧全家福管理）。 */
  onFamilyToggle?: () => void
  /** 提供后右键「⚙️ 设置」打开悬浮设置面板（插件入口传；缺省气泡指路）。 */
  onOpenSettings?: () => void
}

export interface PetHandle {
  /** 任务完成触发（带节流）。 */
  celebrate(): void
  /** 主动戳一下（喊+绑定动作）。 */
  poke(): void
  /** 飞一圈（demo「一起飞」等宿主 UI 用）。 */
  fly(): void
  /** 导演触发动作（demo 分镜脚本用）：内部直走 runAction，守卫（拖拽/飞行/演出中不叠开）与 poke/celebrate 同源。 */
  act(name: ActionName): void
  /** 只喊不出动作（demo 分镜脚本用：妈妈团一声吼这类只要声音的镜头）。 */
  shout(): void
  /** 立即转身（demo 分镜摆位用）：走 setFacing 统一入口，--face 与 scaleX 不脱钩。 */
  face(dir: 1 | -1): void
  /** 当前位姿（demo 全家福排兵/一起飞起降判定用）。 */
  bounds(): { x: number; y: number; w: number }
  /** 摆位（demo 全家福列队重排用；展示性挂载不写位置记忆）。 */
  place(v: number): void
  /** 显隐（demo 全家福先隐挂载、重排后显形，防列队瞬移闪烁）。 */
  setVisible(v: boolean): void
  /** 钉住：behave 不再随机游走（合影期间主宠占 C 位用）。 */
  setPinned(on: boolean): void
  /** 置顶：压过其他桌宠（合影 C 位不被叠压）；拖拽拎起也走这个档。 */
  setTopmost(on: boolean): void
  /** AI 会话忙闲：忙时传入开始时间戳，闲时传 null（用于耗时气泡）。 */
  setBusy(busy: { since: number; label: string } | null): void
  /** 静音开关（试玩页角标等宿主 UI 用；与宠物菜单的「声音」同源）。 */
  setMuted(m: boolean): void
  isMuted(): boolean
  destroy(): void
}

type Mood = 'idle' | 'walk' | 'drag' | 'celebrate' | 'sleep' | 'fly'

const PET_H = 120 // 默认显示高度 px（实例实际高度 = petH，随配置热改）

/** 叫声时长的兜底值（ms；mp3 元数据预读失败时 playVoice 也回落到它）。
 *  静音时 shout 借它撑演出时序——只有时长语义，不真的出声。 */
const DEFAULT_SHOUT_MS = 2600

/** 随机池（具体动作）。 */
const ACTION_POOL: ActionName[] = ['fly', 'dance', 'spin', 'hops', 'roll', 'breach', 'sway', 'split', 'drive']
/** 动作全序（菜单循环顺序、设置卡片下拉项；合法性唯一围栏，host schema 是 z.string() 不枚举——前向兼容，见 index.js Action 注释）。 */
export const ACTION_ORDER: ActionName[] = ['signature', ...ACTION_POOL, 'random']
const ACTION_LABEL: Record<ActionName, string> = {
  signature: '签名动作', fly: '飞行', dance: '摇摆舞', spin: '转圈', hops: '连跳',
  roll: '翻滚', breach: '跃出水面', sway: '摇摆', split: '分裂', drive: '开过去', random: '随机',
}

/** 全局气泡唠叨语录（与皮肤专属语录合并抽取）。 */
const QUIPS = [
  '哞？',
  '今天也是个写 bug 的好日子',
  '别卷了，起来活动下',
  '我在吃草，你在吃苦',
  '需求又改了？',
  '这代码我看得都着急',
  '喝口水吧',
]

function asAction(v: unknown, fallback: ActionName): ActionName {
  return typeof v === 'string' && (ACTION_ORDER as string[]).includes(v) ? (v as ActionName) : fallback
}

/** 秒 → "1分23秒" / "45秒"。 */
function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}分${s}秒` : `${s}秒`
}

// ---- WebAudio 合成叫声（零素材、程序合成）----
let actx: AudioContext | null = null
/** 叫声时长全局缓存（mp3 元数据预读，嘴型/气泡撑满长尾音用）：所有宠物实例共享——
 *  否则每只各自全量探测（N 宠 × M 声个 Audio 探针），多宠场景撞 Chromium
 *  WebMediaPlayer 上限（≈75），探针被静默拦截、时长全丢（30 只合影冒烟踩过）。 */
const soundDur = new Map<string, number>()
function audioCtx(): AudioContext | null {
  try {
    if (actx === null) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AC === undefined) return null
      actx = new AC()
    }
    if (actx.state === 'suspended') void actx.resume()
    return actx
  } catch {
    return null
  }
}

/** 哞——：锯齿波下滑 + 低频震颤 + 低通。 */
let volNode: GainNode | null = null
/** 主音量节点（0-100 配置 → gain）；合成音都接它而不直连 destination。 */
function volDest(ctx: AudioContext): AudioNode {
  if (volNode === null) {
    volNode = ctx.createGain()
    volNode.connect(ctx.destination)
  }
  volNode.gain.value = masterVolume / 100
  return volNode
}

/** 主音量镜像（pet.ts 内 playVoice/playReply 直接读；syncConfig 里同步）。 */
let masterVolume = 100

function synthMoo(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(150, t0)
  osc.frequency.exponentialRampToValueAtTime(92, t0 + 0.75)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 5.5
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 9
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 460
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.09)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9)
  osc.connect(lp); lp.connect(g); g.connect(volDest(ctx))
  osc.start(t0); lfo.start(t0)
  osc.stop(t0 + 0.95); lfo.stop(t0 + 0.95)
}

/** 鲸鸣：正弦长音先扬后抑 + 慢颤音。 */
function synthWhale(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(210, t0)
  osc.frequency.exponentialRampToValueAtTime(430, t0 + 0.5)
  osc.frequency.exponentialRampToValueAtTime(120, t0 + 1.5)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 3
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 22
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6)
  osc.connect(lp); lp.connect(g); g.connect(volDest(ctx))
  osc.start(t0); lfo.start(t0)
  osc.stop(t0 + 1.65); lfo.stop(t0 + 1.65)
}

/** 熊猫吱声：两声短促三角波上挑。 */
function synthSqueak(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  for (const off of [0, 0.22]) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(950, t0 + off)
    osc.frequency.exponentialRampToValueAtTime(1500, t0 + off + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0 + off)
    g.gain.exponentialRampToValueAtTime(0.2, t0 + off + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.16)
    osc.connect(g); g.connect(volDest(ctx))
    osc.start(t0 + off); osc.stop(t0 + off + 0.18)
  }
}

/** 喵——：锯齿波两段滑音（mi-ao 先扬后抑）+ 轻颤音 + 带通。 */
function synthMeow(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(520, t0)
  osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.22)
  osc.frequency.exponentialRampToValueAtTime(360, t0 + 0.68)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 7
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 12
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1100
  bp.Q.value = 0.8
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.26, t0 + 0.06)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75)
  osc.connect(bp); bp.connect(g); g.connect(volDest(ctx))
  osc.start(t0); lfo.start(t0)
  osc.stop(t0 + 0.8); lfo.stop(t0 + 0.8)
}

/** 落地/碰撞闷响「咚」：低频正弦骤降 + 快衰减；strength 0-1 控峰值。 */
function synthThud(ctx: AudioContext, strength: number): void {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(110, t0)
  osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.1)
  const g = ctx.createGain()
  const peak = 0.22 * Math.max(0.15, Math.min(1, strength))
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
  osc.connect(g); g.connect(volDest(ctx))
  osc.start(t0); osc.stop(t0 + 0.18)
}

/** 果冻落地「啵嘤」：中频正弦快速下滑后小回弹（duang 感）；strength 0-1 控峰值。 */
function synthBoing(ctx: AudioContext, strength: number): void {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(320, t0)
  osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.09)
  osc.frequency.exponentialRampToValueAtTime(190, t0 + 0.16)
  osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.28)
  const g = ctx.createGain()
  const peak = 0.2 * Math.max(0.15, Math.min(1, strength))
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.014)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3)
  osc.connect(g); g.connect(volDest(ctx))
  osc.start(t0); osc.stop(t0 + 0.32)
}

/** 火焰噼啪（熔岩史莱姆）：白噪低嘶底 + 随机噼啪爆点，暖烘烘的。 */
function synthCrackle(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  const dur = 0.7
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 900
  bp.Q.value = 0.6
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(bp); bp.connect(g); g.connect(volDest(ctx))
  src.start(t0); src.stop(t0 + dur)
  for (let i = 0; i < 7; i++) {
    const at = t0 + Math.random() * 0.45
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(1600 + Math.random() * 1600, at)
    osc.frequency.exponentialRampToValueAtTime(280, at + 0.045)
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0.0001, at)
    g2.gain.exponentialRampToValueAtTime(0.09, at + 0.004)
    g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
    osc.connect(g2); g2.connect(volDest(ctx))
    osc.start(at); osc.stop(at + 0.06)
  }
}

/** 引擎低吼（警车）：锯齿+方波双层，转速上拉后回落；durS 可传（drive 全程版随驾驶时长）。 */
/** 轿车/警车引擎：怠速「突突」点火感 → 中低转拉上 → 快放油回落。
 *  四冲程节奏感靠怠速段 22Hz 方波门控音量（突突突），转速上来后门控淡出变连续轰鸣；
 *  双失谐锯齿主腔 + 方波亚谐 + 随转速爬升的排气噪声。durS 可传 drive 全程版。 */
function synthEngine(ctx: AudioContext, durS = 0.95): void {
  const t0 = ctx.currentTime
  const dur = durS
  // 转速曲线：怠速 78Hz 微颤 → 中段拉到 150Hz → 放油落回 100Hz
  const pts = 100
  const fCurve = new Float32Array(pts)
  for (let i = 0; i < pts; i++) {
    const t = i / (pts - 1)
    if (t < 0.55) fCurve[i] = 78 + Math.pow(t / 0.55, 1.3) * 78 + Math.sin(t * 90) * 2.5
    else if (t < 0.85) fCurve[i] = 156 - ((t - 0.55) / 0.3) * 48
    else fCurve[i] = 108 - ((t - 0.85) / 0.15) * 6 + Math.sin(t * 60) * 2
  }
  const out = ctx.createGain()
  const attach = (type: OscillatorType, vol: number, mul: number, lpHz: number): void => {
    const osc = ctx.createOscillator()
    osc.type = type
    // 曲线起点现取（取 t0 与现取的大者）：t0 经过重活（噪声缓冲填充/GC 停顿）可能已过期，
    // Chrome 会把过期起点钳到当前时刻、有效终点随之后移，按旧 t0 算的「钉末值」锚点
    // 会落进曲线区间抛 NotSupportedError（30 只合影冒烟踩过）。+0.01 再躲终点渲染量子取整。
    const ts = Math.max(t0, ctx.currentTime)
    osc.frequency.setValueAtTime(78 * mul, ts)
    osc.frequency.setValueCurveAtTime(fCurve, ts, dur)
    osc.frequency.setValueAtTime(102 * mul, ts + dur + 0.01) // 钉住末值防回跳
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = lpHz
    const g = ctx.createGain()
    g.gain.value = vol
    osc.connect(lp); lp.connect(g); g.connect(out)
    osc.start(ts); osc.stop(ts + dur + 0.15)
  }
  attach('sawtooth', 0.3, 1, 650)      // 主腔
  attach('sawtooth', 0.14, 1.018, 750) // 失谐第二嗓（缸体感）
  attach('square', 0.16, 0.5, 300)     // 低吼亚谐
  attach('square', 0.05, 2.0, 1500)    // 机械噪（中低幅不清亮）
  // 排气破音：带通随转速爬升
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.9
  const nlp = ctx.createBiquadFilter()
  nlp.type = 'lowpass'
  nlp.frequency.value = 500
  bp.frequency.value = 160
  const nGain = ctx.createGain()
  nGain.gain.value = 0.42
  noise.connect(bp); bp.connect(nlp); nlp.connect(nGain); nGain.connect(out)
  noise.start(t0); noise.stop(t0 + dur + 0.15)
  // 怠速段突突门控：22Hz 方波 AM，随转速上拉淡出（>0.55 后门控为常开）
  const gate = ctx.createGain()
  gate.gain.setValueAtTime(1, t0)
  const gateOsc = ctx.createOscillator()
  gateOsc.type = 'square'
  // 22Hz → 0.55 处频率不动但幅度衰减到 0（门控深度：1→0）
  const gateDepth = ctx.createGain()
  gateDepth.gain.setValueAtTime(0.55, t0)
  gateDepth.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5 * dur)
  gateOsc.frequency.value = 22
  gateOsc.connect(gateDepth); gateDepth.connect(gate.gain)
  gate.gain.value = 1 - 0.0 // 直流分量 1，深度控制脉冲成分
  out.connect(gate); gate.connect(volDest(ctx))
  gateOsc.start(t0); gateOsc.stop(t0 + dur + 0.15)
  // 总包络：起音 → 保持 → 放油 → 归零
  out.gain.setValueAtTime(0, t0)
  out.gain.linearRampToValueAtTime(0.4, t0 + 0.1 * dur)
  out.gain.setValueAtTime(0.4, t0 + 0.55 * dur)
  out.gain.linearRampToValueAtTime(0.15, t0 + 0.82 * dur)
  out.gain.linearRampToValueAtTime(0.04, t0 + 0.92 * dur)
  out.gain.linearRampToValueAtTime(0, t0 + dur)
}

/** 摩托高转（炸街）：怠速突突 → 双缸咆哮上拉 → 快放油（转速+音量同跌）→ 短怠速尾。
 *  durS 可传：drive 全程版随驾驶时长拉伸（到停车才泄油）。 */
function synthMotor(ctx: AudioContext, durS = 1.1): void {
  const dur = durS
  // 排气噪声缓冲先建先填：十几万个样本的随机填充要几毫秒，而 audio 时钟不等人——
  // 若先取 t0 再填，t0 已过期：curve 起始被钳到当前时刻、有效终点反而晚于 t0+dur，
  // 「钉住末值」的 setValueAtTime(t0+dur) 落进曲线区间直接抛 NotSupportedError（踩过）。
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const t0 = ctx.currentTime
  // 转速曲线：（0-0.62）拉起 85→290Hz，（0.62-0.8）快速放油→135，（0.8-1）怠速微颤回落
  const fCurve = new Float32Array(120)
  for (let i = 0; i < 120; i++) {
    const t = i / 119
    if (t < 0.62) fCurve[i] = 85 + Math.pow(t / 0.62, 1.6) * 205
    else if (t < 0.8) fCurve[i] = 290 - ((t - 0.62) / 0.18) * 155
    else fCurve[i] = 135 - ((t - 0.8) / 0.2) * 12 + Math.sin(t * 40) * 3
  }
  const out = ctx.createGain()
  const attach = (type: OscillatorType, vol: number, mul: number, lpHz: number): void => {
    const osc = ctx.createOscillator()
    osc.type = type
    // 曲线起点现取（同 synthEngine）：GC 停顿也会让 t0 过期，钳位后移会把按旧 t0 算的
    // 锚点吞进曲线区间抛 NotSupportedError；+0.01 再躲终点渲染量子取整。
    const ts = Math.max(t0, ctx.currentTime)
    osc.frequency.setValueAtTime(85 * mul, ts)
    osc.frequency.setValueCurveAtTime(fCurve, ts, dur)
    // 曲线终点钉住末值——不钉会被后面的 setValueAtTime(起始值) 接管，尾端闪一下音高回跳（踩过）。
    osc.frequency.setValueAtTime(135 * mul, ts + dur + 0.01)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = lpHz
    const g = ctx.createGain()
    g.gain.value = vol
    osc.connect(lp); lp.connect(g); g.connect(out)
    osc.start(ts); osc.stop(ts + dur + 0.15)
  }
  attach('sawtooth', 0.34, 1, 900)      // 主腔（四冲程）
  attach('square', 0.2, 0.5, 400)       // 低吼亚谐
  attach('sawtooth', 0.12, 1.012, 1400) // 失谐第二嗓（双缸感）
  attach('square', 0.06, 2.0, 2600)     // 高转啸
  // 排气破音：白噪带通随转速上追回落（炸街的灵魂；缓冲在函数头已建好）
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.1
  const bpCurve = new Float32Array(60)
  for (let i = 0; i < 60; i++) {
    const t = i / 59
    if (t < 0.62) bpCurve[i] = 550 + Math.pow(t / 0.62, 1.5) * 1600
    else bpCurve[i] = 2150 - ((t - 0.62) / 0.38) * 1500
  }
  const tsb = Math.max(t0, ctx.currentTime) // 同 attach：钳位漂移防护
  bp.frequency.setValueCurveAtTime(bpCurve, tsb, dur)
  bp.frequency.setValueAtTime(650, tsb + dur + 0.01) // 同上：钉住不回跳；+0.01 躲开曲线终点的渲染量子取整
  // 排气噪声连续（拍板：连续版，不做断续门控）：带通随转速爬升，持续「呼——」的排气声
  const nGain = ctx.createGain()
  nGain.gain.value = 0.5
  noise.connect(bp); bp.connect(nGain); nGain.connect(out)
  noise.start(t0); noise.stop(t0 + dur + 0.15)
  // 总包络：音头起 → 咆哮保持 → 快放油 → 短怠速尾 → 精确归零（源头停时增益已是 0；
  // 时点按 durS 等比缩放：0.6/0.82/0.91/1.0）
  out.connect(volDest(ctx))
  out.gain.setValueAtTime(0, t0)
  out.gain.linearRampToValueAtTime(0.42, t0 + 0.09 * dur)
  out.gain.setValueAtTime(0.42, t0 + 0.6 * dur)
  out.gain.linearRampToValueAtTime(0.16, t0 + 0.82 * dur)
  out.gain.linearRampToValueAtTime(0.05, t0 + 0.91 * dur)
  out.gain.linearRampToValueAtTime(0, t0 + dur)
}

/** 装甲球滚过**木板**（犰狳卷球签名）：物理玩具声而非电子合成——
 *  1) 木板条接缝撞击：正弦短促衰减的「咚」（空心木板共振，~160-240Hz 非固定，
 *     每格接缝一响，节拍随滚动快慢）；
 *  2) 木腔嗡鸣：白噪过窄带通（低频木箱共鸣）+ 慢速音量起伏；
 *  3) 木质摩擦：轻微低通噪声（板面磨砂感）。durS 可传（随卷球时长）。 */
function synthRoll(ctx: AudioContext, durS = 3.6): void {
  const t0 = ctx.currentTime
  const dur = durS
  const out = ctx.createGain()
  // 总包络：起势 → 巡航 → 减速收尾
  out.gain.setValueAtTime(0, t0)
  out.gain.linearRampToValueAtTime(0.5, t0 + 0.1 * dur)
  out.gain.setValueAtTime(0.5, t0 + 0.72 * dur)
  out.gain.linearRampToValueAtTime(0.12, t0 + 0.9 * dur)
  out.gain.linearRampToValueAtTime(0, t0 + dur)
  out.connect(volDest(ctx))

  // 1) 木板条接缝「咚」：正弦短衰减（木头空心共振，不敲出金属感）
  const HITS = Math.max(10, Math.floor(dur / 0.16))
  for (let i = 0; i < HITS; i++) {
    const at = t0 + (i / HITS) * dur + (Math.random() * 0.02 - 0.01) // 微抖动：天然不齐
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    // 板条厚度不一 → 共振频率微变：160~240Hz 随机 + 慢漂移
    const base = 160 + Math.random() * 80
    osc.frequency.setValueAtTime(base, at)
    osc.frequency.exponentialRampToValueAtTime(base * 0.72, at + 0.09)
    const g = ctx.createGain()
    // 响度随滚动进度起伏（前后轻、中段重），幅度抖动
    const env = 0.3 * Math.sin(Math.min(1, (i / HITS) * 1.4) * Math.PI) + 0.06
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(env * (0.8 + Math.random() * 0.4), at + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
    osc.connect(g); g.connect(out)
    osc.start(at); osc.stop(at + 0.14)
  }

  // 2) 木腔嗡鸣：白噪 → 窄带通（低频木箱共鸣 ~120Hz）→ 音量呼吸
  const bbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const bd = bbuf.getChannelData(0)
  for (let i = 0; i < bd.length; i++) bd[i] = Math.random() * 2 - 1
  const bnoise = ctx.createBufferSource()
  bnoise.buffer = bbuf
  const bbp = ctx.createBiquadFilter()
  bbp.type = 'bandpass'
  bbp.Q.value = 2.2 // 窄：木质腔体共鸣，不是空气噪声
  bbp.frequency.value = 120
  const bg = ctx.createGain()
  bg.gain.value = 0.28
  const bLfo = ctx.createOscillator()
  bLfo.type = 'sine'
  bLfo.frequency.value = 1 / 0.9 // 0.9s 一圈翻身呼吸
  const bDepth = ctx.createGain()
  bDepth.gain.value = 0.12
  bLfo.connect(bDepth); bDepth.connect(bg.gain)
  bnoise.connect(bbp); bbp.connect(bg); bg.connect(out)

  // 3) 木质摩擦：白噪 → 宽低通（板面磨砂感，不用带通——那是"沙沙"高频扫尘）
  const fbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const fd = fbuf.getChannelData(0)
  for (let i = 0; i < fd.length; i++) fd[i] = Math.random() * 2 - 1
  const fnoise = ctx.createBufferSource()
  fnoise.buffer = fbuf
  const flp = ctx.createBiquadFilter()
  flp.type = 'lowpass'
  flp.frequency.value = 300
  const fg = ctx.createGain()
  fg.gain.value = 0.1
  fnoise.connect(flp); flp.connect(fg); fg.connect(out)

  bnoise.start(t0); bnoise.stop(t0 + dur + 0.1)
  bLfo.start(t0); bLfo.stop(t0 + dur + 0.1)
  fnoise.start(t0); fnoise.stop(t0 + dur + 0.1)
}

/** 警笛：中式「嘀-呜」高低转调滑音（阶梯式，非连续摆）。高音段≈880Hz 0.30s →
 *  0.05s 快速下滑至 620Hz 低音段 0.34s → 0.05s 回滑 880Hz，5 轮≈3.7s。
 *  音色：方波+锯齿混合带通眯啸（电子警报器），轻颤音，包络整条渐变不爆音。 */
function synthSiren(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  const HI = 880, LO = 620
  const HI_D = 0.30, LO_D = 0.34, GLIDE = 0.05
  const ROUNDS = 5
  const dur = ROUNDS * (HI_D + LO_D + 2 * GLIDE) // ≈3.7s
  // 音高曲线：阶梯+快速滑音，120 点采样
  const pts = 160
  const curve = new Float32Array(pts)
  const period = HI_D + LO_D + 2 * GLIDE
  for (let i = 0; i < pts; i++) {
    const t = (i / (pts - 1)) * ROUNDS * period
    const ph = t % period
    if (ph < HI_D) curve[i] = HI
    else if (ph < HI_D + GLIDE) {
      const k = (ph - HI_D) / GLIDE
      curve[i] = HI - (HI - LO) * (k * k * (3 - 2 * k)) // smoothstep 滑落
    } else if (ph < HI_D + GLIDE + LO_D) curve[i] = LO
    else {
      const k = (ph - HI_D - GLIDE - LO_D) / GLIDE
      curve[i] = LO + (HI - LO) * (k * k * (3 - 2 * k)) // smoothstep 回升
    }
  }
  const osc = ctx.createOscillator()
  osc.type = 'square'
  const ts = Math.max(t0, ctx.currentTime) // 曲线起点现取（钳位漂移防护，见 synthEngine 注）
  osc.frequency.setValueAtTime(HI, ts)
  osc.frequency.setValueCurveAtTime(curve, ts, dur)
  osc.frequency.setValueAtTime(LO, ts + dur + 0.01) // 钉住末值（+0.01 躲曲线终点渲染量子取整）
  const osc2 = ctx.createOscillator()
  osc2.type = 'sawtooth'
  osc2.frequency.setValueAtTime(HI, ts)
  osc2.frequency.setValueCurveAtTime(curve, ts, dur)
  osc2.frequency.setValueAtTime(LO, ts + dur + 0.01)
  const lp = ctx.createBiquadFilter()
  lp.type = 'bandpass'
  lp.frequency.value = 1400
  lp.Q.value = 0.55
  const lp2 = ctx.createBiquadFilter()
  lp2.type = 'lowpass'
  lp2.frequency.value = 3800
  const gO = ctx.createGain()
  gO.gain.value = 0.075
  const g2O = ctx.createGain()
  g2O.gain.value = 0.04
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 6
  const lfoG = ctx.createGain()
  lfoG.gain.value = 4.5
  lfo.connect(lfoG); lfoG.connect(osc.frequency)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(0.16, t0 + 0.06)
  env.gain.setValueAtTime(0.16, t0 + dur - 0.3)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gO); gO.connect(lp)
  osc2.connect(g2O); g2O.connect(lp)
  lp.connect(lp2); lp2.connect(env); env.connect(volDest(ctx))
  osc.start(t0); osc2.start(t0); lfo.start(t0)
  osc.stop(t0 + dur + 0.05); osc2.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05)
}

export function mountPet(assets: PetAssets, store?: ConfigStore, voiceDebug?: VoiceDebugBus): PetHandle {
  let skins = assets.skins.length > 0
    ? assets.skins
    : [{ id: 'fallback', name: '桌宠', image: '', voice: null, signature: 'hops' as ActionName, shoutBubble: '' }]
  const skinIds = (): string[] => skins.map((s) => s.id)
  // 行为配置统一走 ConfigStore（localStorage / dsh settings scope 双后端）；
  // 下方局部变量只是它的快照镜像，写一律经 config.set / config.setSkinAction
  const config = store ?? new ConfigStore({ skinIds: skinIds(), defaultSkin: assets.defaultSkin })
  /** 位置 x 的文档读写（按设备，永远 localStorage；行为键不归这里管）。 */
  const loadDoc = (): Persisted => loadPersisted(skinIds(), assets.defaultSkin)
  const findSkin = (id: string | undefined): SkinDef =>
    skins.find((s) => s.id === id) ?? skins[0]
  /** 本宠 id（'main'=主宠；额外表按 id 分存皮肤与位置）。 */
  const petId = assets.petId ?? 'main'
  /** 本宠皮肤 id：forceSkin（展示性挂载）最优先；主宠读全局 skin；额外表读各自条目（缺条目回全局）。 */
  const mySkinId = (c: PetConfig): string =>
    assets.forceSkin ?? (petId === 'main' ? c.skin : (c.extraPets.find((p) => p.id === petId)?.skin ?? c.skin))
  /** 本宠大小：forceSize 最优先；主宠读 petSize；额外表读各自条目 size（缺省回 petSize）。 */
  const mySize = (c: PetConfig): number =>
    assets.forceSize ?? (petId === 'main' ? c.petSize : (c.extraPets.find((p) => p.id === petId)?.size ?? c.petSize))
  /** 本宠色相：主宠读 petHue；额外表读各自条目 hue（缺省回皮肤包声明的默认，再缺省 0=原色）。 */
  const myHue = (c: PetConfig): number =>
    petId === 'main'
      ? c.petHue
      : (c.extraPets.find((p) => p.id === petId)?.hue
          ?? skins.find((s) => s.id === mySkinId(c))?.defaultHue ?? 0)
  /** 本宠流光变色开关：主宠读 petHueCycle；额外表读各自条目（缺省回皮肤包声明，再缺省 false）。 */
  const myHueCycle = (c: PetConfig): boolean =>
    petId === 'main'
      ? c.petHueCycle
      : (c.extraPets.find((p) => p.id === petId)?.hueCycle
          ?? skins.find((s) => s.id === mySkinId(c))?.defaultHueCycle ?? false)
  /** 本宠不透明度：主宠读 petOpacity；额外表读各自条目 opacity（缺省回皮肤包声明的默认，再缺省 100）。 */
  const myOpacity = (c: PetConfig): number =>
    petId === 'main'
      ? c.petOpacity
      : (c.extraPets.find((p) => p.id === petId)?.opacity
          ?? skins.find((s) => s.id === mySkinId(c))?.defaultOpacity ?? 100)
  /** 本宠走动开关：主宠读全局 walkEnabled；额外表读各自条目（缺省回全局开关）。
   *  皮肤包的 defaultWalkable 在换肤时落到这些字段上（card.tsx/pet.ts 换肤处理）。 */
  const myWalkOn = (c: PetConfig): boolean =>
    petId === 'main'
      ? c.walkEnabled
      : (c.extraPets.find((p) => p.id === petId)?.walkEnabled ?? c.walkEnabled)
  /** 写本宠皮肤：主宠写全局 skin；额外表读-改-写自己的条目。
   *  换皮肤时大小/不透明度/色相/走动落到新皮肤的默认（用户之后再调优先；皮肤高矮质感颜色是外观固有属性）。 */
  const setMySkin = (skin: string): void => {
    const def = skins.find((s) => s.id === skin)
    const size = def?.defaultSize ?? 120
    const opacity = def?.defaultOpacity ?? 100
    const hue = def?.defaultHue ?? 0
    const hueCycle = def?.defaultHueCycle ?? false
    const walkEnabled = def?.defaultWalkable ?? true
    if (petId === 'main') {
      config.set({ skin, petSize: size, petOpacity: opacity, petHue: hue, petHueCycle: hueCycle, walkEnabled })
      return
    }
    const list = config.getSnapshot().extraPets.map((p) => p.id === petId ? { ...p, skin, size, opacity, hue, hueCycle, walkEnabled } : p)
    config.set({ extraPets: list })
  }
  /** 写本宠色相：主宠写 petHue；额外表读-改-写自己的条目。 */
  const setMyHue = (v: number): void => {
    if (petId === 'main') {
      config.set({ petHue: v })
      return
    }
    config.set({ extraPets: config.getSnapshot().extraPets.map((p) => p.id === petId ? { ...p, hue: v } : p) })
  }
  /** 写本宠不透明度：主宠写 petOpacity；额外表读-改-写自己的条目。 */
  const setMyOpacity = (v: number): void => {
    if (petId === 'main') {
      config.set({ petOpacity: v })
      return
    }
    config.set({ extraPets: config.getSnapshot().extraPets.map((p) => p.id === petId ? { ...p, opacity: v } : p) })
  }
  /** 写本宠大小：主宠写 petSize；额外表读-改-写自己的条目。 */
  const setMySize = (v: number): void => {
    if (petId === 'main') {
      config.set({ petSize: v })
      return
    }
    config.set({ extraPets: config.getSnapshot().extraPets.map((p) => p.id === petId ? { ...p, size: v } : p) })
  }
  /** 本宠位置 x：主宠用 x 键；额外表用 xByPet[petId]（都无记忆时按 defaultX 错位）。
   *  展示性挂载（forceSkin，demo 全家福）不读不写位置记忆——列队位置由 demo 排。 */
  const demoDoll = assets.forceSkin !== undefined
  const loadMyX = (): number | undefined => {
    if (demoDoll) return undefined
    const doc = loadDoc()
    return petId === 'main' ? doc.x : doc.xByPet?.[petId]
  }
  const saveMyX = (v: number): void => {
    if (demoDoll) return
    const doc = loadDoc()
    if (petId === 'main') savePersisted({ ...doc, x: v })
    else savePersisted({ ...doc, xByPet: { ...doc.xByPet, [petId]: v } })
  }
  const initCfg = config.getSnapshot()
  let petH = mySize(initCfg)
  let petHue = myHue(initCfg)
  let petOpacity = myOpacity(initCfg)
  /** 流光变色：开关镜像 + 相位（配置色相作基底色，相位在其上滚动；纯显示不落盘）。 */
  let hueCycleOn = myHueCycle(initCfg)
  let cyclePhase = 0
  /** 睡眠压暗态（applyImgFilter 合成用）。 */
  let dimmed = false
  let skin: SkinDef = findSkin(mySkinId(initCfg))
  let muted = initCfg.muted
  let shoutOnDone = initCfg.shoutOnDone
  let customSoundOn = initCfg.customSoundOn
  let customSound = initCfg.customSound
  let talkative = initCfg.talkative
  let shoutCount = initCfg.shoutCount
  let doneDelaySec = initCfg.doneDelaySec
  let shoutLoopOn = initCfg.shoutLoop
  let replyOn = initCfg.replyNiulai
  let sleepOn = initCfg.sleepEnabled
  let walkOn = myWalkOn(initCfg)
  let groundOff = initCfg.groundOffset
  let physicsOn = initCfg.physics
  let heatOn = initCfg.heatEnabled
  let hiddenAll = initCfg.hidden
  masterVolume = initCfg.volume
  /** 配置音量镜像（syncConfig 与之比较判变；不被菜单 preview 污染）。 */
  let configVolume = initCfg.volume
  let voiceControlOn = initCfg.voiceControl
  let micDeviceId = initCfg.micDeviceId
  let voiceThreshold = initCfg.voiceThreshold
  let voiceTemplate = initCfg.voiceTemplate
  let voiceEngine = initCfg.voiceEngine
  let voiceKeywords = initCfg.voiceKeywords
  let micGain = initCfg.micGain
  let mood: Mood = 'idle'
  /** 动作代际：每次 runAction 成立新代；被 poke 顶掉（放行重开）的旧代
   *   done 回调凭代际判死，不得抢新动作的 mood/收尾（踩过：旧滚的 done 把
   *   新滚的 mood 清回 idle，新滚 step 见 mood 不符即死、rotate 被清——球图
   *   还在但平移不转）。 */
  let actionGen = 0
  let destroyed = false
  /** 钉住中（合影 C 位）：behave 不随机游走。 */
  let pinned = false
  let busyInfo: { since: number; label: string } | null = null

  const cur = (): SkinDef => skin
  /** 喊声播放中（含尾音保持）：sleep 压扁变暗、眨眼都要让位。声明提前：skinIdle 在挂载期被调用。 */
  let shouting = false
  /** 循环喊间隙：演出帧还在滚放——眨眼/sleep 同样不许碰 img.src。声明提前同上。 */
  let animRolling = false
  /** 卷形滚动中（犰狳 roll 换球图；mouthShut 让位用）。 */
  let rollingBall = false
  /** 开车横穿中（imageDrive 换图；mouthShut 让位用——否则喊叫计时器 240ms 把开车图踩回站姿）。 */
  let driving = false
  /** 警灯相位：有 lampA/lampB 的皮肤（警车）待机交替闪。 */
  let lampOn = false
  const skinIdle = (): string => {
    const s = skin
    if (s.imageLampA !== undefined && s.imageLampB !== undefined && !shouting && !animRolling) {
      return lampOn ? s.imageLampA : s.imageLampB
    }
    return s.image
  }
  const skinShout = (): string => skin.imageShout ?? skin.image
  // 趴睡常态皮肤（赛博猫）：常态图就是专睡图，喊叫切站立图
  const isLaydown = (): boolean => {
    const s = cur()
    return s.imageSleep !== undefined && s.imageSleep === s.image && s.imageShout !== undefined
  }

  // ---- DOM ----
  const root = document.createElement('div')
  root.style.cssText = [
    'position:fixed', `bottom:${groundOff}px`, 'left:0', `height:${petH}px`,
    'display:flex', 'flex-direction:column', 'justify-content:flex-end',
    'z-index:99999', 'user-select:none', '-webkit-user-select:none',
    'touch-action:none', 'cursor:grab', 'filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))',
  ].join(';')
  /** 本宠当前 z 号（认领制，见 zCounter）。 */
  let myZ = ++zCounter
  root.style.zIndex = String(myZ)

  const img = document.createElement('img')
  img.src = skinIdle()
  img.draggable = false
  img.style.cssText = `height:${petH}px;display:block;position:relative;transform-origin:50% 100%;pointer-events:none`
  // 红温剪影层：当前图作 alpha 蒙版盖红（mix-blend-mode:color 只换色相保明暗——
  // 蓝皮滤镜拉不红，靠它变成有层次的"真红"而非平红膜）；
  // 蒙版在 cycleTimer 拍里跟随 img.src（最多 90ms 滞后），透明度 = 火气
  const heatLayer = document.createElement('div')
  heatLayer.style.cssText = [
    'position:absolute', 'inset:0', 'pointer-events:none', 'opacity:0',
    'background:rgb(255,60,45)', 'mix-blend-mode:color',
    '-webkit-mask-repeat:no-repeat', 'mask-repeat:no-repeat',
    '-webkit-mask-position:bottom center', 'mask-position:bottom center',
    '-webkit-mask-size:auto 100%', 'mask-size:auto 100%',
  ].join(';')
  /** 红温值 0~1（连戳积累，缓慢消退；applyImgFilter 合成用）。 */
  let heat = 0
  /** 红温爆发中（不理人窗口）。 */
  let raging = false
  /** 合成 img 滤镜：色相旋转（流光开时 = 基底色 + 滚动相位）+ 不透明度 + 红温 + 睡眠压暗。 */
  const applyImgFilter = (): void => {
    const parts: string[] = []
    const effHue = hueCycleOn ? Math.round((petHue + cyclePhase) % 360) : petHue
    if (effHue !== 0) parts.push(`hue-rotate(${effHue}deg)`)
    if (petOpacity !== 100) parts.push(`opacity(${petOpacity}%)`)
    // 忍耐期：heat≤0.45 不显红（前 3 戳像在忍），之后线性到满红
    const dHeat = Math.max(0, (heat - 0.45) / 0.55)
    if (dHeat > 0.02) {
      // 红温：轻度暖化 + 红色辉光（真变红靠 heatLayer 剪影层，见下）
      parts.push(`sepia(${(0.25 * dHeat).toFixed(2)})`)
      parts.push(`saturate(${(1 + 0.8 * dHeat).toFixed(2)})`)
      parts.push(`drop-shadow(0 0 ${Math.round(4 + dHeat * 12)}px rgba(255,70,45,${(0.3 + 0.55 * dHeat).toFixed(2)}))`)
    }
    if (dimmed) parts.push('brightness(.82)')
    img.style.filter = parts.join(' ')
    // 蒙版必须与透明度同帧装上（否则闪整块没剪形的红板），且几何要跟随 img 实时
    // 高/左偏（shoutAnim 倒地宽帧会改 img.height/left——不跟就留一个站高红影子在原地）
    if (dHeat > 0.02) {
      const maskSrc = `url("${img.src}")`
      if (heatLayer.style.webkitMaskImage !== maskSrc) {
        heatLayer.style.webkitMaskImage = maskSrc
        heatLayer.style.maskImage = maskSrc
      }
      const mh = img.style.height || '100%'
      const ml = img.style.left || '0px'
      heatLayer.style.webkitMaskSize = `auto ${mh}`
      heatLayer.style.maskSize = `auto ${mh}`
      heatLayer.style.webkitMaskPosition = `${ml} bottom`
      heatLayer.style.maskPosition = `${ml} bottom`
    }
    heatLayer.style.opacity = String(Math.min(0.5, dHeat * 0.55).toFixed(2))
  }
  applyImgFilter()
  // 流光相位推进 + 红温消退共用一拍：90ms；红温 ~15s 才凉透一半（长演出角色也看得见红）
  const cycleTimer = window.setInterval(() => {
    if (destroyed) return
    if (hueCycleOn) {
      cyclePhase = (cyclePhase + 1.5) % 360
      applyImgFilter()
    }
    if (heat > 0) {
      if (!raging) {
        heat = Math.max(0, heat - 0.003)
        applyImgFilter()
      }
    }
  }, 90)
  // 警灯交替：有 lampA/lampB 的皮肤（警车）480ms 翻相位；喊叫/演出期不动 src
  const lampTimer = window.setInterval(() => {
    if (destroyed) return
    const s = cur()
    if (s.imageLampA === undefined || s.imageLampB === undefined || s.lampIdle === false) return
    lampOn = !lampOn
    if ((mood === 'idle' || mood === 'walk') && !shouting && !animRolling) {
      img.src = skinIdle()
    }
  }, 480)

  // ---- 连戳红温：连续戳积累火气（每戳 +0.3，平时缓慢消退），满格爆发一次：
  // 哼一句 + 扭头背过去 + 4s 气头冷却（期间戳也白戳、不积新火）。
  // 爆发**不清火**——旧火按原速自然消退（慢慢退红，不是瞬间变脸）。 ----
  let rageCooldownUntil = 0
  const rage = async (): Promise<void> => {
    raging = true
    rageCooldownUntil = Date.now() + 4000
    showBubble('再戳我急了！', 2200)
    setFacing(facing === 1 ? -1 : 1) // 扭头背过去
    await img.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-6deg)' },
        { transform: 'rotate(5deg)' },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 520, easing: 'ease-in-out' },
    ).finished.catch(() => {})
    raging = false
  }
  /** 积火气（+0.15/戳，快戳 7 下点爆；heat≤0.45 为忍耐期不显红）；返回 true = 点爆了。 */
  const addHeat = (): boolean => {
    if (Date.now() < rageCooldownUntil) return false // 气头上：戳也白戳
    heat = Math.min(1, heat + 0.15)
    applyImgFilter()
    if (heat >= 1 && !raging) { void rage(); return true }
    return false
  }

  const bubble = document.createElement('div')
  // --pop 控制显隐缩放（外层，0.18s 过渡）；反镜像放到内层文字 span（无过渡、瞬时生效）——
  // 混合在同一 transform 里时，朝向翻转会让 scaleX 走动画插值（文本镜像过渡还穿过 0 宽，踩过）
  // bottom 抬高给完成光环让位（光环 103%，环高约 22px，气泡压在其上方）
  bubble.style.cssText = [
    'position:absolute', 'bottom:calc(103% + 30px)', 'left:50%',
    'transform:translateX(-50%) scale(var(--pop,0))',
    'background:#fff', 'color:#c2502a', 'font:700 15px/1.6 system-ui,sans-serif',
    'padding:2px 12px', 'border-radius:14px', 'border:2px solid #c2502a',
    'white-space:nowrap', 'pointer-events:none', 'transition:transform .18s ease-out',
  ].join(';')
  const bubbleText = document.createElement('span')
  bubbleText.style.cssText = 'display:inline-block;transform:scaleX(var(--face,1));transition:none'
  bubble.appendChild(bubbleText)

  const menu = document.createElement('div')
  menu.style.cssText = [
    'position:absolute', 'bottom:105%', 'left:50%',
    'transform:translateX(-50%) scaleX(var(--face,1))',
    'background:rgba(30,30,34,.96)', 'color:#eee', 'font:13px/1.9 system-ui,sans-serif',
    'border-radius:10px', 'padding:4px 0', 'display:none', 'min-width:170px',
    'box-shadow:0 6px 20px rgba(0,0,0,.4)', 'cursor:default',
  ].join(';')

  const about = document.createElement('div')
  about.style.cssText = [
    'position:absolute', 'bottom:105%', 'left:50%',
    'transform:translateX(-50%) scaleX(var(--face,1))',
    'background:rgba(30,30,34,.96)', 'color:#eee', 'font:13px/1.8 system-ui,sans-serif',
    'border-radius:10px', 'padding:10px 16px', 'display:none', 'min-width:190px',
    'box-shadow:0 6px 20px rgba(0,0,0,.4)', 'cursor:default', 'white-space:nowrap',
  ].join(';')
  const aboutTitle = document.createElement('div')
  aboutTitle.textContent = '🐮 牛来桌宠'
  aboutTitle.style.cssText = 'font-weight:700;font-size:14px'
  const aboutVer = document.createElement('div')
  // 版本号由构建期 define 注入（build.mjs 读 package.json），发版自动跟随
  aboutVer.textContent = `dsh-niulai-pet v${__NIULAI_VERSION__} · by whitefirer`
  aboutVer.style.cssText = 'color:#a1a1aa;font-size:12px'
  const aboutNote = document.createElement('div')
  aboutNote.textContent = '动作与叫声均为程序生成'
  aboutNote.style.cssText = 'color:#a1a1aa;font-size:12px'
  const aboutQuote = document.createElement('div')
  aboutQuote.textContent = '「我尽力了，只能做成这样了😂」'
  aboutQuote.style.cssText = 'margin-top:6px;color:#fbbf24;font-size:12px'
  about.append(aboutTitle, aboutVer, aboutNote, aboutQuote)

  // ---- 完成光环：done 庆祝时头顶金光环浮现（全部皮肤通用，幽灵类天然合题） ----
  const halo = document.createElement('div')
  halo.style.cssText = [
    'position:absolute', 'bottom:103%', 'left:50%', 'opacity:0', 'pointer-events:none',
    'width:64px', 'height:22px', 'border-radius:50%',
    'border:3px solid rgba(255,215,94,.95)',
    'box-shadow:0 0 12px rgba(255,205,80,.85), inset 0 0 10px rgba(255,225,140,.6)',
    'transform:translateX(-50%)',
  ].join(';')
  let haloAnim: Animation | null = null
  const showHalo = (): void => {
    if (destroyed) return
    haloAnim?.cancel()
    haloAnim = halo.animate(
      [
        { transform: 'translateX(-50%) scaleX(0.2) scaleY(0.2) translateY(16px)', opacity: 0 },
        { transform: 'translateX(-50%) scaleX(1.25) scaleY(0.9) translateY(0)', opacity: 1, offset: 0.22 },
        { transform: 'translateX(-50%) scaleX(1) scaleY(1) translateY(-5px)', opacity: 1, offset: 0.4 },
        { transform: 'translateX(-50%) scaleX(1) scaleY(1) translateY(0)', opacity: 1, offset: 0.82 },
        { transform: 'translateX(-50%) scaleX(1.15) scaleY(0.6) translateY(0)', opacity: 0 },
      ],
      { duration: 3600, easing: 'ease-out' },
    )
    void haloAnim.finished.catch(() => {})
  }
  root.append(img, heatLayer, bubble, halo, menu, about)
  document.body.appendChild(root)

  // 守灵：dsh 首屏 React 挂载后会置换 body 内容，把直挂节点清掉——
  // 观察 body childList，被清就重新挂回（含后续任何时机的清理）。
  // appendChild 触发的二次回调里 contains 已为 true，不会循环。
  const keeper = new MutationObserver(() => {
    if (!destroyed && !document.body.contains(root)) {
      document.body.appendChild(root)
    }
  })
  keeper.observe(document.body, { childList: true })

  // 起始 x（记忆或默认右下偏左，避开右下角卡片区；额外表按 defaultX 错位）
  let x = Math.min(
    Math.max(0, loadMyX() ?? assets.defaultX ?? window.innerWidth - 320),
    window.innerWidth - 80,
  )
  let facing: 1 | -1 = 1 // 1=朝右
  /** 唯一朝向入口：facing 与 root 的 scaleX(facing)、--face 变量必须三元同步。
   *  裸改 facing 会留下窗口期（走路转身要等 rAF、气泡显示期转身文字不随之消镜像），
   *  气泡/菜单/关于全靠 var(--face) 消镜像——凡改朝向必须走这里（踩过）。 */
  const setFacing = (dir: 1 | -1): void => {
    facing = dir
    applyX()
  }
  /** 拎起高度（≤0，translateY 偏移）；拖拽垂直 1:1 跟随，松手重力坠落。
   *  声明必须在 applyX 前（applyX 挂载即调用，TDZ）；applyX 必须带上它——
   *  物理世界的 setX→applyX 曾把拎着时的 translateY 抹掉，宠物闪回地面（踩过）。 */
  let liftY = 0
  /** 坠落 rAF（0=不在坠落；坠落期 mood 保持 'drag' 挡 behave/动作）。 */
  let fallRaf = 0
  /** 拖拽末段指针采样（算松手水平初速度=抛掷）。 */
  let moveSamples: Array<{ t: number; x: number }> = []
  /** 最大拎起量（负值）：头顶留 24px。 */
  const maxLiftAt = (): number => -(window.innerHeight - groundOff - petH - 24)
  const applyX = (): void => {
    root.style.transform = `translateX(${x}px) scaleX(${facing}) translateY(${liftY}px)`
    root.style.setProperty('--face', String(facing))
  }
  applyX()

  // ---- 叫声 ----
  // 时长缓存用模块级 soundDur（见顶部注释）；这里只剩帧尺寸预读是实例级的。
  // 预读各帧尺寸（w=站立高度 PET_H 下渲染宽，h=自然高）：shoutAnim 逐帧动画按
  // 「统一物理缩放」换算显示尺寸（帧高/参考高 × PET_H），倒地宽帧还要锚定视觉中心
  const frameW = new Map<string, { w: number; h: number }>()
  const preloadW = (src: string | undefined): void => {
    if (src === undefined || frameW.has(src)) return
    const im = new Image()
    im.onload = () => frameW.set(src, { w: (im.naturalWidth / im.naturalHeight) * petH, h: im.naturalHeight })
    im.src = src
  }
  /** 声音元数据 + 帧尺寸预读（热更新新皮肤的素材也走这里补读）。 */
  const preloadAssets = (list: SkinDef[]): void => {
    for (const s of list) {
      for (const src of [...(s.sounds ?? []), ...(s.replySound !== undefined ? [s.replySound] : [])]) {
        if (soundDur.has(src)) continue
        const probe = new Audio()
        probe.preload = 'metadata'
        probe.addEventListener('loadedmetadata', () => { soundDur.set(src, probe.duration) })
        probe.src = src
      }
      preloadW(s.image)
      if (s.imageSleep !== undefined) preloadW(s.imageSleep)
      if (s.imageLampA !== undefined) preloadW(s.imageLampA)
      if (s.imageLampB !== undefined) preloadW(s.imageLampB)
      if (s.imageRoll !== undefined) preloadW(s.imageRoll)
      for (const f of s.shoutAnim ?? []) preloadW(f.src)
    }
  }
  preloadAssets(skins)

  /** 在播的喊声（语音/互动打断时当场掐断用）。 */
  let playingAudio: HTMLAudioElement | null = null
  /** 连喊链在放（非循环模式；戳一下应声用）。 */
  let chainActive = false

  /** 合成音色播放（playVoice / doneVoice 共用；doneVoice 让完成路径有专属预设如警笛）。 */
  const playSynthVoice = (v: VoiceName): number => {
    const ctx = audioCtx()
    if (ctx === null) return 0
    if (v === 'moo') { synthMoo(ctx); return 950 }
    if (v === 'whale') { synthWhale(ctx); return 1650 }
    if (v === 'meow') { synthMeow(ctx); return 800 }
    if (v === 'crackle') { synthCrackle(ctx); return 700 }
    if (v === 'engine') { synthEngine(ctx); return 950 }
    if (v === 'motor') { synthMotor(ctx); return 1100 }
    if (v === 'siren') { synthSiren(ctx); return 3600 }
    synthSqueak(ctx)
    return 450
  }
  /** 把 mp3 元素路由进共享音量节点（MediaElementSource → volNode → destination）。
   *  路由成功后元素自身 volume 失效、由 gain 实时控制——音量调节对**正在播**的声音即刻生效，
   *  不再依赖 playingAudio 引用竞态（踩过：大笑中途调音量听不到变化）。
   *  返回 false = 路由失败（AudioContext 未暖），元素退回自身 volume 按播放时取值。 */
  const attachToVol = (audio: HTMLAudioElement): boolean => {
    try {
      const ctx = audioCtx()
      if (ctx === null) { audio.volume = masterVolume / 100; return false }
      const src = ctx.createMediaElementSource(audio)
      src.connect(volDest(ctx))
      audio.volume = 1 // 路由后增益由 volNode 全权控制
      return true
    } catch {
      audio.volume = masterVolume / 100
      return false
    }
  }
  /** 放一声当前皮肤的叫声，返回时长 ms（0=无声/被静音）。 */
  const playVoice = (): number => {
    if (muted || masterVolume === 0) return 0
    const s = cur()
    if (s.voice === 'mama') {
      const list = s.sounds ?? []
      if (list.length === 0) return 0
      const src = list[Math.floor(Math.random() * list.length)]
      const audio = new Audio(src)
      attachToVol(audio)
      playingAudio = audio
      audio.addEventListener('ended', () => { if (playingAudio === audio) playingAudio = null }, { once: true })
      void audio.play().catch(() => { /* 自动播放被拦：等用户首次交互 */ })
      const d = soundDur.get(src)
      return d !== undefined ? Math.round(d * 1000) + 150 : 2600
    }
    if (s.voice !== null) return playSynthVoice(s.voice)
    return 0
  }

  /** 完成提示音：自定义开关 → 皮肤 doneVoice（合成，如警笛） → 皮肤 doneSounds（采样）
   *   → 普通叫声；戳/表演仍走 playVoice。 */
  const playNotify = (): number => {
    if (muted || masterVolume === 0) return 0
    if (customSoundOn && customSound !== '') {
      const audio = new Audio(customSound)
      attachToVol(audio)
      playingAudio = audio
      audio.addEventListener('ended', () => { if (playingAudio === audio) playingAudio = null }, { once: true })
      void audio.play().catch(() => { /* 自动播放被拦：等用户首次交互 */ })
      const d = soundDur.get(customSound)
      return d !== undefined ? Math.round(d * 1000) + 150 : 2600
    }
    const doneVoice = cur().doneVoice
    if (doneVoice !== undefined) return playSynthVoice(doneVoice)
    const doneList = cur().doneSounds
    if (doneList !== undefined && doneList.length > 0) {
      const src = doneList[Math.floor(Math.random() * doneList.length)]
      const audio = new Audio(src)
      attachToVol(audio)
      playingAudio = audio
      audio.addEventListener('ended', () => { if (playingAudio === audio) playingAudio = null }, { once: true })
      void audio.play().catch(() => { /* 自动播放被拦：等用户首次交互 */ })
      const d = soundDur.get(src)
      return d !== undefined ? Math.round(d * 1000) + 150 : 2600
    }
    return playVoice()
  }

  /**
   * 妈妈的回应「牛来！」：只放声+气泡，不动嘴（不是宠物在喊）。
   * 时机：连喊接龙放完（循环模式关），或循环喊被互动打断时。
   */
  /** 回应去重：打断循环的即时回应与喊声尾部的回应不重复（喊开始后回过就不再回）。 */
  let lastReplyAt = 0
  const playReply = (): void => {
    if (muted || !replyOn || destroyed) return
    const src = cur().replySound
    if (src === undefined) return
    lastReplyAt = Date.now()
    if (masterVolume === 0) return // 音量 0 视同静音（不回不放）
    const audio = new Audio(src)
    attachToVol(audio)
    void audio.play().catch(() => {})
    const d = soundDur.get(src)
    showBubble('牛来！', Math.max(1500, Math.round((d ?? 1.8) * 1000) + 300))
  }
  // 浏览器自动播放策略：首次任意交互时暖一下 AudioContext
  const unlock = (): void => { audioCtx() }
  document.addEventListener('pointerdown', unlock, { once: true, capture: true })

  // ---- 基础动画 ----
  const breathe = img.animate(
    [{ transform: 'scaleY(1) translateY(0)' }, { transform: 'scaleY(1.025) translateY(-1.5px)' }],
    { duration: 1100, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
  )

  let bubbleTimer = 0
  /** system=true 的是用户动作的反馈泡（设置指路/语音命中噤声），不受「气泡」开关管。 */
  const showBubble = (text: string, ms: number, system = false): void => {
    if (text === '') return
    if (!system && !talkative) return // 装饰性气泡（喊声/回话/唠叨）随开关关闭
    bubbleText.textContent = text
    // 反镜像走 var(--face)：显示期间转身（走路调头/被撞/驾驶掉头）文字立即跟着消镜像。
    // 前提是 setFacing 统一入口保证 --face 与 root 的 scaleX 永不脱钩（裸改会踩）。
    root.style.setProperty('--pop', '1')
    window.clearTimeout(bubbleTimer)
    bubbleTimer = window.setTimeout(() => {
      root.style.setProperty('--pop', '0')
    }, ms)
  }

  // 嘴型：「妈-妈~~」两个音节 = 开-合-开，长尾音是开口音——保持张开到声止再闭。
  // 飞行中若皮肤有飞行张嘴帧（imageFlyShout）则照样开合。
  let mouthTimers: number[] = []
  let lingerTimer = 0 // 趴睡皮肤喊完再站一会儿的归位定时器
  const mouthOpen = (): void => {
    if (cur().imageShout === undefined) return
    img.src = mood === 'fly'
      ? (cur().imageFlyShout ?? cur().imageFly ?? cur().image)
      : skinShout()
  }
  const mouthShut = (): void => {
    if (rollingBall || driving) return // 卷形滚动/开车横穿中：嘴型复位别碰演出图（否则被踩回站姿图）
    img.src = mood === 'fly' ? (cur().imageFly ?? cur().image) : skinIdle()
  }
  // 喊叫动画（shoutAnim 皮肤）：按时间线切帧，rock 帧附加倒地摇摆
  let shoutAnimTimers: number[] = []
  let rockAnim: Animation | null = null
  const stopShoutAnim = (resetVisual = true): void => {
    for (const t of shoutAnimTimers) window.clearTimeout(t)
    shoutAnimTimers = []
    rockAnim?.cancel()
    rockAnim = null
    if (resetVisual) {
      animRolling = false
      img.style.left = ''
      img.style.height = `${petH}px` // 不能置 ''——那是清掉内联高度，图会按自然尺寸炸开
    }
  }
  const mouthIdle = (): void => {
    for (const t of mouthTimers) window.clearTimeout(t)
    mouthTimers = []
    stopShoutAnim()
    shouting = false
    if (mood !== 'fly') img.src = skinIdle()
  }
  /** 一声的嘴型时间线：开 240ms → 合 120ms → 开并保持 → ms 时合上，onDone 接龙。
   *  皮肤配了 shoutAnim（且非飞行）时改走帧序列时间线：站笑→弯腰→倒地滚。 */
  const mouthShout = (ms: number, onDone?: () => void): void => {
    for (const t of mouthTimers) window.clearTimeout(t)
    mouthTimers = []
    stopShoutAnim()
    shouting = true
    const anim = mood !== 'fly' ? cur().shoutAnim : undefined
    if (anim !== undefined && anim.length > 0) {
      const total = Math.max(ms, 420)
      const frames = [...anim].sort((a, b) => a.at - b.at)
      // 统一物理缩放：参考高 = 序列最高帧（站姿），其余帧按 帧高/参考高 比例显示——
      // 同角色同机位，倒地帧不会被拉到和站着一样高（此前倒地显得巨大就是这么来的）
      let refH = 0
      for (const f of frames) {
        const e = frameW.get(f.src)
        if (e !== undefined && e.h > refH) refH = e.h
      }
      const apply = (f: ShoutFrame): void => {
        img.src = f.src
        const e = frameW.get(f.src)
        const scale = e !== undefined && refH > 0 ? Math.min(1, e.h / refH) : 1
        img.style.height = `${Math.round(petH * scale)}px`
        // 宽帧（倒地）补偿：以站立帧中心为锚水平平移，并钳进视口（scaleX 翻转下符号随 facing 镜像）
        const idleW = frameW.get(cur().image)?.w
        if (idleW !== undefined && e !== undefined) {
          const fw = e.w * scale
          let off = ((idleW - fw) / 2) * facing
          if (facing === 1) {
            const cx = x + idleW / 2
            const clamped = Math.min(Math.max(cx, fw / 2 + 8), window.innerWidth - fw / 2 - 8)
            off += clamped - cx
          }
          img.style.left = `${off}px`
        }
        rockAnim?.cancel()
        rockAnim = null
        if (f.rock === true) {
          rockAnim = img.animate(
            [{ transform: 'rotate(-9deg)' }, { transform: 'rotate(9deg)' }],
            { duration: 460, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
          )
        }
      }
      apply(frames[0])
      for (let i = 1; i < frames.length; i++) {
        const f = frames[i]
        shoutAnimTimers.push(window.setTimeout(() => apply(f), f.at * total))
      }
      shoutAnimTimers.push(window.setTimeout(() => {
        // 循环喊 2.4s 后接下一声：保持演出帧滚放（动画 webp 本无限循环），别闪回常态；
        // 循环已停（互动/语音/静音打断）才归位
        const loopContinues = shoutLoopTimer !== 0
        stopShoutAnim(!loopContinues)
        if (loopContinues) animRolling = true // 间隙保持滚放，并挡住眨眼/sleep 抢图
        shouting = false
        if (!loopContinues) img.src = skinIdle()
        onDone?.()
      }, total))
      return
    }
    if (isLaydown()) {
      // 趴睡常态皮肤：没有「站着闭嘴」帧，嘴型开合相位会闪回趴睡图——
      // 喊叫全程站图，声止后再站 2.5s 才趴回（拖拽/飞行/新喊叫打断 lingering）
      mouthOpen()
      mouthTimers.push(window.setTimeout(() => {
        shouting = false
        window.clearTimeout(lingerTimer)
        lingerTimer = window.setTimeout(() => {
          if (!destroyed && !shouting && mood !== 'fly' && mood !== 'drag') img.src = skinIdle()
        }, 2500)
        onDone?.()
      }, Math.max(ms, 420)))
      return
    }
    mouthOpen()
    mouthTimers.push(window.setTimeout(mouthShut, 240))
    mouthTimers.push(window.setTimeout(mouthOpen, 360))
    mouthTimers.push(window.setTimeout(() => { mouthShut(); shouting = false; onDone?.() }, Math.max(ms, 420)))
  }

  // 眨眼：2.5~6.4s 随机间隔闭 130ms（喊叫/飞行/拖拽时让位）
  let blinkTimer = 0
  let blinkResetTimer = 0
  const scheduleBlink = (): void => {
    blinkTimer = window.setTimeout(() => {
      const canBlink = !destroyed && (mood === 'idle' || mood === 'walk')
        && !shouting && !animRolling && !rollingBall && !driving && cur().imageBlink !== undefined
      if (canBlink) {
        img.src = cur().imageBlink as string
        blinkResetTimer = window.setTimeout(() => {
          // 复位同样让位演出（卷球/开车）：130ms 闭眼窗内被戳/庆祝开演，
          // 到点会把 roll.png/drive 图踩回站姿图——滚动中闪一下眨眼就是这么来的
          if (!destroyed && mood !== 'fly' && !shouting && !rollingBall && !driving) img.src = skinIdle()
        }, 130)
      }
      scheduleBlink()
    }, 2600 + Math.random() * 3800)
  }
  scheduleBlink()

  /** 一次蹦跳（dur ms、height px 上抛）。 */
  const hop = (height = 44, dur = 380): Promise<void> => {
    breathe.pause()
    const anim = img.animate(
      [
        { transform: 'translateY(0) scale(1,1)', offset: 0 },
        { transform: `translateY(4px) scale(1.06,0.9)`, offset: 0.18 },
        { transform: `translateY(-${height}px) scale(0.94,1.08)`, offset: 0.55 },
        { transform: 'translateY(0) scale(1.04,0.94)', offset: 0.86 },
        { transform: 'translateY(0) scale(1,1)', offset: 1 },
      ],
      { duration: dur, easing: 'ease-out' },
    )
    return anim.finished.then(() => { if (!destroyed) breathe.play() }).catch(() => {})
  }

  /** 连跳三下（庆祝经典款）。 */
  const hops3 = async (): Promise<void> => {
    for (let i = 0; i < 3; i++) {
      if (destroyed) return
      await hop(58 - i * 12, 420)
    }
  }

  /** 摇摆舞：左右摇摆 + 小跳收尾。 */
  const dance = async (): Promise<void> => {
    breathe.pause()
    await img.animate(
      [
        { transform: 'rotate(0deg) translateY(0)', offset: 0 },
        { transform: 'rotate(-13deg) translateY(-7px)', offset: 0.14 },
        { transform: 'rotate(0deg) translateY(0)', offset: 0.28 },
        { transform: 'rotate(13deg) translateY(-7px)', offset: 0.42 },
        { transform: 'rotate(0deg) translateY(0)', offset: 0.56 },
        { transform: 'rotate(-10deg) translateY(-12px)', offset: 0.7 },
        { transform: 'rotate(10deg) translateY(-12px)', offset: 0.84 },
        { transform: 'rotate(0deg) translateY(0)', offset: 1 },
      ],
      { duration: 1600, easing: 'ease-in-out' },
    ).finished.catch(() => {})
    if (!destroyed) breathe.play()
  }

  /** 摇摆（波兰牛 meme）：脚底支点大振幅快节拍摇摆。 */
  const sway = async (): Promise<void> => {
    breathe.pause()
    await img.animate(
      [
        { transform: 'rotate(0deg)', offset: 0 },
        { transform: 'rotate(-19deg) translateY(-5px)', offset: 0.13 },
        { transform: 'rotate(0deg)', offset: 0.25 },
        { transform: 'rotate(19deg) translateY(-5px)', offset: 0.38 },
        { transform: 'rotate(0deg)', offset: 0.5 },
        { transform: 'rotate(-19deg) translateY(-5px)', offset: 0.63 },
        { transform: 'rotate(0deg)', offset: 0.75 },
        { transform: 'rotate(19deg) translateY(-5px)', offset: 0.88 },
        { transform: 'rotate(0deg)', offset: 1 },
      ],
      { duration: 1750, easing: 'ease-in-out' },
    ).finished.catch(() => {})
    if (!destroyed) breathe.play()
  }

  /** 原地转圈（绕脚底支点一圈，带点小跳）。 */
  const spin = async (): Promise<void> => {
    breathe.pause()
    await img.animate(
      [
        { transform: 'rotate(0deg) translateY(0)', offset: 0 },
        { transform: 'rotate(180deg) translateY(-14px)', offset: 0.5 },
        { transform: 'rotate(360deg) translateY(0)', offset: 1 },
      ],
      { duration: 720, easing: 'ease-in-out' },
    ).finished.catch(() => {})
    if (!destroyed) breathe.play()
  }

  /** 熊猫翻滚：绕重心滚 360° 并向朝向平移一段。 */
  const roll = async (): Promise<void> => {
    breathe.cancel() // 内联 transform 与 pause 态的 breathe 叠加会被顶掉，必须 cancel
    // 本滚所属代：poke 顶掉（代际前进）后，旧滚的 rAF 循环与收尾必须全收手——
    // 否则旧滚收尾把新滚的画面清掉（img.transform/球图/rollingBall/breathe 被
    // 踩回），新滚只剩球图平着滑（用户见「变球平移」）
    const gen = actionGen
    const alive = (): boolean => !destroyed && gen === actionGen && mood === 'celebrate'
    const hadBallImg = cur().imageRoll !== undefined
    rollingBall = hadBallImg
    if (!hadBallImg) {
      // 无卷形图（熊猫）：原版短程翻滚 210px
      const from = x
      let target = from + 210 * facing
      target = Math.min(Math.max(0, target), window.innerWidth - 70)
      const dist = target - from
      const dir = dist === 0 ? facing : Math.sign(dist)
      img.style.transformOrigin = '50% 50%'
      const dur = 950
      const start = performance.now()
      await new Promise<void>((resolve) => {
        const step = (now: number): void => {
          if (!alive()) { resolve(); return }
          const t = Math.min(1, (now - start) / dur)
          x = from + dist * t
          const yOff = -Math.sin(t * Math.PI) * 16
          root.style.transform = `translateX(${x}px) translateY(${yOff}px) scaleX(${facing})`
          img.style.transform = `rotate(${360 * dir * t}deg)`
          if (t < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })
    } else {
      // 卷球（犰狳）：像车轮一样滚过整个地面——冲出本侧、另一侧杀回、滑回原位
      // 转角 = 行程/半径（radius = petH/2），镜像父级内不乘 dir（铁律#2）
      const s = cur()
      img.src = s.imageRoll as string
      // 球绕自身中心转：img 默认 origin 是 50% 100%（站立图锚底），不换的话
      // 卷球会绕底部边缘摆，看起来球体在"跷跷板"而非轮式滚动（踩过）
      img.style.transformOrigin = '50% 50%'
      // 滚动声：隆隆底 + 甲片撞击脉冲，随 3.6s 全程滚动（静音/音量 0 自吞）。
      // try/catch 防音频在特定环境抛错中断滚动动画——球图已切但 step 未注册，
      // 表现就是「变球后平移不转」（踩过）
      if (!muted && masterVolume > 0) {
        try {
          const rctx = audioCtx()
          if (rctx !== null) synthRoll(rctx, 3.6)
        } catch { /* 音频异常不拖垮滚动演出 */ }
      }
      const homeX = x
      const homeFacing = facing
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
      setFacing(dir) // 卷球全程 body 朝行进方向
      const w = root.getBoundingClientRect().width
      const off = w + 40
      const radius = Math.max(20, petH / 2)
      const dur = 3600
      const start = performance.now()
      let cumDist = 0 // 轮转角 = cumDist/radius（rad）
      await new Promise<void>((resolve) => {
        const step = (now: number): void => {
          if (!alive()) { resolve(); return }
          const t = Math.min(1, (now - start) / dur)
          const prevX = x
          let nx: number
          if (t < 0.34) nx = homeX + dir * window.innerWidth * ((t / 0.34) ** 1.6)
          else if (t < 0.36) nx = dir === 1 ? -off : window.innerWidth + off
          else if (t < 0.62) {
            const k = (t - 0.36) / 0.26
            nx = (dir === 1 ? -off : window.innerWidth + off) + (dir === 1 ? 1 : -1) * (window.innerWidth + off * 2) * k
          } else {
            const k = (t - 0.64) / 0.36
            const e = 1 - (1 - k) * (1 - k)
            nx = (dir === 1 ? window.innerWidth + off : -off) + (homeX - (dir === 1 ? window.innerWidth + off : -off)) * e
          }
          cumDist += Math.abs(nx - prevX)
          x = nx
          root.style.transform = `translateX(${x}px) scaleX(${facing})`
          img.style.transform = `rotate(${(cumDist / radius) * 57.2958}deg)`
          if (t < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })
      x = homeX
      setFacing(homeFacing)
    }
    // 收尾同样按代际让位：被 poke 顶掉的旧滚不得清理画面——新滚的球图/rotate/
    // transformOrigin/rollingBall/breathe 全是它自己在管，旧滚踩一手就「变球平移」
    if (!alive()) return
    img.style.transform = ''
    img.style.transformOrigin = '50% 100%'
    if (hadBallImg) { img.src = skinIdle(); rollingBall = false } // 球图用完换回常态（警灯皮走 skinIdle 拿到当前灯相位）
    applyX()
    if (!destroyed) breathe.play()
  }

  // ---- 分裂（史莱姆签名）：主图先"陷进去"隐身，2~3 个小号克隆散开乱跳，再聚拢合体弹回 ----
  // 轻量克隆版：克隆是纯 DOM（不挂状态机/不进物理/不写配置），眨眼=定时换 src，
  // 合体后主图走 landSquash（果冻皮多段阻尼弹跳 + 啵嘤声）。
  const splitClones: HTMLDivElement[] = []
  const splitTimers: number[] = []
  let splitting = false
  const cleanupSplit = (): void => {
    for (const t of splitTimers) window.clearInterval(t)
    splitTimers.length = 0
    for (const c of splitClones) c.remove()
    splitClones.length = 0
    splitting = false
    img.style.visibility = ''
    img.style.transform = ''
    heatLayer.style.visibility = ''
    root.style.pointerEvents = ''
  }
  const split = async (): Promise<void> => {
    if (splitting || destroyed) return
    splitting = true
    breathe.pause()
    const rect = root.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const bottom = rect.bottom
    const z = (Number(root.style.zIndex) || 99999) + 1
    // 主图一压隐身（"陷进地里"），期间根节点拒拖（隐身还被拎走就灵异了）。
    // 不加 fill:forwards——WAAPI 前向填充永久压内联样式，没人取消会把主图钉死在趴扁态
    // （铁律#1；await finished 与隐身之间无渲染帧，不需要 fill 兜底）
    root.style.pointerEvents = 'none'
    await img.animate(
      [{ transform: 'scale(1,1)' }, { transform: 'scale(1.3,0.5)' }],
      { duration: 170, easing: 'ease-in' },
    ).finished.catch(() => {})
    img.style.visibility = 'hidden'
    img.style.transform = ''
    heatLayer.style.visibility = 'hidden' // 剪影层也得跟着隐（不然隐身期留个红影子）
    if (destroyed) { cleanupSplit(); return }
    playVoice() // 裂开一声（squeak/moo/采样，随皮肤音色；静音自吞）

    const n = cur().splitCount ?? (Math.random() < 0.5 ? 2 : 3) // 皮肤可声明分裂数（史莱姆王 5-6 只）
    // 克隆身高按面积守恒：原高/√n（2 只≈71%、3 只≈58%）——看上去合体后正好还原大史莱姆
    const miniH = Math.max(36, Math.round(petH / Math.sqrt(n)))
    // 克隆滤镜与主宠镜像一致（变色/透明度/红温快照；睡眠压暗分裂前已唤醒不叠）+ 自己的小投影
    const cloneFilterParts: string[] = []
    const effHue = hueCycleOn ? Math.round((petHue + cyclePhase) % 360) : petHue
    if (effHue !== 0) cloneFilterParts.push(`hue-rotate(${effHue}deg)`)
    if (petOpacity !== 100) cloneFilterParts.push(`opacity(${petOpacity}%)`)
    const dHeat = Math.max(0, (heat - 0.45) / 0.55)
    if (dHeat > 0.02) {
      cloneFilterParts.push(`sepia(${(0.25 * dHeat).toFixed(2)})`)
      cloneFilterParts.push(`saturate(${(1 + 0.8 * dHeat).toFixed(2)})`)
      cloneFilterParts.push(`drop-shadow(0 0 ${Math.round(4 + dHeat * 12)}px rgba(255,70,45,${(0.3 + 0.55 * dHeat).toFixed(2)}))`)
    }
    cloneFilterParts.push('drop-shadow(0 2px 3px rgba(0,0,0,.3))')
    const cloneFilter = cloneFilterParts.join(' ')
    const scatterDur = 2100
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div')
      el.style.cssText = `position:fixed;left:${cx - miniH / 2}px;top:${bottom - miniH}px;z-index:${z};pointer-events:none;transform-origin:50% 100%`
      const im = document.createElement('img')
      im.src = cur().image
      im.style.cssText = `height:${miniH}px;display:block;filter:${cloneFilter}`
      el.appendChild(im)
      el.style.visibility = 'hidden' // 到点再显形（逐个蹦出，不一窝蜂）
      document.body.appendChild(el)
      splitClones.push(el)
      // 眨眼：与主宠同节奏池，闭 130ms
      if (cur().imageBlink !== undefined) {
        const standSrc = cur().image
        const blinkSrc = cur().imageBlink as string
        splitTimers.push(window.setInterval(() => {
          im.src = blinkSrc
          window.setTimeout(() => { im.src = standSrc }, 130)
        }, 2200 + Math.random() * 2600))
      }
      // 散开三连跳（落地压扁→空中拉长），方向左右随机、步距随机、出场错峰
      const dir = i % 2 === 0 ? -1 : 1 // 两左边一右或两右一左，别全压一边
      const drift = dir * (60 + Math.random() * 100)
      const delay = i * 130
      const kf: Keyframe[] = [{ transform: 'translate(0px,0) scale(1,1)', offset: 0 }]
      for (let h = 0; h < 3; h++) {
        const t0 = h / 3
        kf.push({ transform: `translate(${(drift * h) / 3}px,0) scale(1.16,0.78)`, offset: t0 + 0.02 })
        kf.push({ transform: `translate(${(drift * (h + 0.5)) / 3}px,${-20 - Math.random() * 16}px) scale(0.92,1.12)`, offset: t0 + 0.17 })
        kf.push({ transform: `translate(${(drift * (h + 1)) / 3}px,0) scale(1,1)`, offset: (h + 1) / 3 })
      }
      window.setTimeout(() => { if (!destroyed) el.style.visibility = '' }, delay)
      void el.animate(kf, { duration: scatterDur, easing: 'ease-out', fill: 'forwards', delay }).finished.catch(() => {})
    }
    await new Promise<void>((r) => { window.setTimeout(r, scatterDur + n * 130 + 150) })
    if (destroyed) { cleanupSplit(); return }
    // 聚拢：从各自当前位滑回原点并缩小（fill:forwards 的终态就是起点）
    playVoice() // 合体再一声
    await Promise.all(splitClones.map((el) => {
      const now = getComputedStyle(el).transform
      return el.animate(
        [
          { transform: now === 'none' ? 'translate(0px,0) scale(1,1)' : now },
          { transform: 'translate(0px,0) scale(0.55,0.55)' },
        ],
        { duration: 400, easing: 'ease-in', fill: 'forwards' },
      ).finished.catch(() => {})
    }))
    const wasJelly = cur().jelly === true
    cleanupSplit() // 摘克隆 + 主图显形 + 恢复拖拽
    // 合体落地：果冻皮多段弹跳 + 啵嘤；非果冻走普通压扁闷响
    landSquash(wasJelly ? 220 : 120)
    if (!destroyed) breathe.play()
  }

  // ---- 行为循环 ----
  let behaveTimer = 0
  const clampX = (): void => {
    x = Math.min(Math.max(0, x), window.innerWidth - 70)
  }

  const walkTo = async (target: number): Promise<void> => {
    if (mood !== 'idle') return
    mood = 'walk'
    setFacing(target > x ? 1 : -1) // 立即转身（不等 rAF：气泡/菜单显示期转身不再反字）
    const from = x
    const dist = Math.abs(target - from)
    const dur = Math.max(500, (dist / 60) * 1000) // ~60px/s
    breathe.pause()
    // 果冻走路：身体前后挤压摆动（duang duang 感）；普通皮肤：左右倾摇摆
    const wobble = cur().jelly === true
      ? img.animate(
          [
            { transform: 'scale(1.07,0.93) translateY(2px)' },
            { transform: 'scale(0.95,1.06) translateY(-3px)' },
            { transform: 'scale(1.07,0.93) translateY(2px)' },
          ],
          { duration: 300, iterations: Math.max(1, Math.round(dur / 300)) },
        )
      : img.animate(
          [
            { transform: 'rotate(4deg) translateY(0)' },
            { transform: 'rotate(-4deg) translateY(-3px)' },
            { transform: 'rotate(4deg) translateY(0)' },
          ],
          { duration: 320, iterations: Math.max(1, Math.round(dur / 320)) },
        )
    const start = performance.now()
    await new Promise<void>((resolve) => {
      const step = (now: number): void => {
        if (destroyed || mood !== 'walk') { resolve(); return }
        const t = Math.min(1, (now - start) / dur)
        x = from + (target - from) * t
        applyX()
        if (t < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
    wobble.cancel()
    // 被 celebrate/拖拽等打断时不抢状态（否则会把 fly 等 mood 踩回 idle）
    if (mood === 'walk') {
      if (!destroyed) breathe.play()
      mood = 'idle'
    }
  }

  let sleepAnim: Animation | null = null // 睡眠压扁动画（wakeFromSleep 主动取消用）

  const sleepFor = async (ms: number): Promise<void> => {
    if (mood !== 'idle' || shouting || animRolling) return // 叫唤着/演出滚放着不许睡：压扁+变暗会把演出演成梦游
    mood = 'sleep'
    breathe.pause()
    const sleepSrc = cur().imageSleep
    let squash: Animation | null = null
    if (sleepSrc !== undefined) {
      img.src = sleepSrc // 专睡图：换图不压扁（横躺姿态压了反而怪），只压暗
    } else {
      squash = img.animate(
        [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.78)' }],
        { duration: 500, fill: 'forwards', easing: 'ease-out' },
      )
      sleepAnim = squash
      await squash.finished.catch(() => {})
    }
    dimmed = true
    applyImgFilter()
    await new Promise((r) => window.setTimeout(r, ms))
    if (destroyed) return
    dimmed = false
    applyImgFilter()
    if (mood !== 'sleep') {
      squash?.cancel() // 被打断：解除压扁，不抢 transform 与 mood（专睡图由 wakeFromSleep 换回来）
      return
    }
    if (sleepSrc !== undefined) {
      img.src = skinIdle()
      breathe.play()
      mood = 'idle'
      return
    }
    const wake = img.animate(
      [{ transform: 'scaleY(0.78)' }, { transform: 'scaleY(1)' }],
      { duration: 420, fill: 'forwards', easing: 'ease-out' },
    )
    await wake.finished.catch(() => {})
    squash?.cancel()
    wake.cancel()
    breathe.play()
    mood = 'idle'
  }

  /** 动作/喊叫触发时若睡着（压扁变暗），立刻恢复正常高度与亮度——
   *  睡着做动作 = 梦游。等 sleepFor 自己醒太慢（剩余睡眠时长不可控），主动取消。 */
  const wakeFromSleep = (): void => {
    if (mood !== 'sleep') return
    mood = 'idle' // sleepFor 的延时醒来检查见此即走「被打断」路径归位
    dimmed = false
    applyImgFilter()
    if (cur().imageSleep !== undefined) img.src = skinIdle() // 专睡图换回来
    sleepAnim?.cancel()
    sleepAnim = null
    breathe.play()
  }

  /** 飞行统一航迹：dive=中低空平飞掠场（两度轻柔起伏），arc=弧线跃出再落下（两端低中间高）。 */
  const flight = async (path: 'dive' | 'arc'): Promise<void> => {
    if (mood === 'drag' || mood === 'fly' || destroyed) return
    mood = 'fly'
    breathe.cancel() // 内联 transform 会被 pause 态 breathe 的 WAAPI 效果顶掉，必须 cancel
    const homeX = x
    const s = cur()
    img.src = (path === 'dive' ? s.imageFly : undefined) ?? s.image
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
    setFacing(dir)
    const startX = dir === 1 ? -200 : window.innerWidth + 120
    const endX = dir === 1 ? window.innerWidth + 120 : -200
    const amp = window.innerHeight * (0.22 + Math.random() * 0.4) // 弧顶高度=航道（0.22~0.62 屏高，多只在飞不叠层）
    const dur = 2000 + Math.random() * 1600 // 时长抖动，多只在飞时自然错开
    const start = performance.now()
    let spouted = false
    await new Promise<void>((resolve) => {
      const step = (now: number): void => {
        if (destroyed || mood !== 'fly') { resolve(); return }
        const t = Math.min(1, (now - start) / dur)
        x = startX + (endX - startX) * t
        let yOff: number
        let rot: number
        if (path === 'dive') {
          // 向上抛物线飞越（两端低、弧顶高）。飞行图固有姿态≈头朝右水平微低头，
          // 旋转给切线补偿：起攀抬头→弧顶水平→下落低头。
          // 注意：镜像父级内 rotate 方向随镜像自洽，不能再乘 dir（实测乘了就底朝天）
          yOff = -Math.sin(Math.PI * t) * amp
          rot = -5 - Math.cos(Math.PI * t) * 45
        } else {
          // 跃出水面弧线：两端低、弧顶高；抬头跃出、低头落回（沿切线，同样不乘 dir）
          yOff = -Math.sin(Math.PI * t) * amp
          rot = -Math.cos(Math.PI * t) * 48
        }
        root.style.transform = `translateX(${x}px) translateY(${yOff}px) scaleX(${facing})`
        img.style.transform = `rotate(${rot}deg)`
        // 鲸鱼弧顶喷水窗
        if (path === 'arc' && s.imageSpout !== undefined) {
          if (!spouted && t > 0.42 && t < 0.62) {
            spouted = true
            img.src = s.imageSpout
          } else if (spouted && t >= 0.62) {
            img.src = s.image
          }
        }
        if (t < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
    if (destroyed) return
    if (mood !== 'fly') return // 飞行中被拎走/接管：不抢状态（也不发落地回调）
    x = homeX
    img.style.transform = ''
    img.src = skinIdle()
    applyX()
    breathe.play()
    mood = 'idle'
    assets.onFlightEnd?.() // 与 applyX 同一同步段：落地即藏也不会闪一帧
  }

  /** 菜单/一起飞：路线随机（dive 抛物线 / arc 跃出弧），方向与时长见 flight 内随机。 */
  const flyAcross = (): Promise<void> => flight(Math.random() < 0.7 ? 'dive' : 'arc')

  /** 全程引擎声：按皮肤 voice 选合成器拉伸到全长（驶出吼 → 巡航 → 到站泄油）；
   *  与戳出去的短促"轰"叠加（shout 仍走 playVoice），静止/静音自吞。 */
  const driveEngine = (durS: number): void => {
    if (muted || masterVolume === 0) return
    const ctx = audioCtx()
    if (ctx === null) return
    const v = cur().voice
    if (v === 'motor') synthMotor(ctx, durS)
    else if (v === 'engine') synthEngine(ctx, durS)
  }
  /** 地面横穿（警车/摩托签名）：引擎声开吼 → 沿路面冲出屏幕 → 从另一侧杀回 → 滑回原位。
   *  演出风格走皮肤 driveStyle：**前段（冲出+进场）平开，回归段（0.64-1 滑回）才演**
   *  wheelie=抬前轮庆祝 / wiggle=摇头晃脑 / random 每次抽（冲线庆祝语义）。 */
  const driveAcross = async (): Promise<void> => {
    if (mood === 'drag' || mood === 'fly' || destroyed) return
    mood = 'fly'
    breathe.cancel()
    const s = cur()
    const homeX = x
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
    setFacing(dir)
    // 声音：driveSound（如警笛）优先，否则按 voice 拉长做全程引擎（驶出吼→巡航→到站泄油）
    if (s.driveSound !== undefined && !muted && masterVolume > 0) {
      const ctx = audioCtx()
      if (ctx !== null) playSynthVoice(s.driveSound)
    } else {
      driveEngine(3.5)
    }
    const style = s.driveStyle === 'random' ? (Math.random() < 0.5 ? 'wheelie' : 'wiggle') : s.driveStyle ?? 'normal'
    // 开车灯闪：有 lamp 对且没 imageDrive 时，drive 全程 180ms 快速交替（平时 lampIdle=false 不闪）
    let driveLampTimer = 0
    if (s.imageLampA !== undefined && s.imageLampB !== undefined && s.imageDrive === undefined) {
      driveLampTimer = window.setInterval(() => {
        lampOn = !lampOn
        if (!destroyed && mood === 'fly') img.src = lampOn ? cur().imageLampA as string : cur().imageLampB as string
      }, 180)
    } else if (s.imageDrive !== undefined) {
      img.src = s.imageDrive
      driving = true
    }
    const w = root.getBoundingClientRect().width
    const off = w + 40
    const start = performance.now()
    // 分段：0-0.34 冲出本侧屏外 → 0.36-0.62 从另一侧进场 → 0.64-1 滑回原位（带减速）
    const dur = 3600
    await new Promise<void>((resolve) => {
      const step = (now: number): void => {
        if (destroyed || mood !== 'fly') { resolve(); return }
        const t = Math.min(1, (now - start) / dur)
        let nx: number
        if (t < 0.34) nx = homeX + dir * window.innerWidth * ((t / 0.34) ** 1.6) // 加速冲出
        else if (t < 0.36) nx = dir === 1 ? -off : window.innerWidth + off // 屏幕外一闪
        else if (t < 0.62) {
          const k = (t - 0.36) / 0.26
          nx = (dir === 1 ? -off : window.innerWidth + off) + (dir === 1 ? 1 : -1) * (window.innerWidth + off * 2) * k
        } else {
          const k = (t - 0.64) / 0.36
          const e = 1 - (1 - k) * (1 - k) // easeOut：减速滑回
          nx = (dir === 1 ? window.innerWidth + off : -off) + (homeX - (dir === 1 ? window.innerWidth + off : -off)) * e
        }
        x = nx
        // 前段平开；0.64 起在屏幕外**调头**（朝行进方向），回归段逆向前进 = 掉头开回来
        const f = t >= 0.64 ? (dir === 1 ? -1 : 1) : dir
        if (f !== facing) setFacing(f) // 屏幕外调头：气泡/菜单里的字立即跟着消镜像
        let rot = 0
        // 回归段才演冲线庆祝（wheelie 抬前轮 / wiggle 摇头；镜像父级内不乘 dir）
        if (t >= 0.64) {
          if (style === 'wheelie') rot = -24
          else if (style === 'wiggle') rot = Math.sin((t - 0.64) * Math.PI * 21) * 9
        }
        root.style.transform = `translateX(${x}px) scaleX(${facing})`
        img.style.transform = `rotate(${rot}deg)`
        if (t < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
    if (destroyed) return
    if (mood !== 'fly') return
    x = homeX
    // 停在哪就朝哪：保留回归段朝向（不还原开车前朝向——到家瞬间翻头很出戏）
    if (driveLampTimer !== 0) window.clearInterval(driveLampTimer)
    img.style.transform = ''
    img.src = skinIdle()
    driving = false // 开车图用完还原（顺序：防 mouthShut 在还原前的余缝里踩图）
    applyX()
    breathe.play()
    mood = 'idle'
  }

  /** 皮肤的事件默认绑定（角色包 events 声明；无声明回落 signature/hops）。 */
  const defaultsOf = (gid: string): { done: ActionName; poke: ActionName } =>
    assets.defaultActions?.(gid) ?? { done: 'signature', poke: 'hops' }
  /** 当前皮肤的完成绑定（按皮肤记，缺配回落角色包声明的默认）。 */
  const doneAction = (): ActionName => asAction(config.getSnapshot().actions[skin.id]?.done, defaultsOf(skin.id).done)
  /** 当前皮肤的戳一下绑定（按皮肤记，缺配回落角色包声明的默认）。 */
  const pokeAction = (): ActionName => asAction(config.getSnapshot().actions[skin.id]?.poke, defaultsOf(skin.id).poke)

  /** 事件动作派发：signature 解析为当前皮肤签名；random 现场抽。 */
  const runAction = (name: ActionName): void => {
    if (destroyed || mood === 'drag' || mood === 'fly' || mood === 'celebrate') return
    // 演出进行中（roll/dance/... 的 mood 就是 celebrate）不再叠开：两个 rAF 循环
    // 同时写 x/transform 互相覆盖，表现成「戳了没滚」或滚一半闪回（踩过）
    wakeFromSleep() // 睡着（压扁变暗）触发动作先回正常态，不做梦游演出
    let pick = name
    if (pick === 'signature') pick = cur().signature
    // 随机池剔除：drive（车类演出留给车系皮肤自己绑，随机抽到牛来开车很出戏）
    // 与 fly/breach（无飞行图的皮肤飞起来 = 站图平移，旋转补偿幅度小到看不出——
    // 「随机到平移动作」就是这么来的：穿山甲站图从头滑到尾）。无翼皮肤落到签名动作。
    if (pick === 'random') {
      const s = cur()
      const pool = ACTION_POOL.filter((a) => a !== 'drive' && !((a === 'fly' || a === 'breach') && s.imageFly === undefined))
      pick = pool[Math.floor(Math.random() * pool.length)]
    }
    if (pick === 'fly') {
      void flyAcross()
      return
    }
    if (pick === 'breach') {
      void flight('arc')
      return
    }
    if (pick === 'drive') {
      void driveAcross()
      return
    }
    // 清掉 img 上所有残留 WAAPI 动画（走路 wobble/小跳/落地回弹/扭一扭）：
    // 它们 cancel 时机在 await 之后可能被打断而残留，WAAPI 优先级高于内联
    // transform，会把 roll 的每次 rotate() 遮住——球「平移不转」就是这么来的（踩过）
    for (const a of img.getAnimations()) a.cancel()
    mood = 'celebrate'
    const gen = ++actionGen // 本代动作的收尾权：poke 顶掉后旧代 done 无权清 mood
    const done = (): void => {
      if (destroyed || gen !== actionGen) return // 被顶掉的旧代（如 poke 放行重开）不抢新动作的 mood
      if (mood === 'celebrate') mood = 'idle'
    }
    const run = pick === 'dance' ? dance()
      : pick === 'spin' ? spin()
        : pick === 'sway' ? sway()
          : pick === 'roll' ? roll()
            : pick === 'split' ? split()
              : hops3()
    void run.then(done)
  }

  const behave = (): void => {
    if (destroyed) return
    if (mood === 'idle') {
      const rollDie = Math.random()
      if (rollDie < 0.3) {
        void hop(26, 300) // 原地小跳
      } else if (rollDie < 0.62 && walkOn && !demoDoll && !pinned) {
        // 展示性挂载（全家福列队）与被钉住的（合影 C 位主宠）不游走，站在位槽里
        clampX()
        const span = Math.min(260, window.innerWidth * 0.2)
        const target = Math.min(Math.max(0, x + (Math.random() * 2 - 1) * span * 2), window.innerWidth - 70)
        if (Math.abs(target - x) > 40) void walkTo(target)
      } else if (rollDie < 0.78 && sleepOn) {
        void sleepFor(4000 + Math.random() * 4000)
      } else {
        // 原地扭一扭
        breathe.pause()
        void img.animate(
          [{ transform: 'rotate(0)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(0)' }],
          { duration: 620, easing: 'ease-in-out' },
        ).finished.then(() => { if (!destroyed) breathe.play() }).catch(() => {})
      }
    }
    behaveTimer = window.setTimeout(behave, 6000 + Math.random() * 8000)
  }
  behaveTimer = window.setTimeout(behave, 5000)

  // ---- 气泡唠叨：AI 忙时报耗时，闲时随机吐槽 ----
  let chatterTimer = 0
  const chatter = (): void => {
    if (!destroyed && talkative && mood === 'idle') {
      if (busyInfo !== null) {
        const sec = Math.floor((Date.now() - busyInfo.since) / 1000)
        if (sec >= 30) showBubble(`「${busyInfo.label}」的AI已经跑了 ${fmtDur(sec)}…`, 2800)
      } else if (Math.random() < 0.6) {
        // 语录按只解析：本只专属 → 全局自定义 → 内置通用池；皮肤专属语录始终并入
        const c = config.getSnapshot()
        const custom = petId === 'main' ? c.quips : (c.extraPets.find((p) => p.id === petId)?.quips ?? c.quips)
        const pool = (custom.length > 0 ? custom : QUIPS).concat(cur().quips ?? [])
        showBubble(pool[Math.floor(Math.random() * pool.length)], 2400)
      }
    }
    chatterTimer = window.setTimeout(chatter, 35000 + Math.random() * 40000)
  }
  chatterTimer = window.setTimeout(chatter, 20000)

  // ---- 触发 ----
  let lastCelebrate = 0
  // 循环喊（shoutLoop）：完成后每隔 ~2.4s+喊声全长 再喊一声，直到互动停止
  // （戳/拖/新任务开始/静音或开关关闭）；60 声兜底自停，防忘关叫一宿。
  let shoutLoopTimer = 0
  let shoutLoopLeft = 0
  /** 庆祝代际：每次 fireCelebrate/打断 +1，旧连喊链读到代际不符即自杀
   *  （bool 旗会被新一轮复位误伤——旧链会复活，用代际一了百了）。 */
  let celebrateGen = 0
  /** 待延迟庆祝代际：延迟调度（新完成顶掉旧的待延迟）与「用户已处理」事件
   *  （戳/拖/新任务开跑）都 +1，定时器到点读取代际不符即死——
   *  延迟期间用户已经处理过（应声或发了新消息）的完成不再喊。 */
  let pendingCelebrateGen = 0

  /** 当场掐断在播的喊声 + 合嘴 + 连喊链作废（打断语义：被应声了还喊完长尾音就像没听见）。 */
  const cutPlayingShout = (): void => {
    celebrateGen++
    chainActive = false
    if (playingAudio !== null) {
      playingAudio.pause()
      playingAudio = null
    }
    stopShoutAnim() // 打断路径：帧演出的 left/height 残留一并复位（循环喊改保持演出帧后靠这里归位）
    shouting = false
    mouthShut() // 顺便清掉嘴型时间线（mouthTimers 一并清了）
  }

  /** 停循环；withReply=true（互动/新任务打断）且循环确实在跑时，妈妈回一句。
   *  reason 只为定位「谁停的」留日志（踩过「没互动就停」的排查坑）。
   *  互动/语音打断时顺带点杀在播喊声与未放完的连喊链（此前只停循环不停链，
   *  shoutCount>1 时「识别到了还一直叫」就是这么来的）。 */
  const stopShoutLoop = (withReply = false, reason = '?'): boolean => {
    const wasActive = shoutLoopTimer !== 0 || shoutLoopLeft > 0
    window.clearTimeout(shoutLoopTimer)
    shoutLoopTimer = 0
    shoutLoopLeft = 0
    if (wasActive) console.log(`[dsh-niulai-pet] shout loop stop: ${reason}`)
    if (withReply && wasActive) {
      cutPlayingShout()
      playReply()
    } else if (wasActive && playingAudio === null && !shouting) {
      // 循环死在笑声间隙（语音命中/静音/新任务顶掉）：演出帧还在滚放，这里归位；
      // 在放中的由嘴型时间线终点自己归位，不打断
      stopShoutAnim()
      if (mood !== 'fly') img.src = skinIdle()
    }
    syncVoice() // 循环停 → 立即关麦停流
    return wasActive
  }

  // ---- 语音停喊（voiceControl）：循环喊期间开麦识别「牛来」，命中即停循环 ----
  // 模板是「牛来！」的长切版+参考版；命中回调 stopShoutLoop(false)——用户亲自喊了
  // 「牛来」就是扮演了妈妈，不再播录音回应（抢台词），互动打断才回一句
  // ——停止时妈妈回一句，闭环达成。不常驻：只在循环喊进行中开麦。
  let voice: VoiceStopHandle | null = null
  let voiceStarting = false
  /** 开听条件：开关开 + 非静音 + 循环喊在跑（模板全局——长切版+参考版，与皮肤无关）。 */
  const voiceWanted = (): boolean =>
    voiceControlOn && !muted && !destroyed
    && (shoutLoopTimer !== 0 || shoutLoopLeft > 0)
  let lastScoreFwd = 0
  const syncVoice = (): void => {
    if (!voiceWanted()) {
      if (voice !== null) {
        voice.stop()
        voice = null
        voiceDebug?.publish({ listening: false })
      }
      return
    }
    if (voice !== null || voiceStarting) return
    voiceStarting = true
    const handle = startVoiceStop({
      engine: () => voiceEngine,
      // KWS 引擎：worker 装载失败 reject，voice.ts 自动回落模板引擎；
      // 指令词取自当前配置（改词 = 重建监听 + 重建 KWS worker）
      kwsMatcher: async (onHit) => createKwsMatcher(kwsKeywordsKey(voiceKeywords), () => { onHit() }),
      // 自录模板排最前（本人嗓音匹配最强），两个电影模板兜底
      templateSrcs: () => [voiceTemplate === '' ? undefined : voiceTemplate, REPLY_MATCH, REPLY_REF],
      micDeviceId: () => micDeviceId,
      micGain: () => micGain,
      threshold: () => voiceThreshold,
      onMatch: () => {
        voiceDebug?.publish({ matchedAt: Date.now(), listening: false })
        cutPlayingShout() // 用户已应声：当场掐断在播的「妈妈」和剩余连喊
        stopShoutLoop(false, '语音命中')
        // 噤声一幕：嘘——（不播录音：妈妈那句是用户亲口喊的）
        showBubble('😷 唔——', 2000, true)
        if (mood === 'idle') void hop(26, 300)
      },
      // 报分节流：评估每 50ms 一次，卡片状态行 300ms 一刷足够
      onScore: (score) => {
        const now = Date.now()
        if (now - lastScoreFwd < 300) return
        lastScoreFwd = now
        voiceDebug?.publish({ lastScore: score })
      },
    })
    void handle.ready.then((ok) => {
      voiceStarting = false
      if (!ok) return
      if (voiceWanted()) {
        voice = handle
        voiceDebug?.publish({ listening: true, lastScore: null })
      } else {
        handle.stop() // 就绪期间循环已被互动停掉：立即关麦，不留尾巴
      }
    })
  }

  const shoutLoopTick = (): void => {
    shoutLoopTimer = 0
    if (destroyed || !shoutLoopOn || muted || shoutLoopLeft <= 0) {
      stopShoutLoop(false, '喊够/开关关闭')
      return
    }
    if (mood === 'drag' || mood === 'fly') {
      // 动作（飞行/跃出水面）或拖拽中：这声先不喊、过 1.2s 再试，不消耗次数。
      // 此前是直接 stop——完成动作选了飞/随机时循环第一声都没放就死了（踩过）
      shoutLoopTimer = window.setTimeout(shoutLoopTick, 1200)
      return
    }
    shoutLoopLeft--
    const ms = playNotify()
    if (ms > 0) mouthShout(ms)
    const text = cur().shoutBubble
    showBubble(text === '' ? '！' : text, Math.max(1500, ms + 300))
    shoutLoopTimer = window.setTimeout(shoutLoopTick, Math.max(ms, 600) + 2400)
  }

  const fireCelebrate = (): void => {
    if (destroyed) return
    celebrateGen++ // 新一轮庆祝：旧连喊链（若有）代际不符自然死
    if (cur().halo === true) showHalo() // 完成光环：仅皮肤声明 halo 的角色（幽灵系）
    if (shoutOnDone && !muted) {
      if (shoutLoopOn) {
        // 循环模式：连喊几声对循环无意义，跳过接龙直接布防循环（第一声 0.6s 后）
        shoutLoopLeft = 60
        shoutLoopTimer = window.setTimeout(shoutLoopTick, 600)
        syncVoice() // 循环喊开始 → 语音停喊开听（开关开着且环境支持时）
      } else {
        // 连喊 N 声串行接龙：一声放完接下声；每声「开-合-开-保持」，声止嘴合
        const gen = celebrateGen
        chainActive = true
        const chain = (n: number): void => {
          if (destroyed || gen !== celebrateGen) { chainActive = false; return }
          if (n <= 0) {
            chainActive = false
            playReply() // 接龙放完妈妈回一句
            return
          }
          const ms = playNotify()
          if (ms <= 0) return
          const next = (): void => chain(n - 1)
          if (cur().imageShout === undefined) window.setTimeout(next, ms)
          else mouthShout(ms, next)
        }
        chain(shoutCount)
        const text = cur().shoutBubble
        showBubble(Array(shoutCount).fill(text).join(' '), 1400 + shoutCount * 2200)
      }
    }
    const action = doneAction()
    if (!(shoutOnDone && !animAllows(action))) runAction(action) // 帧演出即庆祝本体时动作让位；安静模式照做
  }

  /** 有喊叫动画且会出声：帧序列本身就是演出，移动类动作（翻滚/跳）得让位。
   *  split 例外：分裂自身就是完整演出，和爆炎帧同台没问题（火史莱姆喊=喷火、戳=分裂）。
   *  注意先解析签名占位符——incoming 是 'signature' 时要落到皮肤实际签名再判。 */
  const animAllows = (a: ActionName): boolean => {
    let pick = a
    if (pick === 'signature') pick = cur().signature
    if (pick === 'random') return true
    return pick === 'split' || !((cur().shoutAnim?.length ?? 0) > 0 && !muted && masterVolume > 0)
  }

  const celebrate = (): void => {
    const now = Date.now()
    if (now - lastCelebrate < 6000 || mood === 'drag' || mood === 'fly' || destroyed) return
    lastCelebrate = now
    stopShoutLoop(false, '新一轮完成顶掉') // 新一轮完成顶掉上一轮未停的循环
    const delayMs = doneDelaySec * 1000
    if (delayMs > 0) {
      // 代际 +1：既顶掉旧的待延迟庆祝，也是「延迟期间被处理」的判死依据
      const gen = ++pendingCelebrateGen
      window.setTimeout(() => {
        if (destroyed || gen !== pendingCelebrateGen) return
        fireCelebrate()
      }, delayMs)
      return
    }
    pendingCelebrateGen++ // 立即庆祝也作废任何待延迟的（边界：延迟中又把延迟改回 0）
    fireCelebrate()
  }

  /** 只喊不跳（戳一下的出声部分）：嘴部张合与气泡都撑满喊声全长，
   *  喊完妈妈回一句（开关控制；loop 打断已回过的不重复）。
   *  再喊先掐旧的：叠着放 = 两重唱（长笑声被连戳时尤其灾难）。
   *  静音只静音——动作演出照常（趴睡皮「坐起来叫」的站立图就挂在 mouthShout
   *  的 isLaydown 分支上；静音返回 0 时长会把整条演出链掐掉，猫被戳趴着不动，
   *  观感像死了——踩过）。 */
  const shout = (): void => {
    if (mood === 'drag' || mood === 'fly' || destroyed) return
    wakeFromSleep()
    cutPlayingShout()
    // 静音时取皮肤默认叫声时长撑演出（只用于张合时序与气泡，不真的出声）
    const ms = playVoice() || DEFAULT_SHOUT_MS
    mouthShout(ms)
    const shoutAt = Date.now()
    // 静音不出声就不安排回声；气泡是视觉反馈，照常显示（哑剧演出）
    if (!(muted || masterVolume === 0)) {
      const replyAt = shoutAt
      window.setTimeout(() => { if (lastReplyAt < replyAt) playReply() }, ms)
    }
    showBubble(cur().shoutBubble === '' ? '！' : cur().shoutBubble, Math.max(1500, ms + 300))
  }

  /** 戳一下（点击宠物）：喊 + 绑定动作，肯定要跳；互动即停循环喊（妈妈回一句）。
   *  红温：爆发中不理人（0.5s 甩头窗口）；气头冷却期照常应声出气泡，只是不积火（加火被 addHeat 内部冷却门挡住）。 */
  const poke = (): void => {
    if (mood === 'drag' || mood === 'fly' || destroyed || raging) return
    // 演出/庆祝进行中戳它：用户应声优先级最高——mood 放回 idle 让当前动作
    // （rAF 循环的 mood 守卫）自然收尾（roll 收尾无条件清球图/transform），
    // 并给即将重开的动作开路；否则 runAction 的 mood==='celebrate' 守卫会把
    // 这次戳弹掉——表现成「走路中戳它没滚」（踩过：任务完成庆祝抢跑 3.6s，
    // 走路中戳全程被吞，视觉上是平移）。
    // 代际 +1：旧动作收尾无权清新动作的 mood（旧代 done 凭 gen 判死）。
    if (mood === 'celebrate') { mood = 'idle'; actionGen++ }
    if (heatOn && addHeat()) return
    pendingCelebrateGen++ // 戳 = 用户已应声：延迟中的完成庆祝判死
    // 循环/连喊在放时戳 = 应声停它：妈妈回一句即可，别再喊一声「妈妈」当复读机
    const wasLooping = stopShoutLoop(true, '戳一下')
    const wasChain = chainActive
    if (wasChain) {
      cutPlayingShout()
      playReply()
    }
    if (!wasLooping && !wasChain) shout()
    const act = pokeAction()
    if (animAllows(act)) runAction(act) // 帧演出在放时移动类动作让位（否则大笑帧被转成陀螺）
  }

  // ---- 指针交互（点击 vs 拖拽）----
  let dragStartX = 0
  let dragStartY = 0
  let petStartX = 0
  let dragging = false
  let downAt = 0

  root.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return
    // 菜单/关于面板内的点击：不进入拖拽与戳判定（否则 setPointerCapture
    // 会把行点击截胡成 poke —— 历史上"点菜单=喊一声"的 bug 就出自这里）
    if (menu.contains(ev.target as Node) || about.contains(ev.target as Node)) return
    dragging = false
    downAt = performance.now()
    if (fallRaf !== 0) { cancelAnimationFrame(fallRaf); fallRaf = 0 } // 坠落中被薅住：接管
    moveSamples = []
    pendingCelebrateGen++ // 任意上手互动（拖拽/点击预备）：延迟中的完成庆祝判死
    stopShoutLoop(true, '上手互动') // 任意上手互动（含拖拽与点击预备）都停循环喊，妈妈回一句
    dragStartX = ev.clientX
    dragStartY = ev.clientY
    petStartX = x
    root.setPointerCapture(ev.pointerId)
  })

  root.addEventListener('pointermove', (ev) => {
    if (downAt === 0) return
    const dx = ev.clientX - dragStartX
    const dy = ev.clientY - dragStartY
    if (!dragging && Math.hypot(dx, dy) > 6) {
      dragging = true
      const wasFlying = mood === 'fly'
      mood = 'drag'
      breathe.cancel() // 拎起倾斜用的是内联 transform，pause 态 breathe 会顶掉它
      // 只有飞行中被拎起才换回站立图；喊叫演出（shoutAnim/张嘴帧）在放时拎着不中断——
      // 此前无差别换站立图，演出画面没了笑声还在放（踩过）
      if (wasFlying) img.src = skinIdle()
      root.style.cursor = 'grabbing'
      myZ = ++zCounter // 抓起即认领置顶（松手后保持，不再落回挂载序）
      root.style.zIndex = String(myZ)
    }
    if (dragging) {
      // root 变换是 translateX 叠 scaleX：屏幕位移与 x 恒 1:1，与朝向无关
      x = petStartX + dx
      clampX()
      // 垂直 1:1 跟随（可拎到半空，钳在视口内）；松手进入重力坠落
      liftY = Math.max(maxLiftAt(), Math.min(0, dy))
      root.style.transform = `translateX(${x}px) scaleX(${facing}) translateY(${liftY}px)`
      // 拖拽倾斜按瞬时速度（拎静止自动回正；以前按总位移，拎在半空一直歪着）
      const nowT = performance.now()
      const prevS = moveSamples[moveSamples.length - 1]
      const instV = prevS !== undefined && nowT > prevS.t ? (ev.clientX - prevS.x) / (nowT - prevS.t) : 0
      img.style.transform = `rotate(${Math.max(-16, Math.min(16, instV * 34))}deg)`
      moveSamples.push({ t: nowT, x: ev.clientX })
      if (moveSamples.length > 4) moveSamples.shift()
    }
  })

  /** 落地压扁回弹（坠落越深压越扁）+ 闷响（深度定音量）。砸落碰撞在 startFall 首次触地时触发。
   *  果冻皮肤：多段阻尼弹跳（压扁→拉长→小幅震荡收束）+ 啵嘤声，物理玩具感的核心。 */
  const landSquash = (dropH: number): void => {
    if (cur().jelly === true) {
      const deep = Math.min(0.42, dropH / 1000)
      void img.animate(
        [
          { transform: 'scale(1,1)', offset: 0 },
          { transform: `scale(${1 + deep * 0.9},${1 - deep})`, offset: 0.2 },
          { transform: `scale(${1 - deep * 0.5},${1 + deep * 0.55})`, offset: 0.42 },
          { transform: `scale(${1 + deep * 0.28},${1 - deep * 0.26})`, offset: 0.62 },
          { transform: `scale(${1 - deep * 0.12},${1 + deep * 0.13})`, offset: 0.8 },
          { transform: 'scale(1,1)', offset: 1 },
        ],
        { duration: 520 + Math.min(380, dropH / 2), easing: 'ease-out' },
      ).finished.catch(() => {})
      if (!muted && dropH > 30) {
        const ctx = audioCtx()
        if (ctx !== null) synthBoing(ctx, Math.min(1, dropH / 500))
      }
      return
    }
    const deep = Math.min(0.35, dropH / 1200)
    void img.animate(
      [{ transform: 'scaleY(1)' }, { transform: `scaleY(${1 - deep})` }, { transform: 'scaleY(1)' }],
      { duration: 260 + Math.min(220, dropH / 3), easing: 'ease-out' },
    ).finished.catch(() => {})
    if (!muted && dropH > 30) {
      const ctx = audioCtx()
      if (ctx !== null) synthThud(ctx, Math.min(1, dropH / 500))
    }
  }

  /** 重力坠落：liftY 加速归零；松手水平初速度=抛掷（指数衰减）。
   *  mood 保持 'drag' 到落地（behave/动作/睡眠全挡）；坠落期按水平速度顺势倾斜；
   *  首次触地判砸落碰撞——压实在别只头上时不落定，朝空隙侧弹开滑下（上限 2 次防卡死）；
   *  落定才归位直立 + 压扁回弹 + z 序还原。 */
  const startFall = (): void => {
    const s = moveSamples
    let vx = 0
    if (s.length >= 2) {
      const dt = s[s.length - 1].t - s[0].t
      if (dt > 0) vx = (s[s.length - 1].x - s[0].x) / dt
    }
    vx = Math.max(-1.2, Math.min(1.2, vx))
    moveSamples = []
    const dropH = -liftY
    let vy = 0
    let impacted = false // 砸落碰撞只在首次触地判定（弹开后不重复砸）
    let bounces = 0
    let last = performance.now()
    const step = (now: number): void => {
      if (destroyed) return
      const dt = Math.min(50, now - last)
      last = now
      vy += 0.0035 * dt // 重力加速度 px/ms²（400px 约 0.48s 落地）
      liftY = Math.min(0, liftY + vy * dt)
      if (vx !== 0) {
        x += vx * dt
        vx *= Math.pow(0.997, dt)
        if (Math.abs(vx) < 0.02) vx = 0
        clampX()
      }
      // 坠落姿态：随水平速度倾斜（抛出方向），落定才回正
      img.style.transform = vx !== 0 ? `rotate(${Math.max(-22, Math.min(22, vx * 26))}deg)` : ''
      root.style.transform = `translateX(${x}px) scaleX(${facing}) translateY(${liftY}px)`
      if (liftY < 0) {
        fallRaf = requestAnimationFrame(step)
        return
      }
      if (!impacted) {
        impacted = true
        const { onHead } = impactAt(petId, x, root.getBoundingClientRect().width, dropH)
        if (onHead !== null && bounces < 2) {
          bounces++
          vx = onHead * (0.25 + Math.random() * 0.15)
          vy = -(0.08 + Math.min(0.08, dropH / 6000))
          liftY = -1
          fallRaf = requestAnimationFrame(step)
          return
        }
      }
      fallRaf = 0
      liftY = 0
      mood = 'idle'
      img.style.transform = ''
      root.style.transform = `translateX(${x}px) scaleX(${facing})`
      saveMyX(x)
      landSquash(dropH)
      if (!destroyed) breathe.play()
    }
    fallRaf = requestAnimationFrame(step)
  }

  root.addEventListener('pointerup', (ev) => {
    const wasDragging = dragging
    const quick = performance.now() - downAt < 350
    dragging = false
    downAt = 0
    root.style.cursor = 'grab'
    img.style.transform = ''
    if (wasDragging) {
      if (liftY < -8) {
        startFall() // 拎起到半空松手：重力坠落（mood 保持 'drag' 到落地，自会归位保存）
      } else {
        mood = 'idle'
        liftY = 0 // 微抬直接放：归零，否则后续 applyX 会把残留的几 px 悬浮量写回去
        root.style.transform = `translateX(${x}px) scaleX(${facing})`
        saveMyX(x)
        // 落地回弹
        void hop(20, 260)
        if (!destroyed) breathe.play()
      }
    } else if (quick) {
      poke()
    }
    try { root.releasePointerCapture(ev.pointerId) } catch { /* 已释放 */ }
  })

  // ---- 右键菜单 ----
  type Row =
    | { kind: 'bool'; label: string; on: boolean; fn: () => void }
    | { kind: 'cycle'; label: string; value: string; fn: () => void }
    | { kind: 'action'; label: string; fn: () => void }
    | { kind: 'slider'; label: string; value: number; min: number; max: number; unit: string; fn: (v: number) => void; preview: (v: number) => void }
    | { kind: 'vol'; label: string; muted: boolean; volume: number; fn: (v: number) => void; preview: (v: number) => void; onMute: () => void }
    | { kind: 'skins'; label: string; options: Array<{ id: string; name: string }>; fn: (id: string) => void }

  /** 菜单即乐园：只留高频开关/动作；低频配置（完成喊几声/打盹/碰撞/动作绑定等）全归设置面板。 */
  const rebuildMenu = (): void => {
    menu.textContent = ''
    const skinIdx = skins.indexOf(skin)
    const nextSkin = skins[(skinIdx + 1) % skins.length]
    // 读写都走 ConfigStore：菜单行只发写请求，显示值来自 store 快照镜像
    // （store 变更 → 文末订阅 → syncConfig + 菜单就地重建，设置卡片同理）
    const rows: Row[] = [
      // 音量=静音按钮+滑杆合并：静音显示 0 但值保留；滑到 0 自动静音、拉高自动解除
      { kind: 'vol', label: '📢 音量', muted, volume: masterVolume, fn: (v) => { config.set({ volume: v, muted: v === 0 }) }, preview: (v) => { masterVolume = v; if (volNode !== null) volNode.gain.value = v / 100 }, onMute: () => { config.set({ muted: !muted }) } },
      {
        kind: 'slider', label: '📏 大小', value: petH, min: 72, max: 200, unit: 'px',
        fn: setMySize,
        // 预览只动镜头（视觉即时反馈）；帧缓存/预读留给 syncConfig 落盘后统一做
        preview: (v) => { petH = v; root.style.height = `${v}px`; img.style.height = `${v}px` },
      },
      {
        kind: 'slider', label: '🌈 色相', value: petHue, min: 0, max: 360, unit: '°',
        fn: setMyHue,
        preview: (v) => { petHue = v; applyImgFilter() },
      },
      {
        kind: 'slider', label: '🌫 透明度', value: petOpacity, min: 20, max: 100, unit: '%',
        fn: setMyOpacity,
        preview: (v) => { petOpacity = v; applyImgFilter() },
      },
      { kind: 'bool', label: '💬 气泡', on: talkative, fn: () => { config.set({ talkative: !talkative }) } },
      { kind: 'skins', label: '🎨 皮肤', options: skins.map((s) => ({ id: s.id, name: s.name })), fn: (id) => { setMySkin(id) } },
      { kind: 'action', label: '🕊 飞一圈', fn: () => { void flyAcross() } },
      { kind: 'action', label: '🎭 表演一下', fn: () => { shout(); if (animAllows('signature')) runAction('signature') } },
      ...(assets.onFamilyToggle !== undefined
        ? [{ kind: 'action', label: '👪 全家福', fn: () => { assets.onFamilyToggle?.() } } as Row]
        : []),
      { kind: 'action', label: '⚙️ 设置', fn: () => { openSettings() } },
      { kind: 'action', label: 'ℹ️ 关于', fn: () => { about.style.display = about.style.display === 'block' ? 'none' : 'block' } },
    ]
    // 多只桌宠（数据按只分存：皮肤/位置各自独立，行为配置全局共享）：
    // 主宠可加（连主上限 3 只），额外表可送走；增减由 index.ts 的实例管家落地
    const extraList = config.getSnapshot().extraPets
    const maxExtras = config.getSnapshot().maxPets - 1
    if (petId === 'main' && extraList.length < maxExtras) {
      rows.splice(5, 0, {
        kind: 'action', label: '🐾 再添一只', fn: () => {
          const c = config.getSnapshot()
          if (c.extraPets.length >= c.maxPets - 1) return
          // 新宠皮肤用菜单正循环到的下一只（不然三只同款没有乐园感）
          config.set({ extraPets: [...c.extraPets, { id: `pet${Date.now().toString(36)}`, skin: nextSkin.id }] })
        },
      })
    }
    if (petId !== 'main') {
      rows.splice(5, 0, {
        kind: 'action', label: '🗑 送走这只', fn: () => {
          const c = config.getSnapshot()
          config.set({ extraPets: c.extraPets.filter((p) => p.id !== petId) })
        },
      })
    }
    for (const r of rows) {
      const row = document.createElement('div')
      row.style.cssText = 'padding:3px 14px;cursor:pointer;border-radius:6px;white-space:nowrap;display:flex;align-items:center;justify-content:space-between;gap:14px'
      const label = document.createElement('span')
      label.textContent = r.kind === 'cycle' ? `${r.label}：${r.value}` : r.label
      row.appendChild(label)
      if (r.kind === 'bool') {
        // 胶囊 switch：点击行任意处翻转
        const sw = document.createElement('span')
        sw.style.cssText = `width:28px;height:16px;border-radius:8px;flex:none;position:relative;transition:background .15s;background:${r.on ? '#3b82f6' : '#52525b'}`
        const knob = document.createElement('span')
        knob.style.cssText = `position:absolute;top:2px;left:${r.on ? '14px' : '2px'};width:12px;height:12px;border-radius:50%;background:#fff;transition:left .15s`
        sw.appendChild(knob)
        row.appendChild(sw)
      }
      if (r.kind === 'slider') {
        // 滑杆行：拖动实时预览，change/菜单关闭时落盘（行点击不收菜单）
        const wrap = document.createElement('span')
        wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px'
        const input = document.createElement('input')
        input.type = 'range'
        input.min = String(r.min)
        input.max = String(r.max)
        input.value = String(r.value)
        input.style.cssText = 'width:84px;accent-color:#3b82f6'
        const val = document.createElement('span')
        val.style.cssText = 'font-size:11px;color:#a1a1aa;min-width:28px;text-align:right'
        val.textContent = `${r.value}${r.unit}`
        input.addEventListener('input', () => {
          val.textContent = `${input.value}${r.unit}`
          r.preview(Number(input.value))
        })
        input.addEventListener('change', () => { r.fn(Number(input.value)) })
        wrap.appendChild(input)
        wrap.appendChild(val)
        row.appendChild(wrap)
      }
      if (r.kind === 'vol') {
        // 静音按钮 + 音量滑杆合并行：按钮翻转静音（行内重建），滑杆 preview/commit 同 slider
        const wrap = document.createElement('span')
        wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px'
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = r.muted ? '🔇' : '🔊'
        btn.title = r.muted ? '取消静音' : '静音'
        btn.style.cssText = 'font-size:12px;width:26px;height:18px;border-radius:6px;border:1px solid #3f3f46;background:none;cursor:pointer;padding:0;line-height:1;color:' + (r.muted ? '#3b82f6' : '#e4e4e7')
        const input = document.createElement('input')
        input.type = 'range'
        input.min = '0'
        input.max = '100'
        input.value = String(r.muted ? 0 : r.volume)
        input.style.cssText = 'width:84px;accent-color:#3b82f6'
        const val = document.createElement('span')
        val.style.cssText = 'font-size:11px;color:#a1a1aa;min-width:30px;text-align:right'
        const fmt = (): string => `${r.muted ? 0 : Math.round(r.volume)}%`
        val.textContent = fmt()
        btn.addEventListener('click', (ev) => { ev.stopPropagation(); r.onMute() })
        input.addEventListener('input', () => {
          val.textContent = `${input.value}%`
          r.preview(Number(input.value))
        })
        input.addEventListener('change', () => { r.fn(Number(input.value)) })
        wrap.appendChild(btn)
        wrap.appendChild(input)
        wrap.appendChild(val)
        row.appendChild(wrap)
      }
      if (r.kind === 'skins') {
        // 皮肤下拉：选即换（换肤写配置 → 菜单就地重建刷新显示值）
        const sel = document.createElement('select')
        for (const o of r.options) {
          const op = document.createElement('option')
          op.value = o.id
          op.textContent = o.name
          sel.appendChild(op)
        }
        sel.value = skin.id
        sel.style.cssText = 'font-size:12px;background:#27272a;color:#e4e4e7;border:1px solid #3f3f46;border-radius:6px;padding:2px 6px;max-width:130px'
        sel.addEventListener('change', () => { r.fn(sel.value) })
        row.appendChild(sel)
      }
      row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,.12)' }
      row.onmouseleave = () => { row.style.background = '' }
      row.onclick = () => {
        if (r.kind === 'slider' || r.kind === 'vol' || r.kind === 'skins') return // 滑杆/音量/下拉交互在控件上，点行不动作不收菜单
        r.fn()
        if (r.kind === 'action') {
          closeMenu()
        } else {
          rebuildMenu() // 开关/循环项：就地重建刷新，菜单不收起
        }
      }
      menu.appendChild(row)
    }
  }
  /** 滑杆预览未落盘的收尾：拖过没松 change 就关菜单时，按当前预览值落盘（所见即所得）。 */
  const commitSliderPreview = (): void => {
    if (petHue !== myHue(config.getSnapshot())) setMyHue(petHue)
    if (petOpacity !== myOpacity(config.getSnapshot())) setMyOpacity(petOpacity)
    if (petH !== mySize(config.getSnapshot())) setMySize(petH)
    if (masterVolume !== config.getSnapshot().volume) {
      config.set({ volume: masterVolume, muted: masterVolume === 0 })
    }
  }
  const closeMenu = (): void => {
    if (menu.style.display === 'block') commitSliderPreview()
    menu.style.display = 'none'
  }
  /** 「⚙️ 设置」：宿主给了面板通道就开悬浮设置面板，否则气泡指路（demo/旧宿主）。 */
  const openSettings = (): void => {
    if (assets.onOpenSettings !== undefined) {
      assets.onOpenSettings()
      return
    }
    showBubble('去 设置 → 插件配置 → 牛来桌宠', 3200, true)
  }
  root.addEventListener('contextmenu', (ev) => {
    ev.preventDefault()
    about.style.display = 'none'
    rebuildMenu()
    if (menu.style.display === 'block') closeMenu()
    else menu.style.display = 'block'
  })
  document.addEventListener('pointerdown', (ev) => {
    if (!root.contains(ev.target as Node)) {
      closeMenu()
      about.style.display = 'none'
    }
  })

  // 视口缩放时钳位
  const onResize = (): void => { clampX(); applyX() }
  window.addEventListener('resize', onResize)

  /** 被撞反应：调头朝受推方向小跳（重撞=被砸/高速，跳更高 + 闷响），睡着先唤醒。 */
  const bump = (dir: 1 | -1, strong: boolean): void => {
    if (destroyed || mood === 'drag' || mood === 'fly') return
    wakeFromSleep()
    setFacing(dir) // 被撞立即转身（气泡/菜单文字同步消镜像）
    void hop(strong ? 52 : 24, strong ? 460 : 280)
    if (strong && !muted) {
      const ctx = audioCtx()
      if (ctx !== null) synthThud(ctx, 0.6)
    }
  }

  // 物理碰撞（配置开关，默认关）：注册进 physics 世界，挤压/弹飞由它的循环驱动
  let unregisterBody: (() => void) | null = null
  const syncPhysics = (): void => {
    if (physicsOn && unregisterBody === null && !demoDoll) { // 展示性挂载（全家福）不进物理世界：列队不被挤散
      unregisterBody = registerBody({
        id: petId,
        getX: () => x,
        getW: () => root.getBoundingClientRect().width,
        getLiftY: () => -liftY, // liftY 是负值上移量，物理世界要底边离地正高度
        getH: () => petH,
        // 钳位用实际渲染宽（曾硬编码 60：大个子/倒地宽帧会被推进右墙或留缝）
        setX: (v) => { x = Math.min(Math.max(0, v), Math.max(0, window.innerWidth - root.getBoundingClientRect().width)); applyX() },
        bump,
        held: () => dragging || fallRaf !== 0,
      })
    } else if (!physicsOn && unregisterBody !== null) {
      unregisterBody()
      unregisterBody = null
    }
  }
  syncPhysics()

  // 配置同步：菜单/设置卡片/迁移 seed 任一端改动，经 store 订阅收敛到
  // 局部镜像；皮肤变化换装；菜单开着时就地重建刷新显示值
  const syncConfig = (): void => {
    const c = config.getSnapshot()
    if (c.muted !== muted) {
      muted = c.muted
      // 静音即时生效：掐断在播叫声 + 增益归零；解除恢复增益（滑杆/路由全走 volNode）
      if (muted) {
        playingAudio?.pause()
        cutPlayingShout()
        if (volNode !== null) volNode.gain.value = 0
      } else if (volNode !== null) {
        volNode.gain.value = masterVolume / 100
      }
    }
    shoutOnDone = c.shoutOnDone
    talkative = c.talkative
    shoutCount = c.shoutCount
    doneDelaySec = c.doneDelaySec
    shoutLoopOn = c.shoutLoop
    replyOn = c.replyNiulai
    customSoundOn = c.customSoundOn
    if (c.customSound !== customSound && c.customSound !== '') {
      // 自定义提示音换文件：预读元数据拿真实时长（气泡/嘴型撑满全长用）
      const probe = new Audio()
      probe.preload = 'metadata'
      probe.addEventListener('loadedmetadata', () => { soundDur.set(c.customSound, probe.duration) })
      probe.src = c.customSound
    }
    customSound = c.customSound
    sleepOn = c.sleepEnabled
    if (!sleepOn) wakeFromSleep() // 关打盹时若正睡着：立刻回正常态
    walkOn = myWalkOn(c)
    groundOff = c.groundOffset
    root.style.bottom = `${groundOff}px` // 离地高度（全局共享，各实例同步）
    physicsOn = c.physics
    heatOn = c.heatEnabled
    if (!heatOn && heat > 0) { heat = 0; applyImgFilter() } // 关红温：立即褪掉现有红
    const newVol = c.volume
    // 与 configVolume 比较，不跟 masterVolume 比——菜单 preview 会先把 masterVolume 拨到
    // 预览值，提交时两者相等就误判"没变化"跳过实时更新（踩过：大笑中途调音量听不到变化）
    if (newVol !== configVolume) {
      configVolume = newVol
      masterVolume = newVol
      // 即时生效：正在播的音与合成节点立刻跟新音量
      if (playingAudio !== null) playingAudio.volume = masterVolume / 100
      if (volNode !== null) volNode.gain.value = masterVolume / 100
    }
    hiddenAll = c.hidden
    root.style.display = c.hidden ? 'none' : '' // 隐藏全部（配置全局共享，所有实例同步隐没）
    syncPhysics()
    voiceControlOn = c.voiceControl
    micGain = c.micGain // 增益不进重启 diff：voice 馈送路径逐块读，热生效
    if (c.micDeviceId !== micDeviceId || c.voiceThreshold !== voiceThreshold || c.voiceTemplate !== voiceTemplate || c.voiceEngine !== voiceEngine
      || JSON.stringify(c.voiceKeywords) !== JSON.stringify(voiceKeywords)) {
      // 换麦克风/调阈值/换模板/换引擎/改指令词：正在听就重启监听用上新值
      micDeviceId = c.micDeviceId
      voiceThreshold = c.voiceThreshold
      voiceTemplate = c.voiceTemplate
      voiceEngine = c.voiceEngine
      voiceKeywords = c.voiceKeywords
      if (voice !== null) { voice.stop(); voice = null }
      syncVoice()
    }
    if (muted || !shoutLoopOn) stopShoutLoop(false, '静音/关循环') // 静音/关循环立即生效（设置开关不算互动，不回一句）
    else syncVoice() // 循环跑着时开/关语音开关或静音，立即反映到麦克风
    const next = findSkin(mySkinId(c))
    if (next !== skin) {
      // 换皮肤：在播喊声/连喊链/循环喊当场掐断（带着旧皮肤的声音换新皮很出戏）
      stopShoutLoop(false, '换皮肤')
      cutPlayingShout()
      skin = next
      if (mood !== 'fly') img.src = skinIdle()
    }
    const newH = mySize(c)
    if (newH !== petH) {
      petH = newH
      root.style.height = `${petH}px`
      img.style.height = `${petH}px`
      frameW.clear() // 帧宽按 petH 换算的缓存全废，重新预读
      preloadAssets(skins)
    }
    const newHue = myHue(c)
    if (newHue !== petHue) {
      petHue = newHue
      applyImgFilter()
    }
    const newOpacity = myOpacity(c)
    if (newOpacity !== petOpacity) {
      petOpacity = newOpacity
      applyImgFilter()
    }
    const newCycle = myHueCycle(c)
    if (newCycle !== hueCycleOn) {
      hueCycleOn = newCycle
      applyImgFilter() // 开关切换立即反映（关掉即回基底色）
    }
  }
  const unsubConfig = config.subscribe(() => {
    if (destroyed) return
    syncConfig()
    if (menu.style.display === 'block') rebuildMenu()
  })

  // 皮肤列表热更新：自定义角色包装载/增删后注册表推新列表。
  // 以**配置**为准重解析当前皮肤（不是拿旧皮肤 id 找自己——自定义包晚到时
  // 配置里的皮肤刚被白名单放行，要换过去；当前皮肤被删时配置已回落默认）。
  // 必须按本宠 id 解析（mySkinId）——曾错用全局 skin 字段，包一变更额外表
  // 全变成主宠皮肤，整页刷新才恢复（踩过）。
  const unsubSkins = assets.subscribeSkins?.((next) => {
    if (destroyed || next.length === 0) return
    skins = next
    preloadAssets(skins)
    const want = findSkin(mySkinId(config.getSnapshot()))
    if (want !== skin) {
      skin = want
      if (mood !== 'fly') img.src = skinIdle()
    }
    if (menu.style.display === 'block') rebuildMenu()
  })

  // 设置卡片点预览图：对应桌宠发光脉冲两下 + 原地小跳（拖拽/飞行中只发光不打断）
  const unsubHighlight = assets.highlight?.subscribe((id) => {
    if (destroyed || id !== petId) return
    void root.animate(
      [
        { filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.35))' },
        { filter: 'drop-shadow(0 0 18px rgba(242,177,56,.95))', offset: 0.25 },
        { filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.35))', offset: 0.5 },
        { filter: 'drop-shadow(0 0 18px rgba(242,177,56,.95))', offset: 0.75 },
        { filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.35))' },
      ],
      { duration: 1200, easing: 'ease-in-out' },
    ).finished.catch(() => {})
    if (mood === 'idle') void hop(30, 320)
  })

  // 设置卡片「当前桌宠」tab 驻留高亮：持续金色发光，解除后恢复默认投影
  const DEFAULT_SHADOW = 'drop-shadow(0 3px 6px rgba(0,0,0,.35))'
  const HOLD_SHADOW = 'drop-shadow(0 0 16px rgba(242,177,56,.95))'
  const unsubHold = assets.highlight?.subscribeHold?.((id) => {
    if (destroyed) return
    root.style.filter = id === petId ? HOLD_SHADOW : DEFAULT_SHADOW
  })

  return {
    celebrate,
    poke,
    fly() { void flyAcross() },
    act(name) { runAction(name) },
    shout,
    face(dir) { setFacing(dir) },
    bounds() { const r = root.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width } },
    /** 摆位（全家福列队重排用；展示性挂载不写位置记忆，主宠等常规模糊落盘——收起合影要能回原位）。 */
    place(v: number) { x = v; clampX(); applyX(); if (!demoDoll) saveMyX(x) },
    setPinned(on: boolean) { pinned = on },
    setTopmost(on: boolean) { root.style.zIndex = on ? String(++zCounter) : String(myZ) },
    setVisible(v: boolean) { root.style.visibility = v ? '' : 'hidden' },
    setBusy(busy) {
      busyInfo = busy
      if (busy !== null) {
        pendingCelebrateGen++ // 新任务开跑：延迟中的完成庆祝判死（用户已发新消息，处理过了）
        stopShoutLoop(true, '新任务开跑') // 新任务开跑：别再喊了；打断时妈妈回一句
      }
    },
    setMuted(m) {
      config.set({ muted: m })
    },
    isMuted() {
      return muted
    },
    destroy() {
      destroyed = true
      cleanupSplit()
      unsubConfig()
      unsubSkins?.()
      unsubHighlight?.()
      unsubHold?.()
      haloAnim?.cancel()
      unregisterBody?.()
      if (fallRaf !== 0) cancelAnimationFrame(fallRaf)
      keeper.disconnect()
      if (voice !== null) { voice.stop(); voice = null }
      window.clearTimeout(behaveTimer)
      window.clearTimeout(chatterTimer)
      window.clearTimeout(shoutLoopTimer)
      window.clearInterval(cycleTimer)
      window.clearInterval(lampTimer)
      window.clearTimeout(bubbleTimer)
      window.clearTimeout(blinkTimer)
      window.clearTimeout(blinkResetTimer)
      window.clearTimeout(lingerTimer)
      window.removeEventListener('resize', onResize)
      breathe.cancel()
      mouthIdle()
      root.remove()
    },
  }
}
