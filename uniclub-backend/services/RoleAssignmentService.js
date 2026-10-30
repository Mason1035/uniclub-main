const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { ROLES, normalizeRole, roleInfo, roleFilter, canAssignRole } = require('../utils/roles');
const fail = (message, status) => Object.assign(new Error(message), { status });
const bounded = query => typeof query.maxTimeMS === 'function' ? query.maxTimeMS(5000) : query;

async function acquireRoleLease() {
  const Lock = require('../models/RoleAssignmentLock');
  const owner = randomUUID();
  const lockedUntil = new Date(Date.now() + 60000);
  try {
    await bounded(Lock.findOneAndUpdate(
      { _id: 'account-roles', lockedUntil: { $lte: new Date() } },
      { $set: { owner, lockedUntil } }, { upsert: true, new: true }
    ));
  } catch (error) {
    if (error.code === 11000) throw fail('其他身份调整正在进行，请稍后重试。', 409);
    throw error;
  }
  return {
    assertValid() { if (Date.now() > lockedUntil.getTime() - 10000) throw fail('本次调整已超时，请重试。', 409); },
    async release() { await bounded(Lock.deleteOne({ _id: 'account-roles', owner })); },
  };
}

class RoleAssignmentService {
  constructor({ UserModel = require('../models/User'), acquireLease = acquireRoleLease } = {}) {
    this.users = UserModel; this.acquireLease = acquireLease;
  }
  async accounts(actorId, targetId) {
    return Promise.all([actorId, targetId].map(id => bounded(this.users.findById(id)
      .select('name email uniqueId role isAdmin roleVersion isVerified isEnrolled lastActive createdAt')).lean()));
  }
  validate(actor, target, nextRole) {
    if (!actor) throw fail('登录账号不存在。', 401);
    if (!['admin', 'teacher'].includes(normalizeRole(actor))) throw fail('只有老师和管理员可以调整身份。', 403);
    if (!target) throw fail('未找到该成员。', 404);
    if (!canAssignRole(actor, target, nextRole)) throw fail('老师只能在学生与班委之间调整身份。', 403);
    if (String(actor._id) === String(target._id) && normalizeRole(actor) === 'admin' && nextRole !== 'admin') {
      throw fail('不能取消自己的管理员身份，请由其他管理员操作。', 400);
    }
  }
  async assign(actorId, targetId, nextRole) {
    if (!mongoose.Types.ObjectId.isValid(targetId) || !mongoose.Types.ObjectId.isValid(actorId)) throw fail('无效的成员编号。', 400);
    if (!ROLES.includes(nextRole)) throw fail('请选择学生、班委、老师或管理员。', 400);
    this.validate(...await this.accounts(actorId, targetId), nextRole);
    const lease = await this.acquireLease();
    try {
      // Re-read after taking the shared lease: a previous request may have changed
      // either account while this request waited. Teachers cannot overwrite a
      // concurrent promotion to teacher/admin.
      const [actor, target] = await this.accounts(actorId, targetId);
      this.validate(actor, target, nextRole);
      if (normalizeRole(target) === nextRole) return target;
      if (normalizeRole(target) === 'admin' && nextRole !== 'admin') {
        if (await bounded(this.users.countDocuments(roleFilter('admin'))) <= 1) throw fail('至少需要保留一位管理员。', 409);
      }
      lease.assertValid();
      const snapshot = {};
      for (const key of ['role', 'isAdmin', 'roleVersion']) snapshot[key] =
        target[key] === undefined ? { $exists: false } : target[key];
      const user = await bounded(this.users.findOneAndUpdate(
        { _id: targetId, ...snapshot },
        { $set: { role: nextRole, isAdmin: nextRole === 'admin' }, $inc: { roleVersion: 1 } },
        { new: true, runValidators: true }
      ).select('name email uniqueId role isAdmin roleVersion isVerified isEnrolled lastActive createdAt')).lean();
      if (!user) throw fail('该成员身份已变化，请刷新后重试。', 409);
      return user;
    } finally {
      // The role mutation has already committed. A lease-release failure must not
      // report a false mutation failure; its expiry allows recovery after a crash.
      await lease.release().catch(error => console.error('Role lease release failed:', error.message));
    }
  }
}
function memberDto(user) {
  return { id: user._id, name: user.name, email: user.email || '', uniqueId: user.uniqueId,
    ...roleInfo(user), isVerified: user.isVerified === true, isEnrolled: user.isEnrolled === true,
    lastActive: user.lastActive || null, createdAt: user.createdAt || null,
    hasAvatar: Boolean(user.profile?.avatar?.contentType) };
}
module.exports = { RoleAssignmentService, memberDto, acquireRoleLease };
