/**
 * 配置存取层：桌宠与设置卡片共用的 ConfigStore。
 *
 * 双路径后端：
 *  - localStorage（`dsh-niulai-pet:state-v1`）：现状逻辑，dsh rc.6 及更早
 *    （无 settingsScope 服务）的回退路径，也是 standalone 试玩页的唯一路径。
 *  - dsh settings scope（rc.7+）：Host 持久化 ~/.dsh/settings.yaml
 *    （schema 默认 < cordis entry < user 文档三层），scope.set/unset 带
 *    revision 乐观围栏；写入未落地期间用 pending 覆盖层做乐观回显。
 *
 * 位置 x 不进本模块（按设备的，永远留 localStorage，pet.ts 自行读写）。
 *
 * 旧版文档迁移（loadPersisted 内一次性完成）：全局 doneAction/pokeAction
 * 改写为按皮肤的 actions 映射（忠实起见全皮肤铺同一旧绑定）；皮肤 id
 * `classic` 改写为 defaultSkin。scope 路径首次 ready 时再把 localStorage
 * 旧值 seed 进 user 层（仅 user 层没有的字段，不覆盖设置页已改过的值）。
 */

import type { ActionName } from './pet.js'
import { KWS_KEYWORD_PRESETS } from './kws.js'

/** localStorage 文档键（v1：位置 x 与配置同文档；x 由 pet.ts 直读直写）。 */
const STORE_KEY = 'dsh-niulai-pet:state-v1'

/** 一个皮肤的动作绑定（完成/戳一下）。 */
export interface SkinActionBinding {
  done?: ActionName
  poke?: ActionName
}

/** 解析后的完整生效配置。 */
export interface PetConfig {
  muted: boolean
  /** 音量 0-100。 */
  volume: number
  /** 任务完成时喊（默认开）。 */
  shoutOnDone: boolean
  /** 完成时连喊几声（1-3）。 */
  shoutCount: number
  /** 自定义完成提示音总开关（开着且有文件时，完成提示替代角色叫声；戳/表演仍用角色叫声）。 */
  customSoundOn: boolean
  /** 自定义提示音（audio dataurl，≤1MB；空=未导入）。 */
  customSound: string
  /** 气泡唠叨（默认开）。 */
  talkative: boolean
  /** 当前皮肤 id。 */
  skin: string
  /** 按皮肤的动作绑定；缺配的皮肤由消费端回落默认（done=签名，poke=连跳）。 */
  actions: Record<string, SkinActionBinding>
  /** 自定义唠叨语录（空 = 用内置通用池；非空时替换它，皮肤专属语录仍并入）。 */
  quips: string[]
  /** 完成动作延迟秒数（0 = 立即）。 */
  doneDelaySec: number
  /** 完成后循环喊直到互动停止。 */
  shoutLoop: boolean
  /** 喊完/循环被打断时妈妈回一句「牛来！」。 */
  replyNiulai: boolean
  /** 闲置打盹（压扁变暗）开关；关掉永不进入。 */
  sleepEnabled: boolean
  /** 随意走动（闲置游走）开关；关掉后原地活动，不走位。 */
  walkEnabled: boolean
  /** 离地高度 px（0-300，默认 0=贴视口底；全局共享）。 */
  groundOffset: number
  /** 主宠之外的额外桌宠（每只 id 唯一；皮肤/大小/色相/流光/语录按只存，行为配置全局共享）。上限 = maxPets-1。 */
  extraPets: Array<{ id: string; skin: string; size?: number; hue?: number; hueCycle?: boolean; opacity?: number; walkEnabled?: boolean; quips?: string[] }>
  /** 桌宠显示高度 px（72-200，默认 120；主宠）。 */
  petSize: number
  /** 色相旋转角度（0-360，默认 0=原色；主宠）。 */
  petHue: number
  /** 不透明度 %（20-100，默认 100；主宠）。 */
  petOpacity: number
  /** 流光变色（缓慢循环色相，默认关；petHue 作基底色）。 */
  petHueCycle: boolean
  /** 物理碰撞开关（多只时互相挤/弹飞）。 */
  physics: boolean
  /** 连戳红温（默认开；关掉后戳不积火不变红）。 */
  heatEnabled: boolean
  /** 隐藏全部桌宠（默认关；打开后所有实例隐没，从设置卡片喊回来）。 */
  hidden: boolean
  /** 桌宠数量上限（连主宠，1-15，默认 10）。 */
  maxPets: number
  /** 语音停喊：循环喊期间开麦识别「牛来」（默认关；开启需麦克风授权）。 */
  voiceControl: boolean
  /** 麦克风设备 id（空 = 系统默认）。 */
  micDeviceId: string
  /** 识别阈值（越小越严，0.3-0.85）。 */
  voiceThreshold: number
  /** 用户自录「牛来」模板（wav dataurl，空=没录）。 */
  voiceTemplate: string
  /** 语音停喊引擎（kws=模型识别，template=模板匹配）。 */
  voiceEngine: 'kws' | 'template'
  /** kws 引擎的指令词（预设 id 列表，喊任一即停；至少一个）。 */
  voiceKeywords: string[]
  /** 麦克风软件增益（1.0-4.0，默认 1=直通；浏览器 AGC 之外再叠加，tanh 软削波）。 */
  micGain: number
}

/** 可写子集（整棵 actions 映射一次替换，调用方负责读-并-写）。 */
export type PetConfigPatch = Partial<PetConfig>

/** localStorage 文档形状（含仅迁移期读取的旧键）。 */
export interface Persisted {
  x?: number
  muted?: boolean
  volume?: number
  shoutOnDone?: boolean
  talkative?: boolean
  skin?: string
  shoutCount?: number
  customSoundOn?: boolean
  customSound?: string
  actions?: Record<string, SkinActionBinding>
  quips?: string[]
  doneDelaySec?: number
  shoutLoop?: boolean
  replyNiulai?: boolean
  sleepEnabled?: boolean
  walkEnabled?: boolean
  groundOffset?: number
  extraPets?: Array<{ id: string; skin: string; size?: number; hue?: number; hueCycle?: boolean; opacity?: number; walkEnabled?: boolean; quips?: string[] }>
  petSize?: number
  petHue?: number
  petOpacity?: number
  petHueCycle?: boolean
  physics?: boolean
  heatEnabled?: boolean
  hidden?: boolean
  maxPets?: number
  /** 额外表的位置 x（按设备，petId → x）。主宠仍用 x 键。 */
  xByPet?: Record<string, number>
  voiceControl?: boolean
  micDeviceId?: string
  voiceThreshold?: number
  voiceTemplate?: string
  voiceEngine?: 'kws' | 'template'
  voiceKeywords?: string[]
  micGain?: number
  /** 旧全局绑定（仅迁移读取，见模块注释）。 */
  doneAction?: ActionName
  pokeAction?: ActionName
}

/** settings scope 最小面（dsh client runtime 的发布形状，结构化自描）。 */
export interface SettingsScopeLike {
  getSnapshot(): {
    status: 'loading' | 'ready' | 'unavailable'
    value?: unknown
    user?: unknown
    writable: boolean
  }
  subscribe(fn: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 语录清洗：只留字符串、去空白、丢空条；上限 50 条 / 每条 120 字（防撑爆气泡）。 */
function sanitizeQuips(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((q): q is string => typeof q === 'string')
    .map((q) => q.trim().slice(0, 120))
    .filter((q) => q.length > 0)
    .slice(0, 50)
}

/** 指令词清洗：只留预设表里的 id、去重、保序；全无效时回落默认「牛来」。 */
function sanitizeKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return ['niulai']
  const valid = KWS_KEYWORD_PRESETS.map((p) => p.id)
  const out = input.filter((k): k is string => typeof k === 'string' && valid.includes(k as (typeof valid)[number]))
  return [...new Set(out)].length > 0 ? [...new Set(out)] : ['niulai']
}

/**
 * 读 localStorage 文档，顺手完成一次性旧版迁移（见模块注释）。
 * 迁移写回失败（隐私模式）时内存里照样用迁移后的值。
 */
export function loadPersisted(skinIds: readonly string[] = [], defaultSkin = 'niulai'): Persisted {
  let p: Persisted = {}
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw !== null) p = JSON.parse(raw) as Persisted
  } catch {
    return {}
  }
  let changed = false
  if (p.skin === 'classic') {
    p.skin = defaultSkin
    changed = true
  }
  if (p.doneAction !== undefined || p.pokeAction !== undefined) {
    // 旧绑定全局生效，忠实迁移 = 全皮肤铺上旧值（只铺存在的键，
    // 缺席的键留空由消费端回落该皮肤默认）
    const actions: Record<string, SkinActionBinding> = {}
    for (const id of skinIds) {
      const entry: SkinActionBinding = {}
      if (p.doneAction !== undefined) entry.done = p.doneAction
      if (p.pokeAction !== undefined) entry.poke = p.pokeAction
      actions[id] = entry
    }
    if (skinIds.length > 0) {
      p.actions = { ...p.actions, ...actions }
      changed = true
    }
    delete p.doneAction
    delete p.pokeAction
    changed = true
  }
  if (changed) savePersisted(p)
  return p
}

export function savePersisted(p: Persisted): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p))
  } catch { /* 隐私模式放弃记忆 */ }
}

/** 配置读写门面：localStorage / settings scope 双后端，对消费端透明。 */
export class ConfigStore {
  private scope: SettingsScopeLike | undefined
  /** scope 写入未落地期间的乐观覆盖层（字段级）。 */
  private readonly pending = new Map<string, unknown>()
  private snapshot: PetConfig
  private readonly listeners = new Set<() => void>()
  private skinIds: readonly string[]
  private readonly defaultSkin: string

  constructor(opts: { skinIds: readonly string[]; defaultSkin: string }) {
    this.skinIds = opts.skinIds
    this.defaultSkin = opts.defaultSkin
    this.snapshot = this.resolve()
  }

  /** 自定义角色包装载/增删后更新皮肤白名单；当前皮肤失效时快照解析自动回落默认。 */
  updateSkinIds(ids: readonly string[]): void {
    this.skinIds = ids
    this.republish()
  }

  /** 当前生效配置（稳定引用：无变更时返回同一对象，可直供 uSES）。 */
  getSnapshot(): PetConfig {
    return this.snapshot
  }

  /** 监听变更（本地写入、scope 落地、外部变更、后端切换都会触发）。 */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  /** 写配置（local 同步落盘；scope 乐观回显 + 异步落地）。 */
  set(patch: PetConfigPatch): void {
    const scope = this.scope
    if (scope === undefined) {
      savePersisted({ ...loadPersisted(this.skinIds, this.defaultSkin), ...patch })
      this.republish()
      return
    }
    for (const [field, value] of Object.entries(patch)) {
      if (value === undefined) continue
      this.pending.set(field, value)
      // 落地（resolve）时**不急着清**乐观覆盖：host 接受与文档回播之间有个窗口，
      // 此刻清掉会让快照闪回旧值（订阅方看到开关抖动——循环喊曾被这么闪停过）。
      // pending 在 resolve() 里等快照真正反映出该值时才落槌；拒绝/3s 兜底才清。
      void scope.set(field, value).then(
        () => { this.republish() },
        () => { this.pending.delete(field); this.republish() },
      )
      const captured = value
      setTimeout(() => {
        if (JSON.stringify(this.pending.get(field)) === JSON.stringify(captured)) {
          this.pending.delete(field)
          this.republish()
        }
      }, 3000)
    }
    this.republish()
  }

  /** 改一个皮肤的动作绑定（读-并-写整棵映射）。 */
  setSkinAction(skin: string, event: 'done' | 'poke', action: ActionName): void {
    const actions = { ...this.snapshot.actions }
    actions[skin] = { ...actions[skin], [event]: action }
    this.set({ actions })
  }

  /**
   * 接入 settings scope（rc.7+）：就绪后切后端并把 localStorage 旧值 seed
   * 进 user 层（仅 user 层缺席的字段）。返回 detach（服务下线时调，
   * 回退 localStorage 后端）。
   */
  attachScope(scope: SettingsScopeLike): () => void {
    const sync = (): void => {
      if (this.scope !== scope) {
        // 只在首次 ready 时切换：loading 期间保持 localStorage 后端，
        // unavailable（rc.6 形态/namespace 未被 serve）永不切换
        if (scope.getSnapshot().status !== 'ready') return
        this.scope = scope
        this.seedFromLegacy(scope)
      }
      this.republish()
    }
    sync()
    const unsub = scope.subscribe(sync)
    return () => {
      unsub()
      if (this.scope === scope) {
        this.scope = undefined
        this.pending.clear()
        this.republish()
      }
    }
  }

  /** 把 localStorage 旧值 seed 进 user 层空缺的字段（乐观层先行，免闪默认值）。 */
  private seedFromLegacy(scope: SettingsScopeLike): void {
    const user = scope.getSnapshot().user
    const legacy = loadPersisted(this.skinIds, this.defaultSkin)
    const writes: Array<[string, unknown]> = []
    const cfg = this.fromPersisted(legacy) // 复用校验（类型/范围/皮肤白名单）
    for (const field of ['muted', 'volume', 'shoutOnDone', 'shoutCount', 'customSoundOn', 'customSound', 'talkative', 'skin', 'quips', 'doneDelaySec', 'shoutLoop', 'replyNiulai', 'sleepEnabled', 'walkEnabled', 'groundOffset', 'extraPets', 'physics', 'hidden', 'maxPets', 'petSize', 'petHue', 'petOpacity', 'voiceControl', 'micDeviceId', 'voiceThreshold', 'voiceTemplate', 'voiceEngine', 'voiceKeywords', 'micGain'] as const) {
      if (legacy[field] !== undefined && !(isRecord(user) && field in user)) {
        writes.push([field, cfg[field]])
      }
    }
    if (legacy.actions !== undefined && Object.keys(legacy.actions).length > 0
      && !(isRecord(user) && 'actions' in user)) {
      writes.push(['actions', cfg.actions])
    }
    for (const [field, value] of writes) {
      this.pending.set(field, value)
      void scope.set(field, value).then(
        () => { this.pending.delete(field); this.republish() },
        () => { this.pending.delete(field); this.republish() },
      )
    }
  }

  private republish(): void {
    this.snapshot = this.resolve()
    for (const fn of this.listeners) fn()
  }

  /** 从当前后端解析生效配置（scope 模式叠 pending 乐观层；快照已反映的 pending 落槌清除）。 */
  private resolve(): PetConfig {
    const scope = this.scope
    if (scope === undefined) return this.fromPersisted(loadPersisted(this.skinIds, this.defaultSkin))
    const cfg = this.fromUnknown(scope.getSnapshot().value)
    if (this.pending.size === 0) return cfg
    const merged: PetConfig = { ...cfg, actions: { ...cfg.actions } }
    for (const [field, value] of this.pending) {
      // host 快照已反映出该值 → 落槌（值以快照为准），不再叠乐观层
      if (JSON.stringify(cfg[field as keyof PetConfig]) === JSON.stringify(value)) {
        this.pending.delete(field)
        continue
      }
      if (field === 'actions' && isRecord(value)) {
        merged.actions = this.sanitizeActions(value)
      } else if (field in merged) {
        Object.assign(merged, { [field]: value })
      }
    }
    return merged
  }

  /** localStorage 文档 → 生效配置（含校验与回落）。 */
  private fromPersisted(p: Persisted): PetConfig {
    return {
      muted: p.muted === true,
      volume: typeof p.volume === 'number' && Number.isInteger(p.volume)
        ? Math.min(100, Math.max(0, p.volume)) : 100,
      shoutOnDone: p.shoutOnDone !== false,
      shoutCount: typeof p.shoutCount === 'number' && Number.isInteger(p.shoutCount)
        ? Math.min(99, Math.max(1, p.shoutCount)) : 1,
      customSoundOn: p.customSoundOn === true,
      customSound: typeof p.customSound === 'string' && p.customSound.startsWith('data:audio/') && p.customSound.length < 1_400_000
        ? p.customSound : '',
      talkative: p.talkative !== false,
      skin: this.validSkin(p.skin),
      actions: this.sanitizeActions(p.actions),
      quips: sanitizeQuips(p.quips),
      doneDelaySec: typeof p.doneDelaySec === 'number' && Number.isInteger(p.doneDelaySec)
        ? Math.min(120, Math.max(0, p.doneDelaySec)) : 0,
      shoutLoop: p.shoutLoop === true,
      replyNiulai: p.replyNiulai !== false,
      sleepEnabled: p.sleepEnabled === true, // 默认不打盹（2026-08-23 起；显式开过的仍开）
      walkEnabled: p.walkEnabled !== false, // 默认随意走动
      groundOffset: typeof p.groundOffset === 'number' && Number.isInteger(p.groundOffset)
        ? p.groundOffset : 0, // 负值合法（沉入地面），不做上下限
      physics: p.physics === true,
      heatEnabled: p.heatEnabled !== false, // 连戳红温默认开
      hidden: p.hidden === true,
      maxPets: typeof p.maxPets === 'number' && Number.isInteger(p.maxPets)
        ? Math.max(1, p.maxPets) : 10, // 只保底 1，不设最高上限
      petSize: typeof p.petSize === 'number' && Number.isInteger(p.petSize)
        ? Math.min(200, Math.max(72, p.petSize)) : 120,
      petHue: typeof p.petHue === 'number' && Number.isInteger(p.petHue)
        ? Math.min(360, Math.max(0, p.petHue)) : 0,
      petOpacity: typeof p.petOpacity === 'number' && Number.isInteger(p.petOpacity)
        ? Math.min(100, Math.max(20, p.petOpacity)) : 100,
      petHueCycle: p.petHueCycle === true,
      extraPets: this.sanitizeExtraPets(p.extraPets, (typeof p.maxPets === 'number' && Number.isInteger(p.maxPets)
        ? Math.max(1, p.maxPets) : 10) - 1),
      voiceControl: p.voiceControl === true,
      micDeviceId: typeof p.micDeviceId === 'string' ? p.micDeviceId : '',
      voiceThreshold: typeof p.voiceThreshold === 'number' && p.voiceThreshold >= 0.3 && p.voiceThreshold <= 0.85
        ? p.voiceThreshold : 0.54,
      voiceTemplate: typeof p.voiceTemplate === 'string' && p.voiceTemplate.startsWith('data:audio/') && p.voiceTemplate.length < 300_000
        ? p.voiceTemplate : '',
      voiceEngine: p.voiceEngine === 'template' ? 'template' : 'kws',
      voiceKeywords: sanitizeKeywords(p.voiceKeywords),
      micGain: typeof p.micGain === 'number' && p.micGain >= 1 && p.micGain <= 4 ? p.micGain : 1,
    }
  }

  /** scope 解析值（schema 已过）→ 生效配置（仍防御性校验一遍）。 */
  private fromUnknown(v: unknown): PetConfig {
    const r = isRecord(v) ? v : {}
    return this.fromPersisted({
      muted: r.muted === true,
      volume: typeof r.volume === 'number' ? r.volume : undefined,
      shoutOnDone: r.shoutOnDone !== false,
      talkative: r.talkative !== false,
      shoutCount: typeof r.shoutCount === 'number' ? r.shoutCount : undefined,
      customSoundOn: r.customSoundOn === true,
      customSound: typeof r.customSound === 'string' ? r.customSound : undefined,
      skin: typeof r.skin === 'string' ? r.skin : undefined,
      actions: isRecord(r.actions) ? r.actions as Record<string, SkinActionBinding> : undefined,
      quips: Array.isArray(r.quips) ? r.quips as string[] : undefined,
      doneDelaySec: typeof r.doneDelaySec === 'number' ? r.doneDelaySec : undefined,
      shoutLoop: r.shoutLoop === true,
      replyNiulai: r.replyNiulai !== false,
      sleepEnabled: r.sleepEnabled === true, // 默认不打盹（同 fromPersisted）
      walkEnabled: r.walkEnabled !== false,
      groundOffset: typeof r.groundOffset === 'number' ? r.groundOffset : undefined,
      physics: r.physics === true,
      heatEnabled: r.heatEnabled !== false,
      hidden: r.hidden === true,
      maxPets: typeof r.maxPets === 'number' ? r.maxPets : undefined,
      petSize: typeof r.petSize === 'number' ? r.petSize : undefined,
      petHue: typeof r.petHue === 'number' ? r.petHue : undefined,
      petOpacity: typeof r.petOpacity === 'number' ? r.petOpacity : undefined,
      petHueCycle: r.petHueCycle === true,
      extraPets: Array.isArray(r.extraPets) ? r.extraPets as Array<{ id: string; skin: string; size?: number; hue?: number; hueCycle?: boolean; opacity?: number; walkEnabled?: boolean; quips?: string[] }> : undefined,
      voiceControl: r.voiceControl === true,
      micDeviceId: typeof r.micDeviceId === 'string' ? r.micDeviceId : undefined,
      voiceThreshold: typeof r.voiceThreshold === 'number' ? r.voiceThreshold : undefined,
      voiceTemplate: typeof r.voiceTemplate === 'string' ? r.voiceTemplate : undefined,
      voiceEngine: r.voiceEngine === 'template' ? 'template' : r.voiceEngine === 'kws' ? 'kws' : undefined,
      voiceKeywords: Array.isArray(r.voiceKeywords) ? r.voiceKeywords as string[] : undefined,
      micGain: typeof r.micGain === 'number' ? r.micGain : undefined,
    })
  }

  private validSkin(id: string | undefined): string {
    if (id !== undefined && this.skinIds.includes(id)) return id
    // 自定义包转内置的迁移：xiaonailong/default 这类 `内置id/皮肤id` 回落到内置 id
    if (id !== undefined && id.includes('/')) {
      const prefix = id.split('/')[0]
      if (this.skinIds.includes(prefix)) return prefix
    }
    return this.defaultSkin
  }

  /** 额外表清洗：id/皮肤形状 + 皮肤白名单 + 去重 + 上限 cap 只。 */
  private sanitizeExtraPets(input: unknown, cap = 2): Array<{ id: string; skin: string; size?: number; hue?: number; hueCycle?: boolean; opacity?: number; walkEnabled?: boolean; quips?: string[] }> {
    if (!Array.isArray(input)) return []
    const out: Array<{ id: string; skin: string; size?: number; hue?: number; hueCycle?: boolean; opacity?: number; walkEnabled?: boolean; quips?: string[] }> = []
    const seen = new Set<string>()
    for (const p of input) {
      if (!isRecord(p) || typeof p.id !== 'string' || p.id === '' || seen.has(p.id)) continue
      seen.add(p.id)
      const quips = sanitizeQuips(p.quips)
      out.push({
        id: p.id,
        skin: this.validSkin(typeof p.skin === 'string' ? p.skin : undefined),
        ...(typeof p.size === 'number' && Number.isInteger(p.size) && p.size >= 72 && p.size <= 200 ? { size: p.size } : {}),
        ...(typeof p.hue === 'number' && Number.isInteger(p.hue) && p.hue >= 0 && p.hue <= 360 ? { hue: p.hue } : {}),
        ...(p.hueCycle === true ? { hueCycle: true } : {}),
        ...(typeof p.opacity === 'number' && Number.isInteger(p.opacity) && p.opacity >= 20 && p.opacity <= 100 ? { opacity: p.opacity } : {}),
        ...(typeof p.walkEnabled === 'boolean' ? { walkEnabled: p.walkEnabled } : {}),
        ...(quips.length > 0 ? { quips } : {}),
      })
      if (out.length >= cap) break
    }
    return out
  }

  /** 绑定清洗：皮肤 id 白名单 + 字段形状；动作名合法性由消费端 asAction 围栏（Host schema 是 z.string() 不枚举，前向兼容未来动作）。 */
  private sanitizeActions(input: Record<string, unknown> | undefined): Record<string, SkinActionBinding> {
    const out: Record<string, SkinActionBinding> = {}
    if (input === undefined) return out
    for (const [skin, binding] of Object.entries(input)) {
      if (!this.skinIds.includes(skin) || !isRecord(binding)) continue
      const entry: SkinActionBinding = {}
      if (typeof binding.done === 'string') entry.done = binding.done as ActionName
      if (typeof binding.poke === 'string') entry.poke = binding.poke as ActionName
      if (entry.done !== undefined || entry.poke !== undefined) out[skin] = entry
    }
    return out
  }
}
