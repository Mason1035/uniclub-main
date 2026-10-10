// ClassHub currently has one class roster per instance. An enrolled account
// must still exist in that roster; removing a roster row intentionally keeps
// its login account, so isEnrolled alone does not prove current membership.
function createRandomCallMembersService({
  UserModel = require('../models/User'),
  RosterModel = require('../models/EnrolledUser'),
} = {}) {
  return async userId => {
    const [account, rosterIds] = await Promise.all([
      UserModel.findById(userId).select('uniqueId isEnrolled').lean(),
      RosterModel.distinct('uniqueId'),
    ]);
    const currentIds = rosterIds.filter(id => typeof id === 'string' && id.trim());
    if (!account || account.isEnrolled !== true || !currentIds.includes(account.uniqueId)) {
      throw Object.assign(new Error('仅当前班级成员可以使用随机点名。'), { status: 403 });
    }

    // Deliberately no isAdmin filter: student administrators belong to the
    // same pool as every other current class member. Never load avatar data
    // or account secrets just to return the existing image endpoint.
    const users = await UserModel.find({
      isEnrolled: true,
      uniqueId: { $in: currentIds },
    }).select('_id name profile.avatar.contentType').sort({ _id: 1 }).lean();

    return users.filter(user => user._id && typeof user.name === 'string' && user.name.trim())
      .map(user => ({
        id: String(user._id),
        name: user.name.trim(),
        avatar: ['image/jpeg', 'image/png', 'image/webp'].includes(user.profile?.avatar?.contentType)
          ? `/api/users/avatar/${user._id}` : null,
      }));
  };
}

module.exports = { createRandomCallMembersService };
