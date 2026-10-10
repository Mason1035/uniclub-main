import { useRef, type RefObject } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { Flip } from '@/lib/gsapFlip';

type LeavingItem = { id: string; node: HTMLElement; rect: DOMRect };

/** Capture in the click handler, then animate the same keyed nodes after React commits. */
export function useFlipList(scope: RefObject<HTMLDivElement>, revision: string) {
  const pending = useRef<{ state: ReturnType<typeof Flip.getState>; leaving: LeavingItem[] }>();
  const active = useRef<gsap.core.Timeline>();
  const ghosts = useRef<HTMLElement[]>([]);
  const policy = useRef({ reduce: false, mobile: false });
  const clearGhosts = () => { ghosts.current.forEach(node => node.remove()); ghosts.current = []; };
  const finish = () => { active.current?.progress(1); clearGhosts(); };

  const { contextSafe } = useGSAP(() => {
    const root = scope.current;
    const media = gsap.matchMedia();
    media.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
      policy.current = { reduce: !!conditions?.reduce, mobile: !!conditions?.mobile };
      return () => { finish(); pending.current = undefined; };
    }, scope);
    root?.addEventListener('focusin', finish);
    return () => { root?.removeEventListener('focusin', finish); finish(); media.revert(); };
  }, { scope });

  const capture = contextSafe((options?: { leaving?: boolean }) => {
    finish();
    pending.current = undefined;
    if (policy.current.reduce || !scope.current) return;
    const items = Array.from(scope.current.querySelectorAll<HTMLElement>('[data-flip-id]'));
    const state = Flip.getState(items);
    const leaving = options?.leaving ? items.flatMap(node => {
      const rect = node.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return [];
      return [{ id: node.dataset.flipId!, node: node.cloneNode(true) as HTMLElement, rect }];
    }) : [];
    pending.current = { state, leaving };
  });

  useGSAP(() => {
    const snapshot = pending.current;
    pending.current = undefined;
    if (!snapshot || policy.current.reduce || !scope.current) return;
    const items = Array.from(scope.current.querySelectorAll<HTMLElement>('[data-flip-id]'));
    const ids = new Set(items.map(node => node.dataset.flipId));
    const exits: gsap.core.Tween[] = [];
    snapshot.leaving.filter(item => !ids.has(item.id)).forEach(({ node, rect }) => {
      // React owns the real items. Only inert, inaccessible visual copies leave.
      node.removeAttribute('id');
      node.removeAttribute('data-flip-id');
      node.querySelectorAll('[id],[data-flip-id]').forEach(el => { el.removeAttribute('id'); el.removeAttribute('data-flip-id'); });
      node.setAttribute('aria-hidden', 'true');
      node.inert = true;
      Object.assign(node.style, {
        position: 'absolute', left: `${rect.left + scrollX}px`, top: `${rect.top + scrollY}px`,
        width: `${rect.width}px`, height: `${rect.height}px`, margin: '0',
        pointerEvents: 'none', zIndex: '1', background: 'hsl(var(--paper))',
      });
      document.body.appendChild(node);
      ghosts.current.push(node);
      exits.push(gsap.to(node, { paused: true, autoAlpha: 0, duration: 0.16, ease: 'power1.out', onComplete: () => node.remove() }));
    });
    active.current = Flip.from(snapshot.state, {
      targets: items, scale: true, nested: true, duration: policy.current.mobile ? 0.24 : 0.3,
      ease: 'power2.inOut', prune: true,
      onEnter: entering => gsap.fromTo(entering, { autoAlpha: 0, y: 12 }, {
        autoAlpha: 1, y: 0, duration: 0.24, stagger: { amount: 0.08 },
        clearProps: 'transform,opacity,visibility',
      }),
    });
    // Even an entirely empty result needs time to finish its outgoing fade.
    exits.forEach(tween => active.current?.add(tween.paused(false), 0));
    active.current.eventCallback('onComplete', clearGhosts);
    return () => { active.current?.kill(); clearGhosts(); };
  }, { scope, dependencies: [revision], revertOnUpdate: true });

  return capture;
}
