import { Link } from 'react-router-dom';
import { Pin } from 'lucide-react';
import type { Announcement } from '../../lib/announcementMeta';
import { announcementLevel } from '../../lib/announcementMeta';
import { formatDate } from '../../lib/contentFormat';
import Illustration from '../Illustration';
export default function AnnouncementCard({announcement,clampBody=false}: {announcement:Announcement;clampBody?:boolean}) {
  return <article className="announcement-entry" data-flip-id={`announcement-${announcement._id}`}><Illustration kind="announcement" size="small" className="entry-illustration"/><div data-pet-avoid><div className="flex items-center gap-2"><span className={`status-label ${announcement.level}`}>{announcementLevel(announcement.level).label}</span>{announcement.pinned && <span className="entry-meta"><Pin size={13}/>置顶</span>}</div><h3>{announcement.title}</h3><p className={clampBody?'line-clamp-2':''}>{announcement.body}</p>{announcement.link && (/^https?:\/\//i.test(announcement.link) ? <a className="text-link min-h-11 inline-flex items-center text-sm" href={announcement.link} target="_blank" rel="noopener noreferrer">查看相关链接 ↗</a> : announcement.link.startsWith('/') && !announcement.link.startsWith('//') ? <Link className="text-link min-h-11 inline-flex items-center text-sm" to={announcement.link}>查看相关内容 →</Link> : null)}</div><time dateTime={announcement.publishedAt}>{formatDate(announcement.publishedAt)}</time></article>;
}
