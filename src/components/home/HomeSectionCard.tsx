import type { ReactNode } from 'react';
import { useMindMarketDesign } from '../../design/mindmarket/DesignContext';
import { MMRiveScene } from '../../design/mindmarket/MMRiveScene';
import LiquidGlass from '../LiquidGlass';
import MMCloudSurface from '../../design/mindmarket/MMCloudSurface';
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
export default function HomeSectionCard({ kind, title, titleTone = 'editorial', to, linkLabel, wide, children }: Props) {
  const mindmarket = useMindMarketDesign();
  const scenes: Record<string,string> = {announcement:'research',activity:'basketball_player',resource:'scientist',news:'composer',pulse:'trumpeter_1',gallery:'binoculars'};
  const headingId = `home-${kind}-title`;
  const content = <>
      <div className="home-card__art" aria-hidden="true">
        {mindmarket ? <MMRiveScene src={`/mindmarket/rive/${scenes[kind] || 'behavior'}.riv`} style={{width:'100%',aspectRatio:'1'}}/> : <Illustration kind={kind} size="large"/>}
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
  </>;
  const classes=`home-card home-card--${kind}${wide ? ' home-card--wide' : ''} home-section`;
  return <LiquidGlass as="section" optics={!mindmarket} className={`${classes}${mindmarket ? ' mm-cloud-card' : ''}`} aria-labelledby={headingId}>
    {mindmarket && <MMCloudSurface variant={kind==='fees'||kind==='randomCall'?'brief':kind} wide={wide}/>}
    {content}
  </LiquidGlass>;
}
