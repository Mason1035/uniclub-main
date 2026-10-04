import type { ReactNode } from 'react';
export default function PageHeading({ title, description, actions, tone = 'ui' }: { title: string; description?: string; actions?: ReactNode; tone?: 'ui' | 'editorial' | 'signature' }) {
  return <header className={`page-heading page-heading--${tone}`}><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions}</header>;
}
