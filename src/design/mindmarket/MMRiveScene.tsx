import { useEffect, useRef, type CSSProperties } from 'react';
import { mountRivePlayer, type RivePlayerController } from './rive-player';

export { loadRiveRuntime } from './rive-player';

/** React owns the box; the shared host owns lazy loading and every listener. */
export function MMRiveScene({ src, className = '', autoplay = true, reveal = false, style, label, poster }: {
  src: string; className?: string; autoplay?: boolean; reveal?: boolean;
  style?: CSSProperties; label?: string; poster?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<RivePlayerController | null>(null);
  const active = useRef(autoplay);
  active.current = autoplay;

  useEffect(() => {
    if (!host.current || !canvas.current) return;
    const player = mountRivePlayer({
      host: host.current, canvas: canvas.current, src,
      active: active.current, reveal, poster,
    });
    controller.current = player;
    return () => {
      player.dispose();
      if (controller.current === player) controller.current = null;
    };
  }, [src, reveal, poster]);

  // A dropdown changing active state never tears down/reloads its first player.
  useEffect(() => controller.current?.setActive(autoplay), [autoplay]);

  return <div ref={host} className={`mm-rive-scene ${className}`} style={style}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }}/>
  </div>;
}
export default MMRiveScene;
