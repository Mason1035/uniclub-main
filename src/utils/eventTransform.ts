/**
 * Utility functions for transforming event data between different formats
 */

export interface MongoEvent {
  id?: string;
  _id?: string;
  rsvpLink?: string;
  status?: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  eventType: string;
  category: string[];
  location?: {
    type: string;
    address?: string;
    room?: string;
    virtualLink?: string;
  };
  maxCapacity?: number;
  rsvpCount?: number;
  discussionCount?: number;
  likeCount?: number;
  shareCount?: number;
  saveCount?: number;
  commentCount?: number;
  likes?: number;
  shares?: number;
  saves?: number;
  comments?: number;
  views?: number;
  engagement?: {
    likes?: number;
    views: number;
    rsvpCount: number;
    attendedCount: number;
    likeCount: number;
    shareCount: number;
  };
  organizer?: {
    name: string;
    _id: string;
    uniqueId: string;
  };
  skillLevel?: string;
  prerequisites?: string[];
  tags?: string[];
  imageUrl?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    eventType: string;
    category: string[];
    description: string;
    location?: string;
    organizer?: string;
    skillLevel?: string;
    maxCapacity?: number;
    rsvpCount?: number;
  };
}

export interface EventCardData {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  attendeeCount: number;
  rsvpCount: number;
  discussionCount: number;
  imageUrl?: string;
  category: string;
  eventType: string;
  isFeatured?: boolean;
  isCompact?: boolean;
  likeCount?: number;
  shareCount?: number;
  saveCount?: number;
  commentCount?: number;
  views?: number;
}

/**
 * Transform MongoDB event to calendar event format
 */
export function transformToCalendarEvent(event: MongoEvent): CalendarEvent {
  const eventId = event.id || event._id || '';
  
  return {
    id: eventId,
    title: event.title,
    start: new Date(event.startDate),
    end: new Date(event.endDate),
    resource: {
      eventType: event.eventType,
      category: event.category || [],
      description: event.description,
      location: formatEventLocation(event.location),
      organizer: event.organizer?.name,
      skillLevel: event.skillLevel,
      maxCapacity: event.maxCapacity,
      rsvpCount: event.rsvpCount || 0,
    },
  };
}

/**
 * Transform MongoDB event to EventCard format
 */
export function transformToEventCard(event: MongoEvent): EventCardData {
  const eventId = event.id || event._id || '';
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  
  return {
    id: eventId,
    title: event.title,
    description: event.description,
    date: startDate.toLocaleDateString('zh-CN'),
    time: `${startDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
    location: formatEventLocation(event.location),
    attendeeCount: event.rsvpCount || 0,
    rsvpCount: event.rsvpCount || 0,
    discussionCount: event.discussionCount || 0,
    imageUrl: event.imageUrl,
    category: event.category?.[0] || 'General',
    eventType: event.eventType,
    isFeatured: false,
    isCompact: false,
    // Include engagement stats from backend data (matching API response format)
    likeCount: event.likeCount || event.likes || 0,
    shareCount: event.shareCount || event.shares || 0,
    saveCount: event.saveCount || event.saves || 0,
    commentCount: event.commentCount || event.comments || 0,
    views: event.views || 0,
  };
}

/**
 * Format event location for display
 */
export function formatEventLocation(location?: MongoEvent['location']): string {
  if (!location) return '地点待公布';
  
  switch (location.type) {
    case 'virtual':
      return '线上活动';
    case 'physical':
      // For card display, prioritize room name, fallback to address
      return location.room || location.address || '线下地点待公布';
    case 'hybrid': {
      const roomOrAddress = location.room || location.address || '线下地点待公布';
      return `${roomOrAddress} + 线上`;
    }
    default:
      return '地点待公布';
  }
}

/**
 * Get appropriate image URL based on event type and category
 */
function getEventImageUrl(eventType: string, category?: string[]): string {
  const baseUrl = 'https://images.unsplash.com';
  
  // Map event types to appropriate stock images
  const eventTypeImages: Record<string, string> = {
    'Workshop': `${baseUrl}/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop`, // AI/coding
    'Seminar': `${baseUrl}/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop`, // presentation/lecture
    'Bootcamp': `${baseUrl}/photo-1555949963-ff9fe0c870eb?w=800&h=400&fit=crop`, // intensive learning
    'Meetup': `${baseUrl}/photo-1552664730-d307ca884978?w=800&h=400&fit=crop`, // networking/social
    'Hackathon': `${baseUrl}/photo-1517077304055-6e89abbf09b0?w=800&h=400&fit=crop`, // coding/competition
    'Tutorial': `${baseUrl}/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop`, // learning/teaching
    'Social': `${baseUrl}/photo-1511632765486-a01980e01a18?w=800&h=400&fit=crop`, // social gathering
  };

  return eventTypeImages[eventType] || eventTypeImages['Workshop'];
}

/**
 * Check if an event is happening today
 */
export function isEventToday(event: MongoEvent): boolean {
  const today = new Date();
  const eventDate = new Date(event.startDate);
  
  return today.toDateString() === eventDate.toDateString();
}

/**
 * Check if an event is upcoming (in the future)
 */
export function isEventUpcoming(event: MongoEvent): boolean {
  const now = new Date();
  const eventStart = new Date(event.startDate);
  
  return eventStart > now;
}

/**
 * Get event duration in hours
 */
export function getEventDuration(event: MongoEvent): number {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60); // Convert to hours
}

/**
 * Group events by date for calendar display
 */
export function groupEventsByDate(events: MongoEvent[]): Record<string, MongoEvent[]> {
  return events.reduce((groups, event) => {
    const date = new Date(event.startDate).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, MongoEvent[]>);
}
