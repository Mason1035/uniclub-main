import api from './axios';
import { clearSession, readToken } from './session';

export class AiRequestError extends Error {
  constructor(message: string, public code = 'AI_ERROR') { super(message); this.name = 'AiRequestError'; }
}

export interface AiStreamStatus { phase: 'searching' | 'reasoning' | 'answering'; message: string; }
interface StreamOptions<TResult> {
  signal: AbortSignal;
  onDelta: (text: string) => void;
  onStatus?: (status: AiStreamStatus) => void;
  validateResult?: (value: unknown) => value is TResult;
  forbiddenMessage?: string;
  tooLargeMessage?: string;
}

const serverMessage = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length <= 300 && /[\u4e00-\u9fff]/.test(value) ? value : fallback;

// Both AI surfaces use this decoder, including split UTF-8 / SSE boundaries.
// A final result is required: partial text from a broken connection is not a reply.
export async function readAiStream<TResult>(response: Response, options: StreamOptions<TResult>): Promise<TResult> {
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new AiRequestError('AI 响应格式异常，请重试。', 'INVALID_RESPONSE');
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', result: TResult | undefined, outputLength = 0;
  const consume = (block: string) => {
    const lines = block.split('\n');
    const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    const raw = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
    if (!raw) return;
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); } catch { throw new AiRequestError('AI 响应格式异常，请重试。', 'INVALID_RESPONSE'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AiRequestError('AI 响应格式异常，请重试。', 'INVALID_RESPONSE');
    if (event === 'error') throw new AiRequestError(serverMessage(data.error, 'AI 暂时无法回答，请稍后再试。'), typeof data.code === 'string' ? data.code : 'AI_ERROR');
    if (event === 'delta' && typeof data.text === 'string') {
      outputLength += data.text.length;
      if (outputLength > 1024 * 1024) throw new AiRequestError('AI 回答过长，请缩小问题范围。', 'OUTPUT_TOO_LONG');
      options.onDelta(data.text);
    }
    if (event === 'status' && ['searching', 'reasoning', 'answering'].includes(String(data.phase)) && typeof data.message === 'string') {
      options.onStatus?.({ phase: data.phase as AiStreamStatus['phase'], message: data.message.slice(0, 300) });
    }
    if (event === 'result') {
      if (options.validateResult && !options.validateResult(data)) throw new AiRequestError('AI 响应格式异常，请重试。', 'INVALID_RESPONSE');
      result = data as TResult;
    }
  };
  const abort = () => { void reader.cancel().catch(() => undefined); };
  options.signal.addEventListener('abort', abort, { once: true });
  try {
    if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    for (;;) {
      const chunk = await reader.read();
      if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      pending = (pending + decoder.decode(chunk.value, { stream: !chunk.done })).replace(/\r\n/g, '\n');
      if (pending.length > 1024 * 1024) throw new AiRequestError('AI 回答过长，请缩小问题范围。', 'OUTPUT_TOO_LONG');
      let end: number;
      while ((end = pending.indexOf('\n\n')) !== -1) { consume(pending.slice(0, end)); pending = pending.slice(end + 2); }
      if (result !== undefined) return result;
      if (chunk.done) break;
    }
    if (pending.trim()) consume(pending);
    if (result === undefined) throw new AiRequestError('AI 连接中断，回答未完整接收，请重试。', 'INCOMPLETE_STREAM');
    return result;
  } catch (error) {
    if (options.signal.aborted || error instanceof AiRequestError) throw error;
    throw new AiRequestError('AI 连接中断，请检查网络后重试。', 'NETWORK_ERROR');
  } finally {
    options.signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => undefined); reader.releaseLock();
  }
}

// Fetch streaming shares the ordinary API origin, JWT and session-expiry logic.
// It deliberately leaves Content-Type unset for the administrator's FormData.
export async function postAiStream<TResult>(path: string, body: BodyInit, options: StreamOptions<TResult>, headers: Record<string, string> = {}): Promise<TResult> {
  const token = readToken();
  let response: Response;
  try {
    response = await fetch(`${(api.defaults.baseURL || '').replace(/\/$/, '')}${path}`, {
      method: 'POST', headers: { Accept: 'text/event-stream', ...(token && { Authorization: `Bearer ${token}` }), ...headers }, body, signal: options.signal,
    });
  } catch (error) {
    if (options.signal.aborted) throw error;
    throw new AiRequestError('无法连接网站服务，请检查网络后重试。', 'NETWORK_ERROR');
  }
  if (response.status === 401 && token && token === readToken()) {
    clearSession(); window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  if (!response.ok) {
    const raw = await response.json().catch(() => ({}));
    const data = raw && typeof raw === 'object' ? raw : {};
    const fallback = response.status === 401 ? '登录已过期，请重新登录。'
      : response.status === 403 ? options.forbiddenMessage || '此账号暂时无法使用 AI，请联系管理员。'
      : response.status === 413 ? options.tooLargeMessage || '问题过长，请缩短后重试。'
      : response.status === 429 ? '提问太频繁，请稍后再试。' : 'AI 暂时无法回答，请稍后再试。';
    throw new AiRequestError(response.status === 401 || response.status === 403 ? fallback : serverMessage(data.error, fallback), typeof data.code === 'string' ? data.code : 'HTTP_ERROR');
  }
  return readAiStream(response, options);
}
