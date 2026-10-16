import { MoonStar, Sun } from 'lucide-react';
import { useTheme } from '../context/themeContextState';

export default function AppearanceToggle({ className = '' }: { className?: string }) {
  const { isDarkMode, toggleDarkMode } = useTheme();
  return <button type="button" className={`icon-control home-appearance-toggle ${className}`}
    role="switch" aria-checked={isDarkMode} aria-label="深色星空"
    title={isDarkMode ? '关闭深色星空，恢复浅色界面' : '打开深色星空'} onClick={toggleDarkMode}>
    {isDarkMode ? <Sun aria-hidden="true"/> : <MoonStar aria-hidden="true"/>}
  </button>;
}
