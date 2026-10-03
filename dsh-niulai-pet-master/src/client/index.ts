/**
 * dsh-niulai-pet client 入口：挂载桌宠 + 订阅 sessions 服务驱动庆祝/耗时气泡
 * + （dsh rc.7+）注册设置卡片。
 *
 * 皮肤注册表在 skins.ts（独立模块，demo 试玩页直接引它，不经过本入口——
 * 本入口引入设置卡片会带上 react，demo bundle 不含 react）。
 * @module dsh-niulai-pet/client
 */

import { mountPet, type PetHandle } from './pet.js'
import { SKINS, PackRegistry } from './skins.js'
import { defaultActionsFor } from './packs.js'
import { ConfigStore } from './config.js'
import { registerSettingsCard, mountCardPanel } from './card.js'
import { VoiceDebugBus } from './voice-debug.js'
import { HighlightBus } from './highlight.js'
import { FAMILY_LEFT, FAMILY_RIGHT, FAMILY_LAYERED_WINGS, layoutLayered, layoutUniform } from './family.js'

export { SKINS } from './skins.js'
export type { SkinDef } from './pet.js'

/** 必需服务：无 —— 桌宠本体不依赖任何宿主服务；设置卡片走可选子 fiber。 */
export const inject: string[] = []

/** client ctx 面（cordis-client-runner guard 代理兼容，照 dsh-browser-fs）。 */
interface ClientCtx {
  effect(fn: () => void | (() => void), label?: string): void
  inject(names: string[], fn: (ctx: unknown) => void): void
}

/** ObservableSnapshot 最小面（dsh client runtime 的发布形状）。 */
interface Snapshot<T> {
  getSnapshot(): T
  subscribe(fn: () => void): () => void
}

interface SessionRow {
  running?: boolean
  completed?: boolean
  /** 人读标签：durable 标题，其次项目目录名，再退 session id。 */
  displayTitle?: string
}

interface SessionsService {
  list: Snapshot<{ byId: Record<string, SessionRow> }>
}

interface WatchCallbacks {
  /** 有会话完成时触发。 */
  onDone: () => void
  /** 忙闲沿变化：忙起传起始时间与会话标签，闲落传 null。 */
  onBusy: (busy: { since: number; label: string } | null) => void
}

/** 标签裁到 12 字（durable 标题可能很长）。 */
function shortLabel(title: string | undefined): string {
  const t = (title ?? '').trim()
  if (t === '') return 'AI'
  return t.length > 12 ? `${t.slice(0, 12)}…` : t
}

function watchSessions(ctx: ClientCtx, cb: WatchCallbacks): void {
  ctx.inject(['sessions'], (raw: unknown) => {
    const sessions = (raw as { sessions?: SessionsService } | undefined)?.sessions
    if (sessions === undefined || typeof sessions.list?.subscribe !== 'function') {
      console.warn('[dsh-niulai-pet] sessions 服务不在场（旧宿主？）——任务完成触发停用，仅手动交互')
      return
    }
    const prev = new Map<string, { running: boolean; completed: boolean }>()
    /** 各在跑会话的起跑观测点（快照无 startedAt 字段，只能从本页观测到 running 起算）。 */
    const runningSince = new Map<string, number>()
    const seed = sessions.list.getSnapshot()
    for (const [id, row] of Object.entries(seed.byId)) {
      prev.set(id, { running: row.running === true, completed: row.completed === true })
      if (row.running === true) runningSince.set(id, Date.now())
    }
    /** 当前在跑里起跑最早的那个（气泡报它的标签与耗时）。 */
    const currentBusy = (): { since: number; label: string } | null => {
      const snap = sessions.list.getSnapshot()
      let best: { since: number; label: string } | null = null
      for (const [id, since] of runningSince) {
        if (best !== null && since >= best.since) continue
        best = { since, label: shortLabel(snap.byId[id]?.displayTitle) }
      }
      return best
    }
    let wasAnyRunning = runningSince.size > 0
    if (wasAnyRunning) cb.onBusy(currentBusy())
    console.log(`[dsh-niulai-pet] ready, sessions watch on (baseline ${prev.size})`)
    const unsub = sessions.list.subscribe(() => {
      const snap = sessions.list.getSnapshot()
      for (const [id, row] of Object.entries(snap.byId)) {
        const before = prev.get(id)
        const now = { running: row.running === true, completed: row.completed === true }
        if (before !== undefined) {
          const finished = (before.running && !now.running) || (!before.completed && now.completed)
          if (finished) {
            console.log(`[dsh-niulai-pet] task done detected: ${id.slice(0, 8)} (running ${before.running}->${now.running}, completed ${before.completed}->${now.completed})`)
            cb.onDone()
          }
          if (!before.running && now.running) runningSince.set(id, Date.now())
        }
        if (!now.running) runningSince.delete(id)
        prev.set(id, now)
      }
      for (const id of [...prev.keys()]) {
        if (!(id in snap.byId)) {
          prev.delete(id)
          runningSince.delete(id)
        }
      }
      const anyRunning = runningSince.size > 0
      // 忙中每个快照都推一次：标签可能滞后投影进来（displayTitle 先空后有）
      if (anyRunning) cb.onBusy(currentBusy())
      else if (wasAnyRunning) cb.onBusy(null)
      wasAnyRunning = anyRunning
    })
    ctx.effect(() => unsub, 'niulai-pet sessions watch')
  })
}

export function apply(ctx: ClientCtx): void {
  const start = (): void => {
    // 角色包注册表：内置先行，IndexedDB 自定义包异步装载后推送热更新
    // （桌宠换装、选择器扩项、ConfigStore 白名单放宽三路各自订阅）
    const registry = new PackRegistry()
    const store = new ConfigStore({ skinIds: registry.getSnapshot().skinIds, defaultSkin: 'niulai' })
    registry.subscribe(() => store.updateSkinIds(registry.getSnapshot().skinIds))
    const voiceDebug = new VoiceDebugBus()
    const highlight = new HighlightBus()
    // 悬浮设置面板（右键「⚙️ 设置」）：单例，锚定发起桌宠上方，点外即关。
    // 渲染走 card.tsx 的 mountCardPanel（同一个 NiulaiCard 组件，同一份 ConfigStore）。
    let panelEl: HTMLElement | null = null
    let panelCleanup: (() => void) | null = null
    const onDocDown = (ev: PointerEvent): void => {
      if (panelEl !== null && !panelEl.contains(ev.target as Node)) closePanel()
    }
    const closePanel = (): void => {
      panelCleanup?.()
      panelCleanup = null
      panelEl?.remove()
      panelEl = null
      document.removeEventListener('pointerdown', onDocDown, true)
    }
    const openSettingsPanel = (anchor: () => { x: number; y: number; w: number }, petId?: string): void => {
      if (panelEl !== null) { closePanel(); return } // 再点一次 = 收起
      const b = anchor()
      const w = Math.min(360, window.innerWidth - 16)
      const left = Math.min(Math.max(8, b.x + b.w / 2 - w / 2), window.innerWidth - w - 8)
      const bottom = Math.max(8, window.innerHeight - b.y + 12)
      panelEl = document.createElement('div')
      panelEl.style.cssText = [
        `position:fixed;left:${left}px;bottom:${bottom}px;width:${w}px`,
        'max-height:70vh;overflow:auto;z-index:10000002;border-radius:12px;padding:8px',
        'background:#18181b;border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 40px rgba(0,0,0,.5)',
      ].join(';')
      const closeBtn = document.createElement('button')
      closeBtn.textContent = '✕'
      closeBtn.title = '关闭'
      closeBtn.style.cssText = [
        'position:sticky;top:0;float:right;z-index:1;width:26px;height:26px;border-radius:7px',
        'border:1px solid rgba(255,255,255,.14);background:#27272a;color:#a1a1aa;cursor:pointer;font-size:13px;line-height:1',
      ].join(';')
      closeBtn.onclick = () => { closePanel() }
      panelEl.appendChild(closeBtn)
      // 卡片渲进独立子容器——createRoot 会接管并清空容器，closeBtn 必须当它的兄弟（踩过）
      const cardSlot = document.createElement('div')
      panelEl.appendChild(cardSlot)
      document.body.appendChild(panelEl)
      panelCleanup = mountCardPanel(cardSlot, store, voiceDebug, registry, highlight, petId ?? 'main')
      document.addEventListener('pointerdown', onDocDown, true)
    }
    const mkAssets = (petId?: string, defaultX?: number): Parameters<typeof mountPet>[0] => ({
      skins: registry.getSnapshot().skins,
      defaultSkin: 'niulai',
      ...(petId !== undefined ? { petId } : {}),
      ...(defaultX !== undefined ? { defaultX } : {}),
      subscribeSkins: (fn) => registry.subscribe(() => fn(registry.getSnapshot().skins)),
      defaultActions: (gid) => defaultActionsFor(registry.getSnapshot().characters, gid),
      highlight,
      // 全家福菜单项只给主宠（闭包延迟引用，点击时管理器已就位）
      ...(petId === undefined ? { onFamilyToggle: () => { toggleFamily() } } : {}),
      // 设置面板所有只都有（闭包延迟引用句柄；全家福展示宠查不到句柄就不弹）
      onOpenSettings: () => {
        const h = petId === undefined ? pet : extraPets.get(petId)
        if (h !== undefined) openSettingsPanel(() => h.bounds(), petId)
      },
    })
    const pet = mountPet(mkAssets(), store, voiceDebug)
    // 全家福（主宠菜单「👪 全家福」）：均匀列队 → 层次合影 → 收起循环。
    // 主宠摆进 C 位、期间钉住不游走、置顶不被叠压；收起时回原位——全程可恢复。
    let famMode: 'off' | 'uniform' | 'layered' = 'off'
    const familyPets: PetHandle[] = []
    let familyTimer = 0
    let mainHomeX = -1
    const closeFamily = (): void => {
      window.clearTimeout(familyTimer)
      for (const h of familyPets) h.destroy()
      familyPets.length = 0
      pet.setPinned(false)
      pet.setTopmost(false) // 冗余无害（可能没置过）
      if (mainHomeX >= 0) { pet.place(mainHomeX); mainHomeX = -1 } // place 对主宠落盘，原位恢复
      famMode = 'off'
    }
    const openFamily = (mode: 'uniform' | 'layered'): void => {
      const mainIsNiulai = store.getSnapshot().skin === 'niulai'
      // layered 的数组序 = 绘制序（中心先挂，两翼后挂压上来）；uniform 按左→右
      const order = mode === 'layered'
        ? [...(mainIsNiulai ? [] : ['niulai']), ...FAMILY_LAYERED_WINGS]
        : [...FAMILY_LEFT, ...(mainIsNiulai ? [] : ['niulai']), ...FAMILY_RIGHT]
      order.forEach((sid, i) => {
        const def = registry.getSnapshot().skins.find((v) => v.id === sid)
        if (def === undefined) return
        const h = mountPet({
          ...mkAssets(`family-${i}`),
          forceSkin: sid,
          forceSize: def.defaultSize ?? 120,
          defaultX: 30 + i * 90, // provisional，待重排
        }, store, voiceDebug)
        h.setVisible(false) // 先隐挂载：重排落定前不露面，防列队瞬移闪烁
        familyPets.push(h)
      })
      if (mainIsNiulai) {
        mainHomeX = pet.bounds().x
        pet.setPinned(true) // 主宠占 C 位才钉住；不在队列里就随它去
      }
      familyTimer = window.setTimeout(() => {
        // 成员：均匀档=左翼 5 + 牛来（主宠是牛来就直接摆进 C 位，否则用挂载的）+ 右翼 5；
        // 层次档则主宠/挂载牛来在 members[0]（绘制序中心在前）
        const members = mode === 'uniform'
          ? (mainIsNiulai
            ? [...familyPets.slice(0, FAMILY_LEFT.length), pet, ...familyPets.slice(FAMILY_LEFT.length)]
            : familyPets)
          : (mainIsNiulai ? [pet, ...familyPets] : familyPets)
        if (mode === 'uniform') {
          layoutUniform(members)
        } else {
          layoutLayered(members)
          members[0].setTopmost(true) // C 位牛来压过两翼（主宠或挂载的都抬）
        }
        for (const h of familyPets) h.setVisible(true) // 重排落定，整队同时显形
      }, 450)
    }
    const toggleFamily = (): void => {
      if (famMode === 'off') { famMode = 'uniform'; openFamily('uniform'); return }
      if (famMode === 'uniform') { closeFamily(); famMode = 'layered'; openFamily('layered'); return }
      closeFamily()
    }
    // 额外表实例管家：盯配置里的 extraPets 增删实例（数据按只分存见 pet.ts petId）
    const extraPets = new Map<string, PetHandle>()
    const syncExtraPets = (): void => {
      const want = store.getSnapshot().extraPets
      want.forEach((p, idx) => {
        if (!extraPets.has(p.id)) {
          extraPets.set(p.id, mountPet(mkAssets(p.id, Math.max(0, window.innerWidth - 320 - 150 * (idx + 1))), store, voiceDebug))
        }
      })
      for (const [id, h] of extraPets) {
        if (!want.some((p) => p.id === id)) {
          h.destroy()
          extraPets.delete(id)
        }
      }
    }
    syncExtraPets()
    store.subscribe(syncExtraPets)
    void registry.init()
    // 庆祝/忙闲广播到每一只（任务完成全园同庆——含列队中的全家福成员；循环喊/语音停喊仍是各只自己的状态）
    watchSessions(ctx, {
      onDone: () => { pet.celebrate(); for (const h of extraPets.values()) h.celebrate(); for (const h of familyPets) h.celebrate() },
      onBusy: (b) => { pet.setBusy(b); for (const h of extraPets.values()) h.setBusy(b); for (const h of familyPets) h.setBusy(b) },
    })
    // 设置卡片（dsh rc.7+）：可选注入——settingsScope/slots/locale 任一缺席
    // （rc.6 及更早）子 fiber 就永远等不到服务，静默没有卡片；桌宠与菜单
    // 不受影响，配置继续走 localStorage 后端。
    ctx.inject(['slots', 'locale', 'settingsScope', 'connection', 'remote'], (cardCtx: unknown) => {
      registerSettingsCard(cardCtx as Parameters<typeof registerSettingsCard>[0], store, voiceDebug, registry, highlight)
    })
    // 验证钩子：?petdebug=1 时暴露句柄（playwright 触发 celebrate/fly 等）
    if (new URLSearchParams(location.search).has('petdebug')) {
      ;(window as unknown as { __niulai?: PetHandle }).__niulai = pet
    }
    ctx.effect(() => () => { closePanel(); pet.destroy(); for (const h of extraPets.values()) h.destroy(); for (const h of familyPets) h.destroy() }, 'niulai-pet pet')
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
