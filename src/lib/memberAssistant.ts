import { isAxiosError } from 'axios';
import api from './axios';
import { AiRequestError, postAiStream, type AiStreamStatus } from './aiStream';

export interface AssistantSource { id: string; title: string; url: string; type: 'site' | 'web'; snippet?: string; }
export interface AssistantUsage { promptTokens: number; completionTokens: number; totalTokens: number; reported: boolean; }
export interface AssistantMessage { id: string; role: 'user' | 'assistant'; content: string; imageCount?: number; sources?: AssistantSource[]; warning?: string | null; usage?: AssistantUsage; }
export interface AssistantQuota { limit: number; windowHours: number; usedTokens: number; reservedTokens: number; remainingTokens: number; resetAt: string | null; blocked: boolean; }
export interface AssistantStatus { quota?: AssistantQuota; configured: boolean; model: string; memoryEnabled: boolean; visionSupported?: boolean; limits: { prompt: number; images: number; imageBytes: number }; }
export interface AssistantResult { answer: string; sources: AssistantSource[]; warning?: string | null; usage: AssistantUsage; requestId: string; localAction?: 'memory_saved' | 'random_call'; quota?: AssistantQuota; }
export interface MemoryEntry { id: string; text: string; createdAt: string; updatedAt: string; }
export interface AssistantMemory { enabled: boolean; entries: MemoryEntry[]; }

// Citation URLs come only from retrieval metadata; never turn model-generated
// schemes, protocol-relative links or embedded credentials into navigation.
export function safeAssistantSources(value: unknown): AssistantSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AssistantSource[] => {
    if (!item || typeof item.title !== 'string' || typeof item.url !== 'string' || !['site', 'web'].includes(item.type)) return [];
    let url = item.url;
    if (item.type === 'site') {
      if (!/^\/(?!\/)/.test(url) || [...url].some(character => character.charCodeAt(0) <= 32 || character === '\\')) return [];
    } else {
      try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return []; url = parsed.href; }
      catch { return []; }
    }
    return [{ id: typeof item.id === 'string' ? item.id : url, title: item.title.slice(0, 200), url, type: item.type, ...(typeof item.snippet === 'string' && { snippet: item.snippet.slice(0, 500) }) }];
  }).slice(0, 10);
}

export function boundedAssistantHistory(messages: Pick<AssistantMessage, 'role' | 'content'>[]) {
  let remaining = 16000;
  return messages.filter(message => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string').slice(-10).reverse().flatMap(message => {
    if (remaining <= 0) return [];
    const content = message.content.slice(-remaining); remaining -= content.length;
    return content ? [{ role: message.role, content }] : [];
  }).reverse();
}
export function validateAssistantImages(files: Pick<File, 'type' | 'size'>[]): string | null {
  if (files.length > 4) return '一次最多上传 4 张照片。';
  if (files.some(file => !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type))) return '请选择 JPG、PNG、GIF 或 WebP 图片。';
  if (files.some(file => file.size > 2 * 1024 * 1024)) return '每张图片请控制在 2 MB 以内。';
  return null;
}

export async function getAssistantQuota(signal: AbortSignal): Promise<AssistantQuota> { const { data } = await api.get('/api/assistant/quota', { signal }); return data; }
export async function getAssistantStatus(signal: AbortSignal): Promise<AssistantStatus> {
  const { data } = await api.get('/api/assistant/status', { signal }); return data;
}
export async function askAssistant(prompt: string, history: AssistantMessage[], files: File[], webSearch: boolean, signal: AbortSignal, onDelta: (text: string) => void, onStatus: (status: AiStreamStatus) => void): Promise<AssistantResult> {
  const body = new FormData(); body.set('prompt', prompt); body.set('history', JSON.stringify(boundedAssistantHistory(history))); body.set('webSearch', String(webSearch));
  files.forEach(file => body.append('images', file));
  const result = await postAiStream<AssistantResult>('/api/assistant/chat', body, {
    signal, onDelta, onStatus,
    tooLargeMessage: '上传内容过大，请减少图片或缩短问题后重试。',
    validateResult: (value): value is AssistantResult => !!value && typeof value === 'object' && typeof (value as AssistantResult).answer === 'string',
  });
  return { ...result, sources: safeAssistantSources(result.sources), warning: typeof result.warning === 'string' ? result.warning : null };
}
export async function getAssistantMemory(signal: AbortSignal): Promise<AssistantMemory> { const { data } = await api.get('/api/assistant/memory', { signal }); return data; }
export async function setMemoryEnabled(enabled: boolean, signal: AbortSignal) { const { data } = await api.patch('/api/assistant/memory', { enabled }, { signal }); return data as AssistantMemory; }
export async function saveMemory(text: string, id: string | null, signal: AbortSignal) { if (id) await api.patch(`/api/assistant/memory/${encodeURIComponent(id)}`, { text }, { signal }); else await api.post('/api/assistant/memory', { text }, { signal }); }
export async function removeMemory(id: string, signal: AbortSignal) { await api.delete(`/api/assistant/memory/${encodeURIComponent(id)}`, { signal }); }
export async function exportMemory(signal: AbortSignal): Promise<Blob> { const { data } = await api.get('/api/assistant/memory/export', { signal, responseType: 'blob' }); return data; }
export function assistantError(error: unknown): string {
  if (error instanceof AiRequestError) return error.message;
  if (isAxiosError<{ error?: string }>(error)) {
    if (error.response?.status === 401) return '登录已过期，请重新登录。';
    if (error.response?.status === 429 && (error.response?.data as { code?: string })?.code !== 'AI_QUOTA_EXCEEDED') return '当前请求较多，请稍后再试。';
    const message = error.response?.data?.error;
    if (typeof message === 'string' && message.length <= 300 && /[\u4e00-\u9fff]/.test(message)) return message;
  }
  return '暂时无法连接 AI 服务，请稍后重试。';
}

export interface FeedbackDraft { title: string; description: string; expected: string; page: string; }
export interface FeedbackResult { answer: string; draft: FeedbackDraft | null; usage?: AssistantUsage; requestId: string; quota?: AssistantQuota; }
export interface FeedbackReceipt { id: string; status: 'new'; createdAt: string; }
export async function askAssistantFeedback(prompt: string, history: Pick<AssistantMessage, 'role' | 'content'>[], page: string, signal: AbortSignal, onDelta: (text: string) => void, onStatus: (status: AiStreamStatus) => void): Promise<FeedbackResult> {
  return postAiStream<FeedbackResult>('/api/assistant/feedback/chat', JSON.stringify({ prompt, history: boundedAssistantHistory(history), page }), {
    signal, onDelta, onStatus,
    validateResult: (value): value is FeedbackResult => !!value && typeof value === 'object' && typeof (value as FeedbackResult).answer === 'string' && ((value as FeedbackResult).draft === null || validFeedbackDraft((value as FeedbackResult).draft)),
  }, { 'Content-Type': 'application/json' });
}
function validFeedbackDraft(value: unknown): value is FeedbackDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as FeedbackDraft;
  return [draft.title, draft.description, draft.expected, draft.page].every(field => typeof field === 'string')
    && draft.title.length <= 120 && draft.description.length <= 3000 && draft.expected.length <= 1500 && draft.page.length <= 300;
}
export async function submitAssistantFeedback(draft: FeedbackDraft, requestId: string, signal: AbortSignal): Promise<FeedbackReceipt> {
  const { data } = await api.post('/api/assistant/feedback', { ...draft, requestId }, { signal }); return data;
}
export function isAssistantQuotaError(error: unknown): boolean {
  return error instanceof AiRequestError && error.code === 'AI_QUOTA_EXCEEDED';
}
