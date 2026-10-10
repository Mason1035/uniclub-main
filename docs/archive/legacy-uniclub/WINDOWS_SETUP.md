# 💻 Windows Development Setup Guide

This guide provides Windows-specific instructions for developing the Uniclub application.

## 🚀 Quick Start (PowerShell)

### Automated Scripts (Recommended)

```powershell
# Start both backend and frontend servers
npm run start:win

# Check if servers are running
npm run check:ports

# Stop all servers
npm run stop:win

# Emergency: Kill all Node processes
npm run kill:all
```

---

## 📋 Available Commands

### Development Scripts

| Command | Description |
|---------|-------------|
| `npm run start:win` | Start both servers with automatic port cleanup |
| `npm run stop:win` | Stop all development servers |
| `npm run check:ports` | Check server status and health |
| `npm run kill:all` | Emergency kill all Node.js processes |

### Individual Server Control

```powershell
# Backend only
cd uniclub-backend
npm run dev

# Frontend only (in a new terminal)
npm run frontend
```

---

## 🔍 Checking Server Status

### Quick Status Check
```powershell
npm run check:ports
```

This will show:
- ✅ Backend status (port 5000)
- ✅ Frontend status (port 8081)
- ✅ API health check
- ✅ Process information

### Manual Port Checking

```powershell
# Check if backend is running (port 5000)
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue

# Check if frontend is running (port 8081)
Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue

# List all Node.js processes
Get-Process node -ErrorAction SilentlyContinue
```

---

## 🛑 Stopping Servers

### Automated Stop
```powershell
npm run stop:win
```

### Manual Stop (by port)

```powershell
# Stop backend (port 5000)
$process = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($process) { Stop-Process -Id $process.OwningProcess -Force }

# Stop frontend (port 8081)
$process = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if ($process) { Stop-Process -Id $process.OwningProcess -Force }
```

### Emergency Kill All
```powershell
npm run kill:all
```

⚠️ **Warning**: This kills ALL Node.js processes on your system!

---

## 🐛 Troubleshooting

### Issue: Port Already in Use

**Symptoms:**
- Error: "Port 5000 is already in use"
- Error: "Port 8081 is already in use"

**Solution:**
```powershell
# Check what's running
npm run check:ports

# Stop old servers
npm run stop:win

# Start fresh
npm run start:win
```

### Issue: Servers Won't Start

**Symptoms:**
- Servers appear to start but aren't accessible
- Blank terminal windows

**Solution:**
```powershell
# 1. Kill everything
npm run kill:all

# 2. Wait a moment
Start-Sleep -Seconds 3

# 3. Verify ports are free
npm run check:ports

# 4. Start fresh
npm run start:win
```

### Issue: Can't See Server Logs

**Solution:**
The automated scripts open servers in separate PowerShell windows. Check for:
- A window titled "BACKEND SERVER" (green header)
- A window titled "FRONTEND SERVER" (cyan header)

If you don't see them, they may be minimized in your taskbar.

### Issue: PowerShell Script Won't Run

**Error:** "Running scripts is disabled on this system"

**Solution:**
```powershell
# Allow script execution (run as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or use the bypass flag:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1
```

---

## 🔧 Manual Development Workflow

If you prefer manual control:

### 1. Open Two Terminal Windows

**Terminal 1 - Backend:**
```powershell
cd uniclub-backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
npm run frontend
```

### 2. Verify Running

```powershell
# In a third terminal
npm run check:ports
```

### 3. Test the App

Open your browser to:
- **Frontend:** http://localhost:8081
- **Backend API:** http://localhost:5000/api/health

---

## 🌐 Network Access

The frontend is accessible on your local network:

```powershell
# After running npm run start:win, check the frontend terminal for:
# ➜  Network: http://192.168.x.x:8081/
```

You can access the app from:
- Your computer: http://localhost:8081
- Other devices on network: http://YOUR_IP:8081

**Backend CORS is configured for:**
- localhost:8080, 8081, 8082
- 127.0.0.1:8080, 8081, 8082  
- 192.168.1.191:8080, 8081, 8082

To add more IPs, edit `uniclub-backend/index.js` (lines 33-37).

---

## 📝 PowerShell vs Command Prompt

### PowerShell (Recommended) ✅
```powershell
# Use semicolon for multiple commands
cd uniclub-backend; npm run dev
```

### Command Prompt ❌
```cmd
# Use && for multiple commands (but PowerShell is preferred)
cd uniclub-backend && npm run dev
```

**Note:** All npm scripts in this project are designed for PowerShell.

---

## 🎯 Best Practices

1. **Always use `npm run start:win`** for the cleanest startup
2. **Check ports before starting** with `npm run check:ports`
3. **Stop servers properly** with `npm run stop:win` (not just closing windows)
4. **Keep terminals visible** so you can monitor logs
5. **Use `npm run kill:all`** only when servers are stuck

---

## 📦 Dependencies

All Windows-specific scripts are located in:
```
scripts/
├── start-dev.ps1       # Smart startup with port cleanup
├── stop-dev.ps1        # Clean shutdown
├── check-ports.ps1     # Status checker
└── kill-all-node.ps1   # Emergency cleanup
```

No additional dependencies are required - these scripts use PowerShell built-ins.

---

## 🆘 Common Errors

### Error: "Cannot find module"

**Cause:** Dependencies not installed

**Solution:**
```powershell
# Install all dependencies
npm run install-all

# Or manually
npm install
cd uniclub-backend
npm install
```

### Error: "MONGODB_URI is not set"

**Cause:** Missing .env file in backend

**Solution:**
```powershell
# Check if .env exists
cd uniclub-backend
Get-Item .env

# If missing, copy from .env.example
Copy-Item .env.example .env

# Edit .env with your MongoDB credentials
notepad .env
```

### Error: "401 Unauthorized" in Browser

**Cause:** Backend not running or wrong URL

**Solution:**
```powershell
# 1. Check backend is running
npm run check:ports

# 2. Verify backend health
Invoke-WebRequest http://localhost:5000/api/health

# 3. Check frontend is connecting to correct backend
# Should see in src/lib/axios.ts: baseURL: 'http://localhost:5000'
```

---

## 📞 Getting Help

If you're still having issues:

1. Check server status: `npm run check:ports`
2. View backend logs in the BACKEND SERVER terminal window
3. View frontend logs in the FRONTEND SERVER terminal window
4. Check browser console (F12) for frontend errors
5. Verify all environment variables in `uniclub-backend/.env`

---

**Made for Windows Developers** 💙

*Using PowerShell for modern Node.js development*

