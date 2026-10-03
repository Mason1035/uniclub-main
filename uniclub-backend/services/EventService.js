const Event = require('../models/Event');
const EventRSVP = require('../models/EventRSVP');
const User = require('../models/User');
const EngagementService = require('./EngagementService');

class EventService {
  
  /**
   * Create a new event
   */
  static async createEvent(eventData, organizerId) {
    try {
      const event = new Event({
        ...eventData,
        organizer: organizerId
      });
      
      await event.save();
      
      // Update user stats
      await User.findByIdAndUpdate(organizerId, {
        $inc: { 'socialStats.eventsCreated': 1 }
      });
      
      return event;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }
  
  /**
   * RSVP to an event
   */
  static async rsvpToEvent(eventId, userId, rsvpData) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if event is at capacity
      if (event.maxCapacity && rsvpData.status === 'going') {
        const currentAttendees = await EventRSVP.countDocuments({
          event: eventId,
          status: 'going'
        });
        
        if (currentAttendees >= event.maxCapacity) {
          rsvpData.status = 'waitlist';
          rsvpData.waitlistPosition = await this.getNextWaitlistPosition(eventId);
          rsvpData.waitlistJoinedAt = new Date();
        }
      }
      
      // Create or update RSVP
      const rsvp = await EventRSVP.findOneAndUpdate(
        { event: eventId, user: userId },
        {
          event: eventId,
          user: userId,
          ...rsvpData
        },
        { upsert: true, new: true }
      );
      
      // Update event RSVP count
      await this.updateEventRSVPCount(eventId);
      
      return rsvp;
    } catch (error) {
      console.error('Error RSVPing to event:', error);
      throw error;
    }
  }
  
  /**
   * Cancel RSVP
   */
  static async cancelRSVP(eventId, userId) {
    try {
      const rsvp = await EventRSVP.findOneAndDelete({
        event: eventId,
        user: userId
      });
      
      if (rsvp) {
        // Update event RSVP count
        await this.updateEventRSVPCount(eventId);
        
        // If this was a 'going' RSVP, promote someone from waitlist
        if (rsvp.status === 'going') {
          await this.promoteFromWaitlist(eventId);
        }
      }
      
      return rsvp;
    } catch (error) {
      console.error('Error canceling RSVP:', error);
      throw error;
    }
  }
  
  /**
   * Check in user to event
   */
  static async checkInUser(eventId, userId, checkedInBy) {
    try {
      const rsvp = await EventRSVP.findOneAndUpdate(
        { event: eventId, user: userId },
        {
          checkedIn: true,
          checkedInAt: new Date(),
          checkedInBy: checkedInBy
        },
        { new: true }
      );
      
      if (rsvp) {
        // Update user's events attended count
        await User.findByIdAndUpdate(userId, {
          $inc: { 'socialStats.eventsAttended': 1 }
        });
        
        // Update event's attended count
        await Event.findByIdAndUpdate(eventId, {
          $inc: { 'engagement.attendedCount': 1 }
        });
      }
      
      return rsvp;
    } catch (error) {
      console.error('Error checking in user:', error);
      throw error;
    }
  }
  
  /**
   * Get user's events (RSVPs)
   */
  static async getUserEvents(userId, status = null, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const query = { user: userId };
      
      if (status) {
        query.status = status;
      }
      
      const rsvps = await EventRSVP.find(query)
        .populate({
          path: 'event',
          match: { status: { $ne: 'deleted' } }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      return rsvps.filter(rsvp => rsvp.event); // Filter out deleted events
    } catch (error) {
      console.error('Error getting user events:', error);
      return [];
    }
  }
  
  /**
   * Get event attendees
   */
  static async getEventAttendees(eventId, status = 'going') {
    try {
      const attendees = await EventRSVP.find({
        event: eventId,
        status: status
      })
      // 不 populate 头像：profile.avatar 里是 Base64，几十人的列表会有几十 MB；
      // 而且参与者名单属于班级内部信息，调用方需先通过鉴权。
      .populate('user', 'name uniqueId')
      .sort({ createdAt: 1 });
      
      return attendees;
    } catch (error) {
      console.error('Error getting event attendees:', error);
      return [];
    }
  }
  
  /**
   * Get upcoming events for a user based on their interests
   */
  static async getRecommendedEvents(userId, limit = 10) {
    try {
      const user = await User.findById(userId);
      if (!user) return [];
      
      const userInterests = user.profile.interests || [];
      
      const events = await Event.find({
        status: 'published',
        startDate: { $gte: new Date() },
        $or: [
          { category: { $in: userInterests } },
          { tags: { $in: userInterests } }
        ]
      })
      .sort({ startDate: 1 })
      .limit(limit)
      .populate('organizer', 'name profile.avatar');
      
      return events;
    } catch (error) {
      console.error('Error getting recommended events:', error);
      return [];
    }
  }
  
  /**
   * Add event to user's calendar (prepare calendar data)
   */
  static async prepareCalendarData(eventId, userId) {
    try {
      const event = await Event.findById(eventId).populate('organizer', 'name');
      if (!event) return null;
      
      const calendarEvent = {
        title: event.title,
        description: event.description,
        start: event.startDate,
        end: event.endDate,
        location: this.formatEventLocation(event.location),
        organizer: {
          name: event.organizer.name,
          email: 'events@aiclub.com' // Use your club email
        },
        attendees: [], // Can be populated if needed
        reminders: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 } // 30 minutes before
        ]
      };
      
      return calendarEvent;
    } catch (error) {
      console.error('Error preparing calendar data:', error);
      return null;
    }
  }
  
  /**
   * Helper methods
   */
  static async updateEventRSVPCount(eventId) {
    try {
      const rsvpCount = await EventRSVP.countDocuments({
        event: eventId,
        status: { $in: ['going', 'maybe'] }
      });
      
      await Event.findByIdAndUpdate(eventId, {
        'engagement.rsvpCount': rsvpCount
      });
    } catch (error) {
      console.error('Error updating event RSVP count:', error);
    }
  }
  
  static async getNextWaitlistPosition(eventId) {
    try {
      const lastWaitlist = await EventRSVP.findOne({
        event: eventId,
        status: 'waitlist'
      }).sort({ waitlistPosition: -1 });
      
      return lastWaitlist ? lastWaitlist.waitlistPosition + 1 : 1;
    } catch (error) {
      console.error('Error getting next waitlist position:', error);
      return 1;
    }
  }
  
  static async promoteFromWaitlist(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event.maxCapacity) return;
      
      const currentAttendees = await EventRSVP.countDocuments({
        event: eventId,
        status: 'going'
      });
      
      if (currentAttendees < event.maxCapacity) {
        const nextInWaitlist = await EventRSVP.findOne({
          event: eventId,
          status: 'waitlist'
        }).sort({ waitlistPosition: 1 });
        
        if (nextInWaitlist) {
          nextInWaitlist.status = 'going';
          nextInWaitlist.waitlistPosition = undefined;
          nextInWaitlist.waitlistJoinedAt = undefined;
          await nextInWaitlist.save();
          
          // Update RSVP count
          await this.updateEventRSVPCount(eventId);
        }
      }
    } catch (error) {
      console.error('Error promoting from waitlist:', error);
    }
  }
  
  static formatEventLocation(location) {
    if (location.type === 'virtual') {
      return 'Virtual Event';
    } else if (location.type === 'physical') {
      let formatted = location.address || '';
      if (location.room) {
        formatted += `, ${location.room}`;
      }
      return formatted;
    } else if (location.type === 'hybrid') {
      return `${location.address || 'Physical Location'} + Virtual`;
    }
    return 'Location TBD';
  }
}

module.exports = EventService; 