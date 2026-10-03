const { authenticateIfPresent, restrictStatusFilter, canReadContent } = require('../middleware/contentAccess');
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const EventRSVP = require('../models/EventRSVP');
const Comment = require('../models/Comment');
const EventService = require('../services/EventService');
const EngagementService = require('../services/EngagementService');
const authenticateToken = require('../middleware/auth');
const { isAdminUser } = require('../middleware/admin');
const mongoose = require('mongoose');
const { eventFields, pickFields } = require('../utils/contentPolicy');
const eventStatuses = ['draft', 'published', 'cancelled', 'completed'];

// GET /api/events - get all events with filtering and pagination
router.get('/', restrictStatusFilter('published'), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = 'published',
      eventType,
      category,
      upcoming = 'true',
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { status };
    
    // Filter by upcoming events
    if (upcoming === 'true') {
      query.startDate = { $gte: new Date() };
    }
    
    // Filter by event type
    if (eventType) {
      query.eventType = eventType;
    }
    
    // Filter by category
    if (category) {
      query.category = { $in: [category] };
    }
    
    // Search in title and description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const events = await Event.find(query)
      .populate('organizer', 'name profile.avatar uniqueId')
      .populate('speakers.user', 'name profile.avatar uniqueId')
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Event.countDocuments(query);
    
    // Get real-time comment counts for all events (like News does)
    const eventIds = events.map(event => event._id);
    const commentCounts = await Comment.aggregate([
      { 
        $match: { 
          contentType: 'event',
          contentId: { $in: eventIds }, 
          status: 'active' 
        } 
      },
      { $group: { _id: '$contentId', count: { $sum: 1 } } }
    ]);
    
    const commentCountMap = {};
    commentCounts.forEach(cc => {
      commentCountMap[cc._id.toString()] = cc.count;
    });
    
    // Transform events to include engagement data for frontend
    const transformedEvents = events.map(event => ({
      ...event,
      // Ensure engagement data is available for InteractionButtons
      likeCount: event.likes || 0,
      shareCount: event.shares || 0,
      saveCount: event.saves || 0,
      commentCount: commentCountMap[event._id.toString()] || 0,
      rsvpCount: event.rsvpCount || 0,
      attendedCount: event.attendedCount || 0,
      // Include comment count (discussions) - use real-time count
      discussionCount: commentCountMap[event._id.toString()] || 0
    }));

    res.json({
      success: true,
      events: transformedEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
  }
});

// GET /api/events/:id - get specific event
router.get('/:id', authenticateIfPresent, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name profile.avatar uniqueId')
      .populate('speakers.user', 'name profile.avatar uniqueId')
      .lean();
    
    if (!event || !(await canReadContent(req, event, 'organizer', 'published'))) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Transform to include engagement data for frontend
    const transformedEvent = {
      ...event,
      likeCount: event.likes || 0,
      shareCount: event.shares || 0,
      saveCount: event.saves || 0,
      commentCount: event.comments || 0,
      rsvpCount: event.rsvpCount || 0,
      attendedCount: event.attendedCount || 0,
      discussionCount: event.comments || 0
    };
    
    res.json({
      success: true,
      event: transformedEvent
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event', details: error.message });
  }
});

// POST /api/events - create new event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const admin = await isAdminUser(req.user.userId);
    if (!admin && req.body.status !== undefined && req.body.status !== 'draft') {
      return res.status(403).json({ error: 'Only an admin can publish or change event status' });
    }
    const status = admin ? (req.body.status ?? 'draft') : 'draft';
    if (!eventStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid event status' });
    }
    const eventData = { ...pickFields(req.body, eventFields), status };
    const organizerId = req.user.userId;
    
    const event = await EventService.createEvent(eventData, organizerId);
    await event.populate('organizer', 'name profile.avatar uniqueId');
    
    res.status(201).json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event', details: error.message });
  }
});

// PUT /api/events/:id - update event (organizer OR admin)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const admin = await isAdminUser(req.user.userId);
    const isOrganizer = event.organizer.toString() === req.user.userId;
    if (!isOrganizer && !admin) {
      return res.status(403).json({ error: 'Only the organizer or an admin can update this event' });
    }
    if (!admin && req.body.status !== undefined && req.body.status !== 'draft') {
      return res.status(403).json({ error: 'Only an admin can publish or change event status' });
    }
    const updates = pickFields(req.body, eventFields);
    if (!Object.keys(updates).length && !Object.hasOwn(req.body, 'status')) {
      return res.status(400).json({ error: 'No supported fields provided' });
    }
    updates.status = admin ? (req.body.status ?? event.status) : 'draft';
    if (!eventStatuses.includes(updates.status)) {
      return res.status(400).json({ error: 'Invalid event status' });
    }
    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('organizer', 'name profile.avatar uniqueId');
    
    res.json({
      success: true,
      event: updatedEvent
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event', details: error.message });
  }
});

// DELETE /api/events/:id - delete event (organizer OR admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const isOrganizer = event.organizer.toString() === req.user.userId;
    if (!isOrganizer && !(await isAdminUser(req.user.userId))) {
      return res.status(403).json({ error: 'Only the organizer or an admin can delete this event' });
    }
    
    await Event.findByIdAndDelete(req.params.id);
    // Clean up dependent RSVP records so no orphaned rows remain.
    await EventRSVP.deleteMany({ event: req.params.id });
    
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event', details: error.message });
  }
});

// POST /api/events/:id/rsvp - RSVP to event
router.post('/:id/rsvp', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const { status, guestCount = 0, dietaryRestrictions = [], accessibilityNeeds = [], notes = '' } = req.body;
    
    if (!['going', 'maybe', 'not_going'].includes(status)) {
      return res.status(400).json({ error: 'Invalid RSVP status' });
    }
    
    const rsvpData = {
      status,
      guestCount,
      dietaryRestrictions,
      accessibilityNeeds,
      notes
    };
    
    const rsvp = await EventService.rsvpToEvent(req.params.id, req.user.userId, rsvpData);
    await rsvp.populate('user', 'name profile.avatar uniqueId');
    
    res.json({
      success: true,
      rsvp
    });
  } catch (error) {
    console.error('Error creating RSVP:', error);
    res.status(500).json({ error: 'Failed to create RSVP', details: error.message });
  }
});

// DELETE /api/events/:id/rsvp - cancel RSVP
router.delete('/:id/rsvp', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const rsvp = await EventService.cancelRSVP(req.params.id, req.user.userId);
    
    res.json({
      success: true,
      message: 'RSVP cancelled successfully',
      rsvp
    });
  } catch (error) {
    console.error('Error cancelling RSVP:', error);
    res.status(500).json({ error: 'Failed to cancel RSVP', details: error.message });
  }
});

// GET /api/events/:id/rsvp - get user's RSVP status
router.get('/:id/rsvp', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const rsvp = await EventRSVP.findOne({
      event: req.params.id,
      user: req.user.userId
    });
    
    res.json({
      success: true,
      rsvp
    });
  } catch (error) {
    console.error('Error fetching RSVP:', error);
    res.status(500).json({ error: 'Failed to fetch RSVP', details: error.message });
  }
});

// GET /api/events/:id/attendees - get event attendees
// 需要登录：参与者名单属于班级内部信息，原实现完全公开。
router.get('/:id/attendees', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const { status = 'going' } = req.query;
    const attendees = await EventService.getEventAttendees(req.params.id, status);
    
    res.json({
      success: true,
      attendees
    });
  } catch (error) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ error: 'Failed to fetch attendees', details: error.message });
  }
});

// POST /api/events/:id/calendar - get calendar data for event
router.post('/:id/calendar', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const calendarData = await EventService.prepareCalendarData(req.params.id, req.user.userId);
    
    if (!calendarData) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Update RSVP to mark calendar integration
    await EventRSVP.findOneAndUpdate(
      { event: req.params.id, user: req.user.userId },
      { 
        'calendarIntegration.addedToCalendar': true,
        'calendarIntegration.calendarEventId': req.body.calendarEventId || null
      }
    );
    
    res.json({
      success: true,
      calendarData
    });
  } catch (error) {
    console.error('Error preparing calendar data:', error);
    res.status(500).json({ error: 'Failed to prepare calendar data', details: error.message });
  }
});

// POST /api/events/:id/checkin/:userId - check in user to event (organizer only)
router.post('/:id/checkin/:userId', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid event ID or user ID' });
    }
    
    // Verify user is the organizer
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    if (event.organizer.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the organizer can check in attendees' });
    }
    
    const rsvp = await EventService.checkInUser(req.params.id, req.params.userId, req.user.userId);
    
    res.json({
      success: true,
      message: 'User checked in successfully',
      rsvp
    });
  } catch (error) {
    console.error('Error checking in user:', error);
    res.status(500).json({ error: 'Failed to check in user', details: error.message });
  }
});

// GET /api/events/user/mine - get user's events (organized + RSVP'd)
router.get('/user/mine', authenticateToken, async (req, res) => {
  try {
    const { type = 'all', status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let events = [];
    
    if (type === 'organized' || type === 'all') {
      // Events organized by user
      const organizedEvents = await Event.find({
        organizer: req.user.userId,
        ...(status && { status })
      })
      .populate('organizer', 'name profile.avatar uniqueId')
      .sort({ startDate: 1 })
      .skip(type === 'organized' ? skip : 0)
      .limit(type === 'organized' ? parseInt(limit) : undefined);
      
      events = [...events, ...organizedEvents.map(event => ({ ...event.toObject(), type: 'organized' }))];
    }
    
    if (type === 'rsvp' || type === 'all') {
      // Events user RSVP'd to
      const rsvpEvents = await EventService.getUserEvents(req.user.userId, status, 1, 50);
      events = [...events, ...rsvpEvents.map(rsvp => ({ ...rsvp.event.toObject(), type: 'rsvp', rsvpStatus: rsvp.status }))];
    }
    
    // Sort by start date
    events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    // Apply pagination to combined results if type is 'all'
    if (type === 'all') {
      const total = events.length;
      events = events.slice(skip, skip + parseInt(limit));
      
      res.json({
        success: true,
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } else {
      res.json({
        success: true,
        events
      });
    }
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({ error: 'Failed to fetch user events', details: error.message });
  }
});

// GET /api/events/user/recommended - get recommended events for user
router.get('/user/recommended', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const recommendedEvents = await EventService.getRecommendedEvents(req.user.userId, parseInt(limit));
    
    res.json({
      success: true,
      events: recommendedEvents
    });
  } catch (error) {
    console.error('Error fetching recommended events:', error);
    res.status(500).json({ error: 'Failed to fetch recommended events', details: error.message });
  }
});

module.exports = router; 