# 🔒 Environment File Safety Guide

## 🚨 **CRITICAL: Your `.env` File is Precious!**

Your `uniclub-backend/.env` file contains all your API keys and secrets. **NEVER delete it!**

## ⚠️ **If You Accidentally Delete the .env File**

### **Option 1: Restore from Automatic Backup**
```powershell
npm run restore:env
```
This will show you all available backups and let you choose which one to restore.

### **Option 2: Restore from Static Backup**
If automatic backups aren't available:
```powershell
Copy-Item uniclub-backend\.env.backup -Destination uniclub-backend\.env
```

### **Option 3: Manual Recreation**
If all backups are lost, you'll need to recreate it with:

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/uniclub?retryWrites=true&w=majority&appName=uniclub

# JWT Secret for Authentication (generate new one if lost)
JWT_SECRET=your-long-random-jwt-secret-here

# Server Configuration
PORT=5000

# News API Key (Get from https://newsapi.org/)
NEWS_API_KEY=your_news_api_key_here

# Google Gemini API Key (Get from https://ai.google.dev/)
GEMINI_API_KEY=your_gemini_api_key_here

# Payload CMS Secret (if needed)
PAYLOAD_SECRET=your-payload-secret-key-here
```

---

## 🛡️ **Protection Layers in Place**

### **1. Git Ignore**
✅ Your `.env` file is in `.gitignore` - it won't be committed to Git

### **2. Static Backup**
✅ `uniclub-backend/.env.backup` - Always-available backup copy

### **3. Automatic Timestamped Backups**
✅ `uniclub-backend/.env-backups/` - Keeps last 5 backups with timestamps

### **4. Backup Scripts**
✅ Easy-to-use PowerShell scripts for backup/restore

---

## 📝 **Regular Backup Commands**

### **Create a Backup**
```powershell
npm run backup:env
```
This creates a timestamped backup in `uniclub-backend/.env-backups/`

### **Restore from Backup**
```powershell
npm run restore:env
```
Interactive menu to choose which backup to restore

---

## 🔄 **Recommended Workflow**

1. **Before major changes**: Run `npm run backup:env`
2. **Daily development**: Backups are auto-created (last 5 kept)
3. **After updates**: Verify .env still exists
4. **If something breaks**: Run `npm run restore:env`

---

## 🆘 **Emergency Recovery**

If you deleted the .env file:

1. **DON'T PANIC!** 
2. Run: `npm run restore:env`
3. If that fails, check: `uniclub-backend/.env.backup`
4. If that fails, manually recreate using the template above

---

## 📍 **Important Files to NEVER Delete**

- `uniclub-backend/.env` ← **Your main config**
- `uniclub-backend/.env.backup` ← **Static backup**
- `uniclub-backend/.env-backups/` ← **Timestamped backups folder**

---

## ✅ **Safety Checklist**

- [ ] `.env` file exists and has all keys
- [ ] `.env.backup` exists as fallback
- [ ] `.env-backups/` folder has recent backups
- [ ] Servers start successfully with current .env
- [ ] All API features work (MongoDB, AI, News)

---

## 🔐 **Security Notes**

1. **NEVER** commit `.env` to Git
2. **NEVER** share `.env` contents publicly
3. **DO** backup regularly with `npm run backup:env`
4. **DO** keep `.env.backup` up to date when keys change
5. **DO** store keys in a password manager as additional backup

---

## 🎯 **Quick Commands Reference**

```powershell
# Backup current .env
npm run backup:env

# Restore from backup (interactive)
npm run restore:env

# Copy static backup to .env
Copy-Item uniclub-backend\.env.backup -Destination uniclub-backend\.env

# Check if .env exists
Test-Path uniclub-backend\.env

# View .env contents (be careful!)
Get-Content uniclub-backend\.env
```

---

**Remember: Your `.env` file is the heart of your app. Protect it!** 🛡️

