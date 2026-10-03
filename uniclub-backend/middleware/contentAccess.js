const authenticateToken = require('./auth');
const requireAdmin = require('./admin');
const { isAdminUser } = require('./admin');

const authenticateIfPresent = (req, res, next) =>
  req.headers.authorization ? authenticateToken(req, res, next) : next();

// Non-public list views are provided to administrators only.
const restrictStatusFilter = (publicStatus) => (req, res, next) =>
  req.query.status && req.query.status !== publicStatus ? requireAdmin(req, res, next) : next();

const canReadContent = async (req, content, ownerField, publicStatus) => {
  if (content.status === publicStatus) return true;
  if (!req.user) return false;
  if (content[ownerField]?.toString() === req.user.userId) return true;
  return isAdminUser(req.user.userId);
};

module.exports = { authenticateIfPresent, restrictStatusFilter, canReadContent };
