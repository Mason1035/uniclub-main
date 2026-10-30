const mongoose = require('mongoose');
const User = require('../models/User');
const authenticateToken = require('./auth');
const { hasPermission } = require('../utils/roles');

function requirePermission(permission, message) {
  const check = async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(403).json({ error: message });
      // Resolve each request from the database. Revoking a role affects existing sessions.
      const user = await User.findById(userId).select('email name uniqueId role isAdmin roleVersion');
      if (!user || !hasPermission(user, permission)) return res.status(403).json({ error: message });
      req.adminUser = user;
      return next();
    } catch (error) {
      console.error('Authorization lookup failed:', error.message);
      return res.status(503).json({ error: '权限暂时无法验证，请稍后重试。' });
    }
  };
  return (req, res, next) => req.user ? check(req, res, next) : authenticateToken(req, res, () => check(req, res, next));
}
const requireAdmin = requirePermission('system:manage', '此操作仅管理员可执行。');
const requireStaff = requirePermission('content:manage', '此操作需要班委、老师或管理员权限。');
const requireRoleManager = requirePermission('roles:manage', '此操作需要老师或管理员权限。');
async function permissionUser(userId, permission) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return false;
  try { return hasPermission(await User.findById(userId).select('role isAdmin'), permission); }
  catch { return false; }
}
module.exports = requireAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.requireStaff = requireStaff;
module.exports.requireRoleManager = requireRoleManager;
module.exports.requirePermission = requirePermission;
module.exports.checkAdmin = requireAdmin;
module.exports.isAdminUser = userId => permissionUser(userId, 'system:manage');
module.exports.isStaffUser = userId => permissionUser(userId, 'content:manage');
