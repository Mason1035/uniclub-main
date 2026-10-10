import { isAxiosError } from 'axios';
import api from './axios';
import { AiRequestError, postAiStream, type AiStreamStatus } from './aiStream';

export const NEWS_QUESTION_LIMIT = 1000;
export interface NewsChatSource { title: string; url: string; }
export interface NewsChatMessage {
  role: 'user' | 'assistant'; content: string; timestamp?: string;
  sources?: NewsChatSource[]; warning?: string | null; reasoning?: boolean;
}
export interface NewsChatResult {
  messages: NewsChatMessage[]; answer: string; sources: NewsChatSource[]; warning: string | null;
  reasoning: boolean; usedWebSearch: boolean; elapsedMs: number;
}

// Sources come only from server retrieval metadata. Never infer citations from
// generated prose, and never allow non-web URL schemes to become clickable.
export function safeNewsSources(value: unknown): NewsChatSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item.title !== 'string' || typeof item.url !== 'string') return [];
    try {
      const url = new URL(item.url);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? [{ title: item.title.slice(0, 200), url: url.href }] : [];
    } catch { return []; }
  }).slice(0, 4);
}

function readMessages(value: unknown): NewsChatMessage[] {
  if (!Array.isArray(value)) throw new AiRequestError('聊天记录格式异常，请重新加载。', 'INVALID_RESPONSE');
  return value.filter(message => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string').slice(-20).map(message => ({
    role: message.role, content: message.content,
    timestamp: typeof message.timestamp === 'string' ? message.timestamp : undefined,
    sources: safeNewsSources(message.sources),
    warning: typeof message.warning === 'string' ? message.warning : null,
    reasoning: message.reasoning === true,
  }));
}

export async function getNewsChat(articleId: string, signal: AbortSignal): Promise<NewsChatMessage[]> {
  const { data } = await api.get(`/api/chat/${encodeURIComponent(articleId)}`, { signal });
  return readMessages(Array.isArray(data) ? data : data?.messages);
}

export async function askNews(articleId: string, question: string, signal: AbortSignal, onDelta: (text: string) => void, onStatus: (status: AiStreamStatus) => void): Promise<NewsChatResult> {
  // Only the question and article ID cross this boundary. News context and
  // previous turns are loaded and bounded by the existing backend chat route.
  const result = await postAiStream<NewsChatResult>(`/api/chat/${encodeURIComponent(articleId)}`, JSON.stringify({ content: question }), {
    signal, onDelta, onStatus,
    validateResult: (value): value is NewsChatResult => !!value && typeof value === 'object'
      && Array.isArray((value as NewsChatResult).messages) && typeof (value as NewsChatResult).answer === 'string',
  }, { 'Content-Type': 'application/json' });
  const messages = readMessages(result.messages), sources = result.usedWebSearch ? safeNewsSources(result.sources) : [];
  const warning = typeof result.warning === 'string' ? result.warning : null;
  const last = messages[messages.length - 1];
  if (last?.role === 'assistant') { last.sources = sources; last.warning = warning; last.reasoning = result.reasoning === true; }
  return { ...result, messages, sources, warning };
}

export function newsChatError(error: unknown): string {
  if (error instanceof AiRequestError) return error.message;
  if (isAxiosError<{ error?: string }>(error)) {
    if (error.response?.status === 401) return '登录已过期，请重新登录。';
    if (error.response?.status === 404) return '这篇新闻已不存在，无法继续问答。';
    if (error.response?.status === 429) return '提问太频繁，请稍后再试。';
    const message = error.response?.data?.error;
    if (typeof message === 'string' && message.length <= 300 && /[\u4e00-\u9fff]/.test(message)) return message;
    if (error.code === 'ECONNABORTED') return '请求超时，请稍后重试。';
  }
  return 'AI 暂时无法回答，请检查网络或稍后再试。';
}
