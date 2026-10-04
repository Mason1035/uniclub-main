import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pin } from 'lucide-react';
import type { Announcement } from '../../lib/announcementMeta';
import { announcementLevel } from '../../lib/announcementMeta';
import { formatDate } from '../../lib/contentFormat';
import Illustration from '../Illustration';

const REVEAL_DURATION = 240;

// Announcements are plain text from the notification textarea. React escapes
// the text; only explicit HTTP(S) URLs become links, never arbitrary HTML.
function linkedBody(body: string) {
  return body.split(/(https?:\/\/[^\s<>"'）。，；！？]+)/g).map((part, index) =>
    /^https?:\/\//i.test(part)
      ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : part,
  );
}

function AnnouncementPreview({ body, link }: Pick<Announcement, 'body' | 'link'>) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const startingHeight = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = viewport.current;
    const from = startingHeight.current;
    startingHeight.current = null;
    if (!element || from === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = element.getBoundingClientRect().height;
    // Animate measured heights, then return to natural height. No fixed maximum
    // cuts off long notices; cleanup also makes rapid toggles/unmounts safe.
    const animation = element.animate([
      { height: `${from}px`, opacity: .94 },
      { height: `${to}px`, opacity: 1 },
    ], { duration: REVEAL_DURATION, easing: 'cubic-bezier(.2, .65, .3, 1)' });
    // Safari can pause the animation timeline in a background window. Always
    // release its temporary height so a notice cannot stay clipped indefinitely.
    const finishTimer = window.setTimeout(() => animation.cancel(), REVEAL_DURATION + 40);
    return () => { window.clearTimeout(finishTimer); animation.cancel(); };
  }, [expanded]);

  function toggle() {
    startingHeight.current = viewport.current?.getBoundingClientRect().height ?? null;
    setExpanded(value => !value);
  }

  return <>
    <div id={bodyId} ref={viewport} className="announcement-preview" data-expanded={expanded}>
      <p>{expanded ? linkedBody(body) : body}</p>
    </div>
    <div className="announcement-preview__actions">
      <button type="button" className="text-link" aria-expanded={expanded} aria-controls={bodyId} onClick={toggle}>
        {expanded ? '收起原文 ↑' : '展开原文 ↓'}
      </button>
      {expanded && link && (/^https?:\/\//i.test(link)
        ? <a className="text-link announcement-preview__source" href={link} target="_blank" rel="noopener noreferrer">查看来源 ↗</a>
        : link.startsWith('/') && !link.startsWith('//')
          ? <Link className="text-link announcement-preview__source" to={link}>查看相关内容 →</Link>
          : null)}
    </div>
  </>;
}

export default function AnnouncementCard({announcement,clampBody=false}: {announcement:Announcement;clampBody?:boolean}) {
  return <article className="announcement-entry" data-flip-id={`announcement-${announcement._id}`}>
    <Illustration kind="announcement" size="small" className="entry-illustration"/>
    <div data-pet-avoid>
      <div className="flex items-center gap-2"><span className={`status-label ${announcement.level}`}>{announcementLevel(announcement.level).label}</span>{announcement.pinned && <span className="entry-meta"><Pin size={13}/>置顶</span>}</div>
      <h3>{announcement.title}</h3>
      {clampBody ? <AnnouncementPreview key={announcement._id} body={announcement.body} link={announcement.link}/> : <>
        <p>{announcement.body}</p>
        {announcement.link && (/^https?:\/\//i.test(announcement.link) ? <a className="text-link min-h-11 inline-flex items-center text-sm" href={announcement.link} target="_blank" rel="noopener noreferrer">查看相关链接 ↗</a> : announcement.link.startsWith('/') && !announcement.link.startsWith('//') ? <Link className="text-link min-h-11 inline-flex items-center text-sm" to={announcement.link}>查看相关内容 →</Link> : null)}
      </>}
    </div>
    <time dateTime={announcement.publishedAt}>{formatDate(announcement.publishedAt)}</time>
  </article>;
}
