import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePopup } from '../../context/popupContextState';
import { usePet } from './PetContext';
import type { ClassHubPetConfigStore } from './pet-config';
import { mountClassHubPet } from './pet-engine';
import PetContextMenu from './components/PetContextMenu';
import type { PetHandle } from './types';

export default function ClassHubPet({ store }: { store: ClassHubPetConfigStore }) {
  const container = useRef<HTMLDivElement>(null);
  const handle = useRef<PetHandle | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const { register } = usePet();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { closeUserProfile } = usePopup();

  useEffect(() => {
    if (!container.current) return;
    try {
      const engine = mountClassHubPet({ container: container.current, store, onMenu: setMenu, onFailure: () => setFailed(true) });
      handle.current = engine; register(engine);
      return () => { engine.destroy(); handle.current = null; register(null); };
    } catch (error) {
      console.warn('[ClassHub pet] Could not initialize:', error);
      setFailed(true);
    }
  }, [store, register]);

  useEffect(() => { setMenu(null); handle.current?.refreshViewport(); }, [pathname]);
  useEffect(() => {
    if (failed) { handle.current?.destroy(); handle.current = null; register(null); }
  }, [failed, register]);

  return createPortal(<div className="classhub-pet-layer" data-testid="pet-layer" style={failed ? { display: 'none' } : undefined}>
    <div ref={container}/>
    {menu && <PetContextMenu store={store} point={menu} onClose={() => { setMenu(null); handle.current?.focus(); }}
      onPerform={() => handle.current?.perform()} onSettings={() => { closeUserProfile(); setMenu(null); navigate('/settings#pet-settings'); }}/>}
  </div>, document.body);
}
