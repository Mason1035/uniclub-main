const { AiError } = require('../utils/aiSecret');
const { plainText } = require('../utils/newsAiContext');
const { safeWebUrl } = require('../utils/webSafety');

const clean = (value, limit) => plainText(typeof value === 'string' ? value : '').slice(0, limit);
const cancelled = () => new AiError('CANCELLED', '请求已取消。', 499);
const unavailable = () => new AiError('SEARCH_UNAVAILABLE', '联网检索暂不可用，本次无法核实网上的最新信息。', 503);

// General web search uses the configured DeepSeek key and a fixed provider
// endpoint. We never fetch an arbitrary URL or forward site/memory context.
// Contract: https://api-docs.deepseek.com/api/search/
class AssistantWebSearch {
  constructor({ assistant } = {}) {
    this.assistant = assistant || new (require('./DeepSeekAssistant').DeepSeekAssistant)();
  }
  async search(question, { signal } = {}) {
    if (signal?.aborted) throw cancelled();
    if (typeof question !== 'string' || !question.trim()) throw new AiError('INVALID_QUESTION', '请输入要检索的问题。', 400);
    const query = Array.from(question.trim()).slice(0, 128).join('');
    const key = await this.assistant.apiKey();
    if (signal?.aborted) throw cancelled();
    let data;
    try {
      const response = await this.assistant.http.post('/v1/tools/search', { query, count: 4, need_content: false }, {
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        signal, timeout: 15000, maxRedirects: 0, responseType: 'json', maxContentLength: 1024 * 1024,
      });
      data = response.data;
    } catch {
      if (signal?.aborted) throw cancelled();
      throw unavailable();
    }
    if (signal?.aborted) throw cancelled();
    if (!Array.isArray(data?.results)) throw unavailable();
    const seen = new Set(), sources = [];
    for (const row of data.results.slice(0, 50)) {
      let url;
      try { url = safeWebUrl(row?.url).href; } catch { continue; }
      const title = clean(row.title, 240), text = clean(row.summary || row.snippet, 1800);
      if (!title || !text || seen.has(url)) continue;
      seen.add(url);
      sources.push({ id: `web-${sources.length + 1}`, title, url, type: 'web', text, snippet: clean(row.snippet || row.summary, 240) });
      if (sources.length === 4) break;
    }
    return { sources, performed: true };
  }
}
module.exports = { AssistantWebSearch };
