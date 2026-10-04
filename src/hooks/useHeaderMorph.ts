import type { RefObject } from 'react';
import { gsap, useGSAP } from '../lib/gsap';

const MOTION = { smoothingMs: 65, settleEpsilon: 0.0005, scrollHeaderLengths: 2.2, horizontalLeadPower: 2, navRisePower: 4 } as const;
const GEOMETRY = {
  compactGapEm: 1.5, logoGapEm: 1.75, maxLogoEm: 9.5, logoScale: .55,
  landingShiftRatio: .04, arcRatio: .06, scrollStartRatio: .08,
  mobileScale: .94, tabletScale: .66, tabletLogoShiftRatio: .17, tabletNavShift: 42,
} as const;

/** Keep the existing fixed, two-row header; only its painted geometry morphs. */
export function useHeaderMorph(scope: RefObject<HTMLDivElement>) {
  useGSAP(() => {
    const root = scope.current;
    if (!root) return;
    const header = root.querySelector<HTMLElement>('.masthead');
    const brand = root.querySelector<HTMLElement>('.masthead-brand');
    const nav = root.querySelector<HTMLElement>('.masthead-nav');
    const tools = root.querySelector<HTMLElement>('.masthead-actions');
    const container = root.querySelector<HTMLElement>('.site-container');
    if (!header || !brand || !nav || !tools || !container) return;
    const links = Array.from(nav.querySelectorAll<HTMLElement>('a'));
    const variables = ['--header-progress', '--header-horizontal-progress', '--header-nav-rise', '--header-logo-x', '--header-logo-y', '--header-logo-scale', '--header-nav-start-x', '--header-nav-end-x', '--header-nav-y', '--header-tools-y', '--header-paper-scale'];
    const originalVariables = variables.map(name => [name, header.style.getPropertyValue(name)] as const);
    const originalGap = nav.style.columnGap;
    const originalShifts = links.map(link => link.style.getPropertyValue('--header-link-shift'));
    const ease = gsap.parseEase('power2.inOut');
    const media = gsap.matchMedia();
    media.add({ desktop: '(min-width: 1024px)', tablet: '(min-width: 768px) and (max-width: 1023px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
      let alive = true;
      let frame = 0;
      let measurementFrame = 0;
      let lastTime = 0;
      let current = 0;
      let target = 0;
      let start = 0;
      let distance = 1;
      let logoEndY = 0;
      let arc = 0;
      let desktop = false;
      const mobile = !!conditions?.mobile;
      const reduce = !!conditions?.reduce;
      const write = (name: string, value: number, unit = '') => header.style.setProperty(name, `${value}${unit}`);
      const readTarget = () => {
        if (mobile) return window.scrollY > 80 ? 1 : 0;
        const progress = gsap.utils.clamp(0, 1, (Math.max(0, window.scrollY) - start) / distance);
        return reduce ? (progress > 0 ? 1 : 0) : progress;
      };
      const draw = () => {
        const progress = ease(current);
        write('--header-progress', progress);
        // Make horizontal room first; the nav rises after the logo clears it.
        // Both curves have continuous, reversible endpoints without reparenting.
        write('--header-horizontal-progress', desktop ? 1 - Math.pow(1 - progress, MOTION.horizontalLeadPower) : progress);
        write('--header-nav-rise', desktop ? Math.pow(progress, MOTION.navRisePower) : progress);
        write('--header-logo-y', logoEndY * progress + (desktop && !reduce ? Math.sin(Math.PI * progress) * arc : 0), 'px');
        header.dataset.compact = String(current >= 1 - MOTION.settleEpsilon);
      };
      const tick = (time: number) => {
        frame = 0;
        if (!alive) return;
        const delta = lastTime ? Math.min(time - lastTime, 64) : 1000 / 60;
        lastTime = time;
        current += (target - current) * (1 - Math.exp(-delta / MOTION.smoothingMs));
        const settled = Math.abs(target - current) < MOTION.settleEpsilon;
        if (settled) current = target;
        draw();
        header.dataset.morphing = String(!settled);
        if (!settled) frame = requestAnimationFrame(tick);
        else lastTime = 0;
      };
      const onScroll = () => {
        target = readTarget();
        if (reduce) { current = target; draw(); return; }
        if (!frame && Math.abs(target - current) >= MOTION.settleEpsilon) frame = requestAnimationFrame(tick);
      };
      const measure = () => {
        measurementFrame = 0;
        if (!alive) return;
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        // One measurement batch on resize/font changes, never in a scroll frame.
        header.dataset.morphMode = 'measuring';
        nav.style.columnGap = originalGap;
        const brandBox = brand.getBoundingClientRect();
        const navBox = nav.getBoundingClientRect();
        const navLineBox = links[0]?.getBoundingClientRect() || navBox;
        const toolsBox = tools.getBoundingClientRect();
        // The right grid track includes empty space; reserve only real controls.
        const toolsContentLeft = Math.min(...Array.from(tools.children, child => child.getBoundingClientRect().left), toolsBox.right);
        const headerBox = header.getBoundingClientRect();
        const containerBox = container.getBoundingClientRect();
        const navStyle = getComputedStyle(nav);
        const fontSize = parseFloat(navStyle.fontSize);
        const openGap = parseFloat(navStyle.columnGap) || 0;
        const compactGap = Math.min(openGap, fontSize * GEOMETRY.compactGapEm);
        const logoGap = fontSize * GEOMETRY.logoGapEm;
        const compactLogoWidth = Math.min(brandBox.width * GEOMETRY.logoScale, fontSize * GEOMETRY.maxLogoEm);
        const compactNavWidth = links.reduce((width, link) => width + link.offsetWidth, 0) + compactGap * (links.length - 1);
        const groupWidth = compactLogoWidth + logoGap + compactNavWidth;
        const center = headerBox.left + headerBox.width / 2;
        const gutter = parseFloat(getComputedStyle(container).paddingRight);
        const clearance = fontSize;
        const availableHalf = Math.min(center - containerBox.left - gutter, toolsContentLeft - center - clearance);
        desktop = !!conditions?.desktop && groupWidth / 2 <= availableHalf;
        const brandCenterY = brandBox.top + brandBox.height / 2 - headerBox.top;
        // A small downward landing retains the accepted contraction (~one nav row).
        const compactCenterY = brandCenterY + brandBox.height * GEOMETRY.landingShiftRatio;
        const compactHeight = Math.max(compactCenterY * 2, compactLogoWidth / 3 + fontSize * 2);
        logoEndY = desktop ? compactCenterY - brandCenterY : mobile ? 0 : -brandBox.height * GEOMETRY.tabletLogoShiftRatio;
        arc = brandBox.height * GEOMETRY.arcRatio;
        write('--header-logo-x', desktop ? center - (brandBox.left + brandBox.width / 2) - (compactNavWidth + logoGap) / 2 : 0, 'px');
        write('--header-logo-scale', desktop ? compactLogoWidth / brandBox.width : mobile ? GEOMETRY.mobileScale : GEOMETRY.tabletScale);
        write('--header-nav-start-x', desktop ? -(openGap - compactGap) * (links.length - 1) / 2 : 0, 'px');
        write('--header-nav-end-x', desktop ? (compactLogoWidth + logoGap) / 2 : 0, 'px');
        write('--header-nav-y', desktop ? compactCenterY - (navLineBox.top + navLineBox.height / 2 - headerBox.top) : mobile ? 0 : -GEOMETRY.tabletNavShift, 'px');
        write('--header-tools-y', desktop ? compactCenterY - (toolsBox.top + toolsBox.height / 2 - headerBox.top) : 0, 'px');
        write('--header-paper-scale', desktop ? compactHeight / headerBox.height : mobile ? 1 : (headerBox.height - GEOMETRY.tabletNavShift) / headerBox.height);
        if (desktop) nav.style.columnGap = `${compactGap}px`;
        links.forEach((link, index) => link.style.setProperty('--header-link-shift', `${desktop ? index * (openGap - compactGap) : 0}px`));
        header.dataset.morphMode = desktop ? 'desktop' : mobile ? 'mobile' : 'tablet';
        header.dataset.reducedMotion = String(reduce);
        header.dataset.morphing = 'false';
        start = headerBox.height * GEOMETRY.scrollStartRatio;
        distance = headerBox.height * MOTION.scrollHeaderLengths;
        target = readTarget();
        current = target;
        draw();
      };
      const queueMeasure = () => { if (!measurementFrame) measurementFrame = requestAnimationFrame(measure); };
      measure();
      const observer = new ResizeObserver(queueMeasure);
      [brand, nav, tools, container].forEach(element => observer.observe(element));
      window.addEventListener('resize', queueMeasure, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
      document.fonts?.addEventListener('loadingdone', queueMeasure);
      void document.fonts?.ready.then(() => { if (alive) queueMeasure(); });
      return () => {
        alive = false;
        cancelAnimationFrame(frame);
        cancelAnimationFrame(measurementFrame);
        observer.disconnect();
        window.removeEventListener('resize', queueMeasure);
        window.removeEventListener('scroll', onScroll);
        document.fonts?.removeEventListener('loadingdone', queueMeasure);
        nav.style.columnGap = originalGap;
        links.forEach((link, index) => {
          if (originalShifts[index]) link.style.setProperty('--header-link-shift', originalShifts[index]);
          else link.style.removeProperty('--header-link-shift');
        });
        originalVariables.forEach(([name, value]) => {
          if (value) header.style.setProperty(name, value);
          else header.style.removeProperty(name);
        });
        ['morphMode', 'morphing', 'compact', 'reducedMotion'].forEach(name => delete header.dataset[name]);
      };
    }, root);
    return () => media.revert();
  }, { scope });
}
