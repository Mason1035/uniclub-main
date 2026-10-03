/**
 * Gemini 客户端（全项目唯一的 AI 出口）。
 *
 * 用 axios 而不是 @google/genai SDK，原因：
 *   1. axios 已经是本项目的依赖，且原生支持代理配置；
 *   2. Node 的 fetch(undici) 默认**不读** HTTP(S)_PROXY 环境变量，
 *      SDK 走 fetch，在国内网络下会直接 "fetch failed"；
 *   3. 只需一个 REST 端点，没必要为一个调用引一整套 SDK。
 *
 * 代理配置（可选，按顺序取第一个非空值）：
 *   GEMINI_PROXY > HTTPS_PROXY > https_proxy
 * 例如在 uniclub-backend/.env 里写：GEMINI_PROXY=http://127.0.0.1:7890
 *
 * 导出的 generateText(prompt, { maxTokens, temperature }) 签名保持不变，
 * 新闻策展、AI 摘要、聊天等既有调用方无需改动。
 */
const axios = require('axios');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 60000;

/** 解析代理地址，返回 axios 需要的 { protocol, host, port, auth? }。 */
const resolveProxy = () => {
  const raw = process.env.GEMINI_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
      ...(url.username
        ? {
            auth: {
              username: decodeURIComponent(url.username),
              password: decodeURIComponent(url.password),
            },
          }
        : {}),
    };
  } catch {
    console.warn('⚠️ GEMINI_PROXY 不是合法 URL，已忽略:', raw);
    return null;
  }
};

const proxy = resolveProxy();

/** 供 /api/admin/ai/status 展示当前配置（不泄露 key）。 */
const describeConfig = () => ({
  configured: Boolean(process.env.GEMINI_API_KEY),
  model: MODEL,
  proxy: proxy ? `${proxy.protocol}://${proxy.host}:${proxy.port}` : null,
});

async function generateText(prompt, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in the environment');
  }

  const generationConfig = {};
  if (typeof options.maxTokens === 'number') {
    generationConfig.maxOutputTokens = options.maxTokens;
  }
  if (typeof options.temperature === 'number') {
    generationConfig.temperature = options.temperature;
  }

  const { data } = await axios.post(
    `${API_BASE}/models/${MODEL}:generateContent`,
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    },
    {
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: TIMEOUT_MS,
      ...(proxy ? { proxy } : {}),
    }
  );

  const parts =
    (data && data.candidates && data.candidates[0] && data.candidates[0].content
      ? data.candidates[0].content.parts
      : null) || [];

  // 思考型模型会返回标记为 thought 的内部推理，只保留可见输出
  return parts
    .filter((part) => !part.thought)
    .map((part) => part.text || '')
    .join('');
}

module.exports = { generateText, describeConfig, MODEL };
