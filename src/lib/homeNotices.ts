import type { Announcement } from './announcementMeta';

export type HomeNotice = { announcement: Announcement; prominent: boolean; label: string };

/** Use the same published, unexpired announcements as the existing notice desk. */
export function selectHomeNotices(announcements: Announcement[], now = Date.now()): HomeNotice[] {
  const seen = new Set<string>();
  const current = announcements.filter(item => {
    if (!item?._id || !item.title?.trim() || seen.has(item._id)) return false;
    const published = Date.parse(item.publishedAt);
    const expires = item.expiresAt ? Date.parse(item.expiresAt) : Infinity;
    if (!Number.isFinite(published) || published > now || !(expires > now)) return false;
    seen.add(item._id);
    return true;
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b._id.localeCompare(a._id));
  const prominent = (item: Announcement) => item.pinned || item.level === 'urgent' || item.level === 'important';
  const priority = current.find(prominent);
  const recent = current.find(item => !prominent(item));
  return [priority && { announcement: priority, prominent: true,
    label: priority.level === 'urgent' ? '紧急通知' : priority.pinned ? '置顶通知' : '重要通知' },
  recent && { announcement: recent, prominent: false, label: '最近通知' }].filter((item): item is HomeNotice => !!item);
}

export const homeNoticeTarget = (id: string) => `/announcements?notice=${encodeURIComponent(id)}`;

export function homeNoticeDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date).replace('/', '-') : '';
}
