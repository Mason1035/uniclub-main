// ========================================
// Manual News Curation Script (One-Time Run)
// ========================================
// This script runs ONCE and exits when complete.
// Use this during development to test news curation.
//
// Commands:
//   npm run curate:win       (Windows - recommended)
//   npm run curate:news      (Linux/Mac)
//   npm run curation         (from backend directory)
//   npm run curation:verbose (with detailed logs)
// ========================================

require('dotenv').config();
const NewsCurationService = require('./services/NewsCurationService');

const verbose = process.argv.includes('--verbose');

console.log('🚀 Manual News Curation Starting...');
console.log('📝 This is a ONE-TIME run - script will exit when complete');

const newsCurationService = new NewsCurationService();

async function runCuration() {
  try {
    await newsCurationService.runMidnightCuration();
    console.log('✅ Manual curation completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Manual curation failed:', error);
    process.exit(1);
  }
}

runCuration();




