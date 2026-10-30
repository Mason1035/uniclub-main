import { createContext, forwardRef, useContext, useId, useRef, type HTMLAttributes } from 'react';
import GlassDecoration from './GlassDecoration';
import { useHomeGlass } from '../hooks/useHomeGlass';
import { useTheme } from '../context/themeContextState';

const GlassParent = createContext(false);
type Props = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article';
  density?: 'clear' | 'reading' | 'workspace';
  optics?: boolean;
  refraction?: boolean;
};

/** All visible dark surfaces share the home optics; nesting never stacks filters. */
const LiquidGlass = forwardRef<HTMLDivElement, Props>(function LiquidGlass({
  as: Tag = 'div', density = 'clear', optics = true, refraction, className = '', children, ...props
}, ref) {
  const { isDarkMode } = useTheme();
  const nested = useContext(GlassParent);
  const refracts = refraction ?? isDarkMode;
  const scope = useRef<HTMLDivElement | null>(null);
  const lensId = `home-glass-${useId().replace(/:/g, '')}`;
  useHomeGlass(scope, { enabled: !nested && optics, refraction: refracts });
  return <GlassParent.Provider value={true}><Tag {...props} ref={element => {
    scope.current = element;
    if (typeof ref === 'function') ref(element);
    else if (ref) ref.current = element;
  }} className={`${className} ${nested ? 'glass-nested' : `liquid-glass glass-material glass-material--${density}`}`}>
    {!nested && <GlassDecoration lensId={lensId} optics={optics && refracts}/>}
    {children}
  </Tag></GlassParent.Provider>;
});
export default LiquidGlass;
