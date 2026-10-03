/**
 * Admin authorization middleware.
 *
 * Source of truth for admin privileges is ALWAYS the database:
 *   User.isAdmin === true
 *
 * Usage (both styles work):
 *   router.get('/users', requireAdmin, handler)                       // auth runs automatically
 *   router.get('/users', authenticateToken, requireAdmin, handler)    // auth already ran
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const authenticateToken = require('./auth');

/**
 * Verify that the authenticated user has isAdmin === true.
 * Assumes `req.user` was already populated by authenticateToken.
 */
const checkAdmin = async (req, res, next) => {
  try {
    const userId = req.user && req.user.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // The demo/portfolio token carries a hard-coded userId; never let a malformed
    // value reach Mongoose (it would throw a CastError and surface as a 500).
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const user = await User.findById(userId).select('email name uniqueId isAdmin');

    if (!user || user.isAdmin !== true) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Expose the verified admin document for downstream handlers.
    req.adminUser = user;
    return next();
  } catch (error) {
    console.error('❌ requireAdmin error:', error);
    return res.status(500).json({ error: 'Failed to verify admin privileges' });
  }
};

/**
 * Drop-in middleware: authenticates (if needed) and then enforces admin rights.
 */
const requireAdmin = (req, res, next) => {
  if (req.user) {
    return checkAdmin(req, res, next);
  }
  return authenticateToken(req, res, () => checkAdmin(req, res, next));
};

/**
 * Boolean helper for routes that allow EITHER the owner OR an admin
 * (e.g. "organizer or admin can edit this event").
 * Never throws - a lookup failure simply means "not an admin".
 */
const isAdminUser = async (userId) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return false;
  try {
    const user = await User.findById(userId).select('isAdmin');
    return Boolean(user && user.isAdmin === true);
  } catch (error) {
    console.warn('⚠️ isAdminUser lookup failed:', error.message);
    return false;
  }
};

module.exports = requireAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.checkAdmin = checkAdmin;
module.exports.isAdminUser = isAdminUser;
