import type { HTMLAttributes } from 'react';

export default function ContentCard({ as: Tag = 'section', className = '', ...props }: HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'section' | 'div';
}) {
  return <Tag className={`content-card ${className}`} {...props}/>;
}
