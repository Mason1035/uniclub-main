# 📰 News Curation Guide

Complete guide to the Uniclub news curation system.

---

## 🎯 Quick Reference

### **For Development (Manual One-Time Run)**

**Windows:**
```powershell
npm run curate:win           # Run news curation once
npm run curate:win:verbose   # Run with detailed logs
```

**Linux/Mac:**
```bash
npm run curate:news          # Run news curation once
npm run curate:news:verbose  # Run with detailed logs
```

### **For Production (Automated Midnight Run)**

**Option 1: Standalone Daemon**
```bash
# Run this in a separate terminal/screen/tmux session
npm run curate:daemon
```

**Option 2: Integrated into Server**
The midnight curation can be integrated into your main server.
See "Production Setup" section below.

---

## 📊 What Does News Curation Do?

The news curation system:

1. **Fetches** fresh tech articles from News API
2. **Filters** articles using positive/negative keywords
3. **AI Selects** the best 20 articles (prioritizing AI/ML topics)
4. **Scrapes** full article content from original sources
5. **Generates** AI-powered summaries using Claude
6. **Saves** curated articles to MongoDB

**Result:** Your app gets 20 high-quality, AI-curated tech articles daily!

---

## 🔧 Two Different Systems Explained

### **1. NewsCurationService** (What You Need! ✅)

**Purpose:** Fetch NEW articles from News API

**Files:**
- `uniclub-backend/services/NewsCurationService.js` - Main service
- `uniclub-backend/manual-curation.js` - One-time script
- `uniclub-backend/jobs/midnightCuration.js` - Background daemon

**Usage:**
```powershell
npm run curate:win  # Runs once and exits
```

---

### **2. ContentCurationService** (Optional Bonus Feature)

**Purpose:** Rank EXISTING content for homepage display

**What it does:**
- Ranks content already in database (news, events, social)
- Uses AI to select "Top 3" and "#1 Featured" for each category
- Only accessible via API endpoints (not automated)

**API Endpoints:**
```bash
POST /api/curation/run      # Trigger content ranking
GET  /api/curation/homepage # Get top 3 per category
GET  /api/curation/featured # Get #1 featured per category
```

**Note:** This is NOT the same as news curation! It doesn't fetch new articles.

---

## 📋 Available Commands

### Root Package.json

| Command | Description | Exits? | Use Case |
|---------|-------------|--------|----------|
| `npm run curate:win` | Windows one-time curation | Yes ✅ | Development |
| `npm run curate:win:verbose` | Windows verbose curation | Yes ✅ | Debugging |
| `npm run curate:news` | Linux/Mac one-time curation | Yes ✅ | Development |
| `npm run curate:news:verbose` | Linux/Mac verbose curation | Yes ✅ | Debugging |
| `npm run curate:daemon` | Background daemon | No ❌ | Production |
| `npm run daily-curator` | ⚠️ Same as daemon (legacy) | No ❌ | Deprecated |

### Backend Package.json

```bash
cd uniclub-backend

npm run curation           # One-time run
npm run curation:verbose   # Verbose output
npm run daily-curator      # Background daemon (never exits)
```

---

## 🚀 Development Workflow

### Testing News Curation

```powershell
# 1. Make sure backend server is NOT running news curation daemon
npm run stop:win

# 2. Run one-time curation to test
npm run curate:win

# 3. Check the output - should see:
#    ✅ Articles fetched
#    ✅ AI selection
#    ✅ Content scraping
#    ✅ Summaries generated
#    ✅ Saved to database

# 4. Restart your dev servers
npm run start:win
```

### Debugging Issues

```powershell
# Run with verbose logging to see detailed steps
npm run curate:win:verbose

# You'll see:
# - News API fetch results
# - Keyword filtering details
# - AI selection reasoning
# - Scraping progress
# - Database operations
```

---

## 🌐 Production Setup

### Option 1: Separate Process (Recommended)

Run the curation daemon in a separate process:

```bash
# Terminal 1: Main application server
npm run start:win

# Terminal 2: News curation daemon
npm run curate:daemon
```

**With PM2 (Process Manager):**
```bash
# Start main server
pm2 start "npm run start" --name "uniclub-server"

# Start curation daemon
pm2 start "npm run curate:daemon" --name "uniclub-curator"

# View logs
pm2 logs uniclub-curator
```

---

### Option 2: Integrated into Main Server

Add to `uniclub-backend/index.js` at the bottom:

```javascript
// Start midnight curation job in production
if (process.env.NODE_ENV === 'production') {
  console.log('🌙 Starting midnight news curation job...');
  const { cron } = require('./jobs/midnightCuration');
  console.log('✅ Midnight curation job configured');
}
```

Then set environment variable:
```bash
NODE_ENV=production npm start
```

**Pros:** Single process, easier deployment  
**Cons:** Curation restarts if server restarts

---

## ⏰ Curation Schedule

The daemon runs at **12:00 AM Dallas Time (America/Chicago)** every day.

**Timezone Configuration:**
- Configured in `jobs/midnightCuration.js`
- Uses `node-cron` with timezone support
- Automatically handles DST (Daylight Saving Time)

**To change schedule:**
```javascript
// In jobs/midnightCuration.js, line 15:
cron.schedule('0 0 * * *', async () => {
  // Cron format: minute hour day month weekday
  // 0 0 * * * = midnight every day
  // 0 */6 * * * = every 6 hours
  // 0 12 * * * = noon every day
```

---

## 🔑 Required Configuration

### Environment Variables

Required in `uniclub-backend/.env`:

```bash
# MongoDB Connection (Required)
MONGODB_URI=mongodb+srv://...

# News API Key (Required)
NEWS_API_KEY=your-news-api-key
# Get from: https://newsapi.org/

# Anthropic API Key (Required)
ANTHROPIC_API_KEY=your-anthropic-key
# Get from: https://console.anthropic.com/

# Optional - for daemon startup testing
NODE_ENV=development
RUN_INITIAL_CURATION=false
```

---

## 🐛 Troubleshooting

### "News API returned 0 articles"

**Causes:**
- Invalid API key
- API rate limit exceeded
- Network issues

**Solutions:**
```bash
# Check API key in .env
cat uniclub-backend/.env | grep NEWS_API_KEY

# Test API key manually
curl "https://newsapi.org/v2/everything?q=artificial+intelligence&apiKey=YOUR_KEY"

# Check rate limits (free tier: 100 requests/day)
```

---

### "MongoDB connection failed"

**Solution:**
```bash
# Verify MongoDB URI
cat uniclub-backend/.env | grep MONGODB_URI

# Test connection
mongosh "YOUR_MONGODB_URI"
```

---

### "Anthropic API error"

**Causes:**
- Invalid API key
- Insufficient credits
- Rate limit

**Solutions:**
```bash
# Check API key
cat uniclub-backend/.env | grep ANTHROPIC_API_KEY

# Check credits at: https://console.anthropic.com/settings/billing
```

---

### "Curation runs but terminal hangs"

**Cause:** You ran the daemon instead of one-time script

**Solution:**
```powershell
# Press Ctrl+C to stop daemon
# Then use one-time script:
npm run curate:win
```

---

## 📊 Understanding the Output

### Successful Curation
```
Starting Daily News Curation...
✅ Connected to MongoDB

Step 1: Fetching articles from News API...
✅ Fetched 100 raw articles

Step 2: Filtering articles by keywords...
✅ Filtered to 45 relevant articles

Step 3: AI selecting best articles...
✅ AI selected 20 best articles

Step 4: Scraping full content...
✅ Scraped 18/20 articles (2 failed)

Step 5: Generating AI summaries...
✅ Generated 18 summaries

Step 6: Saving to database...
✅ Saved 18 new articles

✅ Manual curation completed successfully
Total time: 45.3 seconds
```

---

## 🎓 Best Practices

### During Development
1. ✅ Use `npm run curate:win` (one-time run)
2. ✅ Test with verbose mode first
3. ✅ Check database after curation
4. ❌ Don't run daemon during dev (it never exits)

### In Production
1. ✅ Run daemon as separate process
2. ✅ Use process manager (PM2, systemd)
3. ✅ Monitor logs for failures
4. ✅ Set up alerting for API errors
5. ✅ Backup database before major changes

---

## 📞 Support

**Logs Location:**
- Manual run: Terminal output
- Daemon: Check PM2 logs or console output

**Common Commands:**
```powershell
# Quick test
npm run curate:win

# Debug issues
npm run curate:win:verbose

# Check what's in database
# (Use MongoDB Compass or mongosh)
```

---

**Last Updated:** October 27, 2025  
**Curation Engine:** Claude 3.5 Haiku + News API  
**Status:** ✅ Production Ready

