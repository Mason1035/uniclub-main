# 🚀 Quick Start - Windows

## First Time Setup

```powershell
# 1. Install dependencies
npm run install-all

# 2. Configure backend .env file
# Edit: uniclub-backend/.env with your MongoDB URI and API keys

# 3. Start servers
npm run start:win
```

---

## Daily Development

### Start Servers
```powershell
npm run start:win
```
✅ Opens 2 terminal windows (backend + frontend)  
✅ Automatically cleans up old processes  
✅ Verifies servers are running

### Check Status
```powershell
npm run check:ports
```
Shows backend/frontend status and health

### Stop Servers
```powershell
npm run stop:win
```
Cleanly shuts down both servers

### Emergency Reset
```powershell
npm run kill:all
```
⚠️ Kills all Node.js processes (use if servers are stuck)

---

## News Curation

### Run News Curation (Development)
```powershell
npm run curate:win           # One-time run
npm run curate:win:verbose   # With detailed logs
```
✅ Fetches new articles from News API  
✅ AI curates best articles  
✅ Exits when complete

### Production Daemon (Don't use during dev!)
```powershell
npm run curate:daemon  # Runs forever - for production only!
```
⚠️ This starts a background job that runs at midnight daily

---

## Access Points

- **Frontend:** http://localhost:8081
- **Backend:** http://localhost:5000
- **API Health:** http://localhost:5000/api/health

---

## Common Issues

### "Port already in use"
```powershell
npm run stop:win
npm run start:win
```

### "Can't see logs"
Look for terminal windows:
- **BACKEND SERVER** (green header)
- **FRONTEND SERVER** (cyan header)

### "News curation terminal won't exit"
You ran the daemon instead of one-time script:
```powershell
# Press Ctrl+C to stop
# Then use:
npm run curate:win
```

### "Script won't run"
```powershell
# Allow scripts (run once as Admin)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Full Documentation

- **Windows Guide:** [WINDOWS_SETUP.md](WINDOWS_SETUP.md)
- **News Curation:** [NEWS_CURATION_GUIDE.md](NEWS_CURATION_GUIDE.md)
- **General README:** [当前 README](../../../README.md)

---

**Need Help?** Run `npm run check:ports` to diagnose issues!
