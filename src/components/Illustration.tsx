import announcement from '../assets/home/announcement.svg';
import activity from '../assets/home/activity.svg';
import resource from '../assets/home/resource.svg';
import news from '../assets/home/news.svg';
import pulse from '../assets/home/pulse.svg';
import gallery from '../assets/home/gallery.svg';
import fees from '../assets/home/fees.svg';

const illustrations = { announcement, activity, resource, news, pulse, gallery, fees };
export type IllustrationKind = keyof typeof illustrations;

/** One illustration family for the home, lists and empty states. */
export default function Illustration({ kind, size = 'medium', className = '' }: {
  kind: IllustrationKind;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}) {
  return <img className={`illustration illustration--${size} ${className}`} src={illustrations[kind]} width={160} height={160} alt="" aria-hidden="true" draggable={false}/>;
}
