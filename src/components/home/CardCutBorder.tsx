import { useLayoutEffect, useRef, useState } from 'react';

/** Asymmetric chamfer sizes per card kind: [topLeft, topRight, bottomRight, bottomLeft] px. */
const CUT_CONFIG: Record<string, [number, number, number, number]> = {
  announcement: [36, 52, 40, 12],
  activity: [22, 32, 26, 10],
  resource: [26, 38, 30, 8],
  news: [38, 26, 10, 30],
  pulse: [30, 44, 34, 10],
  gallery: [24, 34, 28, 8],
};

type Props = { kind: string };

/**
 * Precision-cut glass border, presentational only.
 * Draws the chamfered outline with a polished highlight edge, facet ticks,
 * local blue-violet refraction segments and a restrained traveling glint.
 * Hidden unless the parent card is hovered (see `.home-card__cut` styles).
 * The measured pixel geometry keeps stroke widths uniform via vector-effect.
 */
export default function CardCutBorder({ kind }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const measure = () => setSize({ w: host.offsetWidth, h: host.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const [tl, tr, br, bl] = CUT_CONFIG[kind] ?? CUT_CONFIG.resource;

  if (!size) {
    return <svg ref={ref} className="home-card__cut" aria-hidden="true" viewBox="0 0 1 1" />;
  }
  const { w, h } = size;
  const outline = `${tl},0 ${w - tr},0 ${w},${tr} ${w},${h - br} ${w - br},${h} ${bl},${h} 0,${h - bl} 0,${tl}`;

  return (
    <svg ref={ref} className="home-card__cut" aria-hidden="true" viewBox={`0 0 ${w} ${h}`}>
      <polygon points={outline} className="home-card__cut-under" />
      <polygon points={outline} className="home-card__cut-polish" />
      <line x1={w - tr} y1={2} x2={w - tr - 14} y2={13} className="home-card__cut-tick" />
      <line x1={w - 2} y1={h - br} x2={w - 13} y2={h - br + 10} className="home-card__cut-tick home-card__cut-tick--dim" />
      <line x1={w * 0.58} y1={1} x2={w * 0.58 + 64} y2={1} className="home-card__cut-refract" />
      <line x1={w - 1} y1={h * 0.55} x2={w - 1} y2={h * 0.55 + 40} className="home-card__cut-refract home-card__cut-refract--dim" />
      <path
        d={`M ${w - tr - 60} 1 L ${w - tr} 1 L ${w} ${tr} L ${w} ${tr + 70}`}
        className="home-card__cut-glint"
      />
    </svg>
  );
}
