const sharp = require('sharp');
const { AiError } = require('./aiSecret');
const { SCENARIOS, EXAMPLES } = require('./aiPrompts');
const Event = require('../models/Event');
const News = require('../models/News');
const Resource = require('../models/Resource');

const LIMITS = { prompt: 8000, historyMessages: 12, historyChars: 32000, answer: 40000, images: 4, imageBytes: 2 * 1024 * 1024 };
const MIME = { jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };

function validateInput(body) {
  if (!body || typeof body !== 'object' || typeof body.scenario !== 'string' || !Object.hasOwn(SCENARIOS, body.scenario)) throw new AiError('INVALID_SCENARIO', '请选择支持的 AI 场景。');
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) throw new AiError('EMPTY_INPUT', '请输入问题或需要处理的内容。');
  if (body.prompt.length > LIMITS.prompt) throw new AiError('INPUT_TOO_LONG', `输入过长，上限 ${LIMITS.prompt} 字。`);
  let history = body.history || [];
  if (typeof history === 'string') {
    try { history = JSON.parse(history); } catch { throw new AiError('INVALID_CONTEXT', '对话上下文格式错误，请开始新对话。'); }
  }
  if (!Array.isArray(history) || history.length > LIMITS.historyMessages || history.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) {
    throw new AiError('INVALID_CONTEXT', '对话上下文过长或格式错误，请开始新对话。');
  }
  if (history.reduce((n, m) => n + m.content.length, 0) > LIMITS.historyChars) throw new AiError('CONTEXT_TOO_LONG', '对话上下文过长，请开始新对话。');
  // Allowlist text only. Client-supplied system messages, tools and images in
  // conversation history never reach the provider.
  return { scenario: body.scenario, prompt: body.prompt.trim(), history: history.map(m => ({ role: m.role, content: m.content })) };
}

async function imageParts(files = []) {
  if (files.length > LIMITS.images) throw new AiError('TOO_MANY_IMAGES', '最多上传 4 张图片。');
  const parts = [];
  for (const file of files) {
    if (!file.buffer || file.buffer.length > LIMITS.imageBytes) throw new AiError('IMAGE_TOO_LARGE', '单张图片不能超过 2 MiB。');
    try {
      const image = sharp(file.buffer, { limitInputPixels: 32 * 1024 * 1024, failOn: 'warning' });
      const metadata = await image.metadata();
      const detected = MIME[metadata.format];
      if (!detected || detected !== file.mimetype) throw new Error('MIME mismatch');
      if (!metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192) throw new Error('Image dimensions');
      // Decode the first frame to reject corrupt data and decompression bombs.
      // Only the original validated bytes are sent, never stored on disk.
      await image.resize({ width: 1, height: 1 }).raw().toBuffer();
      parts.push({ type: 'image_url', image_url: { url: `data:${detected};base64,${file.buffer.toString('base64')}` } });
    } catch {
      throw new AiError('INVALID_IMAGE', '图片格式不支持、声明格式不符或图片损坏，请使用 JPEG、PNG、GIF 或 WebP。');
    }
  }
  return parts;
}

const fieldLimits = { title: 200, description: 2000, excerpt: 800, content: 16000, body: 4000, source: 200, link: 2048, linkUrl: 2048, rsvpLink: 2048 };
function parseStructured(scenario, text) {
  const example = EXAMPLES[scenario];
  if (!example) return null;
  // Safe repair: strip a surrounding fenced JSON block once. No eval or
  // heuristics that turn arbitrary prose into publishable content.
  const raw = text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
  const parsed = JSON.parse(raw);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Invalid JSON object');
  const output = {};
  for (const [key, defaultValue] of Object.entries(example)) {
    if (!Object.hasOwn(parsed, key)) throw new Error(`Missing ${key}`);
    const value = parsed[key];
    if (key === 'location') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid location');
      output.location = {};
      for (const name of Object.keys(defaultValue)) {
        if (value[name] != null && typeof value[name] !== 'string') throw new Error('Invalid location field');
        output.location[name] = value[name] || (name === 'type' ? null : '');
      }
      if (value.type != null && !['physical', 'virtual', 'hybrid'].includes(value.type)) throw new Error('Invalid location type');
    } else if (Array.isArray(defaultValue)) {
      if (!Array.isArray(value) || value.length > 20 || value.some(v => typeof v !== 'string' || v.length > 80)) throw new Error('Invalid array');
      output[key] = value;
    } else if (key === 'maxCapacity') {
      if (value !== null && (!Number.isSafeInteger(value) || value < 1)) throw new Error('Invalid capacity');
      output[key] = value;
    } else {
      if (value !== null && typeof value !== 'string') throw new Error('Invalid field');
      const max = scenario === 'announcement' && key === 'title' ? 120 : scenario === 'resource' && key === 'description' ? 1000 : (fieldLimits[key] || 2048);
      if ((value || '').length > max) throw new Error('Field too long');
      output[key] = value == null ? (defaultValue === null ? null : '') : value;
    }
  }
  const validEnum = (value, allowed) => value === null || value === '' || allowed.includes(value);
  if (scenario === 'activity' && (!validEnum(output.eventType, Event.schema.path('eventType').enumValues) || output.category.some(v => !Event.schema.path('category').caster.enumValues.includes(v)))) throw new Error('Invalid event enum');
  if (scenario === 'news' && output.categories.some(v => !News.schema.path('categories').caster.enumValues.includes(v))) throw new Error('Invalid news enum');
  if (scenario === 'resource' && (!validEnum(output.type, Resource.schema.path('type').enumValues) || !validEnum(output.category, Resource.schema.path('category').enumValues))) throw new Error('Invalid resource enum');
  if (scenario === 'announcement' && !['info', 'important', 'urgent'].includes(output.level)) throw new Error('Invalid announcement enum');
  for (const key of ['startDate', 'endDate', 'rsvpDeadline', 'expiresAt']) {
    if (output[key] && (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(output[key]) || !Number.isFinite(new Date(output[key]).getTime()))) throw new Error('Invalid date');
  }
  return output;
}

module.exports = { LIMITS, validateInput, imageParts, parseStructured };
