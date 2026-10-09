// Keep lists, the legacy count endpoint, and engagement counters identical.
const getCommentFilter = (contentId, contentType, options = {}) => {
  const filter = { contentId, contentType, status: 'active' };
  if (options.topLevelOnly) filter.parentCommentId = null;
  return filter;
};

module.exports = { getCommentFilter };
