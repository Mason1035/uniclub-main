// Effective identity always comes from the account document, never JWT/body claims.
const ROLES = Object.freeze(['student', 'committee', 'teacher', 'admin']);
const PERMISSIONS = Object.freeze({
  student: Object.freeze([]),
  committee: Object.freeze(['backend', 'content:manage']),
  teacher: Object.freeze(['backend', 'content:manage', 'roles:manage']),
  admin: Object.freeze(['backend', 'content:manage', 'roles:manage', 'system:manage', 'roster:manage']),
});
function normalizeRole(user) {
  if (ROLES.includes(user?.role)) return user.role;
  return user?.isAdmin === true ? 'admin' : 'student';
}
function hasPermission(user, permission) { return PERMISSIONS[normalizeRole(user)].includes(permission); }
function roleInfo(user) {
  const role = normalizeRole(user);
  return { role, isAdmin: role === 'admin', permissions: [...PERMISSIONS[role]] };
}
// Explicit role takes precedence; missing legacy roles keep the old admin flag.
function roleFilter(role) {
  if (!ROLES.includes(role)) throw new Error('Unknown role');
  if (role === 'admin' || role === 'student') return { $or: [
    { role }, { role: { $nin: ROLES }, isAdmin: role === 'admin' ? true : { $ne: true } },
  ] };
  return { role };
}
function canAssignRole(actor, target, nextRole) {
  if (!ROLES.includes(nextRole)) return false;
  if (normalizeRole(actor) === 'admin') return true;
  return normalizeRole(actor) === 'teacher' &&
    ['student', 'committee'].includes(normalizeRole(target)) &&
    ['student', 'committee'].includes(nextRole);
}
module.exports = { ROLES, PERMISSIONS, normalizeRole, hasPermission, roleInfo, roleFilter, canAssignRole };
