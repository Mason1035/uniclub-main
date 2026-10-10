import api from '@/lib/axios';
import { AiRequestError, postAiStream } from '@/lib/aiStream';
import type { AiGeneration, AiSettings, AiStatus, HistoryMessage, Scenario } from './types';

export { AiRequestError } from '@/lib/aiStream';
export function aiErrorMessage(error: unknown): string {
  if (error instanceof AiRequestError) return error.message;
  const e = error as { response?: { status?: number; data?: { error?: string } }; message?: string; code?: string };
  if (e.response?.status === 401) return '登录已过期，请重新登录。';
  if (e.response?.status === 403) return '此账号没有管理员权限。';
  if (typeof e.response?.data?.error === 'string' && /[\u4e00-\u9fff]/.test(e.response.data.error)) return e.response.data.error;
  if (e.response?.status === 400) return '字段不完整或不符合栏目要求，请检查后重试。';
  if (e.response?.status && e.response.status >= 500) return 'ClassHub 服务暂时无法响应，请稍后重试。';
  if (e.code === 'ECONNABORTED') return '请求超时，请稍后重试。';
  return '无法连接网站服务，请检查网络后重试。';
}
export const getAiStatus = async (): Promise<AiStatus> => (await api.get('/api/admin/ai/status')).data;
export const saveAiKey = async (apiKey: string): Promise<AiSettings> => (await api.put('/api/admin/ai/settings', { apiKey })).data;
export const deleteAiKey = async (): Promise<AiSettings> => (await api.delete('/api/admin/ai/settings')).data;
export const testAiConnection = async (): Promise<{ message: string; elapsedMs: number }> => (await api.post('/api/admin/ai/test', {}, { timeout: 130000 })).data;

// Fetch handles SSE in browsers; base URL/JWT are shared with the normal API
// client. Images stay as File objects in this page's memory, never storage.
export async function generateAi(payload: { scenario: Scenario; prompt: string; history: HistoryMessage[]; images: File[] }, signal: AbortSignal, onDelta: (text: string) => void): Promise<AiGeneration> {
  const body = new FormData();
  body.append('scenario', payload.scenario); body.append('prompt', payload.prompt); body.append('history', JSON.stringify(payload.history));
  payload.images.forEach(file => body.append('images', file));
  return postAiStream<AiGeneration>('/api/admin/ai/generate', body, {
    signal, onDelta,
    forbiddenMessage: '此账号没有管理员权限。',
    tooLargeMessage: '上传内容过大，请缩小图片后重试。',
    validateResult: (value): value is AiGeneration => !!value && typeof value === 'object' && typeof (value as AiGeneration).answer === 'string',
  });
}
