#!/usr/bin/env node
// Local, read-only proof. No public debug endpoint and no publication side effects.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const News = require('../models/News');
const NewsAPIService = require('../services/NewsAPIService');
const { DeepSeekAssistant } = require('../services/DeepSeekAssistant');

async function main() {
  if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('生产环境请使用受管理员保护的每日新闻接口；该验证脚本仅供本地开发。'), { code: 'DEVELOPMENT_ONLY' });
  const mode = process.argv[2];
  if (!['--search-only', '--dry-run', '--ai-check'].includes(mode)) throw Object.assign(new Error('用法：node scripts/check-daily-news.js --search-only | --dry-run | --ai-check'), { code: 'INVALID_MODE' });
  if (mode === '--search-only') {
    const now = new Date();
    // A wider window is an explicit provider diagnostic only. The publication
    // pipeline still requires sources from the last 24 hours without exception.
    const window = process.argv.find(argument => argument.startsWith('--lookback-hours='));
    const lookbackHours = window ? Number(window.slice('--lookback-hours='.length)) : 24;
    if (![24, 48].includes(lookbackHours)) throw Object.assign(new Error('检索诊断窗口只允许 24 或 48 小时。'), { code: 'INVALID_MODE' });
    const query = '"artificial intelligence" OR "AI research"';
    const result = await new NewsAPIService().search(query, { from: new Date(now.getTime() - lookbackHours * 60 * 60 * 1000).toISOString(), to: now.toISOString(), limit: 5 });
    console.info(JSON.stringify({ success: result.results.length > 0, checkedAt: now.toISOString(),
      provider: result.provider, searchPerformed: result.searchPerformed, queries: [query], lookbackHours,
      resultCount: result.results.length, latestResult: result.results[0] || null,
      eligible24HourResults: result.results.filter(source => source.publishedAt && now.getTime() - new Date(source.publishedAt).getTime() <= 24 * 60 * 60 * 1000).length,
      ...(!result.results.length && { code: 'SEARCH_NO_RESULTS', message: '当前检索窗口没有结果；每日新闻不会使用旧资料凑数。' }), persist: false }, null, 2));
    if (!result.results.length) process.exitCode = 1;
    return;
  }
  if (!process.env.MONGODB_URI) throw Object.assign(new Error('未配置现有 MONGODB_URI。'), { code: 'DATABASE_ERROR' });
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  try {
    if (mode === '--ai-check') {
      const result = await new DeepSeekAssistant().testConnection();
      console.info(JSON.stringify({ ...result, configuration: 'existing AI Assistant', persist: false }, null, 2));
      return;
    }
    const { getDailyNewsService, QUERIES } = require('../services/DailyAiNewsService');
    const { errorForDailyNews } = require('../utils/dailyNewsErrors');
    const service = getDailyNewsService();
    const before = await News.countDocuments({});
    let result, failure;
    try { result = await service.dryRun(); } catch (error) { failure = errorForDailyNews(error); }
    const after = await News.countDocuments({});
    if (after !== before) throw Object.assign(new Error('新闻数量在测试期间发生变化，需要检查并发任务。'), { code: 'DATABASE_ERROR' });
    if (failure) {
      const config = await service.repository.getSettings();
      const ai = await service.assistant.getSettings();
      console.info(JSON.stringify({ success: false, code: failure.code, message: failure.message,
        provider: service.searchDiagnostic?.provider || service.search().dailyDiagnostic().provider, queries: config.categories.map(category => QUERIES[category]),
        searchPerformed: service.searchDiagnostic?.searchPerformed || false,
        resultCount: service.searchDiagnostic?.resultCount || 0, latestResult: null, selectedTopics: [],
        ai: { provider: ai.provider, model: ai.model, configuration: 'existing AI Assistant' },
        persist: false, newsCountBefore: before, newsCountAfter: after }, null, 2));
      process.exitCode = 1; return;
    }
    console.info(JSON.stringify({ ...result.proof, ai: result.ai, articles: result.articles.map(article => ({ title: article.title, summaryLength: article.summary.length, contentLength: article.content.length, sourceReferences: article.sourceReferences })), persist: false, newsCountBefore: before, newsCountAfter: after }, null, 2));
  } finally { await mongoose.disconnect(); }
}

main().catch(error => {
  // Do not serialize provider request/config, headers, stack or credentials.
  const known = ['SEARCH_UNAVAILABLE', 'SEARCH_NO_RESULTS', 'AI_UNAVAILABLE', 'AI_TIMEOUT', 'AI_INVALID_RESPONSE', 'INSUFFICIENT_SOURCES', 'VALIDATION_FAILED', 'DATABASE_ERROR', 'DEVELOPMENT_ONLY', 'INVALID_MODE', 'NOT_CONFIGURED', 'INVALID_API_KEY'];
  console.error(JSON.stringify({ success: false, code: known.includes(error.code) ? error.code : 'VERIFICATION_FAILED', message: known.includes(error.code) ? error.message : '本地联网验收未完成，请检查服务器配置。', persist: false }));
  process.exitCode = 1;
});
