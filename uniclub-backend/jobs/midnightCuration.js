// ========================================
// ⚠️  WARNING: THIS IS A BACKGROUND DAEMON
// ========================================
// This script runs FOREVER as a cron job!
// It's designed for production servers.
//
// For ONE-TIME manual curation during development, use:
//   npm run curate:win       (Windows)
//   npm run curate:news      (Linux/Mac)
//   npm run curation         (from backend dir)
//
// This daemon will:
// - Start a cron scheduler
// - Run news curation at midnight daily
// - NEVER EXIT until you press Ctrl+C
// ========================================

// Load environment variables FIRST
require('dotenv').config();

const cron = require('node-cron');
const NewsCurationService = require('../services/NewsCurationService');

console.log('🌙 Midnight News Curation Job Starting...');
console.log('⏰ Timezone: America/Chicago (Dallas CST/CDT)');
console.log('⚠️  This is a DAEMON - it will run forever until stopped');

const newsCurationService = new NewsCurationService();

// Schedule daily news curation at midnight Dallas time
// Format: minute hour day month weekday
// 0 0 * * * = Every day at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('\n🌅 Daily News Curation Triggered!');
  console.log('🕐 Dallas Time:', new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }));
  
  try {
    await newsCurationService.runMidnightCuration();
    console.log('✅ Daily news curation completed successfully');
  } catch (error) {
    console.error('❌ Daily news curation failed:', error);
    // Could implement alerting/retry logic here
  }
}, {
  scheduled: true,
  timezone: "America/Chicago" // Dallas timezone
});

// Optional: Also run a test at startup (only in development with explicit flag)
if (process.env.NODE_ENV === 'development' && process.env.RUN_INITIAL_CURATION === 'true') {
  console.log('🚀 Running initial news curation for testing...');
  newsCurationService.runMidnightCuration().then(() => {
    console.log('✅ Initial curation completed');
  }).catch(error => {
    console.error('❌ Initial curation failed:', error);
  });
}

console.log('📅 Midnight News Curation Job configured:');
console.log('   - Runs every day at 12:00 AM Dallas time');
console.log('   - Fetches articles from News API');
console.log('   - Filters with positive/negative keywords');
console.log('   - AI selects best 20 articles (prioritizing AI/ML)');
console.log('   - Scrapes full content and generates AI summaries');
console.log('   - Fills with previous articles if needed (engagement priority)');
console.log('   - Clears old articles only after success');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n👋 Midnight curation job shutting down...');
  process.exit(0);
});

// Export for integration with main server
module.exports = { 
  cron,
  newsCurationService
}; 