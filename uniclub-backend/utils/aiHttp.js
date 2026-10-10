const rateLimit = require('express-rate-limit');
const { AiError } = require('./aiSecret');

// One in-flight generation per authenticated account across both AI surfaces.
// Like the existing limiter, this is process-local, not a distributed quota.
const active = new Set();
function createAiRateLimiter(limit, message = 'AI 请求次数较多，请稍后再试。') {
  return rateLimit({
    windowMs: 10 * 60 * 1000, limit, keyGenerator: req => req.user.userId,
    standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: message, code: 'AI_RATE_LIMIT' },
  });
}

const defaultError = error => error instanceof AiError ? error : new AiError('AI_INTERNAL_ERROR', 'AI 服务暂时无法响应，请稍后重试。', 503);
function sendAiError(res, error, streaming = false, mapError = defaultError) {
  const safe = mapError(error);
  // Only known codes/statuses. Provider errors can contain credentials/prompts.
  if (safe.code !== 'CANCELLED') console.warn('AI request', { code: safe.code, status: safe.status });
  if (res.destroyed || res.writableEnded) return;
  const body = { error: safe.message, code: safe.code };
  if (streaming) res.write(`event: error\ndata: ${JSON.stringify(body)}\n\n`);
  else res.status(safe.status).json(body);
}

// Shared SSE framing, heartbeat, deadline and disconnect cancellation. A race
// releases resources even if an injected/upstream service ignores cancellation.
function aiRequest(handler, { prepare, requestTimeoutMs = 240000, mapError = defaultError, releaseBody = false } = {}) {
  return async (req, res) => {
    const userId = String(req.user.userId);
    if (active.has(userId)) return res.status(409).json({ error: '当前已有 AI 请求正在处理，请稍候。', code: 'AI_BUSY' });
    active.add(userId);
    const controller = new AbortController();
    let streaming = false, heartbeat, timedOut = false, rejectAbort;
    const cancelled = new Promise((_resolve, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(new AiError('CANCELLED', '请求已取消。', 499));
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const deadline = setTimeout(() => { timedOut = true; controller.abort(); }, requestTimeoutMs); deadline.unref?.();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    const emit = (event, data) => {
      if (streaming && !controller.signal.aborted && !res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const execute = async () => {
      await prepare?.(req, res);
      if (controller.signal.aborted) throw new AiError('CANCELLED', '请求已取消。', 499);
      streaming = req.get('accept')?.includes('text/event-stream') === true;
      if (streaming) {
        res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no', 'Cache-Control': 'no-cache, no-store' });
        res.flushHeaders();
        heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': heartbeat\n\n'); }, 15000); heartbeat.unref?.();
      }
      const result = await handler(req, {
        signal: controller.signal,
        ...(streaming && { onDelta: text => emit('delta', { text }), onStatus: status => emit('status', status) }),
      });
      if (controller.signal.aborted) throw new AiError('CANCELLED', '请求已取消。', 499);
      return result;
    };
    try {
      const result = await Promise.race([execute(), cancelled]);
      if (streaming) emit('result', result);
      else if (!res.destroyed) res.json(result);
    } catch (error) {
      if (timedOut) sendAiError(res, new AiError('PROVIDER_TIMEOUT', 'AI 请求超时，请稍后重试。', 504), streaming, mapError);
      else if (!controller.signal.aborted) sendAiError(res, error, streaming, mapError);
    } finally {
      clearTimeout(deadline); clearInterval(heartbeat);
      controller.signal.removeEventListener('abort', onAbort); res.off('close', disconnect); active.delete(userId);
      if (releaseBody) { req.body = undefined; req.files = undefined; }
      if (streaming && !res.destroyed && !res.writableEnded) res.end();
    }
  };
}

module.exports = { createAiRateLimiter, sendAiError, aiRequest };
