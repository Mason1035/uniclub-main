// Compatibility facade: old callers retain their entry points, while V2 owns
// writes. EventRSVP is a preserved read-only legacy archive after this upgrade.
const { activityService, eventDTO, registrationDTO } = require('./ActivityService');
const { publicFilter, paginationOf, fail } = require('../utils/activityPolicy');
class EventService {
  static async createEvent(data, organizerId) { return activityService.create(data, organizerId); }
  static async rsvpToEvent(id, userId, data = {}) {
    if (data.status === 'not_going' || data.status === 'CANCELLED') return activityService.cancel(id, userId);
    if (data.status && !['going', 'PENDING'].includes(data.status)) throw fail('请提交报名申请。');
    return activityService.apply(id, userId);
  }
  static async cancelRSVP(id, userId) { return activityService.cancel(id, userId); }
  static async getEventAttendees(id, status = 'APPROVED', adminId) {
    const filter = { going: 'approved', maybe: 'pending', waitlist: 'pending', not_going: 'cancelled' }[status] || status.toLowerCase();
    return (await activityService.registrations(id, adminId, { filter })).members;
  }
  static async getUserEvents(userId, status = null, page = 1, limit = 20) {
    await activityService.account(userId);
    const old = await activityService.rsvps.find({ user: userId }).select('event').lean();
    const paging = paginationOf({ page, limit });
    const rows = await activityService.events.find({ $and: [publicFilter(activityService.now()), {
      $or: [{ 'registrations.userId': userId }, { _id: { $in: old.map(row => row.event) } }],
    }] }).select('+registrations +registrationSchemaVersion').populate('organizer', 'name').sort({ startDate: -1 }).skip(paging.skip).limit(paging.limit).lean();
    const data = [];
    for (const event of rows) {
      const registration = (await activityService.legacyLedger(event)).find(row => String(row.userId) === String(userId));
      if (registration && (!status || registration.status === status)) data.push({ ...registrationDTO(registration), event: eventDTO(event, { now: activityService.now() }) });
    }
    return data;
  }
  static async getRecommendedEvents(userId, limit = 10) { return (await activityService.list(userId, { view: 'upcoming', limit })).events; }
  static async prepareCalendarData(id, userId) {
    const event = await activityService.readableEvent(id, userId);
    return { title: event.title, description: event.description, start: event.startDate, end: event.endDate,
      location: this.formatEventLocation(event.location), attendees: [] };
  }
  static formatEventLocation(location) { return location.type === 'virtual' ? '线上活动' : [location.address, location.room, location.type === 'hybrid' ? '线上同步' : ''].filter(Boolean).join(' · '); }
  // There is no automatic waitlist promotion: every accepted V2 application
  // requires an explicit administrator review, including legacy waitlists.
  static async promoteFromWaitlist() { return null; }
}
module.exports = EventService;
