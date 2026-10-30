import { useEffect, useId, useRef, useState } from 'react';

export type CloudVariant = 'announcement' | 'brief' | 'activity' | 'resource' | 'news' | 'pulse' | 'gallery';
type Size = { width: number; height: number };
type CloudShape = {
  top: number[];
  bottom: number[];
  side: number;
  topDepth: number;
  bottomDepth: number;
  topColor: string;
  bottomColor: string;
  tint: string;
  back: string;
  accent: string;
  plane?: boolean;
};

// Each outline has a different rhythm. The values describe horizontal lobes,
// never a percentage of the content height, so long copy keeps a calm interior.
const shapes: Record<CloudVariant, CloudShape> = {
  announcement: { top: [.66, 1.3, .82, 1.03], bottom: [.72, 1.2, .81, .95], side: .94, topDepth: 43, bottomDepth: 39, topColor: '#fffef7', bottomColor: '#f4f0df', tint: '#fff4bf', back: '#d6dcb9', accent: '#d4a83a', plane: true },
  brief: { top: [.64, 1.28, .76], bottom: [.7, 1.13, .79], side: .72, topDepth: 34, bottomDepth: 32, topColor: '#f9ffe9', bottomColor: '#e6f0cd', tint: '#cfe9a6', back: '#b9cf9b', accent: '#79954b' },
  activity: { top: [.7, 1.31, .86], bottom: [.8, 1.19, .73], side: 1, topDepth: 49, bottomDepth: 43, topColor: '#fffdf1', bottomColor: '#f7eacb', tint: '#ffe4a9', back: '#dfcfa7', accent: '#d2a04c' },
  resource: { top: [1.11, .71, 1.32], bottom: [.72, 1.18, .86, .69], side: .88, topDepth: 46, bottomDepth: 41, topColor: '#f4fcff', bottomColor: '#dceff8', tint: '#b9def3', back: '#adc8da', accent: '#619ec3', plane: true },
  news: { top: [.79, 1.29, .94], bottom: [1.04, .71, 1.2], side: .96, topDepth: 44, bottomDepth: 42, topColor: '#fff8f4', bottomColor: '#f9e6da', tint: '#f5c9b4', back: '#dcb8a4', accent: '#cf8a68' },
  pulse: { top: [.74, 1.37, .83], bottom: [.81, 1.25, .7, 1.05], side: 1.05, topDepth: 50, bottomDepth: 44, topColor: '#fff7fc', bottomColor: '#f1e1ee', tint: '#e5bddc', back: '#ceb2c7', accent: '#b885aa' },
  gallery: { top: [.83, 1.28, .67, 1.07], bottom: [.75, 1.16, .69, 1.22, .84], side: .87, topDepth: 45, bottomDepth: 40, topColor: '#fffdf7', bottomColor: '#eee8d9', tint: '#dcd3b5', back: '#cbc2a8', accent: '#a89a73', plane: true },
};

const number = (value: number) => Math.round(value * 100) / 100;

// Integer hashing gives every variant its own stable, irregular silhouette.
// It never depends on render order, browser size, time or Math.random().
const seeded = (seed: number, index: number) => {
  let value = Math.imul(seed ^ Math.imul(index + 1, 374761393), 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
};
const lobeRhythm = (count: number, seed: number) => {
  const major = Math.floor(count * .42);
  const weights = Array.from({ length: count }, (_, index) => .64 + seeded(seed, index) * .56 + (index === major ? 1.03 : index === count - 1 ? .32 : 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map(weight => weight / total);
  const valleys = Array.from({ length: count + 1 }, (_, index) => index === 0 || index === count ? 0 : (seeded(seed + 97, index) - .5) * 12);
  return { widths, valleys };
};

/** Wide side domes use their own unequal rhythm. Only the 3..29px
 * edge strip changes; their tangents remain vertical at soft side valleys. */
function sideCloudPath(width: number, startY: number, endY: number, edge: number, seed: number, rightSide: boolean, tall: boolean) {
  const count = tall ? 3 : 2;
  const weights = rightSide ? (tall ? [.26, .44, .3] : [.43, .57]) : (tall ? [.37, .24, .39] : [.59, .41]);
  const totalHeight = Math.abs(endY - startY);
  const direction = endY > startY ? 1 : -1;
  const valleyInset = Math.min(29, Math.max(edge, width * .055));
  const xAt = (inset: number) => rightSide ? width - inset : inset;
  let y = startY;
  let x = xAt(edge);
  let path = '';
  for (let index = 0; index < count; index += 1) {
    const segment = totalHeight * weights[index];
    const nextY = index === count - 1 ? endY : y + direction * segment;
    const peakY = y + direction * segment * (.43 + seeded(seed, index) * .12);
    const outer = xAt(index === (rightSide ? 0 : count - 1) ? 3 : 6 + seeded(seed + 43, index) * 5);
    const endX = xAt(index === count - 1 ? edge : valleyInset - seeded(seed + 71, index) * 2);
    const join = Math.min(8, segment * .08);
    path += ` C ${number(x)} ${number(y + direction * join)}, ${number(outer)} ${number(peakY - direction * segment * .24)}, ${number(outer)} ${number(peakY)}`;
    path += ` C ${number(outer)} ${number(peakY + direction * segment * .24)}, ${number(endX)} ${number(nextY - direction * join)}, ${number(endX)} ${number(nextY)}`;
    x = endX; y = nextY;
  }
  return path;
}

/** The card's usable rectangle is always inside x=28..w-28,
 * y=60..h-52. Every scallop stays outside that rectangle. */
function cloudGeometry(width: number, height: number, shape: CloudShape) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const edge = Math.min(24, w * .045, h * .13);
  const topDepth = Math.min(shape.topDepth, 55, w * .105, h * .16);
  const bottomDepth = Math.min(shape.bottomDepth, 47, w * .095, h * .15);
  const topY = Math.min(56, topDepth + 9);
  const bottomY = h - Math.min(49, bottomDepth + 7);
  const left = edge;
  const right = w - edge;
  const topStart = left + Math.min(19, w * .035);
  const topEnd = right - Math.min(19, w * .035);
  const seed = shape.topDepth * 67 + shape.bottomDepth * 31;
  const topRhythm = lobeRhythm(shape.top.length, seed);
  const bottomRhythm = lobeRhythm(shape.bottom.length, seed + 211);
  let path = `M ${number(left)} ${number(topY + 18)}`;
  path += ` C ${number(left)} ${number(topY + 3)}, ${number(topStart - 8)} ${number(topY)}, ${number(topStart)} ${number(topY)}`;
  let topX = topStart;
  shape.top.forEach((lobe, index) => {
    const x = topX;
    const segment = (topEnd - topStart) * topRhythm.widths[index];
    const startY = topY + topRhythm.valleys[index];
    const endY = topY + topRhythm.valleys[index + 1];
    // A short explicit rounded valley joins the broad domes. Each lobe
    // stops before the shared low point instead of ending in a pointed V.
    const join = Math.min(8, Math.max(4, segment * .05));
    const last = index === shape.top.length - 1;
    const peak = Math.max(6, Math.min(startY, endY) - topDepth * lobe);
    const peakX = x + segment * (.43 + seeded(seed + 19, index) * .12);
    const endX = x + segment - (last ? 0 : join);
    const endHeight = endY - (last ? 0 : 4);
    path += ` C ${number(x + segment * .12)} ${number(startY - 17)}, ${number(peakX - segment * .23)} ${number(peak)}, ${number(peakX)} ${number(peak)}`;
    path += ` C ${number(peakX + segment * .23)} ${number(peak)}, ${number(endX - segment * .12)} ${number(endHeight - 16)}, ${number(endX)} ${number(endHeight)}`;
    if (!last) path += ` Q ${number(x + segment)} ${number(endY + 4)}, ${number(x + segment + join)} ${number(endY - 4)}`;
    topX += segment;
  });
  path += ` C ${number(right - 8)} ${number(topY)}, ${number(right)} ${number(topY + 4)}, ${number(right)} ${number(topY + 18)}`;
  path += sideCloudPath(w, topY + 18, bottomY - 5, edge, seed + 313, true, h > 700);
  path += ` C ${number(right)} ${number(bottomY + 6)}, ${number(topEnd + 8)} ${number(bottomY)}, ${number(topEnd)} ${number(bottomY)}`;
  let bottomX = topEnd;
  shape.bottom.forEach((lobe, index) => {
    const x = bottomX;
    const segment = (topEnd - topStart) * bottomRhythm.widths[index];
    const startY = bottomY + bottomRhythm.valleys[index];
    const endY = bottomY + bottomRhythm.valleys[index + 1];
    const join = Math.min(8, Math.max(4, segment * .05));
    const last = index === shape.bottom.length - 1;
    const trough = Math.min(h - 7, Math.max(startY, endY) + bottomDepth * lobe);
    const peakX = x - segment * (.44 + seeded(seed + 239, index) * .12);
    const endX = x - segment + (last ? 0 : join);
    const endHeight = endY + (last ? 0 : 4);
    path += ` C ${number(x - segment * .12)} ${number(startY + 17)}, ${number(peakX + segment * .23)} ${number(trough)}, ${number(peakX)} ${number(trough)}`;
    path += ` C ${number(peakX - segment * .23)} ${number(trough)}, ${number(endX + segment * .12)} ${number(endHeight + 16)}, ${number(endX)} ${number(endHeight)}`;
    if (!last) path += ` Q ${number(x - segment)} ${number(endY - 4)}, ${number(x - segment - join)} ${number(endY + 4)}`;
    bottomX -= segment;
  });
  path += ` C ${number(left + 8)} ${number(bottomY)}, ${number(left)} ${number(bottomY - 3)}, ${number(left)} ${number(bottomY - 18)}`;
  path += sideCloudPath(w, bottomY - 18, topY + 18, edge, seed + 617, false, h > 700);
  path += ' Z';
  return { path, topY, bottomY, left, right, topInset: topY + 6, bottomInset: h - bottomY + 6 };
}

export default function MMCloudSurface({ variant, wide = false }: { variant: CloudVariant; wide?: boolean }) {
  const root = useRef<HTMLSpanElement>(null);
  const id = `mm-cloud-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [size, setSize] = useState<Size>(() => wide ? { width: 1000, height: 300 } : { width: 550, height: 400 });
  const shape = shapes[variant];

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = host.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
      setSize(current => current.width === next.width && current.height === next.height ? current : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    observer?.observe(host);
    if (!observer) window.addEventListener('resize', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', schedule);
    };
  }, []);

  const { width, height } = size;
  const { path, topY, bottomY, left, right } = cloudGeometry(width, height, shape);
  const starX = Math.max(30, width - 58);
  const starY = Math.max(15, Math.min(35, topY - 12));
  const planeX = Math.max(25, Math.min(width - 60, width * .16));
  const planeY = Math.max(height - 39, bottomY + 10);

  return <span ref={root} className={`mm-cloud-surface mm-cloud-surface--${variant}${wide ? ' mm-cloud-surface--wide' : ''}`} aria-hidden="true"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none', userSelect: 'none' }}>
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none" fill="none" focusable="false" aria-hidden="true" style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
      <defs>
        <linearGradient id={`${id}-main`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`var(--cloud-top, ${shape.topColor})`}/>
          <stop offset="1" stopColor={`var(--cloud-bottom, ${shape.bottomColor})`}/>
        </linearGradient>
        <linearGradient id={`${id}-back`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`var(--cloud-back, ${shape.back})`} stopOpacity=".48"/>
          <stop offset="1" stopColor={`var(--cloud-back, ${shape.back})`} stopOpacity=".9"/>
        </linearGradient>
        <linearGradient id={`${id}-volume`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity=".66"/>
          <stop offset=".22" stopColor="white" stopOpacity="0"/>
          <stop offset=".75" stopColor={`var(--cloud-tint, ${shape.tint})`} stopOpacity="0"/>
          <stop offset="1" stopColor={`var(--cloud-tint, ${shape.tint})`} stopOpacity=".62"/>
        </linearGradient>
        <linearGradient id={`${id}-foreground`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0"/>
          <stop offset=".5" stopColor="white" stopOpacity=".7"/>
          <stop offset="1" stopColor="white" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id={`${id}-small-cloud`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`var(--cloud-top, ${shape.topColor})`}/>
          <stop offset=".48" stopColor={`var(--cloud-top, ${shape.topColor})`}/>
          <stop offset="1" stopColor={`var(--cloud-tint, ${shape.tint})`}/>
        </linearGradient>
        <radialGradient id={`${id}-soft-light`} cx=".34" cy=".19" r=".83" fx=".3" fy=".14">
          <stop offset="0" stopColor={`var(--cloud-top, ${shape.topColor})`} stopOpacity=".95"/>
          <stop offset=".38" stopColor={`var(--cloud-top, ${shape.topColor})`} stopOpacity=".5"/>
          <stop offset="1" stopColor={`var(--cloud-top, ${shape.topColor})`} stopOpacity="0"/>
        </radialGradient>
        <filter id={`${id}-inner-shadow`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="soft-alpha"/>
          <feOffset in="soft-alpha" dx="0" dy="-9" result="raised-alpha"/>
          <feComposite in="SourceAlpha" in2="raised-alpha" operator="out" result="bottom-curve"/>
          <feFlood floodColor={`var(--cloud-back, ${shape.back})`} floodOpacity=".43" result="curve-tint"/>
          <feComposite in="curve-tint" in2="bottom-curve" operator="in"/>
        </filter>
        <filter id={`${id}-shadow`} x="-4%" y="-4%" width="108%" height="112%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="3"/>
        </filter>
      </defs>
      <path className="mm-cloud-shadow" d={path} transform="translate(0 9)" fill="var(--cloud-shadow, #383d2727)" filter={`url(#${id}-shadow)`}/>
      <path className="mm-cloud-back" d={path} transform="translate(2 11)" fill={`url(#${id}-back)`}/>
      <path className="mm-cloud-main" d={path} fill={`url(#${id}-main)`}/>
      <g className="mm-cloud-volume">
        <path d={path} fill={`url(#${id}-volume)`}/>
        <path d={path} fill={`url(#${id}-soft-light)`}/>
        <path className="mm-cloud-inner-shadow" d={path} fill="white" filter={`url(#${id}-inner-shadow)`}/>
      </g>
      <g className="mm-cloud-foreground" strokeLinecap="round" pointerEvents="none">
        <path d={`M ${number(right - 117)} ${number(bottomY + 16)} Q ${number(right - 85)} ${number(bottomY + 30)} ${number(right - 56)} ${number(bottomY + 11)}`} stroke={`var(--cloud-tint, ${shape.tint})`} strokeOpacity=".48" strokeWidth="3"/>
        <g className="mm-cloud-foreground-puff" transform={`translate(${number(Math.max(12, width * .71 - 35))} ${number(height - 42)})`}>
          <path d="M6 28C-3 25-2 14 7 12 6 3 18-1 24 6 32-4 48 0 49 11 59 5 71 14 67 24 78 32 63 38 54 33 44 40 30 37 26 32 18 37 7 35 6 28Z" transform="translate(1 3)" fill={`var(--cloud-back, ${shape.back})`} opacity=".32"/>
          <path d="M6 28C-3 25-2 14 7 12 6 3 18-1 24 6 32-4 48 0 49 11 59 5 71 14 67 24 78 32 63 38 54 33 44 40 30 37 26 32 18 37 7 35 6 28Z" fill={`url(#${id}-small-cloud)`}/>
          <path d="M13 12Q15 5 22 9M32 8Q39 3 44 11" stroke="var(--cloud-top, white)" strokeWidth="2" opacity=".74"/>
        </g>
        {wide && <g className="mm-cloud-foreground-puff mm-cloud-foreground-puff--small" transform={`translate(${number(Math.max(10, width * .31 - 25))} ${number(height - 34)}) scale(.76)`}>
          <path d="M7 24C-1 23 0 12 8 12 6 2 20-2 25 7 33-3 48 0 48 11 58 6 67 14 64 23 72 31 59 37 51 31 42 38 28 35 24 30 16 35 5 32 7 24Z" transform="translate(1 3)" fill={`var(--cloud-back, ${shape.back})`} opacity=".32"/>
          <path d="M7 24C-1 23 0 12 8 12 6 2 20-2 25 7 33-3 48 0 48 11 58 6 67 14 64 23 72 31 59 37 51 31 42 38 28 35 24 30 16 35 5 32 7 24Z" fill={`url(#${id}-small-cloud)`}/>
          <path d="M14 11Q17 5 23 10M33 8Q40 3 44 10" stroke="var(--cloud-top, white)" strokeWidth="2" opacity=".72"/>
        </g>}
      </g>
      <g className="mm-cloud-edge-details" fill={`var(--cloud-tint, ${shape.accent})`} pointerEvents="none">
        <path className="mm-cloud-star" transform={`translate(${number(starX)} ${number(starY)}) rotate(${variant === 'pulse' ? -12 : 12})`} d="M0-7 2.2-2.2 7 0 2.2 2.2 0 7-2.2 2.2-7 0-2.2-2.2Z" opacity=".78"/>
        <circle cx={number(starX + 16)} cy={number(starY + 12)} r="2.2" opacity=".53"/>
        {shape.plane && <g className="mm-cloud-paper-plane" transform={`translate(${number(planeX)} ${number(planeY)}) rotate(-12)`}>
          <path d="m-16 2 31-10-10 21-7-8-14-3Z" fill="var(--cloud-top, #fffdf4)" stroke={`var(--cloud-back, ${shape.back})`} strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M-2 5 15-8 3 9" stroke={`var(--cloud-back, ${shape.back})`} strokeWidth="1.1" strokeLinejoin="round"/>
          <path d="M-22 7q-9 6-15 0" stroke={`var(--cloud-tint, ${shape.accent})`} strokeOpacity=".55" strokeWidth="1.4" strokeDasharray="2 3"/>
        </g>}
      </g>
    </svg>
  </span>;
}
