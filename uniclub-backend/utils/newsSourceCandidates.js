const { clip, plainText } = require('./newsAiContext');
const { safeWebUrl } = require('./webSafety');

// Shared by retrieval and daily generation: raw counts cannot stand in for
// usable evidence. Keep this policy identical before deciding on a fallback.
function validRecentSource(item, now = new Date()) {
  if (!item || typeof item !== 'object' || !item.publishedAt) return null;
  const timestamp = new Date(item.publishedAt).getTime(), current = new Date(now).getTime();
  const age = current - timestamp;
  if (!Number.isFinite(current) || !Number.isFinite(timestamp) || age < -5 * 60 * 1000 || age > 24 * 60 * 60 * 1000) return null;
  let url;
  try { url = safeWebUrl(item.url); } catch { return null; }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  const title = clip(plainText(item.title), 600), snippet = clip(plainText(item.snippet), 1600);
  if (title.length < 8 || snippet.length < 30 || /\b(sponsored|advertorial|horoscope|celebrity gossip)\b/i.test(title + snippet)) return null;
  return { url: url.href, title, snippet, publishedAt: new Date(timestamp).toISOString() };
}

module.exports = { validRecentSource };
