// Compatibility entry for npm run daily-curator / curate:daemon. The former
// Dallas/Gemini importer has been replaced by the same durable Daily News job
// used by ECS startup, authenticated Cron and the administrator console.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { getDailyNewsService } = require('../services/DailyAiNewsService');
const { startDailyNewsScheduler } = require('./dailyNewsScheduler');
const { errorForDailyNews } = require('../utils/dailyNewsErrors');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  const service = getDailyNewsService();
  await service.initialize();
  const stop = startDailyNewsScheduler(service);
  console.log('ClassHub Daily AI News scheduler: Asia/Shanghai, persisted settings, shared AI Assistant.');
  const close = async () => { stop(); await mongoose.disconnect(); process.exit(0); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
  return { service, stop };
}
if (require.main === module) main().catch(async error => {
  console.error(JSON.stringify({ job: 'daily-ai-news', phase: 'scheduler', code: errorForDailyNews(error).code }));
  await mongoose.disconnect(); process.exitCode = 1;
});
module.exports = { main };
