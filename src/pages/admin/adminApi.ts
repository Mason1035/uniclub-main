import { readToken, clearSession } from '@/lib/session';
export { readToken, clearSession };
/**
 * ClassHub admin API client.
 *
 * Reuses the project-wide axios instance (`src/lib/axios.ts`) so JWT handling
 * and the base URL stay in one place. Every endpoint under /api/admin is
 * enforced server-side by the requireAdmin middleware.
 */
import api from '@/lib/axios';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  uniqueId: string;
  isAdmin: boolean;
  isVerified: boolean;
  isEnrolled?: boolean;
  lastActive: string | null;
  createdAt: string | null;
  hasAvatar: boolean;
}

export interface AdminEvent {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location?: { type?: string; address?: string; room?: string; virtualLink?: string };
  eventType: string;
  category: string[];
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  imageUrl: string | null;
  maxCapacity: number | null;
  rsvpCount: number;
  organizer?: { _id?: string; name?: string; email?: string; uniqueId?: string };
  createdAt: string;
}

export interface AdminNews {
  _id: string;
  title: string;
  excerpt: string;
  source: string;
  categories: string[];
  status: 'draft' | 'pending' | 'approved' | 'archived';
  imageUrl: string | null;
  originalUrl: string | null;
  isFeatured: boolean;
  isTrending: boolean;
  likes: number;
  comments: number;
  publishedAt: string | null;
  createdAt: string;
  author?: { name?: string; email?: string };
}

export interface AdminResource {
  _id: string;
  title: string;
  description: string;
  type: 'Document' | 'Tutorial' | 'Tool' | 'Video';
  category: string;
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  linkUrl: string | null;
  thumbnailUrl: string | null;
  downloadCount: number;
  views: number;
  tags: string[];
  createdAt: string;
  uploadedBy?: { name?: string; email?: string };
}

export interface Paged<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface AdminStats {
  users: number;
  events: number;
  news: number;
  resources: number;
  breakdown: { admins: number; pendingResources: number; pendingNews: number };
  generatedAt: string;
}

export interface RosterEntry {
  id: string;
  email: string;
  name: string;
  uniqueId: string;
  /** 该学号是否已开通账号 */
  registered: boolean;
}

export interface RosterPage {
  entries: RosterEntry[];
  summary: { total: number; registered: number };
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface BulkImportResult {
  accountsCreated?: number;
  accountsExisting?: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
  total: number;
}

/* ---- 班级公告 ---- */

export type AnnouncementLevel = 'info' | 'important' | 'urgent';

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  pinned: boolean;
  link: string;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  author?: { name?: string; email?: string };
}

export interface AnnouncementOverview {
  announcements: { total: number; published: number; draft: number; pinned: number; urgent: number };
  notifications: { total: number; unread: number };
}

/* ---- 相册（往期活动） ---- */

export interface GalleryImage {
  index: number;
  caption: string;
  size: number;
  contentType: string;
  originalName: string;
  uploadedAt: string;
  url: string;
}

export interface AdminPastEvent {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  category: string;
  attendance: number;
  tags: string[];
  link: string;
  galleryCount: number;
  hasPoster: boolean;
  posterUrl: string;
  createdAt: string;
  body?: string;
  gallery?: GalleryImage[];
}

/** Shape of the errors axios surfaces (plus plain Error objects). */
interface ApiErrorShape {
  response?: {
    status?: number;
    /** 正常时是 JSON 对象；后端没启动时代理会回纯文本，所以类型放宽 */
    data?: unknown;
  };
  message?: string;
}

/** Extract a readable message from an axios error. */
export const errorMessage = (error: unknown): string => {
  const err = error as ApiErrorShape;
  const status = err?.response?.status;

  if (status === 403) return '此账号没有管理员权限。';
  if (status === 401) return '登录已过期，请重新登录。';
  // 后端没启动时，Vite 代理会回 500 + 纯文本 body，此时 data.error 不存在，
  // axios 只会给出英文的 "Request failed with status code 500"，需要换成人话。
  if (status && status >= 500) {
    return '服务暂时无法响应，请稍后重试或联系网站负责人。';
  }
  if (!err?.response && /Network Error|Failed to fetch|Load failed/i.test(err?.message || '')) {
    return '无法连接网站服务，请检查网络后重试。';
  }

  const body = err?.response?.data;
  if (body && typeof body === 'object') {
    const shaped = body as { error?: string; details?: string };
    if (shaped.error && /[\u4e00-\u9fff]/.test(shaped.error)) return shaped.error;
    if (shaped.details && /[\u4e00-\u9fff]/.test(shaped.details)) return shaped.details;
  }
  return '操作未成功，请检查输入内容后重试。';
};

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export interface SessionUser {
  id?: string;
  email: string;
  name: string;
  uniqueId: string;
  isAdmin: boolean;
}

/**
 * Persist the session exactly where the rest of the app expects it, so an admin
 * who logs in here is also logged in for the member-facing pages.
 */
export const persistSession = (token: string, user: SessionUser) => {
  localStorage.setItem('token', token);
  localStorage.setItem('authToken', token);
  sessionStorage.setItem('authToken', token);
  localStorage.setItem(
    'authUser',
    JSON.stringify({ email: user.email, name: user.name, uniqueId: user.uniqueId })
  );
  sessionStorage.setItem('user', JSON.stringify(user));
  window.dispatchEvent(new Event('auth:changed'));
};

/** GET /api/auth/me - throws on invalid/expired token. */
export const fetchMe = async (): Promise<SessionUser> => {
  const { data } = await api.get('/api/auth/me');
  return data.user;
};

/** POST /api/auth/login + GET /api/auth/me */
export const loginAsAdmin = async (uniqueId: string, password: string): Promise<SessionUser> => {
  const { data } = await api.post('/api/auth/login', { uniqueId: uniqueId.trim(), password });
  if (!data?.token) throw new Error('登录失败：服务器未返回令牌');

  persistSession(data.token, {
    email: data.user?.email || '',
    name: data.user?.name || uniqueId,
    uniqueId: data.user?.uniqueId || uniqueId,
    isAdmin: data.user?.isAdmin === true,
  });

  const me = await fetchMe();
  persistSession(data.token, me);
  return me;
};

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export const getStats = async (): Promise<AdminStats> => {
  const { data } = await api.get('/api/admin/stats');
  return data;
};

export const getUsers = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}): Promise<Paged<AdminUser>> => {
  const { data } = await api.get('/api/admin/users', { params });
  return { items: data.users, pagination: data.pagination };
};

export const getEvents = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<Paged<AdminEvent>> => {
  const { data } = await api.get('/api/admin/events', { params });
  return { items: data.events, pagination: data.pagination };
};

export const getNews = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<Paged<AdminNews>> => {
  const { data } = await api.get('/api/admin/news', { params });
  return { items: data.news, pagination: data.pagination };
};

export const getResources = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
  category?: string;
}): Promise<Paged<AdminResource>> => {
  const { data } = await api.get('/api/admin/resources', { params });
  return { items: data.resources, pagination: data.pagination };
};

export const getRoster = async (params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<RosterPage> => {
  const { data } = await api.get('/api/admin/roster', { params });
  return { entries: data.roster, summary: data.summary, pagination: data.pagination };
};

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export const setUserAdmin = async (id: string, isAdmin: boolean): Promise<AdminUser> => {
  const { data } = await api.patch(`/api/admin/users/${id}/admin`, { isAdmin });
  return data.user;
};

/** POST /api/events - existing endpoint, organizer becomes the current admin. */
export const createEvent = async (payload: Record<string, unknown>) => {
  const { data } = await api.post('/api/events', payload);
  return data.event;
};

export const updateEvent = async (id: string, payload: Record<string, unknown>) => {
  const { data } = await api.put(`/api/events/${id}`, payload);
  return data.event;
};

export const deleteEvent = async (id: string) => {
  const { data } = await api.delete(`/api/events/${id}`);
  return data;
};

/** POST /api/news - existing endpoint, auto-approved. */
export const createNews = async (payload: Record<string, unknown>) => {
  const { data } = await api.post('/api/news', payload);
  return data.news;
};

export const updateNews = async (id: string, payload: Record<string, unknown>) => {
  const { data } = await api.put(`/api/news/${id}`, payload);
  return data.news;
};

export const deleteNews = async (id: string) => {
  const { data } = await api.delete(`/api/news/${id}`);
  return data;
};

export const triggerCuration = async () => {
  const { data } = await api.post('/api/news/trigger-curation');
  return data;
};

/** POST /api/resources - admin submissions are published immediately. */
export const createResource = async (payload: Record<string, unknown>) => {
  const { data } = await api.post('/api/resources', { status: 'approved', ...payload });
  return data.resource;
};

export const updateResource = async (id: string, payload: Record<string, unknown>) => {
  const { data } = await api.put(`/api/resources/${id}`, payload);
  return data.resource;
};

export const deleteResource = async (id: string) => {
  const { data } = await api.delete(`/api/resources/${id}`);
  return data;
};

/* ---- 班级名单 ---- */

export const addRosterEntry = async (payload: {
  email?: string;
  name: string;
  uniqueId: string;
}): Promise<{ action: 'created' | 'updated' }> => {
  const { data } = await api.post('/api/admin/roster', payload);
  return data;
};

export const bulkImportRoster = async (text: string): Promise<BulkImportResult> => {
  const { data } = await api.post('/api/admin/roster/bulk', { text }, { timeout: 120000 });
  return data;
};

export const deleteRosterEntry = async (id: string) => {
  const { data } = await api.delete(`/api/admin/roster/${id}`);
  return data;
};

/* ---- 班级公告 ---- */

export const getAnnouncementOverview = async (): Promise<AnnouncementOverview> => {
  const { data } = await api.get('/api/admin/announcements/overview');
  return data.overview;
};

export const getAnnouncements = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  level?: string;
  status?: string;
}): Promise<Paged<AdminAnnouncement>> => {
  const { data } = await api.get('/api/admin/announcements', { params });
  return { items: data.announcements, pagination: data.pagination };
};

export const createAnnouncement = async (payload: Record<string, unknown>) => {
  const { data } = await api.post('/api/admin/announcements', payload);
  return data.announcement as AdminAnnouncement;
};

export const updateAnnouncement = async (id: string, payload: Record<string, unknown>) => {
  const { data } = await api.put(`/api/admin/announcements/${id}`, payload);
  return data.announcement as AdminAnnouncement;
};

export const deleteAnnouncement = async (id: string) => {
  const { data } = await api.delete(`/api/admin/announcements/${id}`);
  return data;
};

/* ---- 相册（往期活动） ---- */

export const getPastEvents = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}): Promise<Paged<AdminPastEvent>> => {
  const { data } = await api.get('/api/admin/past-events', { params });
  return { items: data.pastEvents, pagination: data.pagination };
};

export const getPastEvent = async (id: string): Promise<AdminPastEvent> => {
  const { data } = await api.get(`/api/admin/past-events/${id}`);
  return data.pastEvent;
};

export const createPastEvent = async (payload: Record<string, unknown>) => {
  const { data } = await api.post('/api/admin/past-events', payload);
  return data.pastEvent as AdminPastEvent;
};

export const updatePastEvent = async (id: string, payload: Record<string, unknown>) => {
  const { data } = await api.put(`/api/admin/past-events/${id}`, payload);
  return data.pastEvent as AdminPastEvent;
};

export const deletePastEvent = async (id: string) => {
  const { data } = await api.delete(`/api/admin/past-events/${id}`);
  return data;
};

export const uploadGalleryImage = async (
  id: string,
  payload: { data: string; caption?: string; originalName?: string }
): Promise<AdminPastEvent> => {
  const { data } = await api.post(`/api/admin/past-events/${id}/gallery`, payload);
  return data.pastEvent;
};

export const deleteGalleryImage = async (id: string, index: number): Promise<AdminPastEvent> => {
  const { data } = await api.delete(`/api/admin/past-events/${id}/gallery/${index}`);
  return data.pastEvent;
};

