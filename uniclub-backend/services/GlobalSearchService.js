const Announcement = require('../models/Announcement');
const News = require('../models/News');
const Event = require('../models/Event');
const PastEvent = require('../models/PastEvent');
const Resource = require('../models/Resource');
const SocialPost = require('../models/SocialPost');
const User = require('../models/User');
const Follow = require('../models/Follow');

const MAX_QUERY_LENGTH = 200;
const MAX_RESULTS = 12;

// Text is scored by semantic field, never by serializing a business record.
function plainText(value) {
  return String(value ?? '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/gi, entity => ({
      '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'",
    })[entity.toLowerCase()])
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
      const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/\s+/gu, ' ').trim();
}

function normalizeSearchText(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/gu, ' ').trim();
}
const compact = value => normalizeSearchText(value).replace(/ /g, '');

function parseQuery(value) {
  const normalized = normalizeSearchText(value);
  const tokens = [...new Set(normalized.split(' ').filter(Boolean))];
  return { normalized, tokens, full: tokens.join('') };
}

// Non-contiguous Chinese phrases: 材料整理 → 材料统一整理. Full
// substring/token matches always rank above this lightweight fallback.
function chineseCoverage(text, token) {
  if (!/^\p{Script=Han}{3,}$/u.test(token)) return 0;
  const chars = Array.from(token);
  const grams = [...new Set(chars.slice(0, -1).map((char, i) => char + chars[i + 1]))];
  const hits = grams.filter(gram => text.includes(gram)).length;
  const ratio = hits / grams.length;
  return hits >= 2 && ratio >= .6 ? ratio : 0;
}

function fieldMatch(text, query) {
  if (!text) return { kind: 'none', coverage: 0 };
  if (text === query.full) return { kind: 'exact', coverage: 1 };
  if (text.startsWith(query.full)) return { kind: 'prefix', coverage: 1 };
  if (text.includes(query.full)) return { kind: 'contains', coverage: 1 };
  const coverage = query.tokens.reduce((sum, token) =>
    sum + (text.includes(token) ? 1 : chineseCoverage(text, token)), 0) / query.tokens.length;
  if (coverage === 1) return { kind: 'all', coverage };
  return { kind: coverage > 0 ? 'partial' : 'none', coverage };
}

function scoreDocument(document, query) {
  const title = fieldMatch(document.search.title, query);
  const titleScore = { exact: 100, prefix: 80, contains: 60, all: 50, partial: 30, none: 0 }[title.kind];
  const metadata = document.search.keywords.map(text => fieldMatch(text, query));
  const metadataCoverage = fieldMatch(document.search.keywords.join(''), query).coverage;
  const metadataScore = Math.max(metadataCoverage, ...metadata.map(match => match.coverage), 0) * 25;
  const summaryScore = fieldMatch(document.search.summary, query).coverage * 20;
  const contentScore = fieldMatch(document.search.content, query).coverage * 15;
  // Bounded secondary signals cannot lift a body hit above a title hit.
  if (titleScore) return titleScore + title.coverage * 3 + metadataScore / 50 + summaryScore / 50 + contentScore / 50;
  return Math.max(metadataScore, summaryScore, contentScore);
}

function document(type, item, { title = item.title, summary = '', content = '', keywords = [], date, url }) {
  const cleanTitle = plainText(title);
  const cleanSummary = plainText(summary);
  const cleanContent = plainText(content);
  return {
    id: String(item._id), type, title: cleanTitle || cleanContent.slice(0, 70) || '班级动态',
    description: (cleanSummary || cleanContent).slice(0, 180),
    date: date || item.createdAt, url,
    // An untitled post's display snippet is not scored as an actual title.
    search: { title: compact(cleanTitle), summary: compact(cleanSummary), content: compact(cleanContent),
      keywords: keywords.flat().filter(Boolean).map(value => compact(plainText(value))) },
  };
}

const adapters = {
  announcement: item => document('announcement', item, { content: item.body, date: item.publishedAt, url: '/announcements' }),
  news: item => document('news', item, { summary: item.excerpt, content: item.content,
    keywords: [item.categories || [], item.summary?.keyPoints || [], item.summary?.quickSummary],
    date: item.publishedAt, url: `/news/${item._id}` }),
  event: item => document('event', item, { content: item.description,
    keywords: [item.category || [], item.tags || [], item.location?.address, item.location?.room, item.eventType],
    date: item.createdAt, url: `/event/${item._id}` }),
  pastEvent: item => document('pastEvent', item, { summary: item.subtitle, content: item.body,
    keywords: [item.category, item.tags || []], date: item.date, url: `/past-events/${item._id}` }),
  resource: item => document('resource', item, { summary: item.description,
    keywords: [item.file?.originalName, item.category, item.tags || [], item.type], url: `/resource/${item._id}` }),
  social: item => document('social', item, { title: item.projectData?.title || '', content: item.content,
    summary: item.projectData?.description || item.poll?.question || '',
    keywords: [item.hashtags || [], item.projectData?.technologies || []], url: '/social' }),
};

function rankDocuments(documents, value, limit = MAX_RESULTS) {
  const query = parseQuery(value);
  if (!query.full) return { results: [], count: 0, total: 0 };
  const unique = new Map();
  for (const item of documents) {
    const score = scoreDocument(item, query);
    if (!score) continue;
    const key = `${item.type}:${item.id}`;
    const previous = unique.get(key);
    if (!previous || score > previous.score) unique.set(key, { ...item, score });
  }
  const ranked = [...unique.values()].sort((a, b) => b.score - a.score ||
    (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0) || `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
  const countLimit = Math.max(1, Math.min(MAX_RESULTS, Number.parseInt(limit, 10) || MAX_RESULTS));
  const results = ranked.slice(0, countLimit).map(({ search, score, ...result }) => result);
  return { results, count: results.length, total: ranked.length };
}

function socialVisibility(userId, enrolled, followingIds) {
  return { status: 'active', $or: [
    { author: userId },
    { visibility: 'public' },
    ...(enrolled ? [{ visibility: 'club-members' }] : []),
    { visibility: 'friends', author: { $in: followingIds } },
  ] };
}

function createSearchService(models) {
  return async (value, { userId, limit, now = new Date() } = {}) => {
    if (!userId) throw new Error('Authentication required');
    if (!parseQuery(value).full) return rankDocuments([], value, limit);
    const [account, follows] = await Promise.all([
      models.User.findById(userId).select('isEnrolled').lean(),
      models.Follow.find({ followerId: userId, status: 'accepted' }).select('followingId').lean(),
    ]);
    if (!account) throw new Error('Account unavailable');
    const sources = [
      ['announcement', models.Announcement, { isPublished: true, publishedAt: { $lte: now },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, 'title body publishedAt createdAt'],
      ['news', models.News, { status: 'approved', publishedAt: { $lte: now } },
        'title excerpt content categories summary.keyPoints summary.quickSummary publishedAt createdAt'],
      ['event', models.Event, { status: 'published' }, 'title description category tags location.address location.room eventType createdAt'],
      ['pastEvent', models.PastEvent, {}, 'title subtitle body category tags date createdAt'],
      ['resource', models.Resource, { status: 'approved' }, 'title description file.originalName category tags type createdAt'],
      ['social', models.SocialPost, socialVisibility(userId, account.isEnrolled, follows.map(item => item.followingId)),
        'content projectData.title projectData.description projectData.technologies poll.question hashtags createdAt'],
    ];
    // Class-sized collections: project only readable text, then normalize/score
    // per field in memory. No premature per-type limit that loses relevant hits;
    // no images, files, URLs, account fields or persistent index are loaded.
    const batches = await Promise.all(sources.map(async ([type, Model, filter, projection]) =>
      (await Model.find(filter).select(projection).lean()).map(adapters[type])));
    return rankDocuments(batches.flat(), value, limit);
  };
}

const searchContent = createSearchService({ Announcement, News, Event, PastEvent, Resource, SocialPost, User, Follow });
module.exports = { searchContent, createSearchService, normalizeSearchText, rankDocuments, adapters, socialVisibility, MAX_QUERY_LENGTH };
