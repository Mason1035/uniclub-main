# 🚀 AI Club Backend API Documentation

## 📱 Complete User Features API

### 🔐 Authentication (Already Implemented)
- `POST /api/auth/signup-step1` - Validate UTD email
- `POST /api/auth/signup-step2` - Verify unique club ID
- `POST /api/auth/signup-step3` - Complete registration
- `POST /api/auth/login` - User login
- `GET /api/auth/validate` - Validate JWT token
- `GET /api/auth/me` - Get current user profile

---

## 👤 User Profile Management

### 📸 Avatar/Display Picture
```javascript
// Upload/Update Avatar
POST /api/users/avatar
Content-Type: multipart/form-data
Authorization: Bearer <token>
Body: { avatar: <file> }
Response: { success: true, avatarUrl: "/uploads/avatar-123.jpg" }

// Delete Avatar
DELETE /api/users/avatar
Authorization: Bearer <token>
Response: { success: true, message: "Avatar deleted successfully" }

// Get User Avatar
GET /api/users/avatar/:userId
Response: <image file> with cache headers
```

### 📝 Profile Information
```javascript
// Update Profile
PUT /api/users/profile
Authorization: Bearer <token>
Body: {
  bio: "Software engineering student passionate about AI",
  year: "Junior",
  major: "Computer Science",
  interests: ["AI/ML", "Web Development"],
  phoneNumber: "+1-555-0123",
  socialLinks: {
    linkedin: "linkedin.com/in/username",
    github: "github.com/username",
    twitter: "@username",
    portfolio: "portfolio.com"
  },
  location: {
    city: "Dallas",
    state: "TX",
    country: "US"
  }
}
Response: { success: true, user: <updated user object> }

// Get Current User Profile
GET /api/users/me
Authorization: Bearer <token>
Response: { success: true, user: <user object> }
```

---

## 🎯 Universal Engagement System

### ❤️ Like/Save/Share Content
```javascript
// Like any content (News, SocialPost, Event, Comment)
POST /api/engagement/like/:contentType/:contentId
Authorization: Bearer <token>
Response: { success: true, liked: true, engagement: <engagement object> }

// Save content (News, SocialPost, Event)
POST /api/engagement/save/:contentType/:contentId
Authorization: Bearer <token>
Response: { success: true, saved: true, engagement: <engagement object> }

// Share content
POST /api/engagement/share/:contentType/:contentId
Authorization: Bearer <token>
Response: { success: true, shared: true, engagement: <engagement object> }

// Record view
POST /api/engagement/view/:contentType/:contentId
Authorization: Bearer <token>
Response: { success: true, viewed: true, engagement: <engagement object> }
```

### 📊 Get Engagement Data
```javascript
// Get user's engagement for specific content
GET /api/engagement/user/:contentType/:contentId
Authorization: Bearer <token>
Response: { 
  success: true, 
  engagement: { liked: true, saved: false, shared: true, viewed: true } 
}

// Get user's liked content
GET /api/engagement/user/liked/:contentType?page=1&limit=20
Authorization: Bearer <token>
Response: { success: true, content: [<content objects>], page: 1, limit: 20 }

// Get user's saved content
GET /api/engagement/user/saved/:contentType?page=1&limit=20
Authorization: Bearer <token>
Response: { success: true, content: [<content objects>], page: 1, limit: 20 }

// Get engagement stats for content
GET /api/engagement/stats/:contentType/:contentId
Response: { 
  success: true, 
  stats: { totalLikes: 15, totalSaves: 8, totalShares: 3, totalViews: 142 } 
}

// Get batch engagement for multiple items
POST /api/engagement/batch/:contentType
Authorization: Bearer <token>
Body: { contentIds: ["id1", "id2", "id3"] }
Response: { success: true, engagements: { "id1": <engagement>, "id2": <engagement> } }
```

---

## 📱 Enhanced Social Posts

### 📸🎥 Create Posts with Media
```javascript
// Create post with images/videos
POST /api/social
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: {
  content: "Check out this amazing AI project!",
  media: [<image/video files>], // Up to 5 files, 50MB max
  hashtags: ["AI", "MachineLearning", "ProjectShowcase"],
  mentions: ["userId1", "userId2"],
  visibility: "club-members" // public, club-members, friends, private
}
Response: {
  success: true,
  post: {
    _id: "...",
    content: "...",
    media: [
      {
        type: "image",
        url: "/uploads/social/image-123.jpg",
        filename: "image-123.jpg",
        size: 1024000
      },
      {
        type: "video", 
        url: "/uploads/social/video-456.mp4",
        filename: "video-456.mp4",
        size: 5120000,
        thumbnail: "/uploads/social/thumb-video-456.jpg"
      }
    ],
    hashtags: ["AI", "MachineLearning"],
    mentions: [<user objects>],
    author: <user object>,
    engagement: { likeCount: 0, commentCount: 0, shareCount: 0, views: 0 },
    createdAt: "2024-01-15T10:30:00Z"
  }
}
```

### 📋 Get Social Posts
```javascript
// Get social feed
GET /api/social?page=1&limit=20&visibility=club-members
Response: { success: true, posts: [<post objects>], pagination: {...} }

// Get user's posts
GET /api/social/user/:userId?page=1&limit=20
Response: { success: true, posts: [<post objects>], pagination: {...} }

// Get posts by hashtag
GET /api/social/hashtag/:tag?page=1&limit=20
Response: { success: true, posts: [<post objects>], pagination: {...} }
```

---

## 📅 Event Management & RSVP

### 🎪 Event Operations
```javascript
// Get all events
GET /api/events?page=1&limit=20&status=published&upcoming=true&eventType=Workshop&category=AI/ML&search=machine learning
Response: {
  success: true,
  events: [<event objects>],
  pagination: { page: 1, limit: 20, total: 45, pages: 3 }
}

// Get specific event
GET /api/events/:id
Response: { success: true, event: <event object with organizer and speakers> }

// Create event
POST /api/events
Authorization: Bearer <token>
Body: {
  title: "Machine Learning Workshop",
  description: "Hands-on ML workshop for beginners",
  startDate: "2024-02-15T14:00:00Z",
  endDate: "2024-02-15T17:00:00Z",
  location: {
    type: "physical", // physical, virtual, hybrid
    address: "Room 301, Engineering Building",
    room: "Room 301",
    coordinates: { latitude: 32.7767, longitude: -96.7970 }
  },
  eventType: "Workshop",
  category: ["AI/ML", "Education"],
  maxCapacity: 30,
  rsvpDeadline: "2024-02-14T23:59:59Z",
  speakers: [
    {
      name: "Dr. Jane Smith",
      bio: "ML Expert",
      title: "Professor of Computer Science"
    }
  ],
  prerequisites: ["Basic Python knowledge"],
  tags: ["beginner-friendly", "hands-on"],
  skillLevel: "Beginner"
}
Response: { success: true, event: <created event> }

// Update event (organizer only)
PUT /api/events/:id
Authorization: Bearer <token>
Body: <event update data>
Response: { success: true, event: <updated event> }
```

### 🎫 RSVP System
```javascript
// RSVP to event
POST /api/events/:id/rsvp
Authorization: Bearer <token>
Body: {
  status: "going", // going, maybe, not_going
  guestCount: 1,
  dietaryRestrictions: ["vegetarian"],
  accessibilityNeeds: ["wheelchair access"],
  notes: "Looking forward to this workshop!"
}
Response: { success: true, rsvp: <rsvp object> }

// Get user's RSVP status
GET /api/events/:id/rsvp
Authorization: Bearer <token>
Response: { success: true, rsvp: <rsvp object or null> }

// Cancel RSVP
DELETE /api/events/:id/rsvp
Authorization: Bearer <token>
Response: { success: true, message: "RSVP cancelled successfully" }

// Get event attendees
GET /api/events/:id/attendees?status=going
Response: { success: true, attendees: [<user objects with RSVP info>] }
```

### 📅 Calendar Integration
```javascript
// Get calendar data for event
POST /api/events/:id/calendar
Authorization: Bearer <token>
Body: { calendarEventId: "external-calendar-id" } // Optional
Response: {
  success: true,
  calendarData: {
    title: "Machine Learning Workshop",
    description: "...",
    start: "2024-02-15T14:00:00Z",
    end: "2024-02-15T17:00:00Z",
    location: "Room 301, Engineering Building",
    organizer: { name: "AI Club", email: "events@aiclub.com" },
    reminders: [
      { method: "email", minutes: 1440 }, // 1 day before
      { method: "popup", minutes: 30 }    // 30 minutes before
    ]
  }
}
```

### 👥 User Event Management
```javascript
// Get user's events (organized + RSVP'd)
GET /api/events/user/mine?type=all&status=published&page=1&limit=20
// type: all, organized, rsvp
Authorization: Bearer <token>
Response: {
  success: true,
  events: [
    {
      ...eventData,
      type: "organized", // or "rsvp"
      rsvpStatus: "going" // only for RSVP'd events
    }
  ]
}

// Get recommended events
GET /api/events/user/recommended?limit=10
Authorization: Bearer <token>
Response: { success: true, events: [<recommended events based on interests>] }

// Check in user (organizer only)
POST /api/events/:id/checkin/:userId
Authorization: Bearer <token>
Response: { success: true, message: "User checked in successfully" }
```

---

## 💬 Enhanced Comments (Already Implemented)
- `POST /api/comments/article/:articleId` - Create comment
- `GET /api/comments/article/:articleId` - Get comments
- `PUT /api/comments/:id/like` - Like comment
- Threading and replies supported

---

## 🔧 Frontend Integration Examples

### React Hook for Engagement
```javascript
// Custom hook for content engagement
const useEngagement = (contentType, contentId) => {
  const [engagement, setEngagement] = useState(null);
  
  const toggleLike = async () => {
    const response = await fetch(`/api/engagement/like/${contentType}/${contentId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setEngagement(data.engagement);
  };
  
  // Similar for save, share, etc.
  return { engagement, toggleLike, toggleSave, share };
};
```

### Event RSVP Component
```javascript
const EventRSVP = ({ eventId }) => {
  const [rsvpStatus, setRsvpStatus] = useState(null);
  
  const handleRSVP = async (status) => {
    const response = await fetch(`/api/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    setRsvpStatus(data.rsvp.status);
  };
  
  const addToCalendar = async () => {
    const response = await fetch(`/api/events/${eventId}/calendar`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { calendarData } = await response.json();
    // Use calendarData to create calendar event
  };
};
```

---

## 🗄️ Database Schema Overview

- **UserEngagement**: Centralized tracking of all user interactions
- **Event**: Complete event management with scheduling and capacity
- **EventRSVP**: Individual RSVPs with calendar integration
- **SocialPost**: Enhanced with media, hashtags, mentions
- **User**: Extended profile with social links and stats

All endpoints include proper authentication, validation, error handling, and consistent response formats. 