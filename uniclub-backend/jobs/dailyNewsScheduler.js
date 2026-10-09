const { errorForDailyNews } = require('../utils/dailyNewsErrors');
const { getDailyNewsService } = require('../services/DailyAiNewsService');

function startDailyNewsScheduler(service = getDailyNewsService()) {
  let stopped = false, busy = false;
  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try { await service.initialize(); if (!stopped) await service.tick({ wait: true }); }
    catch (error) { console.warn(JSON.stringify({ job: 'daily-ai-news', phase: 'scheduler', code: errorForDailyNews(error).code })); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 60 * 1000);
  timer.unref?.();
  void tick(); // restart recovery reads today's durable job and Asia/Shanghai settings.
  return () => { stopped = true; clearInterval(timer); };
}
module.exports = { startDailyNewsScheduler };
