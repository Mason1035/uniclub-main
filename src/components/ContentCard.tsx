import type { HTMLAttributes } from 'react';
import LiquidGlass from './LiquidGlass';

export default function ContentCard({ as = 'section', className = '', ...props }: HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'section' | 'div';
}) {
  return <LiquidGlass as={as} className={`content-card ${className}`} {...props}/>;
}
