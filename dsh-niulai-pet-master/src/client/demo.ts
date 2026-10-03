/**
 * standalone 试玩页入口：与 dsh 插件同一套 pet.ts + SKINS 注册表，
 * 唯一差别是把 sessions 订阅换成模拟任务驱动（证明纯 client 架构：
 * 去掉宿主服务订阅，同一份 bundle 跑在裸页面上）。
 *
 * 产物 demo/niulai-standalone.js（esbuild iife，素材 dataurl 内联），
 * 由 demo/index.html 直接 <script> 引入。
 * @module dsh-niulai-pet/demo
 */

import { SKINS } from './skins.js'
import { BUILTIN_PACKS, applyVariant, defaultActionsFor, expandCharacters, parsePack, PackParseError } from './packs.js'
import type { CharacterDef } from './packs.js'
import { mountPet, type PetHandle, type SkinDef, type ActionName } from './pet.js'
import { ConfigStore } from './config.js'
import { voiceCapable } from './voice.js'

/** 模拟 agent 任务卡片：跑任务 → 忙（耗时气泡）→ 完成 → 庆祝喊妈（全员广播）。
 *  paused 期间（一起飞表演中）不触发——庆祝会把飞行中的桌宠拽回地面。 */
function mountSim(getAll: () => PetHandle[], paused: () => boolean): void {
  const card = document.createElement('div')
  card.style.cssText = [
    'position:fixed', 'left:16px', 'top:16px', 'z-index:99998', 'width:240px',
    'background:rgba(20,24,45,.92)', 'color:#fff', 'border:1px solid rgba(255,255,255,.12)',
    'border-radius:12px', 'padding:14px 16px', 'font:14px/1.6 system-ui,sans-serif',
    'backdrop-filter:blur(6px)',
  ].join(';')
  card.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px">模拟 agent 任务</div>
    <div data-st style="color:rgba(255,255,255,.6);margin-bottom:8px">空闲中</div>
    <div style="height:6px;background:rgba(255,255,255,.12);border-radius:3px;overflow:hidden;margin-bottom:10px">
      <div data-bar style="height:100%;width:0%;background:#f0a830;transition:width .3s"></div>
    </div>
    <button data-run style="width:100%;padding:7px 0;border:0;border-radius:8px;background:#f0a830;color:#1a1405;font-weight:700;cursor:pointer">跑一个任务</button>
    <div style="margin-top:10px;color:rgba(255,255,255,.45);font-size:12px">也会自动跑（约每 20 秒一个）。戳桌宠、开菜单都能玩。</div>
  `
  document.body.appendChild(card)
  const st = card.querySelector('[data-st]') as HTMLDivElement
  const bar = card.querySelector('[data-bar]') as HTMLDivElement
  const btn = card.querySelector('[data-run]') as HTMLButtonElement

  let running = false
  const run = (): void => {
    if (running || paused()) return
    running = true
    btn.disabled = true
    btn.style.opacity = '.5'
    const dur = 4000 + Math.random() * 4000
    const t0 = Date.now()
    for (const h of getAll()) h.setBusy({ since: t0, label: '演示任务' })
    st.textContent = '任务运行中…'
    const tick = (): void => {
      const p = Math.min(1, (Date.now() - t0) / dur)
      bar.style.width = `${Math.round(p * 100)}%`
      if (p < 1) {
        requestAnimationFrame(tick)
        return
      }
      for (const h of getAll()) { h.setBusy(null); h.celebrate() }
      st.textContent = '任务完成！'
      bar.style.width = '0%'
      running = false
      btn.disabled = false
      btn.style.opacity = '1'
      window.setTimeout(() => { if (!running) st.textContent = '空闲中' }, 4000)
    }
    requestAnimationFrame(tick)
  }
  btn.addEventListener('click', run)
  // 自动演示：约每 20s 跑一个（仅页面可见时；celebrate 自身有 6s 节流）
  window.setInterval(() => { if (!document.hidden) run() }, 18000 + Math.random() * 8000)
}

/** 右上角静音角标：展示 + 控制，和宠物菜单「声音」同源同步。 */
function mountMuteBtn(pet: PetHandle): void {
  const btn = document.createElement('button')
  btn.style.cssText = [
    'position:fixed', 'right:16px', 'top:16px', 'z-index:99998',
    'width:40px', 'height:40px', 'border-radius:10px',
    'border:1px solid rgba(255,255,255,.12)', 'background:rgba(20,24,45,.92)',
    'font-size:19px', 'cursor:pointer', 'backdrop-filter:blur(6px)',
  ].join(';')
  const sync = (): void => {
    const m = pet.isMuted()
    btn.textContent = m ? '🔇' : '🔊'
    btn.title = m ? '已静音，点我开声' : '声音开，点我静音'
    btn.setAttribute('aria-label', btn.title)
  }
  btn.addEventListener('click', () => { pet.setMuted(!pet.isMuted()); sync() })
  sync()
  window.setInterval(sync, 1000) // 菜单里拨开关也同步角标
  document.body.appendChild(btn)
}

/** 语音停喊角标（🎤）：demo 没有设置卡片，开关落 localStorage 后端。
 *  开前真试一次授权（原生授权框），被拒不落配置；环境不支持（非 https/localhost）禁用。 */
function mountVoiceBtn(store: ConfigStore): void {
  const btn = document.createElement('button')
  btn.style.cssText = [
    'position:fixed', 'right:64px', 'top:16px', 'z-index:99998',
    'width:40px', 'height:40px', 'border-radius:10px',
    'border:1px solid rgba(255,255,255,.12)', 'background:rgba(20,24,45,.92)',
    'font-size:19px', 'cursor:pointer', 'backdrop-filter:blur(6px)',
  ].join(';')
  btn.textContent = '🎤'
  const capable = voiceCapable()
  const sync = (): void => {
    const on = store.getSnapshot().voiceControl
    btn.style.opacity = !capable ? '.3' : on ? '1' : '.5'
    btn.title = !capable
      ? '当前访问方式不支持麦克风（需 https 或 localhost 打开）'
      : on
        ? '语音停喊开（循环喊时喊一声「牛来」即停），点我关'
        : '语音停喊关，点我开（会先弹麦克风授权）'
    btn.setAttribute('aria-label', btn.title)
  }
  btn.addEventListener('click', () => {
    if (!capable) return
    if (store.getSnapshot().voiceControl) {
      store.set({ voiceControl: false })
      return
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(
      (stream) => {
        for (const track of stream.getTracks()) track.stop()
        store.set({ voiceControl: true })
      },
      () => { console.warn('[niulai-demo] 麦克风授权被拒，语音停喊未开启') },
    )
  })
  sync()
  store.subscribe(sync)
  document.body.appendChild(btn)
}

/** 自定义角色包试玩：📦 按钮/拖入 zip → parsePack 校验 → 并入皮肤列表（仅内存，
 *  试玩不落库）并切过去。皮肤试用间——做包不用装就能先看效果。 */
function mountPackImport(ctx: DemoCtx): void {
  const btn = document.createElement('button')
  btn.style.cssText = [
    'position:fixed', 'right:112px', 'top:16px', 'z-index:99998',
    'width:40px', 'height:40px', 'border-radius:10px',
    'border:1px solid rgba(255,255,255,.12)', 'background:rgba(20,24,45,.92)',
    'font-size:19px', 'cursor:pointer', 'backdrop-filter:blur(6px)',
  ].join(';')
  btn.textContent = '📦'
  btn.title = '试玩自定义角色包（.nlpack.zip），也可直接拖进页面'
  btn.setAttribute('aria-label', btn.title)
  document.body.appendChild(btn)

  const toast = document.createElement('div')
  toast.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
    'z-index:99998', 'max-width:80vw', 'padding:8px 16px', 'border-radius:10px',
    'background:rgba(20,24,45,.95)', 'border:1px solid rgba(255,255,255,.15)',
    'color:#fff', 'font:13px/1.6 system-ui,sans-serif', 'display:none',
    'white-space:pre-wrap', 'backdrop-filter:blur(6px)',
  ].join(';')
  document.body.appendChild(toast)
  let toastTimer = 0
  const showToast = (msg: string, err = false): void => {
    toast.textContent = msg
    toast.style.borderColor = err ? 'rgba(239,68,68,.6)' : 'rgba(255,255,255,.15)'
    toast.style.display = 'block'
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => { toast.style.display = 'none' }, err ? 8000 : 3200)
  }

  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = '.zip,.nlpack.zip'
  fileInput.style.display = 'none'
  document.body.appendChild(fileInput)
  btn.addEventListener('click', () => { fileInput.click() })
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0]
    fileInput.value = ''
    if (f !== undefined) void importFile(f)
  })
  document.addEventListener('dragover', (e) => { e.preventDefault() })
  document.addEventListener('drop', (e) => {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f !== undefined) void importFile(f)
  })

  const importFile = async (f: File): Promise<void> => {
    try {
      const data = new Uint8Array(await f.arrayBuffer())
      const known = [...BUILTIN_PACKS.map((c) => c.id), ...ctx.customs.map((c) => c.id)]
      let { def, warnings } = parsePack(data, known)
      if (def.extendedFrom !== undefined) {
        const target = [...BUILTIN_PACKS, ...ctx.customs].find((c) => c.id === def.extendedFrom)
        if (target !== undefined) def = applyVariant(target, def)
      }
      ctx.customs = [...ctx.customs.filter((c) => c.id !== def.id), def]
      const skins = [...SKINS, ...expandCharacters(ctx.customs)]
      ctx.pushSkins(skins)
      const firstSkin = def.skins[0]
      ctx.store.set({ skin: firstSkin.id, ...(firstSkin.defaultWalkable === false ? { walkEnabled: false } : { walkEnabled: true }) }) // 切过去看效果（皮肤包声明不走动的落关）
      showToast(`已载入「${def.name}」（试玩不过夜，刷新即还原）${warnings.length > 0 ? `\n提醒：\n· ${warnings.join('\n· ')}` : ''}`, warnings.length > 0)
    } catch (e) {
      showToast(e instanceof PackParseError ? e.message : String(e), true)
    }
  }
}

/** 隐藏/喊回角标（👁）：demo 没有设置卡片，隐藏全部后从这恢复。 */
function mountHideBtn(store: ConfigStore): void {
  const btn = document.createElement('button')
  btn.style.cssText = [
    'position:fixed', 'right:256px', 'top:16px', 'z-index:99998',
    'width:40px', 'height:40px', 'border-radius:10px',
    'border:1px solid rgba(255,255,255,.12)', 'background:rgba(20,24,45,.92)',
    'font-size:19px', 'cursor:pointer', 'backdrop-filter:blur(6px)',
  ].join(';')
  const sync = (): void => {
    const on = store.getSnapshot().hidden
    btn.textContent = on ? '🙈' : '👁'
    btn.title = on ? '桌宠已隐藏，点我喊回来' : '隐藏全部桌宠，点我藏起'
    btn.setAttribute('aria-label', btn.title)
  }
  btn.addEventListener('click', () => { store.set({ hidden: !store.getSnapshot().hidden }) })
  sync()
  store.subscribe(sync)
  document.body.appendChild(btn)
}

/** demo 侧共享状态：自定义包（内存）+ 皮肤推送通道 + ConfigStore。 */
interface DemoCtx {
  customs: CharacterDef[]
  store: ConfigStore
  pushSkins(next: SkinDef[]): void
}

import { FAMILY_LEFT, FAMILY_RIGHT, FAMILY_LAYERED_WINGS, layoutLayered, layoutUniform } from './family.js'

/** 一起飞 + 全家福（右上角图标排整活按钮）。全家福宠物用 forceSkin/forceSize
 *  展示性挂载（绕开配置、只数上限与位置记忆），再点一次收起。 */
/** 一起飞模式共享状态（start() 创建，落地回调与 mountFun 共用）。 */
interface FlyState {
  on: boolean
  flying: Set<PetHandle>
}

/** 飞行落地回调工厂：一起飞模式中，飞完这趟的桌宠落地即藏（与 flight 收尾同同步段）。 */
const mkFlightEnd = (flyState: FlyState, byPid: Map<string, PetHandle>, pid: string) => (): void => {
  if (!flyState.on) return
  const h = byPid.get(pid)
  if (h !== undefined && flyState.flying.delete(h)) h.setVisible(false)
}

function mountFun(ctx: DemoCtx, main: PetHandle, extraPets: Map<string, PetHandle>, subSkins: (fn: (s: SkinDef[]) => void) => () => void, family: PetHandle[], flyState: FlyState, byPid: Map<string, PetHandle>): void {
  const mkBtn = (right: number, icon: string, title: string): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.style.cssText = [
      `position:fixed`, `right:${right}px`, 'top:16px', 'z-index:99998',
      'width:40px', 'height:40px', 'border-radius:10px',
      'border:1px solid rgba(255,255,255,.12)', 'background:rgba(20,24,45,.92)',
      'font-size:19px', 'cursor:pointer', 'backdrop-filter:blur(6px)',
    ].join(';')
    btn.textContent = icon
    btn.title = title
    btn.setAttribute('aria-label', title)
    document.body.appendChild(btn)
    return btn
  }
  let reflowTimer = 0
  let flyTimer = 0
  const flying = flyState.flying
  const flyBtn = mkBtn(160, '🛫', '一起飞：彩带式持续起飞（只显示飞行中的），再点停（在飞的会落回）')
  flyBtn.addEventListener('click', () => {
    if (flyTimer !== 0) {
      window.clearTimeout(flyTimer)
      flyTimer = 0
      flyState.on = false
      flyBtn.style.opacity = '1'
      // 落地的显形；在飞的保持可见、飞完这趟落回（落地回调见 flyState.on=false 不会藏它）
      for (const h of [main, ...extraPets.values(), ...family]) {
        if (!flying.has(h)) h.setVisible(true)
      }
      flying.clear()
      return
    }
    flyBtn.style.opacity = '.6' // 持续起飞中
    flyState.on = true
    const all = (): PetHandle[] => [main, ...extraPets.values(), ...family]
    // 站立的先藏起来：一起飞模式只显示飞行中的桌宠
    for (const h of all()) h.setVisible(false)
    // 落地隐藏由 pet 的 onFlightEnd 回调驱动（flight 收尾同一同步段，零闪烁）；
    // 循环只管按随机节奏补位发射
    const loop = (): void => {
      const pets = all()
      // 并发上限 ≈ 一半：全在天上必叠层，留地面梯队才有彩带感
      const cap = Math.max(2, Math.ceil(pets.length * 0.5))
      if (flying.size < cap) {
        const landed = pets.filter((h) => !flying.has(h))
        const pick = landed[Math.floor(Math.random() * landed.length)]
        if (pick !== undefined) {
          flying.add(pick)
          pick.setVisible(true)
          pick.fly()
        }
      }
      flyTimer = window.setTimeout(loop, 400 + Math.random() * 500)
    }
    loop() // 首只立刻起，后面靠随机节奏一只只跟（别开第二条计时链——停不掉，踩过）
  })
  // 全家福两种排布：uniform=均匀列队（牛来 C 位、奶龙/小奶龙 ±1/±2 对称）；
  // layered=层次合影（高个靠中后排、个矮两翼前压，24% 叠压出前后空间感）。按钮循环：均匀→层次→收起
  const famBtn = mkBtn(208, '👪', '全家福：均匀列队 → 层次合影 → 收起（循环切换）')
  let famMode: 'off' | 'uniform' | 'layered' = 'off'
  let mainHomeX = -1
  const closeFamily = (): void => {
    window.clearTimeout(reflowTimer)
    family.forEach((h, i) => {
      h.destroy()
      byPid.delete(`family-${i}`)
      flyState.flying.delete(h) // 被销毁的不会发落地回调，手动除名防漏 cap
    })
    family.length = 0
    main.setPinned(false)
    main.setTopmost(false) // 冗余无害（可能没置过）
    if (mainHomeX >= 0) { main.place(mainHomeX); mainHomeX = -1 } // 主宠回原位（place 对非展示挂载落盘）
    famMode = 'off'
    famBtn.style.opacity = '1'
  }
  const buildFamily = (mode: 'uniform' | 'layered'): void => {
    const mainIsNiulai = ctx.store.getSnapshot().skin === 'niulai'
    // layered 的数组序 = 绘制序（中心先挂，两翼后挂压上来）；uniform 按左→右
    const order = mode === 'layered'
      ? [...(mainIsNiulai ? [] : ['niulai']), ...FAMILY_LAYERED_WINGS]
      : [...FAMILY_LEFT, ...(mainIsNiulai ? [] : ['niulai']), ...FAMILY_RIGHT]
    order.forEach((sid, i) => {
      const def = SKINS.find((v) => v.id === sid)
      if (def === undefined) return
      const pid = `family-${i}`
      const h = mountPet({
        skins: SKINS,
        defaultSkin: 'niulai',
        petId: pid,
        defaultX: 30 + i * 90, // provisional，待重排
        forceSkin: sid,
        forceSize: def.defaultSize ?? 120,
        subscribeSkins: subSkins,
        onFlightEnd: mkFlightEnd(flyState, byPid, pid),
      }, ctx.store)
      byPid.set(pid, h)
      h.setVisible(false) // 先隐挂载：重排落定前不露面，防列队瞬移闪烁
      family.push(h)
    })
    famBtn.style.opacity = '.6' // 列队中
    if (mainIsNiulai) {
      mainHomeX = main.bounds().x
      main.setPinned(true) // 主宠占 C 位才钉住；不在队列里就随它去
    }
    reflowTimer = window.setTimeout(() => {
      // 成员：均匀档=左翼 5 + 牛来（主宠是牛来就直接摆进 C 位，否则用挂载的）+ 右翼 5；
      // 层次档则主宠/挂载牛来在 members[0]（绘制序中心在前）
      const members = mode === 'uniform'
        ? (mainIsNiulai
          ? [...family.slice(0, FAMILY_LEFT.length), main, ...family.slice(FAMILY_LEFT.length)]
          : family)
        : (mainIsNiulai ? [main, ...family] : family)
      if (mode === 'uniform') {
        layoutUniform(members)
      } else {
        layoutLayered(members)
        members[0].setTopmost(true) // C 位牛来压过两翼（主宠或挂载的都抬）
      }
      for (const h of family) h.setVisible(true) // 重排落定，整队同时显形
    }, 450)
  }
  famBtn.addEventListener('click', () => {
    if (famMode === 'off') {
      famMode = 'uniform'
      buildFamily('uniform')
      return
    }
    if (famMode === 'uniform') {
      closeFamily()
      famMode = 'layered'
      buildFamily('layered')
      return
    }
    closeFamily()
  })
}

const start = (): void => {
  // 导演/调试模式（?petdebug=1）：挂 __director 钩子，且模拟任务不再自动跑/手动跑——
  // 录制期间随机庆祝会把排好的分镜搅乱（庆祝 6s 节流挡不住 20s 一次的自动任务）。
  const directorMode = new URLSearchParams(location.search).has('petdebug')
  let currentSkins = SKINS
  const skinListeners = new Set<(s: SkinDef[]) => void>()
  const store = new ConfigStore({ skinIds: SKINS.map((s) => s.id), defaultSkin: 'niulai' })
  const ctx: DemoCtx = {
    customs: [],
    store,
    pushSkins(next) {
      currentSkins = next
      store.updateSkinIds(next.map((s) => s.id))
      for (const fn of skinListeners) fn(next)
    },
  }
  const flyState: FlyState = { on: false, flying: new Set() }
  const byPid = new Map<string, PetHandle>()
  const pet = mountPet({
    skins: currentSkins,
    defaultSkin: 'niulai',
    subscribeSkins: (fn) => { skinListeners.add(fn); return () => { skinListeners.delete(fn) } },
    onFlightEnd: mkFlightEnd(flyState, byPid, 'main'),
    // 和 dsh 插件同源：自定义包的动作绑定（poke=roll / done=signature）从包声明解析；
    // 不传的话穿山甲这类包的 poke 会回落默认连跳（试玩页戳它不滚——踩过）
    defaultActions: (gid) => defaultActionsFor([...BUILTIN_PACKS, ...ctx.customs], gid),
  }, store)
  byPid.set('main', pet)
  // 额外表实例管家（同 index.ts；试玩页也开乐园模式）
  const extraPets = new Map<string, PetHandle>()
  const syncExtraPets = (): void => {
    const want = store.getSnapshot().extraPets
    want.forEach((p, idx) => {
      if (!extraPets.has(p.id)) {
        const h = mountPet({
          skins: currentSkins,
          defaultSkin: 'niulai',
          petId: p.id,
          defaultX: Math.max(0, window.innerWidth - 320 - 150 * (idx + 1)),
          subscribeSkins: (fn) => { skinListeners.add(fn); return () => { skinListeners.delete(fn) } },
          onFlightEnd: mkFlightEnd(flyState, byPid, p.id),
          defaultActions: (gid) => defaultActionsFor([...BUILTIN_PACKS, ...ctx.customs], gid),
        }, store)
        byPid.set(p.id, h)
        extraPets.set(p.id, h)
      }
    })
    for (const [id, h] of extraPets) {
      if (!want.some((p) => p.id === id)) {
        h.destroy()
        extraPets.delete(id)
        byPid.delete(id)
        flyState.flying.delete(h) // 被销毁的不会发落地回调，手动除名
      }
    }
  }
  syncExtraPets()
  store.subscribe(syncExtraPets)
  const family: PetHandle[] = [] // 全家福阵容（mountFun 填；mountSim 广播要用）
  mountSim(() => [pet, ...extraPets.values(), ...family], () => flyState.on || directorMode)
  mountMuteBtn(pet)
  mountVoiceBtn(store)
  mountHideBtn(store)
  mountPackImport(ctx)
  mountFun(ctx, pet, extraPets, (fn) => { skinListeners.add(fn); return () => { skinListeners.delete(fn) } }, family, flyState, byPid)
  // 验证钩子（playwright 冒烟用）
  ;(window as unknown as { __niulai?: PetHandle }).__niulai = pet

  // 导演接口（仅 ?petdebug=1）：视频分镜脚本的驱动钩子。演员表 cast 独立管理，
  // spawn 走 forceSkin/forceSize 展示性挂载（同全家福：绕开配置、只数上限与位置记忆，
  // 不进物理、不游走），remove/removeAll 只清自己挂的，不动主宠/额外表/全家福。
  if (directorMode) {
    const cast = new Map<string, { h: PetHandle; skin: string }>()
    let castSeq = 0
    const find = (id: string): PetHandle | undefined => cast.get(id)?.h ?? byPid.get(id)
    const must = (id: string): PetHandle => {
      const h = find(id)
      if (h === undefined) throw new Error(`[director] 无此桌宠：${id}`)
      return h
    }
    const director = {
      /** 在场桌宠清单：主宠 + 额外表 + 演员表（全家福不走导演，不列）。 */
      list(): Array<{ id: string; skin: string; x: number; size: number }> {
        const out = [{ id: 'main', skin: store.getSnapshot().skin, x: Math.round(pet.bounds().x), size: Math.round(pet.bounds().w) }]
        for (const p of store.getSnapshot().extraPets) {
          const h = extraPets.get(p.id)
          if (h !== undefined) out.push({ id: p.id, skin: p.skin, x: Math.round(h.bounds().x), size: Math.round(h.bounds().w) })
        }
        for (const [id, e] of cast) out.push({ id, skin: e.skin, x: Math.round(e.h.bounds().x), size: Math.round(e.h.bounds().w) })
        return out
      },
      /** 展示性挂载一只（皮肤须已在列表里——自定义包先经 📦 导入）。返回演员 id。 */
      spawn(skinId: string, opts?: { x?: number; size?: number }): string {
        const def = currentSkins.find((s) => s.id === skinId)
        if (def === undefined) throw new Error(`[director] 未知皮肤：${skinId}（角色包没导？）`)
        const id = `cast-${++castSeq}`
        const h = mountPet({
          skins: currentSkins,
          defaultSkin: skinId,
          petId: id,
          defaultX: opts?.x ?? window.innerWidth - 320,
          forceSkin: skinId,
          forceSize: opts?.size ?? def.defaultSize ?? 120,
          subscribeSkins: (fn) => { skinListeners.add(fn); return () => { skinListeners.delete(fn) } },
          onFlightEnd: mkFlightEnd(flyState, byPid, id),
          defaultActions: (gid) => defaultActionsFor([...BUILTIN_PACKS, ...ctx.customs], gid),
        }, store)
        byPid.set(id, h)
        cast.set(id, { h, skin: skinId })
        if (opts?.x !== undefined) h.place(opts.x)
        return id
      },
      act(id: string, action: ActionName): void { must(id).act(action) },
      poke(id: string): void { must(id).poke() },
      celebrate(id: string): void { must(id).celebrate() },
      shout(id: string): void { must(id).shout() },
      place(id: string, x: number): void { must(id).place(x) },
      face(id: string, dir: 1 | -1): void { must(id).face(dir) },
      pin(id: string, on: boolean): void { must(id).setPinned(on) },
      show(id: string, on: boolean): void { must(id).setVisible(on) },
      remove(id: string): void {
        const e = cast.get(id)
        if (e === undefined) return
        e.h.destroy()
        cast.delete(id)
        byPid.delete(id)
        flyState.flying.delete(e.h) // 被销毁的不会发落地回调，手动除名（同 closeFamily）
      },
      removeAll(): void {
        for (const id of [...cast.keys()]) director.remove(id)
      },
    }
    ;(window as unknown as { __director?: typeof director }).__director = director
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
