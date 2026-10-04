import { forwardRef, type HTMLAttributes } from 'react';

/** Width and gutters belong to Layout; pages choose their content rhythm. */
const PageShell = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`page-shell ${className}`} {...props}/>
));
PageShell.displayName = 'PageShell';
export default PageShell;
