import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

const DesignContext = createContext(true);

/** An explicit, non-persistent fallback keeps the original UI available. */
export function DesignProvider({ children }: { children: ReactNode }) {
  const [enabled] = useState(() => {
    const legacy = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('design') === 'legacy';
    return !legacy && import.meta.env.VITE_CLASSHUB_DESIGN !== 'legacy';
  });
  useLayoutEffect(() => {
    document.documentElement.dataset.classhubDesign = enabled ? 'mindmarket' : 'legacy';
  }, [enabled]);
  return <DesignContext.Provider value={enabled}>{children}</DesignContext.Provider>;
}

export const useMindMarketDesign = () => useContext(DesignContext);
