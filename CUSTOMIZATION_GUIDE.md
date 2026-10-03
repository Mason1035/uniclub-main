# 🎨 Uniclub Customization Guide

## 📋 Table of Contents
- [Branding & Logos](#branding--logos)
- [Club Switcher Configuration](#club-switcher-configuration)
- [Color Theming](#color-theming)
- [Portfolio Demo Mode](#portfolio-demo-mode)
- [PWA Configuration](#pwa-configuration)
- [Environment Configuration](#environment-configuration)

---

## 🎨 Branding & Logos

### Changing the Main Club Logo

The main club logo appears in the top-left corner of the application.

**Location:** `public/Assets/Logo.png`

**Steps:**
1. Replace the file at `public/Assets/Logo.png` with your club logo
2. Recommended size: **512x512px** (or larger, square aspect ratio)
3. Supported formats: PNG, JPG, WEBP
4. Transparent background recommended for PNG files

```bash
# Example: Copy your new logo
cp your-new-logo.png public/Assets/Logo.png
```

**Where it appears:**
- Top-left navigation header
- Club switcher current club display

---

### Changing the Favicon & App Icons

The favicon and app icons appear in browser tabs and when the app is installed as a PWA.

**Location:** `public/Assets/App Logo.png`

**Steps:**
1. Replace the file at `public/Assets/App Logo.png`
2. Recommended size: **512x512px** minimum
3. Format: PNG with transparent background
4. This single file is used for all icon sizes (192x192, 512x512)

**Configured in:**
- `index.html` (line 11): Browser favicon
- `index.html` (line 16): Apple touch icon
- `manifest.json` (lines 15-25): PWA icons

**No rebuild required** - Just replace the file and refresh!

---

### Changing the App Name

**1. Browser Title**
- File: `index.html`
- Line 6: `<title>Uniclub</title>`
- Change "Uniclub" to your club name

**2. PWA Manifest**
- File: `public/manifest.json`
- Lines 2-3:
```json
{
  "name": "Your Club Name",
  "short_name": "YourClub",
  ...
}
```

**3. Navigation Header**
- File: `src/components/Layout.tsx`
- Line 261: `<h1 className="text-white text-lg font-bold font-avigea tracking-[1px]">AI Biz</h1>`
- Replace "AI Biz" with your club name

**4. Welcome Message**
- File: `src/components/WelcomeCard.tsx`
- Line 31: Change "Hello, Ashwin!" to your preferred greeting

---

## 🔄 Club Switcher Configuration

The club switcher dropdown allows users to switch between multiple clubs they're part of.

**Location:** `src/components/Layout.tsx` (lines 44-50)

### Adding/Editing Clubs

```typescript
const clubs = [
  { id: 1, name: 'AI Biz', logo: '/Assets/Logo.png', isActive: true },
  { id: 2, name: 'Tech Innovators', logo: '/Assets/2.png', isActive: false },
  { id: 3, name: 'Data Science Club', logo: '/Assets/3.png', isActive: false },
  { id: 4, name: 'Robotics Society', logo: '/Assets/4.png', isActive: false },
  { id: 5, name: 'Code Warriors', logo: '/Assets/5.png', isActive: false },
];
```

### Adding New Clubs

**Steps:**
1. Add your club logo to `public/Assets/` (e.g., `6.png`, `7.png`)
2. Add entry to the clubs array:
```typescript
{ id: 6, name: 'Your New Club', logo: '/Assets/6.png', isActive: false }
```

### Logo Requirements
- **Recommended size:** 256x256px or larger
- **Format:** PNG, JPG, WEBP
- **Naming:** Use simple numbers (2.png, 3.png, etc.) or descriptive names
- **Location:** `public/Assets/`

**Current Club Logos:**
- `Logo.png` - Main club logo (currently active)
- `2.png` - Tech Innovators
- `3.png` - Data Science Club
- `4.png` - Robotics Society
- `5.png` - Code Warriors

---

## 🎨 Color Theming

### Primary Brand Colors

**Current Theme:** Orange gradient

**Location:** Multiple files (search and replace recommended)

**Main Colors Used:**
- Orange gradient: `from-orange-400 via-orange-500 to-orange-600`
- Accent: `orange-500`, `orange-600`
- Hover states: `hover:from-orange-500 hover:to-orange-700`

### Changing Brand Colors

**Example: Change from Orange to Blue**

1. **Global Search & Replace:**
```bash
# Find all instances
grep -r "orange-400\|orange-500\|orange-600" src/
```

2. **Common Replacements:**
- `orange-400` → `blue-400`
- `orange-500` → `blue-500`
- `orange-600` → `blue-600`

**Files with branding colors:**
- `src/components/Layout.tsx` - Header gradient
- `src/components/UserProfile.tsx` - Profile UI
- `src/components/WelcomeCard.tsx` - Welcome section
- `src/pages/NotificationsPage.tsx` - Notifications
- `tailwind.config.ts` - Global theme config

### Tailwind Theme Configuration

**File:** `tailwind.config.ts`

```typescript
export default {
  theme: {
    extend: {
      colors: {
        // Add custom colors here
        primary: {
          50: '#...',
          100: '#...',
          // ... up to 900
        }
      }
    }
  }
}
```

---

## 🎭 Portfolio Demo Mode

The app includes a portfolio demo mode that auto-logs visitors in for demonstrations.

### How It Works

**Configured in:**
- `src/utils/portfolioDemo.ts` - Demo token and user setup
- `src/context/UserContext.tsx` - Auto-login logic
- `uniclub-backend/middleware/auth.js` - Backend demo authentication

### Customizing Demo User

**File:** `src/utils/portfolioDemo.ts` (lines 10-14)

```typescript
export const DEMO_USER = {
  email: 'your.email@utdallas.edu',
  name: 'Your Name',
  uniqueId: 'YOUR_ID',
};
```

**Also update in:**
- `src/context/UserContext.tsx` (lines 118-120)
- `uniclub-backend/middleware/auth.js` (lines 32-34)

### Disabling Portfolio Mode

To require real authentication, remove or comment out:

**File:** `src/App.tsx` (line 28)
```typescript
// initPortfolioDemo(); // Comment this line
```

---

## 📱 PWA Configuration

### Manifest Settings

**File:** `public/manifest.json`

```json
{
  "name": "Uniclub Today Feed",
  "short_name": "Uniclub",
  "description": "Uniclub news and social feed application",
  "theme_color": "#059669",        // Main theme color
  "background_color": "#ffffff",   // Launch screen background
  "display": "standalone",
  "orientation": "portrait-primary",
  "start_url": "/",
  "icons": [...]
}
```

### Key Customizations

**1. Theme Color**
- Change `theme_color` to match your brand color (hex code)
- This affects the mobile browser UI

**2. Display Mode**
- `standalone` - Looks like a native app (recommended)
- `fullscreen` - Completely hides browser UI
- `minimal-ui` - Minimal browser controls
- `browser` - Regular browser view

**3. App Icons**
```json
"icons": [
  {
    "src": "Assets/App Logo.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any maskable"
  }
]
```

---

## ⚙️ Environment Configuration

### Required Environment Variables

**File:** `uniclub-backend/.env`

```bash
# MongoDB Connection (Required)
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/uniclub

# JWT Secret (Required - Generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Server Configuration
PORT=5000

# News API Key (Get from https://newsapi.org/)
NEWS_API_KEY=your-news-api-key

# Google Gemini API Key (Get from https://ai.google.dev/)
GEMINI_API_KEY=your-gemini-api-key
```

### Generating Secure JWT Secret

**Option 1: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Option 2: OpenSSL**
```bash
openssl rand -hex 64
```

**Option 3: PowerShell (Windows)**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

### API Keys Setup

**1. News API**
- Visit: https://newsapi.org/
- Sign up for free account
- Copy API key to `.env`
- Free tier: 100 requests/day

**2. Google Gemini**
- Visit: https://ai.google.dev/
- Create account / project
- Enable the Gemini API and generate an API key
- Copy key to `.env` as `GEMINI_API_KEY`

**3. MongoDB Atlas**
- Visit: https://www.mongodb.com/cloud/atlas
- Create free cluster
- Get connection string
- Replace `USERNAME` and `PASSWORD` with your credentials

---

## 🔐 Security Best Practices

### Environment Files

**✅ DO:**
- Keep `.env` files out of version control (already in `.gitignore`)
- Use different credentials for development/production
- Rotate API keys regularly
- Use strong, random JWT secrets

**❌ DON'T:**
- Commit `.env` files to Git
- Share credentials in documentation
- Use default/weak secrets in production
- Store credentials in code files

### Backup Strategy

The app includes automatic `.env` backup:
- Backups stored in: `uniclub-backend/.env-backups/`
- Manual backup: `npm run backup:env`
- Restore backup: `npm run restore:env`

---

## 📝 Customization Checklist

Before deploying your customized app:

- [ ] Replace main club logo (`public/Assets/Logo.png`)
- [ ] Replace favicon (`public/Assets/App Logo.png`)
- [ ] Update app name in `index.html` and `manifest.json`
- [ ] Configure club switcher logos and names
- [ ] Customize welcome message
- [ ] Update demo user information
- [ ] Change brand colors if needed
- [ ] Update PWA manifest settings
- [ ] Configure environment variables
- [ ] Generate secure JWT secret
- [ ] Test all features after customization
- [ ] Verify mobile PWA installation works
- [ ] Check dark mode compatibility

---

## 🚀 After Customization

### Testing Your Changes

**1. Start Development Servers**
```powershell
# Windows
npm run start:win

# Linux/Mac
npm start
```

**2. Test Checklist**
- [ ] Logo appears correctly in header
- [ ] Favicon shows in browser tab
- [ ] App name displays correctly
- [ ] Club switcher works with new logos
- [ ] Colors theme applied consistently
- [ ] PWA installs correctly on mobile
- [ ] Dark mode works properly

**3. Production Build**
```bash
npm run build
```

### Deployment

See [README.md](README.md) for deployment instructions.

---

## 💡 Tips & Tricks

### Logo Design Tips
- Use vector graphics (SVG) when possible for crisp display
- Include padding around logos for better visibility
- Test logos on both light and dark backgrounds
- Optimize image file sizes (use tools like TinyPNG)

### Color Scheme Tools
- [Coolors.co](https://coolors.co/) - Generate color palettes
- [Tailwind Color Generator](https://uicolors.app/create) - Create Tailwind color schemes
- [Adobe Color](https://color.adobe.com/) - Professional color tools

### Testing Tools
- Chrome DevTools - Test PWA installation
- Lighthouse - Check PWA compliance
- BrowserStack - Test on real devices

---

## 🆘 Need Help?

- **Documentation:** [README.md](README.md)
- **Windows Setup:** [WINDOWS_SETUP.md](WINDOWS_SETUP.md)
- **API Docs:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **News Curation:** [NEWS_CURATION_GUIDE.md](NEWS_CURATION_GUIDE.md)

---

**Made with ❤️ for the AI Club Community**

