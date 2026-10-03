import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ClassHubPetConfigStore } from '../pet-config';
import { PET_SKINS } from '../pet-skins';

interface Props {
  store: ClassHubPetConfigStore;
  point: { x: number; y: number };
  onClose: () => void;
  onPerform: () => void;
  onSettings: () => void;
}

export default function PetContextMenu({ store, point, onClose, onPerform, onSettings }: Props) {
  const { config } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const menu = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const [skinsOpen, setSkinsOpen] = useState(false);
  const [position, setPosition] = useState({ left: point.x, top: point.y });
  useLayoutEffect(() => {
    const update = () => {
      const node = menu.current; if (!node) return;
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth; const height = viewport?.height ?? window.innerHeight;
      const left = viewport?.offsetLeft ?? 0; const top = viewport?.offsetTop ?? 0;
      setPosition({
        left: Math.max(left + 8, Math.min(point.x - node.offsetWidth / 2, left + width - node.offsetWidth - 8)),
        top: Math.max(top + 8, Math.min(point.y - node.offsetHeight - 12, top + height - node.offsetHeight - 8)),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [point, skinsOpen]);
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) close.current(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close.current(); } };
    document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape); };
  }, []);

  return <div ref={menu} role="menu" aria-label="桌宠菜单" className="pet-menu" style={position}
    onKeyDown={event => {
      if (event.key === 'Tab') { close.current(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = [...menu.current.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]')];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[index]?.focus();
    }}>
    <button type="button" role="menuitemcheckbox" aria-checked={config.petMuted} onClick={() => store.update({ petMuted: !config.petMuted })}>🔇 静音 <span>{config.petMuted ? '开启' : '关闭'}</span></button>
    <button type="button" role="menuitemcheckbox" aria-checked={config.petTalkative} onClick={() => store.update({ petTalkative: !config.petTalkative })}>💬 气泡 <span>{config.petTalkative ? '开启' : '关闭'}</span></button>
    <button type="button" role="menuitem" aria-expanded={skinsOpen} onClick={() => setSkinsOpen(!skinsOpen)}>🎭 更换角色 <span>⌄</span></button>
    {skinsOpen && PET_SKINS.map(skin => <button type="button" key={skin.id} role="menuitemradio" aria-checked={config.petSkin === skin.id}
      onClick={() => { store.update({ petSkin: skin.id }); close.current(); }}>{skin.name}<span>{config.petSkin === skin.id ? '✓' : ''}</span></button>)}
    <button type="button" role="menuitem" onClick={() => { onPerform(); close.current(); }}>✨ 表演一下</button>
    <button type="button" role="menuitem" onClick={onSettings}>⚙ 桌宠设置</button>
  </div>;
}
