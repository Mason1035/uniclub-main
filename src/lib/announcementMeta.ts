/**
 * 班级公告的展示元数据（成员端共用）。
 * 数据由管理员在后台「通知管理」页发布，接口 GET /api/announcements。
 */

export interface Announcement {
  _id: string;
  title: string;
  body: string;
  level: 'info' | 'important' | 'urgent';
  pinned: boolean;
  link?: string;
  publishedAt: string;
  expiresAt: string | null;
}

export const ANNOUNCEMENT_LEVELS: Record<
  Announcement['level'],
  { label: string; badge: string; accent: string }
> = {
  info: {
    label: '通知',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    accent: 'border-l-sky-400',
  },
  important: {
    label: '重要',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    accent: 'border-l-amber-400',
  },
  urgent: {
    label: '紧急',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    accent: 'border-l-red-500',
  },
};

export const announcementLevel = (level: string) =>
  ANNOUNCEMENT_LEVELS[level as Announcement['level']] || ANNOUNCEMENT_LEVELS.info;

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期 */
export const timeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} 天前`;
  return date.toLocaleDateString('zh-CN');
};
