import api from '@/lib/axios';
export type FeedbackStatus = 'new' | 'read' | 'resolved';
export interface FeedbackItem {
  id: string; title: string; description: string; expected: string; page: string;
  status: FeedbackStatus; createdAt: string; updatedAt: string;
  member: { id: string; name: string; email: string };
}
export interface FeedbackInbox {
  items: FeedbackItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
  summary: { new: number; read: number; resolved: number; total: number };
}
export async function getFeedbackInbox(params: { page: number; limit: number; status: string; search: string }, signal?: AbortSignal): Promise<FeedbackInbox> {
  return (await api.get('/api/admin/feedback', { params, signal })).data;
}
export async function updateFeedbackStatus(id: string, status: FeedbackStatus, signal?: AbortSignal): Promise<FeedbackItem> {
  return (await api.patch(`/api/admin/feedback/${encodeURIComponent(id)}`, { status }, { signal })).data;
}
