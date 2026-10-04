import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Illustration, { type IllustrationKind } from '../Illustration';

type Props = {
  kind: IllustrationKind;
  title: string;
  titleTone?: 'ui' | 'editorial' | 'signature';
  to: string;
  linkLabel: string;
  wide?: boolean;
  children: ReactNode;
};

/** Presentation only: the existing queries and content cards own all behavior. */
export default function HomeSectionCard({ kind, title, titleTone = 'ui', to, linkLabel, wide, children }: Props) {
  const headingId = `home-${kind}-title`;
  return (
    <section className={`home-card home-card--${kind}${wide ? ' home-card--wide' : ''} home-section`} aria-labelledby={headingId}>
      <div className="home-card__art" aria-hidden="true">
        <Illustration kind={kind} size="large"/>
      </div>
      <div className="home-card__content">
        <div className="home-card__heading section-heading">
          <h2 id={headingId} className={`${titleTone}-heading`}>{title}</h2>
          <Link className="home-card__link text-link" to={to}>
            {linkLabel}<span aria-hidden="true"> →</span>
          </Link>
        </div>
        <div className="home-card__body">{children}</div>
      </div>
    </section>
  );
}
