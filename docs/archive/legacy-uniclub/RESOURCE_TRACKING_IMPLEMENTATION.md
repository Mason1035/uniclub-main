# Resource Click Tracking Implementation

## Overview
Implemented a **user-specific click tracking system** for resource views and downloads. Each user is counted **only once** per action type (view/download) per resource, and tracking happens **ONLY when the user clicks** the relevant buttons.

## Key Changes

### 1. Backend Routes (`uniclub-backend/routes/resourceRouter.js`)

#### View Tracking (`POST /api/resources/:id/view`)
- ✅ **Requires authentication** - uses `authenticateToken` middleware
- ✅ **Checks UserEngagement** - verifies if user already viewed
- ✅ **Prevents duplicates** - only increments count for first view
- ✅ **Records engagement** - stores view timestamp in `UserEngagement` model
- ✅ **Returns status** - tells frontend if this was a new view or duplicate

**Behavior:**
```
First view by user  → Increment count, return { newView: true }
Second view by user → Don't increment, return { newView: false }
```

#### Download Tracking (`POST /api/resources/:id/download`)
- ✅ **Requires authentication** - uses `authenticateToken` middleware  
- ✅ **Checks UserEngagement** - verifies if user already downloaded
- ✅ **Prevents duplicates** - only increments count for first download
- ✅ **Records engagement** - stores download timestamp in `UserEngagement` model
- ✅ **Returns status** - tells frontend if this was a new download or duplicate

**Behavior:**
```
First download by user  → Increment count, return { newDownload: true }
Second download by user → Don't increment, return { newDownload: false }
```

### 2. Frontend Changes (`src/pages/ResourceDetailPage.tsx`)

#### Removed Auto-Tracking
- ❌ **REMOVED** automatic view tracking on page load (lines 52-64)
- ✅ Views are now **ONLY** tracked when user clicks the "View" button

#### Updated Click Handlers

**`handleDownload()`:**
```typescript
- Uses authenticated api.post() instead of fetch()
- Tracks download when user clicks "Download PDF" button
- Shows console feedback for new vs. duplicate downloads
- Still allows download even if tracking fails
```

**`handleView()`:**
```typescript
- Uses authenticated api.post() instead of fetch()
- Tracks view when user clicks "Watch Video" / "Explore" / "Learn More" button
- Shows console feedback for new vs. duplicate views
- Still allows viewing even if tracking fails
```

## How It Works

### Database Schema

**UserEngagement Model** (tracks individual user actions):
```javascript
{
  user: ObjectId,           // Reference to User
  contentType: 'Resource',  // Type of content
  contentId: ObjectId,      // Reference to Resource
  viewed: Boolean,          // Has user viewed?
  viewedAt: Date,          // When did they view?
  downloaded: Boolean,      // Has user downloaded?
  downloadedAt: Date,      // When did they download?
  lastEngagedAt: Date      // Last engagement timestamp
}
```

**Resource Model** (aggregated counts):
```javascript
{
  title: String,
  type: String,            // Document, Video, Tutorial, Tool
  views: Number,          // Total unique views
  downloadCount: Number,  // Total unique downloads
  // ... other fields
}
```

### Flow Diagram

```
User clicks "Download PDF" or "Watch Video"
         ↓
Frontend calls POST /api/resources/:id/download or /view
         ↓
Backend checks: Has this user already done this action?
         ↓
    ┌─────┴─────┐
    NO          YES
    ↓            ↓
1. Create/Update UserEngagement record
2. Increment Resource counter
3. Return { newView/newDownload: true }
                Return { newView/newDownload: false }
```

## Resource Types & Tracking

| Resource Type | Metric Tracked | Trigger Action |
|--------------|----------------|----------------|
| **Document** | Downloads | User clicks "Download PDF" button |
| **Video** | Views | User clicks "Watch Video" button |
| **Tutorial** | Views | User clicks "Learn More" button |
| **Tool** | Views | User clicks "Explore" button |

## Testing the Implementation

### Test 1: First View/Download (Should Count)
```
1. Login as User A
2. Navigate to a resource detail page
3. Click "Watch Video" or "Download PDF"
4. Check console: Should see "✅ View/Download tracked successfully"
5. Check database: Resource count should increment by 1
6. Check database: UserEngagement record should be created
```

### Test 2: Duplicate View/Download (Should NOT Count)
```
1. Stay logged in as User A
2. Refresh the page or navigate back
3. Click the same button again
4. Check console: Should see "ℹ️ You already viewed/downloaded this resource"
5. Check database: Resource count should NOT change
6. Check database: UserEngagement record unchanged
```

### Test 3: Different Users (Each Should Count Once)
```
1. Login as User A → Click download → Count = 1
2. Logout
3. Login as User B → Click download → Count = 2
4. Logout  
5. Login as User C → Click download → Count = 3
```

### Test 4: Authentication Required
```
1. Logout (no user logged in)
2. Try to click "Download PDF" or "Watch Video"
3. API should return 401 Unauthorized
4. Count should NOT increment
```

## API Responses

### Success - New Engagement
```json
{
  "success": true,
  "message": "View count updated",
  "views": 42,
  "newView": true
}
```

### Success - Duplicate Engagement
```json
{
  "success": true,
  "message": "Already viewed",
  "views": 42,
  "newView": false
}
```

### Error - Not Authenticated
```json
{
  "error": "Access denied. No token provided."
}
```

### Error - Resource Not Found
```json
{
  "error": "Resource not found"
}
```

## Database Queries

### Get all users who viewed a resource:
```javascript
UserEngagement.find({
  contentType: 'Resource',
  contentId: resourceId,
  viewed: true
}).populate('user', 'name email');
```

### Get all resources a user has downloaded:
```javascript
UserEngagement.find({
  user: userId,
  contentType: 'Resource',
  downloaded: true
}).populate('contentId');
```

### Get engagement stats for a resource:
```javascript
const stats = await UserEngagement.aggregate([
  { $match: { contentType: 'Resource', contentId: resourceId } },
  {
    $group: {
      _id: null,
      totalViews: { $sum: { $cond: ['$viewed', 1, 0] } },
      totalDownloads: { $sum: { $cond: ['$downloaded', 1, 0] } }
    }
  }
]);
```

## Important Notes

### ✅ What Changed
1. **Views**: Now tracked ONLY on button click (not on page load)
2. **Downloads**: Now track each user only once
3. **Authentication**: Both endpoints now require login
4. **UserEngagement**: Properly tracks individual user actions

### ⚠️ Breaking Changes
- **Unauthenticated users** can no longer trigger view/download counts
- **Page views** (without clicking) are NOT counted anymore
- Existing counts in database are preserved but tracking method changed

### 🔄 Migration Needed?
No migration needed! Existing counts remain valid. New tracking system starts from this point forward.

### 🚀 Future Enhancements
- Add visual indicator showing "You've already downloaded this"
- Show download/view history in user profile
- Add analytics dashboard showing which resources are most engaged
- Export engagement data for reports

## Files Modified

1. `uniclub-backend/routes/resourceRouter.js` - Updated view/download endpoints
2. `src/pages/ResourceDetailPage.tsx` - Updated click handlers, removed auto-tracking
3. `src/components/cards/ResourceCard.tsx` - Updated action button tracking with authentication
4. `RESOURCE_TRACKING_IMPLEMENTATION.md` - This documentation

## Database Models Used

1. `uniclub-backend/models/UserEngagement.js` - Tracks individual user actions
2. `uniclub-backend/models/Resource.js` - Stores aggregated counts

---

**Implementation Date:** October 27, 2025  
**Status:** ✅ Complete and tested

