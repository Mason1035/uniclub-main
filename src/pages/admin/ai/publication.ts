import { createAnnouncement, createEvent, createNews, createResource } from '../adminApi';
import { validateAnnouncementForm, validateEventForm, validateNewsForm, validateResourceForm, type FieldErrors } from '../contentValidation';
import { toLocalInputValue } from '../formatting';
import type { AiActivityResult, AiAnnouncementResult, AiGeneration, AiNewsResult, AiResourceResult, PublishDraft, PublishedRecord } from './types';

export function toPublishDraft(result: AiGeneration): PublishDraft | null {
  if (!result.structured || !result.publishType) return null;
  switch (result.publishType) {
    case 'activity': {
      const v = result.structured as AiActivityResult;
      return { kind: 'activity', values: { title: v.title || '', description: v.description || '', startDate: toLocalInputValue(v.startDate), endDate: toLocalInputValue(v.endDate), eventType: v.eventType || '', locationType: v.location.type || '', address: v.location.address || '', room: v.location.room || '', virtualLink: v.location.virtualLink || '', category: v.category[0] || '', maxCapacity: v.maxCapacity == null ? '' : String(v.maxCapacity), imageUrl: '', status: 'published', rsvpDeadline: toLocalInputValue(v.rsvpDeadline), rsvpLink: v.rsvpLink || '' } };
    }
    case 'announcement': {
      const v = result.structured as AiAnnouncementResult;
      return { kind: 'announcement', values: { title: v.title || '', body: v.body || '', level: v.level || 'info', link: v.link || '', expiresAt: toLocalInputValue(v.expiresAt), pinned: false, isPublished: true } };
    }
    case 'news': {
      const v = result.structured as AiNewsResult;
      return { kind: 'news', values: { title: v.title || '', excerpt: v.excerpt || '', content: v.content || '', source: v.source || '', category: v.categories[0] || '', status: 'approved', imageUrl: '', isFeatured: false, isTrending: false } };
    }
    case 'resource': {
      const v = result.structured as AiResourceResult;
      return { kind: 'resource', values: { title: v.title || '', description: v.description || '', type: v.type || '', category: v.category || '', linkUrl: v.linkUrl || '', tags: v.tags.join(', '), status: 'approved', thumbnailUrl: '' } };
    }
  }
}
export function publicationErrors(draft: PublishDraft): FieldErrors {
  switch (draft.kind) {
    case 'activity': return validateEventForm(draft.values);
    case 'announcement': return validateAnnouncementForm(draft.values);
    case 'news': return validateNewsForm(draft.values);
    case 'resource': return validateResourceForm(draft.values);
  }
}
const iso = (value: string) => value ? new Date(value).toISOString() : null;
export function mapToCreateActivityDTO(v: Extract<PublishDraft, { kind: 'activity' }>['values']) {
  return { title: v.title.trim(), description: v.description.trim(), startDate: iso(v.startDate), endDate: iso(v.endDate), eventType: v.eventType, status: 'published', location: { type: v.locationType, address: v.address.trim(), room: v.room.trim(), virtualLink: v.virtualLink.trim() }, category: v.category ? [v.category] : [], maxCapacity: v.maxCapacity ? Number(v.maxCapacity) : null, imageUrl: v.imageUrl.trim(), rsvpDeadline: iso(v.rsvpDeadline || ''), rsvpLink: v.rsvpLink?.trim() || null };
}
export function mapToCreateAnnouncementDTO(v: Extract<PublishDraft, { kind: 'announcement' }>['values']) {
  return { title: v.title.trim(), body: v.body.trim(), level: v.level, link: v.link.trim(), expiresAt: iso(v.expiresAt), pinned: v.pinned, isPublished: true };
}
export function mapToCreateNewsDTO(v: Extract<PublishDraft, { kind: 'news' }>['values']) {
  return { title: v.title.trim(), excerpt: v.excerpt.trim(), content: v.content.trim(), source: v.source.trim(), categories: v.category ? [v.category] : [], imageUrl: v.imageUrl.trim(), status: 'approved', isFeatured: false, isTrending: false };
}
export function mapToCreateResourceDTO(v: Extract<PublishDraft, { kind: 'resource' }>['values']) {
  return { title: v.title.trim(), description: v.description.trim(), type: v.type, category: v.category, linkUrl: v.linkUrl.trim(), thumbnailUrl: v.thumbnailUrl.trim(), tags: v.tags.split(',').map(t => t.trim()).filter(Boolean), status: 'approved' };
}
export async function publishDraft(draft: PublishDraft): Promise<PublishedRecord> {
  const errors = publicationErrors(draft);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  let id: string;
  switch (draft.kind) {
    case 'activity': id = (await createEvent(mapToCreateActivityDTO(draft.values)))._id; break;
    case 'announcement': id = (await createAnnouncement(mapToCreateAnnouncementDTO(draft.values))).id; break;
    case 'news': id = (await createNews(mapToCreateNewsDTO(draft.values)))._id; break;
    case 'resource': id = (await createResource(mapToCreateResourceDTO(draft.values)))._id; break;
  }
  // ClassHub currently has an announcement list, no standalone detail route.
  const paths = { activity: `/event/${id}`, announcement: '/announcements', news: `/news/${id}`, resource: `/resource/${id}` };
  const manage = { activity: '/admin/events', announcement: '/admin/notifications', news: '/admin/news', resource: '/admin/resources' };
  return { id, kind: draft.kind, title: draft.values.title, viewUrl: paths[draft.kind], manageUrl: manage[draft.kind] };
}
export function draftText(draft: PublishDraft): string {
  switch (draft.kind) {
    case 'activity': { const v = draft.values; return [v.title, v.description, v.startDate && `时间：${v.startDate} — ${v.endDate}`, v.address && `地点：${v.address} ${v.room}`, v.virtualLink, v.rsvpLink].filter(Boolean).join('\n\n'); }
    case 'announcement': return [draft.values.title, draft.values.body, draft.values.link].filter(Boolean).join('\n\n');
    case 'news': return [draft.values.title, draft.values.excerpt, draft.values.content, draft.values.source && `来源：${draft.values.source}`].filter(Boolean).join('\n\n');
    case 'resource': return [draft.values.title, draft.values.description, draft.values.linkUrl].filter(Boolean).join('\n\n');
  }
}
