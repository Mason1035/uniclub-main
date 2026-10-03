import axios from 'axios';
import api from './axios';
import type { StorageConfiguration, StorageConfigurationInput, StorageMaterialList, UploadAuthorization, CollectionInput, CollectionList, DownloadLink, DownloadLinks, SubmissionOverview, SubmissionState, UploadCredentials, UploadSession, QuantificationCollection, QuantificationSubmission } from '../types/quantification';

const base = '/api/quantification';
const adminBase = '/api/admin/quantification';
export const quantificationApi = {
  collections: async (admin = false) => (await api.get<CollectionList>(`${admin ? adminBase : base}/collections`)).data,
  access: async () => (await api.get<{ canManage: boolean }>(`${base}/access`)).data,
  mine: async (id: string) => (await api.get<SubmissionState>(`${base}/collections/${id}/me`)).data,
  init: async (id: string, file: File) => (await api.post<UploadSession>(`${base}/collections/${id}/uploads`, { originalFilename: file.name, fileSize: file.size, mimeType: 'application/zip' }, { timeout: 60000 })).data,
  credentials: async (id: string) => (await api.post<{ credentials: UploadCredentials }>(`${base}/uploads/${id}/credentials`, {})).data.credentials,
  authorization: async (id: string, partNumber: number | null, signal: AbortSignal) => (await api.post<UploadAuthorization>(`${base}/uploads/${id}/authorization`, { partNumber }, { signal, timeout: 30000 })).data,
  storageFiles: async () => (await api.get<StorageMaterialList>(`${adminBase}/files`, { timeout: 60000 })).data,
  storageDownloads: async (keys: string[]) => (await api.post<DownloadLinks>(`${adminBase}/files/downloads`, { keys }, { timeout: 120000 })).data,
  storageConfig: async () => (await api.get<StorageConfiguration>(`${adminBase}/storage`)).data,
  saveStorageConfig: async (body: StorageConfigurationInput) => (await api.put<StorageConfiguration>(`${adminBase}/storage`, body, { timeout: 60000 })).data,
  testStorageConfig: async () => (await api.post<{ connected: boolean; message: string }>(`${adminBase}/storage/test`, {}, { timeout: 40000 })).data,
  parts: async (id: string) => (await api.get<{ parts: { partNumber: number; size: number; etag: string }[] }>(`${base}/uploads/${id}/parts`)).data.parts,
  complete: async (id: string) => (await api.post<{ submission: QuantificationSubmission }>(`${base}/uploads/${id}/complete`, {}, { timeout: 300000 })).data,
  abort: async (id: string) => (await api.post(`${base}/uploads/${id}/abort`, {})).data,
  download: async (id: string, admin = false) => (await api.get<DownloadLink>(`${admin ? adminBase : base}/submissions/${id}/download`)).data,
  createCollection: async (body: CollectionInput) => (await api.post<{ collection: QuantificationCollection }>(`${adminBase}/collections`, body)).data.collection,
  editCollection: async (id: string, body: CollectionInput) => (await api.patch<{ collection: QuantificationCollection }>(`${adminBase}/collections/${id}`, body)).data.collection,
  overview: async (id: string, params: Record<string, string | number>) => (await api.get<SubmissionOverview>(`${adminBase}/collections/${id}/submissions`, { params })).data,
  downloads: async (ids: string[]) => (await api.post<DownloadLinks>(`${adminBase}/downloads`, { submissionIds: ids }, { timeout: 120000 })).data,
  cleanup: async () => (await api.post<{ processed: number; failed: number; configured: boolean; retainedFiles?: boolean }>(`${adminBase}/cleanup`, {}, { timeout: 300000 })).data,
};

export function quantificationError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return '登录已过期，请重新登录后再操作。';
    if (error.response?.status === 403) return '当前账号没有操作权限。';
    const text = error.response?.data?.error;
    if (typeof text === 'string' && /[\u4e00-\u9fff]/.test(text)) return text;
    if (!error.response) return '网络连接中断，请检查网络后重试。';
  }
  if (error instanceof Error && /[\u4e00-\u9fff]/.test(error.message)) return error.message;
  return '操作暂时未完成，请稍后重试。';
}
export function quantificationErrorCode(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.code === 'string' ? error.response.data.code : '';
}
export const quantificationBytes = (size: number) => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${(size / 1024).toFixed(1)} KB`;
export const quantificationDate = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未设置';
export function collectionAvailability(c: QuantificationCollection): QuantificationCollection['availability'] {
  if (c.status === 'draft') return 'draft';
  if (c.status === 'closed' || (c.deadline && Date.parse(c.deadline) <= Date.now())) return 'closed';
  if (c.startAt && Date.parse(c.startAt) > Date.now()) return 'scheduled';
  return 'open';
}
export const collectionStatusLabel = { draft: '未发布', scheduled: '尚未开始', open: '开放提交', closed: '已截止' };
