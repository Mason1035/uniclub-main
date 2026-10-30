import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BellRing, Megaphone } from 'lucide-react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gsap, useGSAP } from '@/lib/gsap';
import api from '@/lib/axios';
import { useAuth } from '@/context/authContextState';
import { useUser } from '@/context/userContextState';
import { listFrom } from '@/lib/contentFormat';
import type { Announcement } from '@/lib/announcementMeta';
import { homeNoticeDate, homeNoticeTarget, selectHomeNotices } from '@/lib/homeNotices';
import { PRELOADER_DONE } from '@/lib/preloader';
import './home-notice-bubbles.css';

gsap.registerPlugin(ScrollTrigger);

/** A small local drawing shares the illustration's playfulness without another asset request. */
function NoticeDoodle() {
  return <svg className="home-notice__doodle" viewBox="0 0 74 50" fill="none" aria-hidden="true" focusable="false">
    <path d="m8 29-5-5m9-3-2-7m9 5 2-5" stroke="#ed7868" strokeWidth="3" strokeLinecap="round"/>
    <path d="M31 36c-2-5 0-12 7-12h10c2-3 1-5 1-8a10 10 0 0 1 20 1c0 5-3 8-7 10 4 4 3 9-1 12-7 5-24 4-30-3Z" fill="#fffaf0"/>
    <path d="M51 29c-7-2-12 1-11 5 2 4 9 3 12-1" fill="#f1e5cc"/>
    <path d="m64 18 10 4-11 3" fill="#efb84f"/>
    <circle cx="62" cy="15" r="1.8" fill="#383c32"/>
  </svg>;
}

export default function HomeNoticeBubbles({ hostRef }: { hostRef: RefObject<HTMLDivElement> }) {
  const { user: identity, loading } = useAuth();
  const { isAuthenticated, isLoading } = useUser();
  const member = !loading && !isLoading && !!identity && isAuthenticated;
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const scope = useRef<HTMLElement>(null);
  useEffect(() => { setHost(hostRef.current); }, [hostRef]);
  const query = useQuery({
    queryKey: ['announcements', 'home-bubbles', identity?.id], enabled: member,
    queryFn: async ({ signal }) => listFrom<Announcement>((await api.get('/api/announcements?view=home-bubbles', { signal })).data, 'announcements'),
    staleTime: 60000,
  });
  const items = member ? selectHomeNotices(query.data || []) : [];
  const signature = items.map(item => item.announcement._id).join('|');

  useGSAP(() => {
    const root = scope.current;
    const hero = host?.querySelector<HTMLElement>('.c-hero-home');
    if (!root || !hero || !signature) return;
    const media = gsap.matchMedia();
    media.add({ compact: '(max-width: 999px)', desktop: '(min-width: 1000px)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
      const reduced = !!conditions?.reduce;
      const shells = Array.from(root.querySelectorAll<HTMLElement>('.home-notice'));
      const arrivals = root.querySelectorAll<HTMLElement>('.home-notice__arrival');
      const floats = Array.from(root.querySelectorAll<HTMLElement>('.home-notice__float'));
      const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('.home-notice__link'));
      const hovered = new Set<number>();
      const focused = new Set<number>();
      let started = false;
      let entered = false;
      let progress = 0;

      // Only this absolute overlay is positioned. Never alter a hero/header/artwork node.
      const place = () => {
        const origin = host!.getBoundingClientRect();
        const header = document.querySelector('.mm-header')?.getBoundingClientRect();
        const shortcut = document.querySelector('.mm-home-shortcuts')?.getBoundingClientRect();
        const title = hero.querySelector('.mm-hero-line:last-child')?.getBoundingClientRect();
        const firstLine = hero.querySelector('.mm-hero-line')?.getBoundingClientRect();
        const headerNode = document.querySelector<HTMLElement>('.mm-header');
        const shortcutNode = document.querySelector<HTMLElement>('.mm-home-shortcuts');
        const fixedBottom = (node: HTMLElement | null) => node ? (parseFloat(getComputedStyle(node).top) || 0) + node.offsetHeight : 0;
        const ceiling = Math.max(fixedBottom(headerNode), fixedBottom(shortcutNode), 80) - (origin.top + window.scrollY);
        root.dataset.compact = String(!!conditions?.compact);
        delete root.dataset.minimal;
        root.style.left = '';
        root.style.right = '';
        root.style.top = `${ceiling + (conditions?.compact ? 14 : 34)}px`;
        const left = origin.width - parseFloat(getComputedStyle(root).right) - root.offsetWidth;
        if (title && firstLine && left < title.right - origin.left + 24 && ceiling + 34 + root.offsetHeight > firstLine.top - origin.top - 16) {
          root.dataset.compact = 'true';
          root.style.top = `${ceiling + 14}px`;
        }
        if (firstLine && root.dataset.compact === 'true' && ceiling + 14 + root.offsetHeight > firstLine.top - origin.top - 14) {
          root.dataset.minimal = 'true';
          root.style.top = `${(shortcut?.top ?? header?.bottom ?? 80) - origin.top}px`;
          root.style.left = '20px';
          root.style.right = 'auto';
        }
      };
      place();
      const observer = new ResizeObserver(place);
      [hero, document.querySelector('.mm-header'), document.querySelector('.mm-home-shortcuts')].forEach(element => { if (element) observer.observe(element); });

      const drift = reduced ? [] : floats.map((element, index) => gsap.to(element, {
        y: index ? -4 : 3.5, rotation: index ? .45 : -.4,
        duration: index ? 4.1 : 3.2, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true,
      }));
      const sync = () => {
        const hidden = !started || progress >= .98;
        root.inert = hidden;
        if (hidden) root.setAttribute('aria-hidden', 'true'); else root.removeAttribute('aria-hidden');
        drift.forEach((tween, index) => tween.paused(!entered || progress > .002 || document.hidden || hovered.has(index) || focused.has(index)));
      };
      const intro = gsap.timeline({ paused: true, onComplete: () => { entered = true; sync(); } });
      intro.fromTo(arrivals, { x: reduced ? 0 : 26, scale: reduced ? 1 : .93, autoAlpha: 0 }, {
        x: 0, scale: 1, autoAlpha: 1, duration: reduced ? .16 : .7,
        stagger: reduced ? 0 : .16, ease: reduced ? 'none' : 'back.out(1.35)',
      });
      gsap.set(shells, { x: 0, y: 0, scale: 1, rotation: 0, autoAlpha: 1, transformOrigin: '65% 30%' });
      const collapse = gsap.timeline({ paused: true, onUpdate: () => {
        const previous = progress;
        progress = collapse.progress();
        if (previous > .002 && progress <= .002) place();
        sync();
      } });
      if (reduced) {
        collapse.to(shells, { autoAlpha: 0, duration: 1, ease: 'none' });
      } else {
        shells.forEach((element, index) => {
          collapse.to(element, { x: index ? -10 : 8, y: index ? -17 : 8, scaleX: 1.025, scaleY: .93,
            rotation: index ? -1 : 1, duration: .24, ease: 'sine.inOut' }, 0);
          collapse.to(element, { scaleX: .985, scaleY: 1.025, y: index ? -12 : 2, duration: .19, ease: 'sine.out' }, .24);
          collapse.to(element, { x: index ? 13 : 23, y: index ? -176 : -146, scaleX: .6, scaleY: .64,
            rotation: index ? 3 : -4, autoAlpha: 0, duration: .53, ease: 'power2.in' }, .36 + index * .12);
        });
      }
      const trigger = ScrollTrigger.create({
        id: 'classhub-home-notices', trigger: hero, start: 'top top',
        end: () => `+=${Math.min(380, Math.max(200, window.innerHeight * .4))}`,
        animation: collapse, scrub: reduced ? true : .18, invalidateOnRefresh: true,
      });
      // Account/data can arrive after scroll restoration. Adopt that position before revealing.
      collapse.progress(trigger.progress);
      gsap.set(root, { visibility: 'visible' });
      const enter = () => { if (started) return; started = true; sync(); intro.play(); };
      window.addEventListener(PRELOADER_DONE, enter);
      if ((!window.__classhubPreloader || window.__classhubPreloader.state === 'done') && !document.documentElement.hasAttribute('data-classhub-preloader')) enter();
      const subscriptions = links.map((link, index) => {
        const over = () => { hovered.add(index); sync(); };
        const out = () => { hovered.delete(index); sync(); };
        const focus = () => { focused.add(index); intro.progress(1); sync(); };
        const blur = () => { focused.delete(index); sync(); };
        link.addEventListener('pointerenter', over); link.addEventListener('pointerleave', out);
        link.addEventListener('focus', focus); link.addEventListener('blur', blur);
        return () => {
          link.removeEventListener('pointerenter', over); link.removeEventListener('pointerleave', out);
          link.removeEventListener('focus', focus); link.removeEventListener('blur', blur);
        };
      });
      document.addEventListener('visibilitychange', sync);
      sync();
      return () => {
        observer.disconnect(); subscriptions.forEach(dispose => dispose());
        window.removeEventListener(PRELOADER_DONE, enter);
        document.removeEventListener('visibilitychange', sync);
        root.inert = true;
        root.setAttribute('aria-hidden', 'true');
        ['top', 'left', 'right'].forEach(property => root.style.removeProperty(property));
        delete root.dataset.compact; delete root.dataset.minimal;
      };
    }, root);
    return () => media.revert();
  }, { scope, dependencies: [host, signature], revertOnUpdate: true });

  if (!host || !items.length) return null;
  return createPortal(<aside ref={scope} className="home-notice-bubbles" aria-label="首页通知" data-pet-avoid>
    {items.map(({ announcement: item, prominent, label }, index) => <div key={item._id} className={`home-notice${prominent ? ' home-notice--important' : ''}`}>
      <div className="home-notice__arrival"><div className="home-notice__float">
        <Link className="home-notice__link" to={homeNoticeTarget(item._id)} aria-label={`${label}：${item.title}，${homeNoticeDate(item.publishedAt)}，查看详情`}>
          {index === 0 && prominent && <NoticeDoodle/>}
          <span className="home-notice__meta"><span className="home-notice__icon">{prominent ? <BellRing size={15} aria-hidden="true"/> : <Megaphone size={15} aria-hidden="true"/>}</span><span className="home-notice__label">{label}</span><time dateTime={item.publishedAt}>{homeNoticeDate(item.publishedAt)}</time></span>
          <strong className="home-notice__title">{item.title}</strong>
          <span className="home-notice__description">{item.body.replace(/\s+/g, ' ').trim()}</span>
          <ArrowUpRight className="home-notice__arrow" size={17} aria-hidden="true"/>
          {index === 0 && items.length > 1 && <span className="home-notice__count" aria-hidden="true">+{items.length - 1}</span>}
        </Link>
      </div></div>
    </div>)}
  </aside>, host);
}
