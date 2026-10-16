import { gsap, useGSAP } from '@/lib/gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { ScrollSmoother } from 'gsap/dist/ScrollSmoother';

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollSmoother);
export { gsap, useGSAP, ScrollTrigger, ScrollSmoother };

// About 动效参数；DOM 变换复现完整的右→左弧线，插件仅由本路由加载。
export const MOTION = {
  smoothSeconds: 1.15,     // 桌面平滑滚动追随时间。
  scrollScreens: 3.8,     // 完整飞行占用 3.8 屏纵向滚动。
  scrubSeconds: 0.45,     // 舞台进度的追随时间。
  edgeMargin: 140,        // 两侧屏外余量，保证带阴影的卡片完全离场。
  arcPeak: 0.36,          // 弧线最高处的卡片顶部 / 舞台高度。
  arcEdge: 0.78,          // 两侧入场、离场的卡片顶部 / 舞台高度。
  cardStagger: 0.15,      // 三张卡片在归一化时间线上错开。
  flightDuration: 0.8,    // 归一化时长，不是秒数；由滚动控制。
  tiltDegrees: 3,         // 仅绕 Z 轴轻微倾斜，不使用会压窄卡片的透视旋转。
  minimumScale: 0.98,     // 屏幕边缘的等比缩放；弧线中间恢复原尺寸。
  floatPixels: 5,
  floatSeconds: 4,
  cardWidth: 340,
  gap: 34,
};

/** 抛物线顶点在中间，边缘低；p=0/1 时整张卡片处在屏幕外。 */
export function flightPoint(p: number, width: number, height: number, options = MOTION) {
  const start = width + options.edgeMargin;
  const end = -options.cardWidth - options.edgeMargin;
  const edge = height * options.arcEdge;
  return { x: start + (end - start) * p,
    y: edge - 4 * p * (1 - p) * (edge - height * options.arcPeak) };
}
