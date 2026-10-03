import api from '@/lib/axios';
import { clearSession, readToken } from '@/lib/session';
import type { AiGeneration, AiSettings, AiStatus, HistoryMessage, Scenario } from './types';

export class AiRequestError extends Error {
  constructor(message: string, public code = 'AI_ERROR') { super(message); }
}
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
  const token = readToken();
  let response: Response;
  try {
    response = await fetch(`${(api.defaults.baseURL || '').replace(/\/$/, '')}/api/admin/ai/generate`, {
      method: 'POST', headers: { Accept: 'text/event-stream', ...(token && { Authorization: `Bearer ${token}` }) }, body, signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AiRequestError('无法连接网站服务，请检查网络后重试。', 'NETWORK_ERROR');
  }
  if (response.status === 401 && token === readToken()) {
    clearSession(); window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = response.status === 401 ? '登录已过期，请重新登录。' : response.status === 403 ? '此账号没有管理员权限。' : response.status === 413 ? '上传内容过大，请缩小图片后重试。' : data.error || '网站 AI 服务暂时无法响应。';
    throw new AiRequestError(message, data.code || 'HTTP_ERROR');
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new AiRequestError('AI 响应格式异常，请重新生成。', 'INVALID_RESPONSE');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', result: AiGeneration | null = null;
  const consume = (block: string) => {
    const lines = block.split('\n');
    const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    const raw = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch { throw new AiRequestError('AI 响应格式异常，请重新生成。', 'INVALID_RESPONSE'); }
    if (event === 'error') throw new AiRequestError(data.error || 'AI 服务异常，请重试。', data.code);
    if (event === 'delta' && typeof data.text === 'string') onDelta(data.text);
    if (event === 'result') result = data as AiGeneration;
  };
  try {
    for (;;) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      if (pending.length > 1024 * 1024) throw new AiRequestError('AI 响应过长，请缩小问题范围。', 'OUTPUT_TOO_LONG');
      let end;
      while ((end = pending.indexOf('\n\n')) !== -1) { consume(pending.slice(0, end)); pending = pending.slice(end + 2); }
      if (chunk.done) break;
    }
    if (pending.trim()) consume(pending);
    if (!result) throw new AiRequestError('AI 连接中断，结果未完整接收，请重新生成。', 'INCOMPLETE_STREAM');
    return result;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
