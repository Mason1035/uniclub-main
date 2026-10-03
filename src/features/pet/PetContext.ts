import { createContext, useContext } from 'react';
import type { ClassHubPetConfigStore } from './pet-config';
import type { PetAPI, PetHandle } from './types';

export interface PetContextValue {
  store: ClassHubPetConfigStore | null;
  pet: PetAPI;
  register: (handle: PetHandle | null) => void;
}
export const PetContext = createContext<PetContextValue | null>(null);
export const usePet = (): PetContextValue => {
  const context = useContext(PetContext);
  if (!context) throw new Error('usePet requires PetProvider');
  return context;
};
