/** ClassHub's native pet engine, adapted from dsh-niulai-pet/pet.ts.
 * Copyright (c) 2026 whitefirer. MIT License; see public/pet-assets/LICENSE.
 * Retains the upstream mood guards, breathing/blink cadence, action keyframes,
 * facing convention, mouth timing and drag/fall mechanics. All resources belong
 * to this mount; there is no host runtime, body observer or voice recognition.
 */
import type { ClassHubPetConfigStore } from './pet-config';
import { createPetAudio } from './pet-audio';
import { clamp, releaseVelocity, stepFall, type PointerSample } from './pet-physics';
import { clearPetPosition, readPetPosition, savePetPosition } from './pet-storage';
import { findPetSkin } from './pet-skins';
import type { PetAction, PetHandle } from './types';

type Mood = 'idle' | 'walk' | 'drag' | 'celebrate' | 'fly';
interface EngineOptions {
  container: HTMLElement;
  store: ClassHubPetConfigStore;
  onMenu: (point: { x: number; y: number }) => void;
  onFailure: () => void;
}

export function mountClassHubPet({ container, store, onMenu, onFailure }: EngineOptions): PetHandle {
  let config = store.getSnapshot().config;
  let skin = findPetSkin(config.petSkin);
  let destroyed = false;
  let mood: Mood = 'idle';
  let generation = 0;
  let busy = false;
  let paused = false;
  let petH = config.petSize;
  let petW = petH * skin.aspectRatio;
  let floorY = 0;
  let minX = 0;
  let maxX = 0;
  let topLimit = 0;
  let liftY = 0;
  let facing: 1 | -1 = 1;
  let pointer: number | null = null;
  let dragging = false;
  let longPressed = false;
  let dragOrigin = { px: 0, py: 0, x: 0, lift: 0 };
  let samples: PointerSample[] = [];
  const position = readPetPosition(store.userId);
  let x = position ? position.x * window.innerWidth / position.viewportWidth : window.innerWidth;
  if (position) facing = position.facing;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set<number>();
  const animations = new Set<Animation>();
  let frameId = 0;
  let scrollFrame = 0;
  let finishFrames: ((completed: boolean) => void) | null = null;
  let breathe: Animation | null = null;
  let mouthTimers: number[] = [];
  let bubbleTimer = 0;
  let holdTimer = 0;
  let blinkReset = 0;
  let controlsResize: ResizeObserver | undefined;
  let watchedMain: HTMLElement | null = null;
  let bubbleVisible = false;
  let speaking = false;
  const audio = createPetAudio();
  audio.sync(config);

  const root = document.createElement('button');
  root.type = 'button'; root.className = 'classhub-pet';
  root.dataset.testid = 'classhub-pet';
  root.setAttribute('aria-haspopup', 'menu');
  const face = document.createElement('span'); face.className = 'pet-face';
  const image = document.createElement('img');
  image.draggable = false; image.alt = ''; image.className = 'pet-sprite';
  face.append(image); root.append(face);
  const bubble = document.createElement('div');
  bubble.className = 'pet-bubble'; bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite'); bubble.hidden = true;
  container.append(root, bubble);

  const later = (callback: () => void, delay: number): number => {
    const timer = window.setTimeout(() => { timers.delete(timer); if (!destroyed) callback(); }, delay);
    timers.add(timer); return timer;
  };
  const clearTimer = (timer: number) => { window.clearTimeout(timer); timers.delete(timer); };
  const setMood = (next: Mood) => { mood = next; root.dataset.mood = next; };
  setMood('idle');
  const animate = (frames: Keyframe[], options: KeyframeAnimationOptions): Promise<boolean> => {
    if (destroyed || paused || reducedMotion.matches || !image.animate) return Promise.resolve(!destroyed);
    const animation = image.animate(frames, options);
    animations.add(animation);
    return animation.finished.then(() => true, () => false).finally(() => {
      animations.delete(animation); animation.cancel();
    });
  };
  const stopBreathe = () => { breathe?.cancel(); breathe = null; };
  const startBreathe = () => {
    stopBreathe();
    if (destroyed || paused || reducedMotion.matches || mood !== 'idle' || !image.animate) return;
    breathe = image.animate([
      { transform: 'scaleY(1) translateY(0)' },
      { transform: 'scaleY(1.025) translateY(-1.5px)' },
    ], { duration: 1100, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  };
  const idleImage = () => { image.src = skin.image; };
  const mouthImage = (open: boolean) => {
    image.src = mood === 'fly' && skin.imageFly
      ? (open ? skin.imageFlyShout ?? skin.imageFly : skin.imageFly)
      : (open ? skin.imageShout ?? skin.image : skin.image);
  };
  const clearMouth = () => {
    mouthTimers.forEach(clearTimer); mouthTimers = []; speaking = false;
    if (mood !== 'fly' || skin.imageFly) mouthImage(false);
  };
  const applyBubblePosition = () => {
    if (!bubbleVisible) return;
    const rect = root.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? window.innerWidth);
    const width = bubble.offsetWidth;
    bubble.style.left = `${clamp(rect.left + rect.width / 2 - width / 2, left + 8, right - width - 8)}px`;
    bubble.style.top = `${Math.max(top + 8, rect.top - bubble.offsetHeight - 16)}px`;
  };
  const applyPosition = () => {
    x = clamp(x, minX, maxX);
    liftY = clamp(liftY, Math.min(0, topLimit - floorY), 0);
    root.style.transform = `translate3d(${x}px,${floorY + liftY}px,0)`;
    face.style.transform = `scaleX(${facing})`;
    root.dataset.facing = String(facing);
    applyBubblePosition();
  };
  const setFacing = (direction: 1 | -1) => { facing = direction; applyPosition(); };
  const remember = () => savePetPosition(store.userId, { x, viewportWidth: window.innerWidth, facing });
  const hideBubble = () => { bubbleVisible = false; bubble.hidden = true; clearTimer(bubbleTimer); };
  const say = (message: string, duration = 2800) => {
    if (destroyed || paused || !config.petTalkative || !message.trim()) return;
    bubble.textContent = message.trim().slice(0, 120);
    bubble.hidden = false; bubbleVisible = true; applyBubblePosition();
    clearTimer(bubbleTimer); bubbleTimer = later(hideBubble, duration);
  };

  const cancelFrames = () => {
    cancelAnimationFrame(frameId); frameId = 0;
    finishFrames?.(false); finishFrames = null;
  };
  const interrupt = () => {
    generation++; cancelFrames(); stopBreathe();
    for (const animation of animations) animation.cancel();
    animations.clear();
    image.style.transform = ''; image.style.transformOrigin = '50% 100%';
  };
  const framesFor = (duration: number, step: (progress: number, elapsed: number) => void | boolean): Promise<boolean> => {
    cancelFrames();
    if (destroyed || paused) return Promise.resolve(false);
    if (reducedMotion.matches || duration <= 0) { step(1, duration); return Promise.resolve(true); }
    return new Promise(resolve => {
      finishFrames = resolve;
      const start = performance.now(); let last = start;
      const tick = (now: number) => {
        if (destroyed || paused) { finishFrames = null; resolve(false); return; }
        const progress = Math.min(1, (now - start) / duration);
        const continuing = step(progress, Math.min(50, now - last)) !== false; last = now;
        if (progress < 1 && continuing) frameId = requestAnimationFrame(tick);
        else { frameId = 0; finishFrames = null; resolve(true); }
      };
      frameId = requestAnimationFrame(tick);
    });
  };

  // Prevent the mobile pet from intercepting a visible form or primary action.
  // Re-evaluate on scroll/resize/route changes, not every animation frame.
  const avoidControls = () => {
    if (window.innerWidth > 767 || pointer !== null) { root.style.visibility = ''; return; }
    const controls = [...document.querySelectorAll<HTMLElement>(
      'main button, main input, main textarea, main select, main .ed-button, [data-pet-avoid]',
    )].map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    const blocked = (candidate: number) => controls.some(rect =>
      candidate < rect.right + 6 && candidate + petW > rect.left - 6 && floorY < rect.bottom + 6 && floorY + petH > rect.top - 6,
    );
    const candidate = [x, maxX, minX].find(value => !blocked(value));
    root.style.visibility = candidate === undefined ? 'hidden' : '';
    if (candidate !== undefined && candidate !== x) { x = candidate; applyPosition(); }
  };
  // Lazy routes and API responses can add controls after the route event.
  // Observe only the mobile content's layout; never repair/reinsert body DOM.
  const watchControls = () => {
    const main = window.innerWidth <= 767 ? document.querySelector<HTMLElement>('main#main-content') : null;
    if (main === watchedMain) return;
    controlsResize?.disconnect(); watchedMain = main;
    if (main && typeof ResizeObserver !== 'undefined') {
      controlsResize ??= new ResizeObserver(onScroll);
      controlsResize.observe(main);
    }
  };
  const refreshViewport = () => {
    if (destroyed) return;
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const mobile = window.innerWidth <= 767;
    const nav = document.querySelector<HTMLElement>('.mobile-nav');
    const navH = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().height : 0;
    petH = Math.max(20, Math.min(config.petSize * (mobile ? 0.8 : 1), width * 0.38 / skin.aspectRatio, height * 0.28));
    petW = petH * skin.aspectRatio;
    const sidePadding = petH * 0.4 + 12;
    minX = left + sidePadding; maxX = Math.max(minX, left + width - petW - sidePadding);
    topLimit = top + petW * 0.5 + 20;
    floorY = Math.max(topLimit, top + height - navH - petH - Math.max(20, petH * 0.5));
    root.style.width = `${petW}px`; root.style.height = `${petH}px`;
    image.style.width = `${petW}px`;
    bubble.style.maxWidth = `${Math.max(40, Math.min(240, width - 16))}px`;
    applyPosition(); avoidControls(); watchControls();
    const active = document.activeElement;
    const editing = mobile && active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]');
    const nextPaused = document.hidden || editing || (mobile && height < window.innerHeight * 0.68);
    if (nextPaused !== paused) {
      paused = nextPaused;
      if (paused) { interrupt(); clearMouth(); audio.stop(); liftY = 0; setMood('idle'); hideBubble(); applyPosition(); }
      else startBreathe();
    }
    root.hidden = paused;
    if (!paused && mood === 'idle' && !breathe) startBreathe();
  };

  // Upstream hop squash/stretch keyframes and action timings.
  const hop = (height = 44, duration = 380) => animate([
    { transform: 'translateY(0) scale(1,1)', offset: 0 },
    { transform: 'translateY(4px) scale(1.06,0.9)', offset: 0.18 },
    { transform: `translateY(-${Math.min(height, floorY - topLimit)}px) scale(0.94,1.08)`, offset: 0.55 },
    { transform: 'translateY(0) scale(1.04,0.94)', offset: 0.86 },
    { transform: 'translateY(0) scale(1,1)', offset: 1 },
  ], { duration, easing: 'ease-out' });
  const dance = () => animate([
    { transform: 'rotate(0deg) translateY(0)', offset: 0 },
    { transform: 'rotate(-13deg) translateY(-7px)', offset: 0.14 },
    { transform: 'rotate(0deg) translateY(0)', offset: 0.28 },
    { transform: 'rotate(13deg) translateY(-7px)', offset: 0.42 },
    { transform: 'rotate(0deg) translateY(0)', offset: 0.56 },
    { transform: 'rotate(-10deg) translateY(-12px)', offset: 0.7 },
    { transform: 'rotate(10deg) translateY(-12px)', offset: 0.84 },
    { transform: 'rotate(0deg) translateY(0)', offset: 1 },
  ], { duration: 1600, easing: 'ease-in-out' });
  const sway = () => animate([
    { transform: 'rotate(0deg)', offset: 0 },
    { transform: 'rotate(-19deg) translateY(-5px)', offset: 0.13 },
    { transform: 'rotate(0deg)', offset: 0.25 },
    { transform: 'rotate(19deg) translateY(-5px)', offset: 0.38 },
    { transform: 'rotate(0deg)', offset: 0.5 },
    { transform: 'rotate(-19deg) translateY(-5px)', offset: 0.63 },
    { transform: 'rotate(0deg)', offset: 0.75 },
    { transform: 'rotate(19deg) translateY(-5px)', offset: 0.88 },
    { transform: 'rotate(0deg)', offset: 1 },
  ], { duration: 1750, easing: 'ease-in-out' });
  const spin = () => {
    image.style.transformOrigin = '50% 50%';
    return animate([
      { transform: 'rotate(0deg) translateY(0)', offset: 0 },
      { transform: 'rotate(180deg) translateY(-14px)', offset: 0.5 },
      { transform: 'rotate(360deg) translateY(0)', offset: 1 },
    ], { duration: 720, easing: 'ease-in-out' });
  };
  const roll = () => {
    const from = x; const target = clamp(from + 210 * facing, minX, maxX);
    image.style.transformOrigin = '50% 50%';
    return framesFor(950, progress => {
      x = from + (target - from) * progress;
      liftY = -Math.sin(progress * Math.PI) * Math.min(16, floorY - topLimit);
      image.style.transform = `rotate(${360 * progress}deg)`;
      applyPosition();
    });
  };
  // The upstream sine arc and tangent rotation stay within ClassHub's viewport.
  const flight = (breach: boolean) => {
    const home = x; const target = clamp(x + (facing * 260), minX, maxX);
    const amplitude = Math.max(0, Math.min(window.innerHeight * 0.28, floorY - topLimit));
    if (skin.imageFly) mouthImage(speaking);
    return framesFor(2400, progress => {
      const phase = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
      x = home + (target - home) * phase;
      liftY = -Math.sin(Math.PI * progress) * amplitude;
      image.style.transform = `rotate(${-Math.cos(Math.PI * progress) * 48}deg)`;
      if (breach && skin.imageSpout) image.src = progress > 0.42 && progress < 0.62 ? skin.imageSpout : skin.image;
      applyPosition();
    });
  };

  const runAction = async (action: PetAction) => {
    if (destroyed || paused || mood === 'drag' || mood === 'celebrate' || mood === 'fly') return;
    interrupt();
    const ownGeneration = generation;
    const alive = () => !destroyed && !paused && ownGeneration === generation;
    let pick = action === 'signature' ? skin.signature : action;
    const pool: PetAction[] = ['dance', 'spin', 'hops', 'roll', 'sway'];
    if (pick === 'random') pick = pool[Math.floor(Math.random() * pool.length)];
    setMood(pick === 'fly' || pick === 'breach' ? 'fly' : 'celebrate');
    try {
      if (pick === 'dance') await dance();
      else if (pick === 'sway') await sway();
      else if (pick === 'spin') await spin();
      else if (pick === 'roll') await roll();
      else if (pick === 'fly' || pick === 'breach') await flight(pick === 'breach');
      else for (let i = 0; i < 3 && alive(); i++) await hop(58 - i * 12, 420);
    } finally {
      if (alive()) {
        liftY = 0; image.style.transform = ''; image.style.transformOrigin = '50% 100%';
        setMood('idle');
        if (!speaking) idleImage();
        else if (!skin.shoutAnim) mouthImage(true);
        applyPosition(); startBreathe(); avoidControls();
      }
    }
  };

  const shout = (showQuip = true) => {
    clearMouth();
    // Static clip lengths keep the visual timeline working while muted/offline.
    const duration = audio.play(skin) || Math.max(...(skin.soundDurationsMs ?? [700]));
    if (skin.shoutAnim?.length && !reducedMotion.matches) {
      speaking = true;
      for (const frame of skin.shoutAnim) {
        if (frame.at === 0) image.src = frame.src;
        else mouthTimers.push(later(() => { image.src = frame.src; }, frame.at * duration));
      }
      mouthTimers.push(later(clearMouth, duration));
    } else if (skin.imageShout || skin.shoutAnim?.length) {
      speaking = true;
      if (reducedMotion.matches) {
        image.src = skin.imageShout ?? skin.shoutAnim?.[skin.shoutAnim.length - 1]?.src ?? skin.image;
      } else {
        mouthImage(true);
        mouthTimers.push(later(() => mouthImage(false), 240), later(() => mouthImage(true), 360));
      }
      mouthTimers.push(later(clearMouth, duration));
    }
    if (showQuip) say(skin.shoutBubble, Math.min(4000, Math.max(1600, duration + 300)));
  };
  const poke = () => {
    if (destroyed || paused || mood === 'drag' || !config.petInteractive) return;
    interrupt(); liftY = 0; setMood('idle'); applyPosition();
    shout(); void runAction(config.petPokeAction);
  };
  let lastCelebrate = -Infinity;
  const celebrate = () => {
    if (destroyed || paused || mood === 'drag' || performance.now() - lastCelebrate < 1500) return;
    lastCelebrate = performance.now();
    interrupt(); liftY = 0; setMood('idle'); applyPosition();
    shout(false); if (config.petPageMessages) say('做得好，完成啦！'); void runAction(config.petCelebrateAction);
  };
  const scheduleBlink = () => {
    later(() => {
      if (!paused && (mood === 'idle' || mood === 'walk') && !speaking && skin.imageBlink) {
        image.src = skin.imageBlink;
        blinkReset = later(() => { if ((mood === 'idle' || mood === 'walk') && !speaking) idleImage(); }, 130);
      }
      scheduleBlink();
    }, 2600 + Math.random() * 3800);
  };
  const walkTo = async (target: number) => {
    if (destroyed || paused || mood !== 'idle' || !config.petWalkable || busy || reducedMotion.matches) return;
    interrupt(); const ownGeneration = generation; const from = x;
    setMood('walk'); setFacing(target > x ? 1 : -1);
    const duration = Math.max(500, Math.abs(target - from) / 60 * 1000);
    void animate([
      { transform: 'rotate(4deg) translateY(0)' },
      { transform: 'rotate(-4deg) translateY(-3px)' },
      { transform: 'rotate(4deg) translateY(0)' },
    ], { duration: 320, iterations: Math.max(1, Math.round(duration / 320)) });
    await framesFor(duration, progress => { x = from + (target - from) * progress; applyPosition(); });
    if (destroyed || ownGeneration !== generation) return;
    for (const animation of animations) animation.cancel();
    setMood('idle'); remember(); startBreathe(); avoidControls();
  };
  const behave = () => {
    if (!paused && !busy && pointer === null && mood === 'idle' && !reducedMotion.matches) {
      const die = Math.random();
      if (die < 0.32 && config.petWalkable) {
        const target = clamp(x + (Math.random() * 2 - 1) * Math.min(260, window.innerWidth * 0.25), minX, maxX);
        if (Math.abs(target - x) > 40) void walkTo(target);
      } else void runAction(die < 0.6 ? 'hops' : 'sway');
    }
    later(behave, (6000 + Math.random() * 8000) * (config.petActivity === 'quiet' ? 2 : config.petActivity === 'active' ? 0.65 : 1));
  };
  const chatter = () => {
    if (!paused && mood === 'idle' && config.petTalkative) {
      const pool = ['喝口水吧', '今天也要记得休息', ...skin.quips];
      say(busy ? '正在处理，稍等一下…' : pool[Math.floor(Math.random() * pool.length)]);
    }
    later(chatter, (35000 + Math.random() * 40000) * (config.petActivity === 'quiet' ? 2 : config.petActivity === 'active' ? 0.65 : 1));
  };

  const land = (depth: number) => {
    audio.land(depth);
    const deep = Math.min(0.35, depth / 1200);
    void animate([
      { transform: 'scaleY(1)' }, { transform: `scaleY(${1 - deep})` }, { transform: 'scaleY(1)' },
    ], { duration: 260 + Math.min(220, depth / 3), easing: 'ease-out' });
  };
  const fall = async () => {
    const depth = -liftY; const ownGeneration = generation;
    let state = { x, liftY, vx: releaseVelocity(samples, performance.now()), vy: 0 };
    samples = []; setMood('drag');
    // Finite frame loop: gravity settles before the deadline; cancellation resolves it.
    await framesFor(reducedMotion.matches ? 0 : 1200, (_progress, elapsed) => {
      state = stepFall(state, elapsed, minX, maxX);
      x = state.x; liftY = state.liftY;
      image.style.transform = `rotate(${clamp(state.vx * 26, -22, 22)}deg)`;
      applyPosition();
      return liftY < 0;
    });
    if (destroyed || generation !== ownGeneration) return;
    liftY = 0; setMood('idle'); image.style.transform = ''; applyPosition();
    remember(); land(depth); startBreathe(); avoidControls();
  };
  const openMenu = () => {
    clearTimer(holdTimer); interrupt(); clearMouth(); audio.stop(); setMood('idle'); liftY = 0; applyPosition();
    const rect = root.getBoundingClientRect();
    onMenu({ x: rect.left + rect.width / 2, y: rect.top });
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || pointer !== null) return;
    audio.warm();
    interrupt(); clearMouth(); audio.stop(); setMood('idle');
    pointer = event.pointerId; dragging = false; longPressed = false;
    dragOrigin = { px: event.clientX, py: event.clientY, x, lift: liftY };
    samples = [{ x: event.clientX, t: performance.now() }];
    try { root.setPointerCapture(event.pointerId); } catch { /* fallback pointer events still work */ }
    if (event.pointerType === 'touch') holdTimer = later(() => { longPressed = true; openMenu(); }, 550);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointer || longPressed) return;
    const dx = event.clientX - dragOrigin.px; const dy = event.clientY - dragOrigin.py;
    if (!dragging && Math.hypot(dx, dy) > 6) { dragging = true; clearTimer(holdTimer); setMood('drag'); }
    if (!dragging) return;
    x = dragOrigin.x + dx; liftY = dragOrigin.lift + dy;
    const now = performance.now(); const previous = samples[samples.length - 1];
    const speed = previous && now > previous.t ? (event.clientX - previous.x) / (now - previous.t) : 0;
    image.style.transform = `rotate(${clamp(speed * 34, -16, 16)}deg)`;
    samples.push({ x: event.clientX, t: now }); if (samples.length > 4) samples.shift();
    applyPosition(); event.preventDefault();
  };
  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    const wasDragging = dragging; pointer = null; dragging = false; clearTimer(holdTimer);
    try { root.releasePointerCapture(event.pointerId); } catch { /* capture already released */ }
    if (wasDragging && event.type === 'pointerup') void fall();
    else {
      liftY = 0; setMood('idle'); image.style.transform = ''; applyPosition();
      if (!longPressed && event.type === 'pointerup') poke();
      else { remember(); startBreathe(); }
    }
  };
  const onContextMenu = (event: MouseEvent) => { event.preventDefault(); openMenu(); };
  const onClick = (event: MouseEvent) => { if (event.detail === 0) { audio.warm(); poke(); } };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); openMenu(); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); interrupt(); liftY = 0; setMood('idle');
      facing = event.key === 'ArrowLeft' ? -1 : 1; x += facing * 24;
      applyPosition(); remember(); startBreathe();
    }
  };
  const onScroll = () => {
    if (destroyed || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; refreshViewport(); });
  };
  const onMotionChange = () => {
    interrupt(); clearMouth(); audio.stop(); liftY = 0; setMood('idle');
    applyPosition(); startBreathe();
  };
  const onImageError = () => {
    if (destroyed) return;
    if (image.getAttribute('src') !== skin.image) { idleImage(); return; }
    if (skin.id !== 'panda') {
      skin = findPetSkin('panda'); idleImage();
      root.dataset.skin = skin.id;
      root.setAttribute('aria-label', `${skin.name}桌宠，点击互动，右键或长按打开菜单`);
      refreshViewport();
    }
    else { root.hidden = true; onFailure(); }
  };
  const syncConfig = () => {
    const next = store.getSnapshot().config;
    const skinChanged = next.petSkin !== config.petSkin;
    const stoppedWalking = !next.petWalkable && mood === 'walk';
    config = next; audio.sync(config);
    if (skinChanged || stoppedWalking) {
      interrupt(); clearMouth(); audio.stop(); liftY = 0; setMood('idle');
      skin = findPetSkin(config.petSkin); idleImage(); startBreathe();
    }
    image.style.filter = `hue-rotate(${config.petHue}deg)`;
    image.style.opacity = String(config.petOpacity);
    root.setAttribute('aria-label', `${skin.name}桌宠，点击互动，右键或长按打开菜单`);
    root.dataset.skin = skin.id;
    if (!config.petTalkative) hideBubble();
    refreshViewport();
  };
  const unsubscribe = store.subscribe(syncConfig);
  image.addEventListener('error', onImageError);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(name, onPointerEnd);
  root.addEventListener('contextmenu', onContextMenu);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', refreshViewport);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.visualViewport?.addEventListener('resize', refreshViewport);
  window.visualViewport?.addEventListener('scroll', onScroll);
  document.addEventListener('visibilitychange', refreshViewport);
  document.addEventListener('focusin', onScroll);
  document.addEventListener('focusout', onScroll);
  reducedMotion.addEventListener('change', onMotionChange);
  idleImage(); syncConfig(); scheduleBlink();
  later(behave, 5000); later(chatter, 20000);

  return {
    poke, celebrate, say: message => { if (config.petPageMessages) say(message); },
    setBusy(value, message) { busy = value; root.dataset.busy = String(value); if (message && config.petPageMessages) say(message); },
    perform(action = 'signature') {
      if (destroyed || paused || mood === 'drag') return;
      interrupt(); liftY = 0; setMood('idle'); applyPosition();
      shout(false); void runAction(action);
    },
    resetPosition() { clearPetPosition(store.userId); interrupt(); setMood('idle'); liftY = 0; x = maxX; facing = -1; applyPosition(); startBreathe(); },
    refreshViewport,
    focus() { root.focus({ preventScroll: true }); if (mood === 'idle') startBreathe(); },
    destroy() {
      if (destroyed) return;
      remember(); destroyed = true; interrupt(); controlsResize?.disconnect(); cancelAnimationFrame(scrollFrame);
      unsubscribe(); timers.forEach(window.clearTimeout); timers.clear(); audio.destroy();
      window.removeEventListener('resize', refreshViewport);
      window.removeEventListener('scroll', onScroll);
      window.visualViewport?.removeEventListener('resize', refreshViewport);
      window.visualViewport?.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', refreshViewport);
      document.removeEventListener('focusin', onScroll);
      document.removeEventListener('focusout', onScroll);
      reducedMotion.removeEventListener('change', onMotionChange);
      image.removeEventListener('error', onImageError);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) root.removeEventListener(name, onPointerEnd);
      root.removeEventListener('contextmenu', onContextMenu);
      root.removeEventListener('click', onClick); root.removeEventListener('keydown', onKeyDown);
      root.remove(); bubble.remove();
    },
  };
}
