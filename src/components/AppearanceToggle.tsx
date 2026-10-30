import { MoonStar, Sun } from 'lucide-react';
import { useMindMarketDesign } from '../design/mindmarket/DesignContext';
import { useTheme } from '../context/themeContextState';

export default function AppearanceToggle({ className = '' }: { className?: string }) {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const mindmarket = useMindMarketDesign();
  return <button type="button" className={`icon-control home-appearance-toggle ${className}`}
    role="switch" aria-checked={isDarkMode} aria-label={mindmarket ? '深色模式' : '深色星空'}
    title={mindmarket ? (isDarkMode ? '切换浅色模式' : '切换深色模式') : (isDarkMode ? '关闭深色星空，恢复浅色界面' : '打开深色星空')} onClick={toggleDarkMode}>
    {isDarkMode ? <Sun aria-hidden="true"/> : <MoonStar aria-hidden="true"/>}
  </button>;
}
