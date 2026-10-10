const { DailyNewsError } = require('./dailyNewsErrors');

const TIMEZONE = 'Asia/Shanghai';
const CATEGORIES = ['ai', 'technology', 'software', 'science', 'education'];
const DEFAULTS = Object.freeze({
  enabled: true, time: '19:00', timezone: TIMEZONE, articleCount: 2,
  categories: CATEGORIES, webSearch: true, reasoning: 'auto',
});
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function settingsFrom(value) {
  const plain = value?.toObject ? value.toObject() : value || {};
  return {
    enabled: typeof plain.enabled === 'boolean' ? plain.enabled : DEFAULTS.enabled,
    time: TIME_PATTERN.test(plain.time) ? plain.time : DEFAULTS.time,
    timezone: TIMEZONE,
    articleCount: Number.isInteger(plain.articleCount) && plain.articleCount >= 1 && plain.articleCount <= 5 ? plain.articleCount : DEFAULTS.articleCount,
    categories: Array.isArray(plain.categories) && plain.categories.length ? [...new Set(plain.categories.filter(item => CATEGORIES.includes(item)))] : [...CATEGORIES],
    webSearch: true,
    reasoning: plain.reasoning === 'high' ? 'high' : 'auto',
  };
}

function validateSettings(value, previous = DEFAULTS) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !Object.hasOwn(DEFAULTS, key))) throw new DailyNewsError('INVALID_SETTINGS');
  const next = { ...settingsFrom(previous), ...value };
  if (typeof next.enabled !== 'boolean' || !TIME_PATTERN.test(next.time) || next.timezone !== TIMEZONE ||
    !Number.isInteger(next.articleCount) || next.articleCount < 1 || next.articleCount > 5 ||
    !Array.isArray(next.categories) || !next.categories.length || next.categories.some(item => !CATEGORIES.includes(item)) ||
    next.webSearch !== true || !['auto', 'high'].includes(next.reasoning)) throw new DailyNewsError('INVALID_SETTINGS');
  return settingsFrom(next);
}

function localParts(now = new Date()) {
  return Object.fromEntries(formatter.formatToParts(now).map(part => [part.type, part.value]));
}
function batchDate(now = new Date()) {
  const part = localParts(now);
  return `${part.year}-${part.month}-${part.day}`;
}
function validDate(date) {
  return typeof date === 'string' && DATE_PATTERN.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
function scheduledAt(date, time) {
  if (!validDate(date) || !TIME_PATTERN.test(time)) throw new DailyNewsError('INVALID_SETTINGS');
  // This fixed product timezone is UTC+08:00, independent of server timezone.
  return new Date(`${date}T${time}:00+08:00`);
}
function dueDate(config, now = new Date()) {
  const settings = settingsFrom(config), date = batchDate(now);
  return settings.enabled && now >= scheduledAt(date, settings.time) ? date : null;
}
function nextRun(config, now = new Date(), completedDate = null) {
  const settings = settingsFrom(config);
  if (!settings.enabled) return null;
  const date = batchDate(now), today = scheduledAt(date, settings.time);
  if (today > now && completedDate !== date) return today;
  if (completedDate !== date) return now; // restart recovery: today's run is overdue.
  const tomorrow = new Date(`${date}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return scheduledAt(tomorrow.toISOString().slice(0, 10), settings.time);
}

module.exports = { DEFAULTS, TIMEZONE, CATEGORIES, settingsFrom, validateSettings, batchDate, validDate, scheduledAt, dueDate, nextRun };
