# Dynamic Navigation System

## Overview

This document describes the implementation of the dynamic navigation breadcrumb system that provides users with contextual "Back to..." navigation throughout the app.

## Features

- **Dynamic breadcrumb text**: Shows "Back to Home", "Back to News", "Back to Events", etc. based on the source page
- **Smart fallbacks**: When no referrer is provided, uses intelligent defaults based on content type
- **Consistent styling**: Unified back navigation component across all detail pages
- **Clean design**: Simple, accessible navigation without visual clutter

## Implementation

### Core Components

#### 1. NavigationUtils (`src/utils/navigationUtils.ts`)
Provides utility functions for:
- Mapping paths to page information (title, icon, fallback path)
- Generating dynamic navigation text
- Validating referrer paths
- Smart defaults based on content type

#### 2. BackNavigation Component (`src/components/BackNavigation.tsx`)
A reusable component that:
- Automatically determines the correct "Back to..." text
- Shows contextual icons
- Provides consistent styling
- Supports both sticky headers and inline usage

### Updated Pages

All detail pages now use the new BackNavigation component:

1. **ArticlePage** (`/article/:id`)
   - Shows "Back to News" when coming from NewsPage
   - Shows "Back to Home" when coming from Homepage
   - Falls back to "Back to News" if no referrer

2. **EventDetailPage** (`/event/:id`)
   - Shows "Back to Events" when coming from EventsPage
   - Shows "Back to Home" when coming from Homepage
   - Falls back to "Back to Events" if no referrer

3. **ResourceDetailPage** (`/resource/:id`)
   - Shows "Back to Resources" when coming from ResourcesPage
   - Shows "Back to Home" when coming from Homepage
   - Falls back to "Back to Resources" if no referrer

4. **CommentsPage** (`/comments/:type/:id`)
   - Dynamically shows back navigation based on content type
   - "Back to News" for news comments
   - "Back to Events" for event comments
   - "Back to Social" for social comments
   - "Back to Resources" for resource comments

### Card Components

All card components now pass referrer information:

1. **NewsCard** - Passes `location.pathname` when navigating to ArticlePage
2. **EventCard** - Passes `location.pathname` when navigating to EventDetailPage  
3. **ResourceCard** - Passes `location.pathname` when navigating to ResourceDetailPage
4. **SocialCard** - Passes `location.pathname` when navigating to CommentsPage

## Navigation Flow Examples

### Homepage → News Article
1. User clicks NewsCard on Homepage (`/`)
2. NewsCard navigates to `/article/123` with `state: { referrer: '/' }`
3. ArticlePage shows "Back to Home" in header
4. User clicks back → returns to Homepage

### News Page → News Article  
1. User clicks NewsCard on NewsPage (`/news`)
2. NewsCard navigates to `/article/123` with `state: { referrer: '/news' }`
3. ArticlePage shows "Back to News" in header
4. User clicks back → returns to NewsPage

### Featured Content → Event Details
1. User clicks featured event on Homepage (`/`)
2. FeaturedContent navigates to `/event/456` with `state: { referrer: '/' }`
3. EventDetailPage shows "Back to Home" in header
4. User clicks back → returns to Homepage

### Event → Comments
1. User clicks "Comments" on event from EventsPage (`/events`)
2. Navigates to `/comments/event/456` with `state: { referrer: '/events' }`
3. CommentsPage shows "Back to Events" in header
4. User clicks back → returns to EventsPage

## Benefits

- **Better UX**: Users always know where they came from and can easily return
- **Contextual**: Navigation text changes based on the source page
- **Consistent**: Same navigation behavior across all pages
- **Resilient**: Smart fallbacks ensure navigation always works
- **Accessible**: Clear, descriptive navigation labels

## Usage

To use the BackNavigation component in a new page:

```tsx
import BackNavigation from '../components/BackNavigation';

// In your component
<BackNavigation 
  referrer={location.state?.referrer}
  contentType="news" // or "event", "resource", "social"
  fallbackReferrer="/news"
/>
```

The component will automatically handle the rest!
