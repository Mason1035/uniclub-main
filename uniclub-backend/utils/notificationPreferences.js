const User = require('../models/User');
const Notification = require('../models/Notification');
const { resolveNotifications } = require('./accountSettingsPolicy');
const categoryFor = data => data.event ? 'activities' : data.resource ? 'materials' : data.article ? 'news' : null;
function notificationFilter(userId, settings = {}) {
  const filter = { recipient: userId };
  if (settings.commentNotifications === false) filter._id = { $exists: false };
  const prefs = resolveNotifications(settings.notifications);
  for (const [field, category] of [['article', 'news'], ['event', 'activities'], ['resource', 'materials']]) {
    if (!prefs[category]) filter[field] = null;
  }
  return filter;
}
async function createUserNotification(data) {
  try {
    const recipient = await User.findById(data.recipient).select('settings').lean();
    if (!recipient || recipient.settings?.commentNotifications === false) return null;
    const category = categoryFor(data);
    if (category && !resolveNotifications(recipient.settings?.notifications)[category]) return null;
    return await Notification.create(data);
  } catch {
    // A notification outage must not turn an already-saved comment into a failed submission.
    console.warn('Notification delivery temporarily unavailable.');
    return null;
  }
}
module.exports = { notificationFilter, createUserNotification };
