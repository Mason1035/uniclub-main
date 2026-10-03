/** Synthesized voices adapted from dsh-niulai-pet/pet.ts.
 * Copyright (c) 2026 whitefirer. MIT License; see public/pet-assets/LICENSE.
 * Per-instance ownership replaces the original shared AudioContext/gain nodes.
 */
import type { PetConfig, PetSkin } from './types';

export function createPetAudio() {
  let context: AudioContext | null = null;
  let output: GainNode | null = null;
  let muted = false;
  let volume = 35;
  let sample: HTMLAudioElement | null = null;
  let destroyed = false;
  const nodes = new Set<AudioNode>();
  const sources = new Set<AudioScheduledSourceNode>();
  const trackNode = <T extends AudioNode>(node: T): T => { nodes.add(node); return node; };
  const disconnectNodes = () => { for (const node of nodes) node.disconnect(); nodes.clear(); };
  const trackSource = <T extends AudioScheduledSourceNode>(source: T): T => {
    sources.add(source);
    source.onended = () => {
      source.disconnect(); sources.delete(source);
      if (!sources.size) disconnectNodes();
    };
    return source;
  };
  const audioCtx = (): AudioContext | null => {
    if (destroyed) return null;
    try {
      if (!context) {
        const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return null;
        context = new Constructor();
      }
      if (context.state === 'suspended') void context.resume().catch(() => {});
      return context;
    } catch { return null; }
  };
  function volDest(ctx: AudioContext): AudioNode {
    if (!output) { output = ctx.createGain(); output.connect(ctx.destination); }
    output.gain.value = muted ? 0 : volume / 100;
    return output;
  }
  const releaseSample = () => {
    if (!sample) return;
    sample.pause(); sample.onended = null; sample.onerror = null;
    sample.removeAttribute('src'); sample.load(); sample = null;
  };
  const stop = () => {
    releaseSample();
    for (const source of sources) { source.onended = null; try { source.stop(); } catch { /* already stopped */ } source.disconnect(); }
    sources.clear(); disconnectNodes();
  };
function synthWhale(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  const osc = trackSource(ctx.createOscillator())
  osc.type = 'sine'
  osc.frequency.setValueAtTime(210, t0)
  osc.frequency.exponentialRampToValueAtTime(430, t0 + 0.5)
  osc.frequency.exponentialRampToValueAtTime(120, t0 + 1.5)
  const lfo = trackSource(ctx.createOscillator())
  lfo.frequency.value = 3
  const lfoGain = trackNode(ctx.createGain())
  lfoGain.gain.value = 22
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  const lp = trackNode(ctx.createBiquadFilter())
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const g = trackNode(ctx.createGain())
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6)
  osc.connect(lp); lp.connect(g); g.connect(volDest(ctx))
  osc.start(t0); lfo.start(t0)
  osc.stop(t0 + 1.65); lfo.stop(t0 + 1.65)
}
function synthSqueak(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  for (const off of [0, 0.22]) {
    const osc = trackSource(ctx.createOscillator())
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(950, t0 + off)
    osc.frequency.exponentialRampToValueAtTime(1500, t0 + off + 0.12)
    const g = trackNode(ctx.createGain())
    g.gain.setValueAtTime(0.0001, t0 + off)
    g.gain.exponentialRampToValueAtTime(0.2, t0 + off + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.16)
    osc.connect(g); g.connect(volDest(ctx))
    osc.start(t0 + off); osc.stop(t0 + off + 0.18)
  }
}
function synthThud(ctx: AudioContext, strength: number): void {
  const t0 = ctx.currentTime
  const osc = trackSource(ctx.createOscillator())
  osc.type = 'sine'
  osc.frequency.setValueAtTime(110, t0)
  osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.1)
  const g = trackNode(ctx.createGain())
  const peak = 0.22 * Math.max(0.15, Math.min(1, strength))
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
  osc.connect(g); g.connect(volDest(ctx))
  osc.start(t0); osc.stop(t0 + 0.18)
}
  return {
    warm: () => { audioCtx(); },
    sync(config: PetConfig) {
      muted = config.petMuted; volume = config.petVolume;
      if (output) output.gain.value = muted ? 0 : volume / 100;
      if (sample) sample.volume = muted ? 0 : volume / 100;
      if (muted || volume === 0) stop();
    },
    play(skin: PetSkin): number {
      if (destroyed || muted || volume === 0) return 0;
      stop();
      try {
        if (skin.sounds?.length) {
          const index = Math.floor(Math.random() * skin.sounds.length);
          const current = new Audio(skin.sounds[index]);
          sample = current;
          current.volume = volume / 100;
          const releaseCurrent = () => { if (sample === current) releaseSample(); };
          current.onended = releaseCurrent; current.onerror = releaseCurrent;
          void current.play().catch(releaseCurrent);
          return skin.soundDurationsMs?.[index] ?? 2600;
        }
        const ctx = audioCtx();
        if (!ctx || skin.voice === null) return 0;
        if (skin.voice === 'whale') { synthWhale(ctx); return 1650; }
        synthSqueak(ctx); return 450;
      } catch { stop(); return 0; }
    },
    land(depth: number) {
      if (destroyed || muted || volume === 0 || depth < 30) return;
      try { const ctx = audioCtx(); if (ctx) { stop(); synthThud(ctx, Math.min(1, depth / 500)); } } catch { stop(); }
    },
    stop,
    destroy() {
      destroyed = true; stop(); output?.disconnect(); output = null;
      if (context) void context.close().catch(() => {});
      context = null;
    },
  };
}
