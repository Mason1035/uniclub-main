import { useMindMarketDesign } from '../design/mindmarket/DesignContext';
import announcement from '../assets/home/announcement.svg';
import activity from '../assets/home/activity.svg';
import resource from '../assets/home/resource.svg';
import news from '../assets/home/news.svg';
import pulse from '../assets/home/pulse.svg';
import gallery from '../assets/home/gallery.svg';
import fees from '../assets/home/fees.svg';
import randomCall from '../assets/home/random-call.svg';

const illustrations = { announcement, activity, resource, news, pulse, gallery, fees, randomCall };
export type IllustrationKind = keyof typeof illustrations;
const mindmarketIllustrations: Record<IllustrationKind,string> = { announcement:'clock.svg', activity:'soccer-shape-2.svg', resource:'folder.svg', news:'sheet.svg', pulse:'joystick.svg', gallery:'plane-2.svg', fees:'folder.svg', randomCall:'soccer-circle.svg' };

/** One illustration family for the home, lists and empty states. */
export default function Illustration({ kind, size = 'medium', className = '' }: {
  kind: IllustrationKind;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}) {
  const mindmarket = useMindMarketDesign();
  return <img className={`illustration illustration--${size} ${className}`} src={mindmarket ? `/mindmarket/timeline/${mindmarketIllustrations[kind]}` : illustrations[kind]} width={160} height={160} alt="" aria-hidden="true" draggable={false}/>;
}
