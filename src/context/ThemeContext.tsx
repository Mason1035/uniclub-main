import { ThemeContext } from './themeContextState';
import React, { useLayoutEffect } from 'react';

const LIGHT_THEME = { isDarkMode: false } as const;

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useLayoutEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    // Retire the old preference, including previously saved dark selections.
    try { localStorage.removeItem('theme'); } catch { /* Light mode does not require storage. */ }
  }, []);

  return (
    <ThemeContext.Provider value={LIGHT_THEME}>
      {children}
    </ThemeContext.Provider>
  );
};
