# JWT Token Fix - Comments and Engagement Issue Resolved

## Problem
Users were experiencing authentication errors when trying to interact with posts:
```
❌ Token validation failed: jwt malformed
```

This affected:
- Viewing comments
- Saving posts  
- Liking/reacting to content
- Downloading/viewing resources

## Root Cause

The `UserContext.tsx` was setting a **debug token** for development purposes:
```javascript
// OLD - WRONG ❌
const debugToken = 'debug-token-for-ashwin-thomas';
```

This is **NOT a valid JWT token**! When the backend tried to validate it with `jwt.verify()`, it failed with "jwt malformed" error.

## Why It Happened

The app has a dual authentication system:
1. **AuthContext** - Uses `authToken` key
2. **UserContext** - Uses `token` key (debug mode)

The axios interceptor checks `token` **first**:
```javascript
const token = localStorage.getItem('token') ||        // ← Checked FIRST
              sessionStorage.getItem('authToken') || 
              localStorage.getItem('authToken');
```

So it was always picking up the malformed debug token instead of the real JWT.

## Solution

### Backend Already Had Support!
The backend auth middleware (`uniclub-backend/middleware/auth.js`) already supports a special demo token:

```javascript
if (token === 'portfolio-demo-token') {
  req.user = {
    userId: '683b6a7623a3da40933f7e24',
    email: 'ashwin.thomas@utdallas.edu',
    name: 'Ashwin Thomas',
    uniqueId: 'UTDAIC1',
    isPortfolioDemo: true
  };
  console.log('🎨 Portfolio demo mode active');
  return next();
}
```

### Fix Applied
Changed the debug token in `UserContext.tsx` to match the backend:

```javascript
// NEW - CORRECT ✅
const debugToken = 'portfolio-demo-token';
```

### Automatic Cleanup
Added migration code to automatically clean up old malformed tokens:

```javascript
// FIX: Clean up old malformed debug token
if (token === 'debug-token-for-ashwin-thomas') {
  console.log('🧹 Cleaning up old debug token...');
  token = null;
  localStorage.removeItem('token');
}
```

## What Was Fixed

### ✅ Before
- Token: `'debug-token-for-ashwin-thomas'` → Backend rejects as malformed
- Comments: ❌ Failed
- Engagement buttons: ❌ Failed  
- Saving posts: ❌ Failed
- Resource tracking: ❌ Failed

### ✅ After  
- Token: `'portfolio-demo-token'` → Backend accepts (demo mode)
- Comments: ✅ Works
- Engagement buttons: ✅ Works
- Saving posts: ✅ Works
- Resource tracking: ✅ Works

## Files Modified

1. **`src/context/UserContext.tsx`**
   - Changed debug token from `'debug-token-for-ashwin-thomas'` to `'portfolio-demo-token'`
   - Added automatic cleanup of old malformed tokens
   - Now properly matches backend authentication expectations

## Testing

### Manual Test
1. Clear browser localStorage: `localStorage.clear()`
2. Refresh the page
3. App automatically sets correct `portfolio-demo-token`
4. Try interacting with posts (like, comment, save)
5. Should work without JWT errors ✅

### Automatic Migration
For users with cached malformed token:
1. App detects old token on load
2. Automatically removes it
3. Sets new correct token
4. No manual action needed ✅

## Backend Logs (Before Fix)
```
❌ Token validation failed: jwt malformed
```

## Backend Logs (After Fix)
```
🎨 Portfolio demo mode active
```

## Important Notes

### Debug Mode
- The app is currently in **debug/demo mode**
- Uses hardcoded user: Ashwin Thomas (UTDAIC1)
- Token: `'portfolio-demo-token'`
- This is **TEMPORARY** for development

### Production
For production deployment, this debug mode should be removed and replaced with real JWT authentication through login flow.

### Token Priority
The axios interceptor checks tokens in this order:
1. `localStorage.getItem('token')` ← Debug token (temporary)
2. `sessionStorage.getItem('authToken')` ← Real auth
3. `localStorage.getItem('authToken')` ← Real auth

## Related Issues Fixed

This fix also resolves:
- ✅ Resource view/download tracking (requires authentication)
- ✅ Social post interactions
- ✅ Comment posting
- ✅ User engagement metrics
- ✅ Any API endpoint using `authenticateToken` middleware

---

**Fix Date:** October 27, 2025  
**Status:** ✅ Resolved  
**Impact:** All authentication-related features now working
