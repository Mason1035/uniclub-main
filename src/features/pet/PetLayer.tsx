import { Component, lazy, Suspense, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { usePet } from './PetContext';
import type { ClassHubPetConfigStore } from './pet-config';
import './pet.css';

const ClassHubPet = lazy(() => import('./ClassHubPet'));

class PetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.warn('[ClassHub pet] Optional layer unavailable:', error.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

function EnabledPet({ store }: { store: ClassHubPetConfigStore }) {
  const { config, available } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { pathname } = useLocation();
  if (!available || !config.petEnabled || pathname === '/auth' || pathname === '/admin' || pathname.startsWith('/admin/')) return null;
  return <PetBoundary key={config.petEnabled ? 'enabled' : 'disabled'}><Suspense fallback={null}><ClassHubPet store={store}/></Suspense></PetBoundary>;
}

export default function PetLayer() {
  const { store } = usePet();
  return store ? <EnabledPet key={store.userId} store={store}/> : null;
}
