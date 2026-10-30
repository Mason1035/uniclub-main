import { gsap } from '@/lib/gsap';

type RiveInput = { name: string; value: boolean | number };
export type RiveInstance = {
  cleanup(): void;
  resizeDrawingSurfaceToCanvas(): void;
  startRendering(): void;
  stopRendering(): void;
  stateMachineInputs?(name: string): RiveInput[];
  viewModelInstance?: { number(name: string): { value: number } | null };
};
export type RiveRuntime = {
  Rive: new (options: Record<string, unknown>) => RiveInstance;
  Layout: new (options: Record<string, unknown>) => unknown;
  Fit: { Contain: unknown };
  Alignment: { Center: unknown };
  RuntimeLoader: { setWasmUrl(url: string): void };
};

let runtimePromise: Promise<RiveRuntime> | undefined;
export function loadRiveRuntime(): Promise<RiveRuntime> {
  if (!runtimePromise) {
    runtimePromise = import('./rive-runtime.js').then(module => {
      const runtime = module.r as RiveRuntime;
      runtime.RuntimeLoader.setWasmUrl(`${import.meta.env.BASE_URL}mindmarket/wasm/rive.wasm`);
      return runtime;
    }).catch(error => {
      runtimePromise = undefined;
      throw error;
    });
  }
  return runtimePromise;
}

export type RivePlayerController = {
  /** Closed menus remain poster-only until they are first opened. */
  setActive(active: boolean): void;
  dispose(): void;
};
export type RivePlayerOptions = {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  src: string;
  active?: boolean;
  reveal?: boolean;
  revealTarget?: HTMLElement;
  revealDelay?: number;
  poster?: string;
};

const localAsset = (path: string) => `${import.meta.env.BASE_URL}mindmarket/${path}`;

/** The poster is an original MindMarket illustration already saved locally.
 * It is decorative artwork, never a stand-in for a member's photograph. */
function createPoster(host: HTMLElement, source?: string) {
  const layer = document.createElement('div');
  layer.className = 'mm-rive-poster';
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'absolute', inset: '0', display: 'grid', placeItems: 'center',
    pointerEvents: 'none', overflow: 'hidden',
  });
  const image = document.createElement('img');
  image.alt = '';
  image.decoding = 'async';
  image.loading = 'lazy';
  image.draggable = false;
  image.src = source || localAsset('posters/character.webp');
  Object.assign(image.style, {
    width: '100%', height: '100%', display: 'block', objectFit: 'contain',
  });
  image.onerror = () => {
    image.onerror = null;
    image.src = localAsset('timeline/hero-background-illustration.svg');
  };
  layer.appendChild(image);
  host.appendChild(layer);
  return layer;
}

/** One lifecycle for native React scenes and source-template c-rive hosts.
 * Observation/posters are cheap; the runtime and .riv fetch begin only when
 * the host is close to the viewport, active, visible and motion is permitted. */
export function mountRivePlayer({
  host, canvas, src, active = true, reveal = false,
  revealTarget = host, revealDelay = 0, poster,
}: RivePlayerOptions): RivePlayerController {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasIntersectionObserver = typeof window.IntersectionObserver === 'function';
  const saved = {
    position: host.style.position,
    visibility: canvas.style.visibility,
    pointerEvents: canvas.style.pointerEvents,
    loaded: host.getAttribute('data-loaded'),
    state: host.getAttribute('data-mm-rive-state'),
  };
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  canvas.style.visibility = 'hidden';
  // Cursor inputs are owned below, so runtime-native listeners cannot keep
  // responding to pointer events after motion has been disabled.
  canvas.style.pointerEvents = 'none';
  const fallback = createPoster(host, poster);
  let disposed = false;
  let reduced = motion.matches;
  let near = false;
  let visible = false;
  let loading = false;
  let ready = false;
  let failed = false;
  let stopped = false;
  let generation = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;
  let player: RiveInstance | undefined;
  let nearObserver: IntersectionObserver | undefined;
  let visibilityObserver: IntersectionObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let resizeFrame = 0;
  let pointerFrame = 0;
  let following = false;
  let revealed = false;
  let revealContext: ReturnType<typeof gsap.context> | undefined;
  let revealTween: gsap.core.Tween | undefined;
  let smiling: RiveInput | undefined;
  let posx: { value: number } | null | undefined;
  let posy: { value: number } | null | undefined;
  const cursor = src.includes('mindmarket_cursor_crop');
  const pointerHost = host.parentElement || host;
  const position = { x: -34, y: -15 };
  let target = { ...position };

  const state = (value: string) => { host.dataset.mmRiveState = value; };
  const showPoster = () => {
    fallback.hidden = false;
    fallback.style.display = 'grid';
    canvas.style.visibility = 'hidden';
  };
  const showCanvas = () => {
    fallback.hidden = true;
    fallback.style.display = 'none';
    canvas.style.visibility = saved.visibility;
  };
  const displayed = () => host.isConnected && !host.closest('[hidden], [inert]') && host.getClientRects().length > 0;
  const eligible = () => active && near && !document.hidden && !reduced && displayed();
  const animating = () => !disposed && ready && !failed && !stopped && visible && eligible();
  const clearTimeoutGuard = () => {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = undefined;
  };
  const restoreReveal = () => {
    revealContext?.revert();
    revealContext = undefined;
    revealTween = undefined;
  };
  const setPosition = () => {
    if (posx) posx.value = position.x;
    if (posy) posy.value = position.y;
  };
  const updatePosition = () => {
    pointerFrame = 0;
    if (!animating()) return;
    position.x += (target.x - position.x) * .1;
    position.y += (target.y - position.y) * .1;
    setPosition();
    if (Math.abs(position.x - target.x) > .5 || Math.abs(position.y - target.y) > .5) {
      pointerFrame = requestAnimationFrame(updatePosition);
    }
  };
  const follow = (event: PointerEvent) => {
    if (!animating()) return;
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    target = {
      x: -90 + Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * 110,
      y: -90 + Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) * 110,
    };
    if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePosition);
  };
  const smile = () => { if (animating() && smiling) smiling.value = true; };
  const reset = () => {
    if (smiling) smiling.value = false;
    target = { x: -34, y: -15 };
    if (animating() && !pointerFrame) pointerFrame = requestAnimationFrame(updatePosition);
  };
  const stopFollowing = () => {
    host.removeEventListener('pointermove', follow);
    pointerHost.removeEventListener('pointerenter', smile);
    pointerHost.removeEventListener('pointerleave', reset);
    following = false;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    if (smiling) smiling.value = false;
    position.x = -34; position.y = -15;
    target = { ...position };
    setPosition();
  };
  const startFollowing = () => {
    if (!cursor || following || !animating()) return;
    following = true;
    host.addEventListener('pointermove', follow, { passive: true });
    pointerHost.addEventListener('pointerenter', smile);
    pointerHost.addEventListener('pointerleave', reset);
  };
  const stopPlayer = () => {
    stopFollowing();
    try { player?.stopRendering(); } catch { /* A failed decorative renderer is optional. */ }
  };
  const destroyPlayer = () => {
    stopPlayer();
    try { player?.cleanup(); } catch { /* Leave the poster and page controls usable. */ }
    player = undefined;
    ready = false;
    smiling = undefined; posx = null; posy = null;
  };
  const cancelPending = () => {
    if (!loading) return;
    generation += 1;
    loading = false;
    request?.abort(); request = undefined;
    clearTimeoutGuard();
    destroyPlayer();
  };
  const fail = (current: number) => {
    if (disposed || current !== generation) return;
    failed = true;
    loading = false;
    request?.abort(); request = undefined;
    clearTimeoutGuard();
    destroyPlayer();
    restoreReveal();
    host.dataset.loaded = 'failed';
    state('fallback');
    showPoster();
  };
  const resize = () => {
    resizeFrame = 0;
    if (disposed || !ready || !displayed()) return;
    try { player?.resizeDrawingSurfaceToCanvas(); } catch { fail(generation); return; }
    // Resizing may request a frame internally. Reapply all current stop rules.
    sync();
  };
  const scheduleResize = () => {
    if (!disposed && ready && !resizeFrame) resizeFrame = requestAnimationFrame(resize);
  };
  const revealOnce = () => {
    if (!reveal || revealed || !animating()) return;
    revealed = true;
    revealContext = gsap.context(() => {
      revealTween = gsap.fromTo(revealTarget, { scale: .75, y: 100, opacity: 0 }, {
        scale: 1, y: 0, opacity: 1, delay: Math.max(0, revealDelay),
        duration: 1.75, ease: 'elastic.out(1,.3)', clearProps: 'transform,opacity',
      });
    }, revealTarget);
  };

  const beginLoad = () => {
    if (disposed || loading || player || failed || !eligible()) return;
    loading = true;
    const current = ++generation;
    request = new AbortController();
    const signal = request.signal;
    state('loading');
    // A slow or failed WASM/.riv never blocks text, menus, navigation or forms.
    timeout = setTimeout(() => fail(current), 12000);
    const file = fetch(src, { signal }).then(response => {
      if (!response.ok) throw new Error('Rive artwork unavailable');
      return response.arrayBuffer();
    });
    void Promise.all([loadRiveRuntime(), file]).then(([runtime, buffer]) => {
      if (disposed || current !== generation || failed || !eligible()) return;
      player = new runtime.Rive({
        buffer, canvas, autoplay: true,
        shouldDisableRiveListeners: true,
        ...(cursor ? { stateMachines: 'State Machine 1', autoBind: true } : {}),
        layout: new runtime.Layout({ fit: runtime.Fit.Contain, alignment: runtime.Alignment.Center }),
        onLoad: () => queueMicrotask(() => {
          if (disposed || current !== generation || failed || !player) return;
          loading = false;
          ready = true;
          clearTimeoutGuard();
          try {
            player.resizeDrawingSurfaceToCanvas();
            if (cursor) {
              smiling = player.stateMachineInputs?.('State Machine 1').find(input => input.name === 'isSmiling');
              posx = player.viewModelInstance?.number('posx');
              posy = player.viewModelInstance?.number('posy');
              setPosition();
            }
          } catch { fail(current); return; }
          host.dataset.loaded = 'true';
          state('ready');
          sync();
        }),
        onLoadError: () => queueMicrotask(() => fail(current)),
        onStop: () => queueMicrotask(() => {
          if (disposed || current !== generation || !ready) return;
          stopped = true;
          stopPlayer();
          restoreReveal();
          // One-shot animation completion keeps the final frame; it is not a
          // resource error and must not restart in a visibility-change loop.
          state('stopped');
          if (reduced) showPoster(); else showCanvas();
        }),
      });
    }).catch(() => { if (!signal.aborted) fail(current); });
  };

  function sync() {
    if (disposed) return;
    if (!eligible() && loading) cancelPending();
    if (reduced || failed || !ready) showPoster();
    else showCanvas();
    if (animating()) {
      try { player?.startRendering(); } catch { fail(generation); return; }
      startFollowing();
      revealOnce();
      revealTween?.resume();
    } else {
      stopPlayer();
      revealTween?.pause();
      if (reduced) {
        restoreReveal();
        state('reduced');
      }
    }
    if (!ready && !failed && eligible()) beginLoad();
  }
  const onMotionChange = () => {
    reduced = motion.matches;
    sync();
  };
  const onVisibilityChange = () => sync();
  const measureVisibility = () => {
    const rect = host.getBoundingClientRect();
    const viewport = window.innerHeight;
    const hasBox = rect.width > 0 && rect.height > 0 && displayed();
    near = hasBox && rect.bottom >= -150 && rect.top <= viewport + 150;
    visible = hasBox && rect.bottom > 0 && rect.top < viewport;
    sync();
  };
  const onWindowResize = () => {
    if (!hasIntersectionObserver) measureVisibility();
    scheduleResize();
  };
  const onContextLost = (event: Event) => { event.preventDefault(); fail(generation); };
  state(reduced ? 'reduced' : 'pending');
  if (hasIntersectionObserver) {
    nearObserver = new IntersectionObserver(entries => {
      near = !!entries[0]?.isIntersecting;
      sync();
    }, { rootMargin: '150px' });
    visibilityObserver = new IntersectionObserver(entries => {
      visible = !!entries[0]?.isIntersecting;
      sync();
    });
    nearObserver.observe(host);
    visibilityObserver.observe(host);
  } else {
    measureVisibility();
    window.addEventListener('scroll', measureVisibility, { passive: true });
  }
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(host);
  }
  if (typeof motion.addEventListener === 'function') motion.addEventListener('change', onMotionChange);
  else motion.addListener(onMotionChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('resize', onWindowResize, { passive: true });
  canvas.addEventListener('webglcontextlost', onContextLost);

  return {
    setActive(value) { active = value; sync(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      request?.abort();
      clearTimeoutGuard();
      nearObserver?.disconnect();
      visibilityObserver?.disconnect();
      resizeObserver?.disconnect();
      if (typeof motion.removeEventListener === 'function') motion.removeEventListener('change', onMotionChange);
      else motion.removeListener(onMotionChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('scroll', measureVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      cancelAnimationFrame(resizeFrame);
      destroyPlayer();
      restoreReveal();
      fallback.remove();
      canvas.style.visibility = saved.visibility;
      canvas.style.pointerEvents = saved.pointerEvents;
      host.style.position = saved.position;
      if (saved.loaded === null) host.removeAttribute('data-loaded'); else host.setAttribute('data-loaded', saved.loaded);
      if (saved.state === null) host.removeAttribute('data-mm-rive-state'); else host.setAttribute('data-mm-rive-state', saved.state);
    },
  };
}

/** Register all source slots without constructing their players up front. */
export function mountReferenceRivePlayers(root: HTMLElement, { reveal = true }: { reveal?: boolean } = {}) {
  const controllers: RivePlayerController[] = [];
  root.querySelectorAll<HTMLElement>('c-rive').forEach(element => {
    const canvas = element.querySelector<HTMLCanvasElement>('canvas');
    const src = element.dataset.src;
    const host = canvas?.parentElement;
    if (!canvas || !host || !src) return;
    controllers.push(mountRivePlayer({
      host, canvas, src,
      active: element.dataset.autoplay !== 'false',
      // Returning home skips only the entrance tween; the native animation,
      // visibility rules and pointer interaction keep their normal lifecycle.
      reveal: reveal && element.dataset.reveal === 'true',
      revealTarget: host.parentElement || host,
      revealDelay: Number(element.dataset.revealDelay) || 0,
      poster: element.dataset.poster,
    }));
  });
  return () => controllers.forEach(controller => controller.dispose());
}
