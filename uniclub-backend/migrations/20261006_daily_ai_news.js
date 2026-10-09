const { settingsFrom } = require('../utils/dailyNewsSchedule');

async function migrateDailyAiNews({ news, settings, jobs }) {
  // Legacy imported and manually authored rows are treated as manual alike.
  // Historical origin must never be guessed from author, title or creation date.
  const backfill = await news.updateMany({ origin: { $exists: false } }, { $set: { origin: 'manual' } });
  await settings.updateOne({ _id: 'deepseek' }, { $setOnInsert: { configured: false } }, { upsert: true });
  await settings.updateOne({ _id: 'deepseek', dailyAiNews: { $exists: false } }, { $set: { dailyAiNews: settingsFrom() } });
  await news.createIndex({ generationBatchId: 1, automationIndex: 1 }, {
    name: 'daily_news_batch_article_unique', unique: true, partialFilterExpression: { origin: 'ai_daily' },
  });
  await news.createIndex({ origin: 1, generationBatchId: 1, publishedAt: -1 });
  await jobs.createIndex({ jobKey: 1 }, { unique: true });
  await jobs.createIndex({ startedAt: -1 });
  return { matched: backfill.matchedCount, modified: backfill.modifiedCount };
}

if (require.main === module) {
  const path = require('node:path');
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const mongoose = require('mongoose');
  void (async () => {
    try {
      if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
      await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
      const result = await migrateDailyAiNews({
        news: mongoose.connection.collection('news'), settings: mongoose.connection.collection('ai_settings'),
        jobs: mongoose.connection.collection('daily_news_jobs'),
      });
      console.log(JSON.stringify({ migration: 'daily-ai-news', ...result }));
    } catch { console.error('Daily AI News migration failed; no credentials were logged.'); process.exitCode = 1; }
    finally { await mongoose.disconnect(); }
  })();
}

module.exports = { migrateDailyAiNews };
