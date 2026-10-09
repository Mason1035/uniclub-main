// One explicitly invoked CLI run, using the same service and lock as the admin
// console. --force confirms replacing today's successful batch; --dry-run
// retrieves real evidence and calls the shared AI but never persists news.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { getDailyNewsService } = require('./services/DailyAiNewsService');
const { errorForDailyNews } = require('./utils/dailyNewsErrors');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  const service = getDailyNewsService();
  if (process.argv.includes('--dry-run')) {
    const result = await service.dryRun();
    console.log(JSON.stringify({ persist: false, ai: result.ai, ...result.proof, articles: result.articles.map(article => ({ title: article.title, sourceReferences: article.sourceReferences })) }, null, 2));
  } else {
    await service.initialize();
    const result = await service.requestRun({ force: process.argv.includes('--force'), trigger: 'manual', wait: true });
    console.log(JSON.stringify(result, null, 2));
    if (result.job?.status === 'failed') process.exitCode = 1;
  }
}
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ job: 'daily-ai-news', code: errorForDailyNews(error).code }));
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
module.exports = { main };
