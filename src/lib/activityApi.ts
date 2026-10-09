import api from './axios';
import type { ActivityDetail, ActivityList, ActivityMedia, ActivityMediaList, ActivityRegistration, ActivityUpload, MemberFilter, RegistrationList, RegistrationStatus, ReviewResult } from '../types/activity';

const base = '/api/events';
export const activityApi = {
  list: async (params: Record<string, unknown>, signal?: AbortSignal) => (await api.get<ActivityList>(base, { params, signal })).data,
  detail: async (id: string, admin = false, signal?: AbortSignal) => (await api.get<ActivityDetail>(`${base}/${id}${admin ? '/admin' : ''}`, { signal })).data,
  mine: async (id: string, signal?: AbortSignal) => (await api.get<{ rsvp: ActivityRegistration | null }>(`${base}/${id}/rsvp`, { signal })).data.rsvp,
  apply: async (id: string) => (await api.post<{ rsvp: ActivityRegistration }>(`${base}/${id}/rsvp`, {})).data.rsvp,
  cancel: async (id: string) => (await api.delete<{ rsvp: ActivityRegistration }>(`${base}/${id}/rsvp`)).data.rsvp,
  members: async (id: string, params: { filter: MemberFilter; search?: string; page: number; limit: number }, signal?: AbortSignal) => (await api.get<RegistrationList>(`${base}/${id}/registrations`, { params, signal })).data,
  review: async (id: string, userId: string, status: RegistrationStatus, version: number, note = '') => (await api.post(`${base}/${id}/registrations/${userId}/review`, { status, version, note })).data,
  bulkReview: async (id: string, registrations: Array<{ userId: string; version: number }>, status: 'APPROVED' | 'REJECTED', note = '') => (await api.post<{ results: ReviewResult[] }>(`${base}/${id}/registrations/bulk-review`, { status, registrations, note })).data,
  summary: async (id: string, summary: string) => (await api.put(`${base}/${id}/summary`, { summary })).data,
  archive: async (id: string) => (await api.post(`${base}/${id}/archive`, {})).data,
  restore: async (id: string) => (await api.post(`${base}/${id}/restore`, {})).data,
  media: async (id: string, page = 1, limit = 24, signal?: AbortSignal) => (await api.get<ActivityMediaList>(`${base}/${id}/media`, { params: { page, limit }, signal })).data,
  initUpload: async (id: string, file: File, mediaType: 'COVER' | 'PHOTO') => (await api.post<ActivityUpload>(`${base}/${id}/media/init`, { mediaType, filename: file.name, mimeType: file.type, size: file.size })).data,
  completeUpload: async (id: string, mediaId: string) => (await api.post<{ media: ActivityMedia; version: number }>(`${base}/${id}/media/${mediaId}/complete`, {})).data,
  deleteMedia: async (id: string, mediaId: string) => (await api.delete(`${base}/${id}/media/${mediaId}`)).data,
  clearCover: async (id: string, version: number) => (await api.delete(`${base}/${id}/media/cover`, { data: { clearLegacy: true, version } })).data,
  orderMedia: async (id: string, ids: string[], version: number) => (await api.patch(`${base}/${id}/media/order`, { ids, version })).data,
};

export function activityError(error: unknown): string {
  const shaped = error as { response?: { status?: number; data?: { error?: string; message?: string; code?: string } }; message?: string };
  const body = shaped?.response?.data;
  if (body?.error && /[\u4e00-\u9fff]/.test(body.error)) return body.error;
  if (body?.message && /[\u4e00-\u9fff]/.test(body.message)) return body.message;
  if (shaped?.response?.status === 403) return '没有执行此操作的权限。';
  if (shaped?.response?.status === 401) return '登录已过期，请重新登录。';
  if (shaped?.response?.status === 409) return '数据已经更新，请刷新后重新操作。';
  if (shaped?.message && /[\u4e00-\u9fff]/.test(shaped.message)) return shaped.message;
  return '操作未完成，请检查网络后重试。';
}
