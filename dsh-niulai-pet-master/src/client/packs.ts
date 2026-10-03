/**
 * 角色包注册表：两级模型（角色 = 声音/动作/事件/语录，皮肤 = 外观）的运行时核心。
 *
 * - 内置角色：以包结构在 TS 里定义（BUILTIN_PACKS），素材 esbuild dataurl 内联；
 *   内置皮肤的**全局 id 沿用历史值**（niulai/orig/young/panda/whale/nailong/dagou/cat；
 *   奶牛 2026-08-23 起移除——与牛来形象重叠，存量 cow 配置由白名单围栏回落默认皮肤），
 *   存量配置（skin 字段、actions 键）零迁移。
 * - 自定义包：zip 导入（parsePack），校验通过转 dataurl 进 IndexedDB，
 *   皮肤全局 id = `角色id/皮肤id`；派生包（type=variant）deep merge 到目标角色。
 * - 消费端（pet.ts 桌宠 / card.tsx 设置卡片）仍吃扁平 SkinDef 列表：
 *   由 expandCharacters 展开，registry 变更时整体换新。
 *
 * 包格式规范见 docs/skin-pack-schema.md。
 * @module dsh-niulai-pet/packs
 */

import { unzipSync } from 'fflate'
import type { ActionName, ShoutFrame, SkinDef, VoiceName } from './pet.js'

// ---- 内置角色素材（assets/ 已按 角色/skins/皮肤 分目录）----
import petImage from '../../assets/niulai/skins/default/pet.png'
import petShout from '../../assets/niulai/skins/default/pet_shout.png'
import petBlink from '../../assets/niulai/skins/default/pet_blink.png'
import petFly from '../../assets/niulai/skins/default/pet_fly.png'
import petFlyShout from '../../assets/niulai/skins/default/pet_fly_shout.png'
import petOrig from '../../assets/niulai/skins/orig/pet_orig.png'
import petOrigShout from '../../assets/niulai/skins/orig/pet_orig_shout.png'
import petOrigBlink from '../../assets/niulai/skins/orig/pet_orig_blink.png'
import petYoung from '../../assets/niulai/skins/young/pet_young.png'
import petYoungShout from '../../assets/niulai/skins/young/pet_young_shout.png'
import petYoungBlink from '../../assets/niulai/skins/young/pet_young_blink.png'
import petYoungFly from '../../assets/niulai/skins/young/pet_young_fly.png'
import petYoungFlyShout from '../../assets/niulai/skins/young/pet_young_fly_shout.png'
import mama1 from '../../assets/niulai/mama1.mp3'
import mama2 from '../../assets/niulai/mama2.mp3'
import replyNiulai from '../../assets/niulai/reply.mp3'
import pandaImage from '../../assets/panda/skins/default/panda.png'
import pandaBlink from '../../assets/panda/skins/default/panda_blink.png'
import whaleImage from '../../assets/whale/skins/default/whale.png'
import whaleBlink from '../../assets/whale/skins/default/whale_blink.png'
import whaleSpout from '../../assets/whale/skins/default/whale_spout.png'
import nailongImage from '../../assets/nailong/skins/default/nailong.png'
import nailongBlink from '../../assets/nailong/skins/default/nailong_blink.png'
import nailongShout from '../../assets/nailong/skins/default/nailong_shout.png'
import nailongLaugh from '../../assets/nailong/nailong_laugh.mp3'
// 奶龙大笑演出：bv2 大笑切片 5–16s 抽 111 帧清洗合成，后按 15.65s 完整笑声乒乓补
// 打滚段至 157 帧（10fps 循环≈15.7s 与音频等长；画布顶裁 7px 归一角色占比至 92%——
// 曾裁 22px 把仰头帧头顶切掉，全帧内容顶 y=9，安全边距 2px）；
// 单文件原生播放，at:0 一帧即整场演出，逐帧时间轴交给 webp 自己走
import nailongAnim from '../../assets/nailong/skins/default/nailong_anim.webp'
import dagouImage from '../../assets/dagou/skins/default/dagou.webp'
import dagouShout from '../../assets/dagou/skins/default/dagou_shout.webp'
// 大狗叫：da+gou+da+gou+jiao×3 链式合成（大狗大狗叫叫叫），源 wav 出自 Dagou-Tap-New
import dagouCall from '../../assets/dagou/dagou_call.mp3'
import catImage from '../../assets/cat/skins/default/cat.webp'
import catSleep from '../../assets/cat/skins/default/cat_sleep.webp'
// 赛博猫叫声：onekeynya 的 nya0.mp3（裁尾静音+归一化）
import catMeow from '../../assets/cat/cat_meow.mp3'
import xnImage from '../../assets/xiaonailong/skins/default/xiaonailong.png'
import xnBlink from '../../assets/xiaonailong/skins/default/xiaonailong_blink.png'
import xnF2 from '../../assets/xiaonailong/skins/default/f2.png'
import xnF3 from '../../assets/xiaonailong/skins/default/f3.png'
import xnF4 from '../../assets/xiaonailong/skins/default/f4.png'
import xnShout from '../../assets/xiaonailong/xiaonailong.mp3'

// ---------------------------------------------------------------------------
// 运行时类型（素材字段一律 dataurl；与包文件格式的差别仅在于路径已解析）
// ---------------------------------------------------------------------------

/** 角色声音策略：samples=自带音频（自定义包唯一路线）；synth=内置合成音色。 */
export type PackVoice =
  | { type: 'samples'; sounds: string[]; reply?: string }
  | { type: 'synth'; preset: 'moo' | 'squeak' | 'whale' | 'meow' | 'crackle' | 'engine' | 'motor' | 'siren' }

/** 角色内一个皮肤（外观变体）。 */
export interface PackSkinDef {
  /** 全局 id：内置沿用历史值；自定义包为 `角色id/皮肤id`。 */
  id: string
  /** 包内局部 id（自定义包皮肤才有，派生合并/重装匹配用）。 */
  localId?: string
  name: string
  images: {
    stand: string
    blink?: string
    shout?: string
    fly?: string
    flyShout?: string
    spout?: string
    /** 专睡图（打盹换图不压扁，可选）。 */
    sleep?: string
    /** 警灯甲/乙帧（成对出现，待机 480ms 交替闪，如警车红蓝警灯）。 */
    lampA?: string
    lampB?: string
    /** 卷形图（roll 动作换图，犰狳卷成球滚动）。 */
    roll?: string
    /** drive 动作图（开车横穿时换它，如火焰骷髅骑士狂焰帧）。 */
    drive?: string
  }
  shoutAnim?: ShoutFrame[]
  signature?: ActionName
  shoutBubble?: string
  quips?: string[]
  /** 默认显示高度 px（72-200；选用该皮肤时大小滑杆落到它，用户另行调整优先）。 */
  defaultSize?: number
  /** 默认不透明度 %（20-100；选用该皮肤时透明度落到它，用户另行调整优先；缺省 100）。 */
  defaultOpacity?: number
  /** 默认色相旋转 °（0-360；选用该皮肤时色相落到它，用户另行调整优先；缺省 0=原色）。 */
  defaultHue?: number
  /** 默认流光变色开关（选用该皮肤时自动开，用户另行调整优先；缺省关）。 */
  defaultHueCycle?: boolean
  /** 分裂克隆数（2-6；仅 split 动作，覆盖随机 2-3，如史莱姆王）。 */
  splitCount?: number
  /** drive 演出风格（normal/wheelie/wiggle/random）。 */
  driveStyle?: 'normal' | 'wheelie' | 'wiggle' | 'random'
  /** 警灯待机交替开关（false = 平时不闪，drive 时快速交替）。 */
  lampIdle?: boolean
  /** drive 期间专属声（如 siren 警笛）。 */
  driveSound?: VoiceName
  /** 完成路径专属合成音色（如 siren 警笛）。 */
  doneVoice?: VoiceName
  /** 完成路径专属采样（mp3 dataurl）。 */
  doneSounds?: string[]
  /** 完成庆祝光环（幽灵系配置；任务完成时头顶金环浮现）。 */
  halo?: boolean
  /** 果冻体质：落地多段阻尼弹跳（替代单次压扁）+ 走路身体挤压摆动（替代左右倾）。 */
  jelly?: boolean
  /** 默认禁止走动（选用该皮肤时走动开关落到 false，用户另行调整优先；缺省走动，适合植物/静物）。 */
  defaultWalkable?: boolean
}

/** 角色（character）：声音 + 动作 + 事件 + 语录；皮肤是外观。 */
export interface CharacterDef {
  id: string
  name: string
  version?: string
  author?: string
  description?: string
  /** 自定义包标记（管理界面展示/可删除判定）。 */
  custom?: boolean
  /** 派生包来源（extends 目标角色 id；仅记录，合并后不再回指）。 */
  extendedFrom?: string
  voice: PackVoice
  /** 事件默认绑定（缺省 done=signature、poke=hops；用户配置优先）。 */
  events?: { done?: ActionName; poke?: ActionName }
  quips?: string[]
  skins: PackSkinDef[]
}

// ---------------------------------------------------------------------------
// 内置角色定义（skin.id 直接写历史全局 id，见模块头注释）
// ---------------------------------------------------------------------------

const NIULAI_VOICE: PackVoice = { type: 'samples', sounds: [mama1, mama2], reply: replyNiulai }

export const BUILTIN_PACKS: CharacterDef[] = [
  {
    id: 'niulai',
    name: '牛来',
    voice: NIULAI_VOICE,
    skins: [
      {
        id: 'niulai', name: '萌化', signature: 'hops', shoutBubble: '妈~~妈~~',
        images: { stand: petImage, shout: petShout, blink: petBlink, fly: petFly, flyShout: petFlyShout },
        quips: ['妈——！', '我会飞你信不信'],
      },
      {
        id: 'orig', name: '原皮', signature: 'hops', shoutBubble: '妈~~妈~~',
        images: { stand: petOrig, shout: petOrigShout, blink: petOrigBlink },
        quips: ['妈——！', '我还没长角呢'],
      },
      {
        id: 'young', name: '小黄', signature: 'roll', shoutBubble: '妈~~',
        images: { stand: petYoung, shout: petYoungShout, blink: petYoungBlink, fly: petYoungFly, flyShout: petYoungFlyShout },
        quips: ['我还小，别卷我'],
      },
    ],
  },
  {
    id: 'nailong',
    name: '奶龙',
    voice: { type: 'samples', sounds: [nailongLaugh] },
    skins: [{
      id: 'nailong', name: '奶龙', signature: 'sway', shoutBubble: '哈~哈~', defaultSize: 155,
      images: { stand: nailongImage, shout: nailongShout, blink: nailongBlink },
      // 大笑演出：站捧腹抖肚 → 抱头弯腰 → 回抱肚渐弯 → 仰头 → 憋不住倒下 → 躺地蹬腿打滚
      shoutAnim: [{ src: nailongAnim, at: 0 }],
      quips: ['嘿嘿，今天也是快乐的一天', '捧腹大笑是基本功'],
    }],
  },
  {
    id: 'dagou',
    name: '大狗',
    voice: { type: 'samples', sounds: [dagouCall] },
    skins: [{
      id: 'dagou', name: '大狗', signature: 'hops', shoutBubble: '大狗叫！',
      images: { stand: dagouImage, shout: dagouShout },
      quips: ['大狗大狗叫叫叫', '汪？'],
    }],
  },
  {
    id: 'panda',
    name: '熊猫',
    voice: { type: 'synth', preset: 'squeak' },
    skins: [{
      id: 'panda', name: '熊猫', signature: 'roll', shoutBubble: '嗯嗯！',
      images: { stand: pandaImage, blink: pandaBlink },
      quips: ['竹子比 bug 好吃', '滚滚滚，别催'],
    }],
  },
  {
    id: 'whale',
    name: '蓝鲸',
    voice: { type: 'synth', preset: 'whale' },
    skins: [{
      id: 'whale', name: '蓝鲸', signature: 'breach', shoutBubble: '噗——！',
      images: { stand: whaleImage, blink: whaleBlink, spout: whaleSpout },
      quips: ['深海里没有 deadline', '咕嘟咕嘟'],
    }],
  },
  {
    id: 'cat',
    name: '赛博猫',
    voice: { type: 'samples', sounds: [catMeow] },
    skins: [{
      id: 'cat', name: '赛博猫', signature: 'sway', shoutBubble: '喵——！',
      // 平时趴睡（stand 用趴睡图），喊叫时才站起来（shout 用站立图）
      images: { stand: catSleep, shout: catImage, sleep: catSleep },
      quips: ['喵', '别卷了，躺会儿'],
    }],
  },
  {
    id: 'xiaonailong',
    name: '小奶龙',
    voice: { type: 'samples', sounds: [xnShout] },
    skins: [{
      id: 'xiaonailong', name: '小奶龙', signature: 'sway', shoutBubble: '我是奶龙！', defaultSize: 100,
      images: { stand: xnImage, blink: xnBlink },
      // 喊叫逐帧演出（原自定义验证包同款时间轴）：站 → 指 → 大笑 → 惊讶
      shoutAnim: [{ src: xnImage, at: 0 }, { src: xnF2, at: 0.15 }, { src: xnF3, at: 0.34 }, { src: xnF4, at: 0.75 }],
      quips: ['我是奶龙！', '嘿嘿嘿'],
    }],
  },
]

// ---------------------------------------------------------------------------
// 展开：角色包 → 消费端扁平 SkinDef 列表
// ---------------------------------------------------------------------------

/** 角色/皮肤 → SkinDef（pet.ts 消费形状）。语录 = 角色级 ⊕ 皮肤级。 */
function expandSkin(char: CharacterDef, skin: PackSkinDef): SkinDef {
  return {
    id: skin.id,
    name: char.skins.length > 1 ? `${char.name}·${skin.name}` : char.name,
    image: skin.images.stand,
    imageBlink: skin.images.blink,
    imageShout: skin.images.shout,
    shoutAnim: skin.shoutAnim,
    imageFly: skin.images.fly,
    imageFlyShout: skin.images.flyShout,
    imageSpout: skin.images.spout,
    imageSleep: skin.images.sleep,
    imageLampA: skin.images.lampA,
    imageLampB: skin.images.lampB,
    imageRoll: skin.images.roll,
    imageDrive: skin.images.drive,
    voice: char.voice.type === 'samples' ? 'mama' : char.voice.preset,
    sounds: char.voice.type === 'samples' ? char.voice.sounds : undefined,
    replySound: char.voice.type === 'samples' ? char.voice.reply : undefined,
    signature: skin.signature ?? 'hops',
    shoutBubble: skin.shoutBubble ?? char.name,
    quips: [...char.quips ?? [], ...skin.quips ?? []],
    defaultSize: skin.defaultSize ?? 120,
    ...(skin.defaultOpacity !== undefined ? { defaultOpacity: skin.defaultOpacity } : {}),
    ...(skin.defaultHue !== undefined ? { defaultHue: skin.defaultHue } : {}),
    ...(skin.defaultHueCycle === true ? { defaultHueCycle: true } : {}),
    ...(skin.splitCount !== undefined ? { splitCount: skin.splitCount } : {}),
    ...(skin.driveStyle !== undefined ? { driveStyle: skin.driveStyle } : {}),
    ...(skin.lampIdle === false ? { lampIdle: false } : {}),
    ...(skin.driveSound !== undefined ? { driveSound: skin.driveSound } : {}),
    ...(skin.doneVoice !== undefined ? { doneVoice: skin.doneVoice } : {}),
    ...((skin.doneSounds?.length ?? 0) > 0 ? { doneSounds: skin.doneSounds } : {}),
    ...(skin.halo === true ? { halo: true } : {}),
    ...(skin.jelly === true ? { jelly: true } : {}),
    ...(skin.defaultWalkable === false ? { defaultWalkable: false } : {}),
  }
}

export function expandCharacters(chars: CharacterDef[]): SkinDef[] {
  return chars.flatMap((c) => c.skins.map((s) => expandSkin(c, s)))
}

/** 皮肤的事件默认绑定（角色 events 缺省 done=signature / poke=hops）。 */
export function defaultActionsFor(chars: CharacterDef[], skinGid: string): { done: ActionName; poke: ActionName } {
  for (const c of chars) {
    if (c.skins.some((s) => s.id === skinGid)) {
      return { done: c.events?.done ?? 'signature', poke: c.events?.poke ?? 'hops' }
    }
  }
  return { done: 'signature', poke: 'hops' }
}

// ---------------------------------------------------------------------------
// 包解析与校验（包文件格式 → 运行时 CharacterDef；错误拦截，警告放行）
// ---------------------------------------------------------------------------

/** 包解析失败：issues 为逐条字段级错误（给 AI 辅助链路自愈用，必须具体）。 */
export class PackParseError extends Error {
  constructor(public readonly issues: string[]) {
    super(`角色包不合法：\n${issues.map((i) => `· ${i}`).join('\n')}`)
  }
}

const ACTIONS: readonly string[] = ['signature', 'fly', 'dance', 'spin', 'hops', 'roll', 'breach', 'sway', 'split', 'drive', 'random']
/** 内置合成音色（voice.preset / doneVoice / driveSound 共用枚举）。 */
const VOICE_PRESETS = ['moo', 'squeak', 'whale', 'meow', 'crackle', 'engine', 'motor', 'siren'] as const
const ID_RE = /^[a-z0-9-]{2,32}$/
const SKIN_ID_RE = /^[a-z0-9-]{1,32}$/
const IMG_EXT = /\.(png|webp)$/
const SND_EXT = /\.mp3$/
/** 软上限（超出只警告）：整包 8MB、单图 2MB。 */
const PACK_WARN_BYTES = 8 * 1024 * 1024
const IMG_WARN_BYTES = 2 * 1024 * 1024

const MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp', mp3: 'audio/mpeg' }

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** semver 三段比较：a<b 返回负，相等 0，a>b 返回正。 */
function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

function toDataurl(bytes: Uint8Array, path: string): string {
  const ext = path.split('.').pop() ?? ''
  let bin = ''
  const CHUNK = 0x8000 // String.fromCharCode 散参上限，分块防栈溢出
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return `data:${MIME[ext] ?? 'application/octet-stream'};base64,${btoa(bin)}`
}

interface RawPack {
  json: Record<string, unknown>
  files: Record<string, Uint8Array>
}

/** zip 字节 → pack.json + 文件表。包结构非法在此抛出。 */
function unpack(data: Uint8Array): RawPack {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data)
  } catch {
    throw new PackParseError(['不是合法的 zip 文件'])
  }
  // 归一化路径：去前导 ./ 与 /，折叠 ..
  const norm: Record<string, Uint8Array> = {}
  for (const [k, v] of Object.entries(files)) {
    const p = k.replace(/\\/g, '/').replace(/^\.?\//, '')
    if (p === '' || p.endsWith('/') || p.split('/').includes('..')) continue
    norm[p] = v
  }
  const raw = norm['pack.json']
  if (raw === undefined) throw new PackParseError(['缺少 pack.json（包根目录必须有角色清单）'])
  try {
    const json: unknown = JSON.parse(new TextDecoder().decode(raw))
    if (!isRec(json)) throw new Error()
    return { json, files: norm }
  } catch {
    throw new PackParseError(['pack.json 不是合法 JSON'])
  }
}

/**
 * 校验并物化一个角色包。返回运行时定义与警告清单；有错抛 PackParseError。
 * @param knownCharIds 已存在的角色 id（冲突检测；派生包则要求 extends 在其中）
 */
export function parsePack(data: Uint8Array, knownCharIds: readonly string[]): { def: CharacterDef; warnings: string[] } {
  const { json, files } = unpack(data)
  const errors: string[] = []
  const warnings: string[] = []

  // -- 顶层标量 --
  if (json.spec !== 1) errors.push(`spec: 不支持的模式版本 ${JSON.stringify(json.spec)}（本加载器只懂 spec=1，插件可能太旧）`)
  const type = json.type
  if (type !== 'character' && type !== 'variant') errors.push(`type: 只支持 character / variant，收到 ${JSON.stringify(type)}`)
  const id = typeof json.id === 'string' ? json.id : ''
  if (!ID_RE.test(id)) errors.push(`id: 必须 2~32 位小写字母/数字/连字符，收到 ${JSON.stringify(json.id)}`)
  else if (type === 'character' && knownCharIds.includes(id)) warnings.push(`id: 角色 ${id} 已存在（内置或已安装）——继续导入将覆盖旧包`)
  const name = typeof json.name === 'string' ? json.name.trim() : ''
  if (name === '') errors.push('name: 必填，角色显示名不能为空')
  if (typeof json.version !== 'string' || json.version.trim() === '') errors.push('version: 必填，如 "1.0.0"')
  // 引擎版本门槛（可选）：低于则提示级警告不拦截——老引擎忽略未知字段，特性只是降级不是坏掉
  if (json.minEngine !== undefined) {
    const me = typeof json.minEngine === 'string' ? json.minEngine.trim() : ''
    if (!/^\d+\.\d+\.\d+$/.test(me)) errors.push(`minEngine: 必须是 x.y.z 形式，收到 ${JSON.stringify(json.minEngine)}`)
    else if (cmpVersion(__NIULAI_VERSION__, me) < 0) warnings.push(`minEngine: 本包声明需要插件 ≥ ${me}（当前 ${__NIULAI_VERSION__}），新特性可能不生效——建议 dsh plugin update dsh-niulai-pet`)
  }
  if (type === 'variant') {
    const ext = typeof json.extends === 'string' ? json.extends : ''
    if (ext === '') errors.push('extends: 派生包必填（目标角色 id）')
    else if (!knownCharIds.includes(ext)) errors.push(`extends: 目标角色 ${ext} 不存在（内置或已安装的角色才能派生）`)
  }

  // -- 素材引用收集（voice/skins 里的路径统一在此解析成 dataurl）--
  const referenced = new Set<string>()
  const asset = (field: string, re: RegExp): string | undefined => {
    const v = fieldValue(json, field)
    if (typeof v !== 'string') return undefined
    referenced.add(v)
    if (!re.test(v)) {
      errors.push(`${field}: 格式不符（需要 ${re === IMG_EXT ? 'png/webp' : 'mp3'}），收到 ${v}`)
      return undefined
    }
    const bytes = files[v]
    if (bytes === undefined) {
      errors.push(`${field}: 文件 ${v} 不存在于包内`)
      return undefined
    }
    if (re === IMG_EXT && bytes.length > IMG_WARN_BYTES) warnings.push(`${field}: ${v} 超过 2MB，首次加载会变慢`)
    return toDataurl(bytes, v)
  }
  // 从嵌套对象取字符串字段的辅助（field 形如 "voice.samples.0" / "skins.0.images.stand"）
  function fieldValue(root: Record<string, unknown>, path: string): unknown {
    let cur: unknown = root
    for (const seg of path.split('.')) {
      if (Array.isArray(cur)) cur = cur[Number(seg)]
      else if (isRec(cur)) cur = cur[seg]
      else return undefined
    }
    return cur
  }

  // -- voice --
  let voice: PackVoice | undefined
  const vraw = json.voice
  if (!isRec(vraw)) {
    errors.push('voice: 必填，声音策略对象（{type:"samples",...} 或 {type:"synth",...}）')
  } else if (vraw.type === 'samples') {
    const list = Array.isArray(vraw.samples) ? vraw.samples : []
    const sounds: string[] = []
    if (list.length === 0) errors.push('voice.samples: 至少一个 mp3 路径')
    list.forEach((p, i) => {
      const d = typeof p === 'string' ? asset(`voice.samples.${i}`, SND_EXT) : undefined
      if (typeof p === 'string' && d !== undefined) sounds.push(d)
      else if (typeof p !== 'string') errors.push(`voice.samples.${i}: 必须是字符串路径`)
    })
    const reply = asset('voice.reply', SND_EXT)
    voice = { type: 'samples', sounds, ...(reply !== undefined ? { reply } : {}) }
  } else if (vraw.type === 'synth') {
    const preset = vraw.preset
    if (preset === 'moo' || preset === 'squeak' || preset === 'whale' || preset === 'meow'
      || preset === 'crackle' || preset === 'engine' || preset === 'motor' || preset === 'siren') {
      voice = { type: 'synth', preset }
    } else errors.push(`voice.preset: 只支持内置音色 moo/squeak/whale/meow/crackle/engine/motor/siren，收到 ${JSON.stringify(preset)}`)
  } else {
    errors.push(`voice.type: 只支持 samples / synth，收到 ${JSON.stringify(vraw.type)}`)
  }

  // -- events --
  let events: CharacterDef['events']
  if (json.events !== undefined) {
    if (!isRec(json.events)) errors.push('events: 必须是对象 {done, poke}')
    else {
      events = {}
      for (const k of ['done', 'poke'] as const) {
        const a = json.events[k]
        if (a === undefined) continue
        if (typeof a === 'string' && ACTIONS.includes(a)) events[k] = a as ActionName
        else errors.push(`events.${k}: 未知动作 ${JSON.stringify(a)}（可选：${ACTIONS.join('/')}）`)
      }
    }
  }

  // -- 语录（角色级）--
  const quips = parseQuips(json.quips, 'quips', errors)

  // -- skins --
  const sraw = json.skins
  const skins: PackSkinDef[] = []
  if (!Array.isArray(sraw) || sraw.length === 0) {
    errors.push('skins: 至少一个皮肤')
  } else {
    const seenLocal = new Set<string>()
    let defaultCount = 0
    sraw.forEach((s, i) => {
      const at = `skins.${i}`
      if (!isRec(s)) {
        errors.push(`${at}: 必须是对象`)
        return
      }
      const local = typeof s.id === 'string' ? s.id : ''
      if (!SKIN_ID_RE.test(local)) errors.push(`${at}.id: 必须 1~32 位小写字母/数字/连字符，收到 ${JSON.stringify(s.id)}`)
      else if (seenLocal.has(local)) errors.push(`${at}.id: 皮肤 id ${local} 在包内重复`)
      else seenLocal.add(local)
      const sname = typeof s.name === 'string' && s.name.trim() !== '' ? s.name.trim() : local
      if (s.default === true) defaultCount++

      const imgRaw = isRec(s.images) ? s.images : undefined
      if (imgRaw === undefined) errors.push(`${at}.images: 必填，至少含 stand`)
      const images: PackSkinDef['images'] = { stand: '' }
      let standOk = false
      if (imgRaw !== undefined) {
        const stand = asset(`${at}.images.stand`, IMG_EXT)
        if (stand !== undefined) {
          images.stand = stand
          standOk = true
        } else if (typeof imgRaw.stand !== 'string') {
          errors.push(`${at}.images.stand: 必填（透明底 png）`)
        }
        for (const key of ['blink', 'shout', 'fly', 'flyShout', 'spout', 'sleep', 'lampA', 'lampB', 'roll', 'drive'] as const) {
          const d = asset(`${at}.images.${key}`, IMG_EXT)
          if (d !== undefined) images[key] = d
        }
      }

      // shoutAnim：at 升序 ∈[0,1]；src png/webp
      let shoutAnim: ShoutFrame[] | undefined
      if (s.shoutAnim !== undefined) {
        if (!Array.isArray(s.shoutAnim) || s.shoutAnim.length === 0) {
          errors.push(`${at}.shoutAnim: 必须是非空数组`)
        } else {
          shoutAnim = []
          let lastAt = -1
          s.shoutAnim.forEach((f, fi) => {
            const fat = `${at}.shoutAnim.${fi}`
            if (!isRec(f)) {
              errors.push(`${fat}: 必须是对象 {src, at}`)
              return
            }
            const src = asset(`${fat}.src`, IMG_EXT)
            const t = typeof f.at === 'number' ? f.at : NaN
            if (!(t >= 0 && t <= 1)) errors.push(`${fat}.at: 必须 0~1 之间，收到 ${JSON.stringify(f.at)}`)
            else if (t < lastAt) errors.push(`${fat}.at: 必须升序`)
            else lastAt = t
            if (src !== undefined && !Number.isNaN(t)) {
              shoutAnim!.push({ src, at: t, ...(f.rock === true ? { rock: true } : {}) })
            }
          })
          if (shoutAnim.length === 0) shoutAnim = undefined
        }
      }

      let signature: ActionName | undefined
      if (s.signature !== undefined) {
        if (typeof s.signature === 'string' && ACTIONS.includes(s.signature) && s.signature !== 'signature' && s.signature !== 'random') {
          signature = s.signature as ActionName
        } else {
          errors.push(`${at}.signature: 签名动作不能是 signature/random，收到 ${JSON.stringify(s.signature)}`)
        }
      }
      const squips = parseQuips(s.quips, `${at}.quips`, errors)
      // drive 演出风格 / 完成专属声（doneVoice 合成音色 / doneSounds 采样路径）
      let driveStyle: 'normal' | 'wheelie' | 'wiggle' | 'random' | undefined
      if (s.driveStyle !== undefined) {
        if (s.driveStyle === 'normal' || s.driveStyle === 'wheelie' || s.driveStyle === 'wiggle' || s.driveStyle === 'random') {
          driveStyle = s.driveStyle
        } else errors.push(`${at}.driveStyle: 只支持 normal/wheelie/wiggle/random，收到 ${JSON.stringify(s.driveStyle)}`)
      }
      let doneVoice: VoiceName | undefined
      if (s.doneVoice !== undefined) {
        if (typeof s.doneVoice === 'string' && (VOICE_PRESETS as readonly string[]).includes(s.doneVoice)) {
          doneVoice = s.doneVoice as VoiceName
        } else errors.push(`${at}.doneVoice: 只支持内置合成音色，收到 ${JSON.stringify(s.doneVoice)}`)
      }
      let driveSound: VoiceName | undefined
      if (s.driveSound !== undefined) {
        if (typeof s.driveSound === 'string' && (VOICE_PRESETS as readonly string[]).includes(s.driveSound)) {
          driveSound = s.driveSound as VoiceName
        } else errors.push(`${at}.driveSound: 只支持内置合成音色，收到 ${JSON.stringify(s.driveSound)}`)
      }
      const doneSounds: string[] = []
      if (s.doneSounds !== undefined) {
        if (!Array.isArray(s.doneSounds)) errors.push(`${at}.doneSounds: 必须是 mp3 路径数组`)
        else {
          (s.doneSounds as unknown[]).forEach((p, i) => {
            const d = typeof p === 'string' ? asset(`${at}.doneSounds.${i}`, SND_EXT) : undefined
            if (typeof p === 'string' && d !== undefined) doneSounds.push(d)
            else if (typeof p !== 'string') errors.push(`${at}.doneSounds.${i}: 必须是字符串路径`)
          })
        }
      }
      const shoutBubble = typeof s.shoutBubble === 'string' ? s.shoutBubble : undefined
      let defaultSize: number | undefined
      if (s.size !== undefined) {
        const n = typeof s.size === 'number' ? s.size : NaN
        if (Number.isInteger(n) && n >= 72 && n <= 200) defaultSize = n
        else errors.push(`${at}.size: 必须 72~200 的整数，收到 ${JSON.stringify(s.size)}`)
      }
      let defaultOpacity: number | undefined
      if (s.opacity !== undefined) {
        const n = typeof s.opacity === 'number' ? s.opacity : NaN
        if (Number.isInteger(n) && n >= 20 && n <= 100) defaultOpacity = n
        else errors.push(`${at}.opacity: 必须 20~100 的整数，收到 ${JSON.stringify(s.opacity)}`)
      }
      let defaultHue: number | undefined
      if (s.hue !== undefined) {
        const n = typeof s.hue === 'number' ? s.hue : NaN
        if (Number.isInteger(n) && n >= 0 && n <= 360) defaultHue = n
        else errors.push(`${at}.hue: 必须 0~360 的整数，收到 ${JSON.stringify(s.hue)}`)
      }
      const defaultHueCycle = s.hueCycle === true
      let splitCount: number | undefined
      if (s.splitCount !== undefined) {
        const n = typeof s.splitCount === 'number' ? s.splitCount : NaN
        if (Number.isInteger(n) && n >= 2 && n <= 6) splitCount = n
        else errors.push(`${at}.splitCount: 必须 2~6 的整数，收到 ${JSON.stringify(s.splitCount)}`)
      }
      const jelly = s.jelly === true
      if (s.walkable !== undefined && typeof s.walkable !== 'boolean') errors.push(`${at}.walkable: 必须是布尔值，收到 ${JSON.stringify(s.walkable)}`)

      if (standOk) {
        skins.push({
          id: `${id}/${local || 'default'}`,
          localId: local,
          name: sname,
          images,
          ...(shoutAnim !== undefined ? { shoutAnim } : {}),
          ...(signature !== undefined ? { signature } : {}),
          ...(shoutBubble !== undefined ? { shoutBubble } : {}),
          ...(squips.length > 0 ? { quips: squips } : {}),
          ...(defaultSize !== undefined ? { defaultSize } : {}),
          ...(defaultOpacity !== undefined ? { defaultOpacity } : {}),
          ...(defaultHue !== undefined ? { defaultHue } : {}),
          ...(defaultHueCycle ? { defaultHueCycle: true } : {}),
          ...(splitCount !== undefined ? { splitCount } : {}),
          ...(driveStyle !== undefined ? { driveStyle } : {}),
          ...(s.lampIdle === false ? { lampIdle: false } : {}),
          ...(driveSound !== undefined ? { driveSound } : {}),
          ...(doneVoice !== undefined ? { doneVoice } : {}),
          ...(doneSounds.length > 0 ? { doneSounds } : {}),
          ...(s.halo === true ? { halo: true } : {}),
          ...(jelly ? { jelly: true } : {}),
          ...(s.walkable === false ? { defaultWalkable: false } : {}),
        })
      }
    })
    if (defaultCount > 1) warnings.push('skins: 多个皮肤标了 default:true，只有第一个生效')
  }

  // -- 动作素材配套（提示级）--
  if (errors.length === 0) {
    const hasFlyImg = skins.some((s) => s.images.fly !== undefined)
    const bindsFly = events?.done === 'fly' || events?.poke === 'fly' || skins.some((s) => s.signature === 'fly')
    if (bindsFly && !hasFlyImg) warnings.push('动作配套: 绑定了 fly 但没有 images.fly 图，飞行时用站立图代替，效果打折')
    const hasSpout = skins.some((s) => s.images.spout !== undefined)
    const bindsBreach = events?.done === 'breach' || events?.poke === 'breach' || skins.some((s) => s.signature === 'breach')
    if (bindsBreach && !hasSpout) warnings.push('动作配套: 绑定了 breach 但没有 images.spout 图，弧顶特效缺席')
    for (const s of skins) {
      if (s.shoutAnim === undefined && s.images.shout === undefined) {
        warnings.push(`皮肤 ${s.name}: 既没有 shoutAnim 也没有 images.shout，喊叫时只有物理变形没有嘴型`)
      }
    }
    const total = Object.values(files).reduce((n, b) => n + b.length, 0)
    if (total > PACK_WARN_BYTES) warnings.push(`整包 ${(total / 1048576).toFixed(1)}MB 超过 8MB 软上限，首次加载会变慢`)
    for (const p of Object.keys(files)) {
      if (p !== 'pack.json' && !referenced.has(p)) warnings.push(`未引用文件: ${p}（导入时被忽略，防夹带）`)
    }
  }

  if (errors.length > 0) throw new PackParseError(errors)

  const def: CharacterDef = {
    id,
    name,
    version: (json.version as string).trim(),
    ...(typeof json.author === 'string' && json.author.trim() !== '' ? { author: json.author.trim() } : {}),
    ...(typeof json.description === 'string' && json.description.trim() !== '' ? { description: json.description.trim() } : {}),
    custom: true,
    ...(type === 'variant' ? { extendedFrom: json.extends as string } : {}),
    voice: voice!,
    ...(events !== undefined ? { events } : {}),
    ...(quips.length > 0 ? { quips } : {}),
    skins,
  }
  return { def, warnings }
}

function parseQuips(v: unknown, field: string, errors: string[]): string[] {
  if (v === undefined) return []
  if (!Array.isArray(v)) {
    errors.push(`${field}: 必须是字符串数组`)
    return []
  }
  const out: string[] = []
  v.forEach((q, i) => {
    if (typeof q === 'string' && q.trim() !== '') out.push(q.trim().slice(0, 120))
    else errors.push(`${field}.${i}: 必须是非空字符串`)
  })
  return out.slice(0, 50)
}

// ---------------------------------------------------------------------------
// 派生合并：variant 包 deep merge 到目标角色，产物是独立新角色
// ---------------------------------------------------------------------------

export function applyVariant(target: CharacterDef, variant: CharacterDef): CharacterDef {
  const skins = target.skins.map((ts) => {
    const over = variant.skins.find((vs) => vs.localId === ts.localId || vs.localId === ts.id || vs.id.endsWith(`/${ts.id}`))
    if (over === undefined) return ts
    return {
      ...ts,
      ...over,
      // 派生皮肤的运行时 gid 归新角色（配置绑定不串原角色）
      id: `${variant.id}/${over.localId ?? over.id.split('/').pop()}`,
      images: { ...ts.images, ...over.images },
      // quips 覆盖而非拼接（作者对角色语录有完全控制权）
      ...(over.quips !== undefined ? { quips: over.quips } : { quips: ts.quips }),
    }
  })
  // 追加新皮肤
  for (const vs of variant.skins) {
    const merged = skins.some((s) => s.localId === vs.localId)
    if (!merged) skins.push(vs)
  }
  return {
    ...target,
    id: variant.id,
    name: variant.name,
    version: variant.version,
    author: variant.author,
    description: variant.description,
    custom: true,
    extendedFrom: variant.extendedFrom,
    voice: variant.voice,
    events: variant.events ?? target.events,
    quips: variant.quips ?? target.quips,
    skins,
  }
}

// ---------------------------------------------------------------------------
// IndexedDB 持久化（自定义角色包整棵 JSON 存取；素材已 dataurl 化）
// ---------------------------------------------------------------------------

const DB_NAME = 'dsh-niulai-pet'
const STORE = 'packs'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => { resolve(req.result) }
    req.onerror = () => { reject(req.error ?? new Error('IndexedDB 打开失败')) }
  })
}

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = run(tx.objectStore(STORE))
    req.onsuccess = () => { resolve(req.result) }
    req.onerror = () => { reject(req.error ?? new Error('IndexedDB 读写失败')) }
    tx.oncomplete = () => { db.close() }
  }))
}

export function listStoredPacks(): Promise<CharacterDef[]> {
  if (typeof indexedDB === 'undefined') return Promise.resolve([])
  return idb<CharacterDef[]>('readonly', (s) => s.getAll() as IDBRequest<CharacterDef[]>)
    .catch(() => []) // 隐私模式等场景：无自定义包，不挡主流程
}

export function storePack(def: CharacterDef): Promise<void> {
  return idb('readwrite', (s) => s.put(def)).then(() => {})
}

export function deleteStoredPack(id: string): Promise<void> {
  return idb('readwrite', (s) => s.delete(id)).then(() => {})
}

// ---------------------------------------------------------------------------
// 注册表：内置 + 自定义合并的可观察门面
// ---------------------------------------------------------------------------

export interface RegistrySnapshot {
  characters: CharacterDef[]
  /** 展开后的扁平皮肤列表（pet/card 直接消费）。 */
  skins: SkinDef[]
  /** 全部合法皮肤全局 id（ConfigStore 白名单）。 */
  skinIds: string[]
}

export class PackRegistry {
  private customs: CharacterDef[] = []
  private snapshot: RegistrySnapshot
  private readonly listeners = new Set<() => void>()

  constructor() {
    this.snapshot = this.build()
  }

  // 箭头属性形态：消费端（useSyncExternalStore 等）以方法引用方式提取，
  // 普通 class 方法会丢 this 炸「reading 'snapshot'」（踩过，设置卡片整卡崩溃）
  readonly getSnapshot = (): RegistrySnapshot => this.snapshot

  readonly subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  /** 启动时装载 IndexedDB 里的自定义包（含派生合并）。 */
  async init(): Promise<void> {
    const stored = await listStoredPacks()
    this.customs = this.resolveVariants(stored)
    this.rebuild()
  }

  /** 预检：解析 zip，返回定义与警告（未落库，供确认式导入）。 */
  async preview(file: File): Promise<{ def: CharacterDef; warnings: string[] }> {
    const data = new Uint8Array(await file.arrayBuffer())
    const known = this.snapshot.characters.map((c) => c.id)
    const { def, warnings } = parsePack(data, known)
    // 同 id 覆盖：对比已装版本，补一条「旧版 → 新版」差异提示（用户确认后覆盖）
    const old = this.snapshot.characters.find((c) => c.id === def.id && !c.custom)
      ?? this.snapshot.characters.find((c) => c.id === def.id)
    if (old !== undefined && (old.version ?? '') !== def.version) {
      warnings.push(`版本差异：已装 ${old.version ?? '?'}，导入后将更新为 ${def.version}（内容以新版为准）`)
    }
    if (def.extendedFrom !== undefined) {
      const target = this.snapshot.characters.find((c) => c.id === def.extendedFrom)
      if (target !== undefined) return { def: applyVariant(target, def), warnings }
    }
    return { def, warnings }
  }

  /** 确认安装（preview 之后；同 id 覆盖视为更新）。 */
  async install(def: CharacterDef): Promise<void> {
    await storePack(def)
    this.customs = [...this.customs.filter((c) => c.id !== def.id), def]
    this.rebuild()
  }

  /** 删除自定义角色（内置不可删；当前皮肤被删由消费端回落默认）。 */
  async remove(charId: string): Promise<void> {
    await deleteStoredPack(charId)
    this.customs = this.customs.filter((c) => c.id !== charId)
    this.rebuild()
  }

  /** 派生包按 extends 合并（存入 IDB 的已是合并产物时跳过）。 */
  private resolveVariants(stored: CharacterDef[]): CharacterDef[] {
    const byId = new Map(BUILTIN_PACKS.map((c) => [c.id, c] as const))
    const out: CharacterDef[] = []
    for (const def of stored) {
      if (def.extendedFrom !== undefined && !def.custom) continue // 数据异常防御
      if (def.extendedFrom !== undefined && def.skins.length === 0) continue
      // install() 存的是合并后产物（custom=true），直接收录；老版本存过未合并派生时在此兜底
      out.push(def)
      byId.set(def.id, def)
    }
    return out
  }

  private build(): RegistrySnapshot {
    const characters = [...BUILTIN_PACKS, ...this.customs]
    const skins = expandCharacters(characters)
    return { characters, skins, skinIds: skins.map((s) => s.id) }
  }

  private rebuild(): void {
    this.snapshot = this.build()
    for (const fn of this.listeners) fn()
  }
}
