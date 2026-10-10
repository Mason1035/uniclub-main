import { useEffect, useState } from 'react';
import './AnimatedTerminalText.css';
import { PRELOADER_DONE } from '../lib/preloader';

type Phase = 'TYPING' | 'HOLDING' | 'DELETING' | 'SHORT_PAUSE' | 'NEXT_WORD' | 'STATIC';
type Frame = { wordIndex: number; characterCount: number; phase: Phase };
type Props = { phrases: readonly [string, ...string[]] };

const timing = {
  typing: [45, 70],
  deleting: [25, 45],
  holding: [1400, 1900],
  emptyPause: [150, 300],
} as const;

const delay = ([min, max]: readonly [number, number]) =>
  Math.round(min + Math.random() * (max - min));

export default function AnimatedTerminalText({ phrases }: Props) {
  const [frame, setFrame] = useState<Frame>(() => ({
    wordIndex: 0, characterCount: Array.from(phrases[0]).length, phase: 'HOLDING',
  }));

  useEffect(() => {
    const words = phrases.map(phrase => Array.from(phrase));
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    let current: Frame;

    // One pending timeout at a time. All mutable animation state belongs to
    // this effect, so StrictMode replay and route unmount cannot duplicate it.
    const schedule = (milliseconds: number) => { timer = setTimeout(tick, milliseconds); };
    const tick = () => {
      if (!active || motion.matches) return;
      const length = words[current.wordIndex].length;
      switch (current.phase) {
        case 'HOLDING':
          current = { ...current, phase: 'DELETING' };
          schedule(delay(timing.deleting));
          break;
        case 'DELETING': {
          const characterCount = Math.max(0, current.characterCount - 1);
          current = { ...current, characterCount, phase: characterCount ? 'DELETING' : 'SHORT_PAUSE' };
          schedule(delay(characterCount ? timing.deleting : timing.emptyPause));
          break;
        }
        case 'SHORT_PAUSE':
          current = { ...current, phase: 'NEXT_WORD' };
          schedule(0);
          break;
        case 'NEXT_WORD':
          current = { wordIndex: (current.wordIndex + 1) % words.length, characterCount: 0, phase: 'TYPING' };
          schedule(delay(timing.typing));
          break;
        case 'TYPING': {
          const characterCount = Math.min(length, current.characterCount + 1);
          current = { ...current, characterCount, phase: characterCount === length ? 'HOLDING' : 'TYPING' };
          schedule(delay(current.phase === 'HOLDING' ? timing.holding : timing.typing));
          break;
        }
        case 'STATIC': return;
      }
      setFrame(current);
    };

    const restart = () => {
      clearTimeout(timer);
      current = { wordIndex: 0, characterCount: words[0].length, phase: motion.matches ? 'STATIC' : 'HOLDING' };
      setFrame(current);
      // Preserve the readable first phrase until the entry layer has uncovered it.
      if (!motion.matches && (!window.__classhubPreloader || window.__classhubPreloader.state === 'done')) schedule(delay(timing.holding));
    };
    restart();
    motion.addEventListener('change', restart);
    window.addEventListener(PRELOADER_DONE, restart);
    return () => {
      active = false;
      clearTimeout(timer);
      motion.removeEventListener('change', restart);
      window.removeEventListener(PRELOADER_DONE, restart);
    };
  }, [phrases]);

  const text = Array.from(phrases[frame.wordIndex] ?? phrases[0]).slice(0, frame.characterCount).join('');
  return <>
    {/* A stable heading for assistive technology; no live character updates. */}
    <span className="sr-only">{phrases[0]}</span>
    <span className="terminal-text" aria-hidden="true" data-phase={frame.phase}>
      {/* Overlapping, invisible copies reserve the widest phrase with its cursor
          using the actual font, including before web fonts finish loading. */}
      {phrases.map((phrase, index) => <span className="terminal-text__measure" key={index}>
        {phrase}<span className="terminal-text__cursor" />
      </span>)}
      <span className="terminal-text__visual">
        {text}<span className="terminal-text__cursor" />
      </span>
    </span>
  </>;
}
