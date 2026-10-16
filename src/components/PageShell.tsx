import { forwardRef, type HTMLAttributes } from 'react';
import LiquidGlass from './LiquidGlass';

/** Width and gutters belong to Layout; pages choose their content rhythm. */
const PageShell = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
  className.split(/\s+/).includes('reading-page')
    ? <LiquidGlass ref={ref} density="reading" className={`page-shell ${className}`} {...props}/>
    : <div ref={ref} className={`page-shell ${className}`} {...props}/>
));
PageShell.displayName = 'PageShell';
export default PageShell;
