/** Single-pet gravity/inertia extracted from dsh-niulai-pet/pet.ts startFall.
 * Copyright (c) 2026 whitefirer. MIT License; see public/pet-assets/LICENSE.
 * The original physics.ts is a multi-body collision world, excluded in v1.
 */
export interface FallState { x: number; liftY: number; vx: number; vy: number }
export interface PointerSample { x: number; t: number }
export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(Math.max(min, max), value));

export function releaseVelocity(samples: PointerSample[], now: number): number {
  if (samples.length < 2 || now - samples[samples.length - 1].t > 100) return 0;
  const dt = samples[samples.length - 1].t - samples[0].t;
  return dt > 0 ? clamp((samples[samples.length - 1].x - samples[0].x) / dt, -1.2, 1.2) : 0;
}

export function stepFall(state: FallState, elapsed: number, minX: number, maxX: number): FallState {
  const dt = clamp(elapsed, 0, 50);
  const vy = state.vy + 0.0035 * dt;
  const targetX = state.x + state.vx * dt;
  let vx = state.vx * Math.pow(0.997, dt);
  if (targetX < minX || targetX > maxX) vx *= -0.35;
  if (Math.abs(vx) < 0.02) vx = 0;
  return { x: clamp(targetX, minX, maxX), liftY: Math.min(0, state.liftY + vy * dt), vx, vy };
}
