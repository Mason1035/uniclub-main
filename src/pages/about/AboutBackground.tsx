import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import AmbientBackground from './AmbientBackground';
import { useTheme } from '../../context/themeContextState';

/** 固定背景放在共享 Shell 的宿主中，避免被平滑滚动的 transform 带走。 */
export default function AboutBackground() {
  const { isDarkMode } = useTheme();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(isDarkMode ? null : document.getElementById('about-background-host')); }, [isDarkMode]);
  // SSR 和首次 hydration 都不访问浏览器；静态底色仍由路由 CSS 提供。
  return !isDarkMode && host ? createPortal(<AmbientBackground/>, host) : null;
}
