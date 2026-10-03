// Only editable content enters a MongoDB update. Ownership, counters and review
// metadata are controlled by the server, never by request-body spreading.
const resourceFields = [
  'title', 'description', 'type', 'category', 'fileSize', 'fileUrl',
  'linkUrl', 'thumbnailUrl', 'file', 'tags'
];
const eventFields = [
  'title', 'description', 'startDate', 'endDate', 'location', 'eventType',
  'category', 'maxCapacity', 'rsvpDeadline', 'rsvpLink', 'speakers', 'imageUrl',
  'attachments', 'prerequisites', 'tags', 'skillLevel', 'allowWaitlist',
  'sendReminders', 'isRecurring', 'recurrence'
];
const pickFields = (body, fields) => Object.fromEntries(
  fields.filter((field) => Object.hasOwn(body, field)).map((field) => [field, body[field]])
);

module.exports = { resourceFields, eventFields, pickFields };
