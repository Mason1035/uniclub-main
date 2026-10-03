const express = require('express');
const router = express.Router();

// Cron endpoint for automated news curation (called by Vercel Cron)
router.get('/news-curation', async (req, res) => {
  // Verify this is called by Vercel Cron (using authorization header)
  const authHeader = req.headers.authorization;
  
  // Fail closed in every environment if the scheduler secret is missing.
  if (!process.env.CRON_SECRET) {
    return res.status(503).json({ error: 'Cron secret is not configured' });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log('🌙 Midnight News Curation triggered by Vercel Cron');
  console.log('🕐 Server Time:', new Date().toISOString());
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
    const NewsCurationService = require('../services/NewsCurationService');
    const curationService = new NewsCurationService();
    
    await curationService.runMidnightCuration();
    
    console.log('✅ Midnight news curation completed successfully');
    res.status(200).json({ 
      success: true, 
      message: 'News curation completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Midnight news curation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
