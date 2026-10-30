import type { TimelinePoint } from './types';
const TAU = Math.PI * 2;
export function percent(count: number, total: number): string {
  return `${total ? (count / total * 100).toLocaleString('zh-CN', { maximumFractionDigits: 1 }) : '0'}%`;
}
export function sectors<T extends { count: number }>(rows: T[]) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  let cursor = -Math.PI / 2;
  return rows.map(row => { const start = cursor; cursor += total ? row.count / total * TAU : 0; return { ...row, start, end: cursor }; });
}
const point = (angle: number, radius: number) => [130 + Math.cos(angle) * radius, 112 + Math.sin(angle) * radius * .8];
const xy = (point: number[]) => point.map(n => n.toFixed(3)).join(' ');
export function sectorPath(start: number, end: number, inner = 0): string {
  const sweep = end - start, outer = 96;
  if (sweep < .00001) return '';
  const full = sweep >= TAU - .00001;
  const arc = (radius: number, a: number, b: number, reverse = false) => `A ${radius} ${radius * .8} 0 ${Math.abs(b - a) > Math.PI ? 1 : 0} ${reverse ? 0 : 1} ${xy(point(b, radius))}`;
  if (full) {
    const mid = start + Math.PI;
    const outside = `M ${xy(point(start, outer))} ${arc(outer,start,mid)} ${arc(outer,mid,end)}`;
    return inner ? `${outside} L ${xy(point(end,inner))} ${arc(inner,end,mid,true)} ${arc(inner,mid,start,true)} Z` : `${outside} Z`;
  }
  return `M ${xy(point(start, outer))} ${arc(outer,start,end)} ${inner ? `L ${xy(point(end, inner))} ${arc(inner,end,start,true)}` : 'L 130 112'} Z`;
}
export interface TimelineBucket extends TimelinePoint { endDate: string; }
export function timelineBuckets(points: TimelinePoint[]): TimelineBucket[] {
  const size = Math.ceil(points.length / 7) || 1;
  return Array.from({ length: Math.ceil(points.length / size) }, (_, index) => {
    const rows = points.slice(index * size, (index + 1) * size);
    return { date: rows[0].date, endDate: rows.at(-1)!.date,
      news: rows.reduce((sum,row)=>sum+row.news,0), events:rows.reduce((sum,row)=>sum+row.events,0), resources:rows.reduce((sum,row)=>sum+row.resources,0) };
  });
}
export function axisTicks(maximum: number): number[] {
  const max = Math.max(1, maximum);
  if (max <= 5) return Array.from({ length: Math.ceil(max) + 1 }, (_, index) => index);
  const raw = max / 4, unit = 10 ** Math.floor(Math.log10(raw));
  const step = Math.ceil(raw / unit) * unit;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, index) => index * step);
}
