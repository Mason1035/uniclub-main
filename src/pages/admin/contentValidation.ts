import { RESOURCE_CATEGORIES, RESOURCE_TYPES } from '@/lib/resourceMeta';
import { ACTIVITY_TYPES } from '@/lib/activityMeta';

export type FieldErrors = Record<string, string>;
export const EVENT_TYPES = ACTIVITY_TYPES.map(type => type.value);
export const EVENT_CATEGORIES = ['AI/ML', 'Web Development', 'Mobile Apps', 'Data Science', 'Cybersecurity', 'Game Development', 'Hardware', 'Startups', 'Career', 'Social'];
export const NEWS_CATEGORIES = ['AI/ML', 'Startups', 'Tech Industry', 'Cybersecurity', 'Software Development', 'Gaming', 'Gadgets', 'IoT', 'Mobile Tech', 'Hardware'];

export interface EventFormValues {
  title: string; description: string; eventType: string; status: string;
  startDate: string; endDate: string; locationType: string; address: string;
  room: string; virtualLink: string; category: string; maxCapacity: string; imageUrl: string;
  rsvpDeadline?: string; rsvpLink?: string;
}
export interface AnnouncementFormValues {
  title: string; body: string; level: string; pinned: boolean; isPublished: boolean; link: string; expiresAt: string;
}
export interface NewsFormValues {
  title: string; excerpt: string; content: string; source: string; category: string; imageUrl: string;
  status: string; isFeatured: boolean; isTrending: boolean;
}
export interface ResourceFormValues {
  title: string; description: string; type: string; category: string; status: string; linkUrl: string; thumbnailUrl: string; tags: string;
}

export const isWebUrl = (value: string) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
};
const text = (errors: FieldErrors, key: string, value: string, label: string, max: number, required = true) => {
  if (required && !value.trim()) errors[key] = `请补充${label}。`;
  else if (value.length > max) errors[key] = `${label}不能超过 ${max} 字。`;
};
const date = (value: string) => value && Number.isFinite(new Date(value).getTime());
const url = (errors: FieldErrors, key: string, value: string, label: string, required = false, relative = false) => {
  if (required && !value.trim()) errors[key] = `请补充${label}。`;
  else if (value.trim() && (!(isWebUrl(value.trim()) || (relative && /^\/(?![/\\])/.test(value.trim()))) || value.length > 2048)) errors[key] = `${label}需要有效的 HTTP(S) 地址${relative ? '或站内路径' : ''}。`;
};

// The manual management forms and AI publication preview share these rules.
// Backend authorization, field allowlists and model validation still run on
// the existing create endpoints; client validation never replaces them.
export function validateEventForm(form: EventFormValues, retainedType?: string): FieldErrors {
  const errors: FieldErrors = {};
  text(errors, 'title', form.title, '活动标题', 200);
  text(errors, 'description', form.description, '活动介绍', 2000);
  if (!date(form.startDate)) errors.startDate = '请补充有效的活动开始时间。';
  if (!date(form.endDate)) errors.endDate = '请补充有效的活动结束时间。';
  if (date(form.startDate) && date(form.endDate) && new Date(form.endDate) <= new Date(form.startDate)) errors.endDate = '结束时间必须晚于开始时间。';
  if (!EVENT_TYPES.includes(form.eventType) && form.eventType !== retainedType) errors.eventType = '请选择团活动、团建、班会、小组交流或其他。';
  if (!['physical', 'virtual', 'hybrid'].includes(form.locationType)) errors.locationType = '请选择活动形式。';
  if (form.locationType !== 'virtual' && !form.address.trim()) errors.address = '请补充线下活动地址。';
  url(errors, 'virtualLink', form.virtualLink, '线上活动链接', ['virtual', 'hybrid'].includes(form.locationType));
  if (form.category && !EVENT_CATEGORIES.includes(form.category)) errors.category = '请选择有效的活动分类。';
  if (form.maxCapacity && (!Number.isSafeInteger(Number(form.maxCapacity)) || Number(form.maxCapacity) < 1 || Number(form.maxCapacity) > 2000)) errors.maxCapacity = '人数上限需要 1–2000 的整数，留空表示不限。';
  if (form.rsvpDeadline && !date(form.rsvpDeadline)) errors.rsvpDeadline = '报名截止时间无效。';
  if (form.rsvpDeadline && date(form.rsvpDeadline) && date(form.endDate) && new Date(form.rsvpDeadline) > new Date(form.endDate)) errors.rsvpDeadline = '报名截止时间不能晚于活动结束。';
  url(errors, 'rsvpLink', form.rsvpLink || '', '报名链接');
  url(errors, 'imageUrl', form.imageUrl, '封面链接');
  return errors;
}
export function validateAnnouncementForm(form: AnnouncementFormValues): FieldErrors {
  const errors: FieldErrors = {};
  text(errors, 'title', form.title, '公告标题', 120);
  text(errors, 'body', form.body, '公告正文', 4000);
  if (!['info', 'important', 'urgent'].includes(form.level)) errors.level = '请选择重要程度。';
  url(errors, 'link', form.link, '相关链接', false, true);
  if (form.expiresAt && !date(form.expiresAt)) errors.expiresAt = '公告下架时间无效。';
  return errors;
}
export function validateNewsForm(form: NewsFormValues, editing = false): FieldErrors {
  const errors: FieldErrors = {};
  text(errors, 'title', form.title, '新闻标题', 200);
  text(errors, 'source', form.source, '新闻来源', 200);
  text(errors, 'excerpt', form.excerpt, '新闻摘要', 800, !editing);
  text(errors, 'content', form.content, '新闻正文', 16000, !editing);
  if (form.category && !NEWS_CATEGORIES.includes(form.category)) errors.category = '请选择有效的新闻分类。';
  url(errors, 'imageUrl', form.imageUrl, '封面链接');
  return errors;
}
export function validateResourceForm(form: ResourceFormValues): FieldErrors {
  const errors: FieldErrors = {};
  text(errors, 'title', form.title, '资源名称', 200);
  text(errors, 'description', form.description, '资源说明', 1000, false);
  if (!(RESOURCE_TYPES as readonly string[]).includes(form.type)) errors.type = '请选择资源形态。';
  if (!(RESOURCE_CATEGORIES as readonly string[]).includes(form.category)) errors.category = '请选择资源分类。';
  url(errors, 'linkUrl', form.linkUrl, '资源链接', true);
  url(errors, 'thumbnailUrl', form.thumbnailUrl, '缩略图链接');
  return errors;
}
