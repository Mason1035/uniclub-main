const axios = require('axios');
const AiSettings = require('../models/AiSettings');
const { AiError, encrypt, decrypt } = require('../utils/aiSecret');
const { SCENARIOS, EXAMPLES, systemPrompt } = require('../utils/aiPrompts');
const { LIMITS, validateInput, imageParts, parseStructured } = require('../utils/aiValidation');

const MODEL = 'deepseek-flash';
const BASE_URL = 'https://api.deepseek.com';
const publicSettings = doc => ({
  configured: doc?.configured === true, provider: 'deepseek', model: MODEL,
  last4: doc?.configured ? doc.last4 || '' : '',
  updatedAt: doc?.updatedAt || null,
  updatedBy: doc?.updatedBy ? String(doc.updatedBy) : null,
});

function providerError(error) {
  if (error instanceof AiError) return error;
  const status = error.response?.status;
  if (status === 401 || status === 403) return new AiError('INVALID_API_KEY', 'DeepSeek API Key 无效或权限不足，请更换密钥。', 502);
  if (status === 402) return new AiError('INSUFFICIENT_BALANCE', 'DeepSeek 余额或额度不足，请充值后重试。', 502);
  if (status === 429) return new AiError('PROVIDER_RATE_LIMIT', 'DeepSeek 请求过于频繁，请稍后重试。', 429);
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return new AiError('PROVIDER_TIMEOUT', 'DeepSeek 请求超时，请稍后重试。', 504);
  if (error.code === 'ERR_CANCELED' || error.name === 'AbortError') return new AiError('CANCELLED', '请求已取消。', 499);
  if (status === 400 || status === 422) return new AiError('PROVIDER_BAD_REQUEST', 'DeepSeek 无法处理本次输入，请检查图片与文字后重试。', 502);
  if (status >= 500) return new AiError('PROVIDER_UNAVAILABLE', 'DeepSeek 服务异常，请稍后重试。', 502);
  return new AiError('PROVIDER_NETWORK', '无法连接 DeepSeek，请检查服务器网络后重试。', 502);
}

class DeepSeekAssistant {
  constructor({ settingsModel = AiSettings, httpClient } = {}) {
    this.settings = settingsModel;
    this.http = httpClient || axios.create({ baseURL: BASE_URL, proxy: false, timeout: 120000, maxRedirects: 0, maxContentLength: 1024 * 1024, maxBodyLength: 20 * 1024 * 1024 });
  }
  async getSettings() { return publicSettings(await this.settings.findById('deepseek').lean()); }
  async saveKey(value, adminId) {
    if (typeof value !== 'string' || !/^sk-[A-Za-z0-9_-]{16,250}$/.test(value.trim())) throw new AiError('INVALID_KEY_FORMAT', '请输入完整的 DeepSeek API Key（sk- 开头）。');
    const key = value.trim();
    const doc = await this.settings.findOneAndUpdate({ _id: 'deepseek' }, {
      $set: { configured: true, secret: encrypt(key), last4: key.slice(-4), updatedBy: adminId },
    }, { upsert: true, new: true, runValidators: true }).lean();
    return publicSettings(doc);
  }
  async deleteKey(adminId) {
    const doc = await this.settings.findOneAndUpdate({ _id: 'deepseek' }, {
      $set: { configured: false, last4: '', updatedBy: adminId }, $unset: { secret: 1 },
    }, { upsert: true, new: true, runValidators: true }).lean();
    return publicSettings(doc);
  }
  async apiKey() {
    const doc = await this.settings.findById('deepseek').select('+secret').lean();
    if (!doc?.configured) throw new AiError('NOT_CONFIGURED', '尚未配置 DeepSeek API Key，请先配置密钥。', 503);
    return decrypt(doc.secret);
  }
  async completion(key, messages, { json = false, onDelta, signal, maxTokens = 4096 } = {}) {
    let response;
    try {
      response = await this.http.post('/chat/completions', {
        model: MODEL, messages, thinking: { type: 'disabled' }, max_tokens: maxTokens,
        ...(json && { response_format: { type: 'json_object' } }),
        stream: Boolean(onDelta), ...(onDelta && { stream_options: { include_usage: true } }),
      }, {
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal,
        ...(onDelta && { responseType: 'stream' }),
      });
      if (!onDelta) {
        const answer = response.data?.choices?.[0]?.message?.content;
        if (typeof answer !== 'string' || !answer.trim()) throw new AiError('EMPTY_OUTPUT', 'DeepSeek 没有返回内容，请重新生成。', 502);
        if (answer.length > LIMITS.answer) throw new AiError('OUTPUT_TOO_LONG', 'AI 回答过长，请缩小问题范围后重试。', 502);
        return { answer, truncated: response.data.choices[0].finish_reason === 'length' };
      }
      let pending = '', answer = '', finished = false, truncated = false;
      const consume = async line => {
        if (!line.startsWith('data:')) return;
        const payload = line.slice(5).trim();
        if (!payload) return;
        if (payload === '[DONE]') { finished = true; return; }
        let chunk;
        try { chunk = JSON.parse(payload); } catch { throw new AiError('INVALID_PROVIDER_STREAM', 'DeepSeek 响应格式异常，请重新生成。', 502); }
        if (chunk.error) throw new AiError('PROVIDER_UNAVAILABLE', 'DeepSeek 服务异常，请稍后重试。', 502);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          answer += delta;
          if (answer.length > LIMITS.answer) throw new AiError('OUTPUT_TOO_LONG', 'AI 回答过长，请缩小问题范围后重试。', 502);
          await onDelta(delta);
        }
        if (chunk.choices?.[0]?.finish_reason === 'length') truncated = true;
      };
      response.data.setEncoding('utf8');
      for await (const piece of response.data) {
        pending += piece;
        if (pending.length > 1024 * 1024) throw new AiError('INVALID_PROVIDER_STREAM', 'DeepSeek 响应格式异常，请重新生成。', 502);
        let index;
        while ((index = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, index).replace(/\r$/, ''); pending = pending.slice(index + 1);
          await consume(line);
        }
      }
      if (pending.trim()) await consume(pending.trim());
      if (!finished) throw new AiError('INCOMPLETE_STREAM', 'DeepSeek 连接中断，回答未完整接收，请重新生成。', 502);
      if (!answer.trim()) throw new AiError('EMPTY_OUTPUT', 'DeepSeek 没有返回内容，请重新生成。', 502);
      return { answer, truncated };
    } catch (error) {
      // axios errors contain headers and image bodies: never log/serialize them.
      response?.data?.destroy?.(); error.response?.data?.destroy?.();
      throw providerError(error);
    }
  }
  async testConnection(signal) {
    const started = Date.now();
    await this.completion(await this.apiKey(), [{ role: 'user', content: '请只回复 OK' }], { maxTokens: 16, signal });
    return { success: true, provider: 'deepseek', model: MODEL, elapsedMs: Date.now() - started, message: 'DeepSeek 连接正常。' };
  }
  async generate(body, files, { onDelta, signal } = {}) {
    const started = Date.now(), input = validateInput(body);
    const parts = await imageParts(files), key = await this.apiKey();
    const messages = [
      { role: 'system', content: systemPrompt(input.scenario) }, ...input.history,
      { role: 'user', content: parts.length ? [{ type: 'text', text: input.prompt }, ...parts] : input.prompt },
    ];
    const json = Boolean(EXAMPLES[input.scenario]);
    const first = await this.completion(key, messages, { json, onDelta, signal });
    let structured = null, answer = first.answer, warning = first.truncated ? 'AI 回答达到长度上限，可能不完整。' : null;
    if (json) {
      try {
        if (first.truncated) throw new Error('Truncated');
        structured = parseStructured(input.scenario, answer);
      } catch {
        try {
          const repaired = await this.completion(key, [...messages,
            { role: 'assistant', content: answer },
            { role: 'user', content: '上一条未符合要求。请按照 system 中的 JSON 结构修复一次，字段必须完整且类型正确，遵守字数上限；未知信息留空，不能增加事实，只返回 json。' },
          ], { json: true, signal });
          if (repaired.truncated) throw new Error('Truncated');
          structured = parseStructured(input.scenario, repaired.answer);
          answer = repaired.answer; warning = null;
        } catch (error) {
          if (signal?.aborted) throw error;
          warning = 'AI 返回内容无法转换为发布格式，请检查后手动处理。';
        }
      }
    }
    return { success: true, scenario: input.scenario, publishType: structured ? SCENARIOS[input.scenario].publishType : null, answer, structured, warning, elapsedMs: Date.now() - started };
  }
}

module.exports = { DeepSeekAssistant, publicSettings, providerError, MODEL, BASE_URL };
