import { ThemeContext } from './themeContextState';
import { useHomeAppearance } from '../hooks/useHomeAppearance';
import { clearGlassMapCache } from '../lib/graphics/homeGlassLens';
import { useEffect, useMemo, type ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { starry, toggle } = useHomeAppearance();
  useEffect(() => {
    try { localStorage.removeItem('theme'); } catch { /* Retire only the legacy preference. */ }
  }, []);
  useEffect(() => {
    if (!starry) clearGlassMapCache();
  }, [starry]);
  const value = useMemo(() => ({ isDarkMode: starry, toggleDarkMode: toggle }), [starry, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
