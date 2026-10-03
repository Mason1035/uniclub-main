const definition = require('../../shared/account-settings.json');
const NOTIFICATION_DEFAULTS = Object.freeze(definition.notifications);
const EMAIL_PATTERN = new RegExp(definition.emailPattern);
const { limits } = definition;

function resolveNotifications(input) {
  return Object.fromEntries(Object.entries(NOTIFICATION_DEFAULTS).map(([key, fallback]) =>
    [key, typeof input?.[key] === 'boolean' ? input[key] : fallback]));
}
function notificationPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.keys(input).length) return null;
  const entries = Object.entries(input);
  if (entries.some(([key, value]) => !Object.hasOwn(NOTIFICATION_DEFAULTS, key) || typeof value !== 'boolean')) return null;
  return Object.fromEntries(entries.map(([key, value]) => [`settings.notifications.${key}`, value]));
}
function validateProfilePatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) return { error: '请填写需要保存的个人资料。' };
  const patch = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'displayName') {
      if (value !== null && (typeof value !== 'string' || value.trim().length > limits.displayName || /[\u0000-\u001f\u007f]/.test(value))) return { error: '显示名称须为 30 字符以内的文本。' };
      patch.displayName = typeof value === 'string' ? value.trim() || null : null;
    } else if (['bio', 'location', 'website'].includes(key)) {
      const max = key === 'bio' ? limits.bio : key === 'location' ? 100 : 300;
      if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return { error: `资料字段 ${key} 格式或长度不正确。` };
      if (key === 'website' && value.trim() && !/^https?:\/\/[^\s]+$/i.test(value.trim())) return { error: '网站地址须以 https:// 或 http:// 开头。' };
      patch[`profile.${key}`] = value.trim();
    } else if (key === 'interests') {
      if (!Array.isArray(value) || value.length > 10 || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 30)) return { error: '兴趣最多 10 项，每项不超过 30 字符。' };
      patch['profile.interests'] = value.map(item => item.trim());
    } else return { error: '不能修改真实姓名、学号或不支持的资料字段。' };
  }
  return { patch };
}
function validateEmail(value) {
  if (value === null || value === '') return { email: null };
  if (typeof value !== 'string') return { error: '请输入有效的邮箱地址。' };
  const email = value.trim().toLowerCase();
  if (!email || email.length > limits.email || !EMAIL_PATTERN.test(email)) return { error: '请输入有效的邮箱地址。' };
  return { email };
}
function validatePasswordChange(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['currentPassword', 'newPassword', 'confirmPassword'].includes(key))) return '密码提交内容不正确。';
  const { currentPassword, newPassword, confirmPassword } = body;
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024) return '请输入当前密码。';
  if (typeof newPassword !== 'string' || newPassword.length < limits.passwordMin) return '新密码至少需要 8 位。';
  if (Buffer.byteLength(newPassword, 'utf8') > limits.passwordBytesMax) return '新密码过长，请缩短后重试。';
  if (newPassword !== confirmPassword) return '两次新密码不一致。';
  if (newPassword === currentPassword) return '新密码须与当前密码不同。';
  return null;
}
const avatarFor = user => user.profile?.avatar?.data ? {
  data: user.profile.avatar.data, contentType: user.profile.avatar.contentType,
  size: user.profile.avatar.size, uploadedAt: user.profile.avatar.uploadedAt,
} : null;
function selfProfile(user) {
  const avatar = user.profile?.avatar?.contentType ? user.profile.avatar : null;
  return {
    name: user.name, uniqueId: user.uniqueId, displayName: user.displayName || null,
    bio: user.profile?.bio || '',
    avatarUrl: avatar ? `/api/users/avatar/${user._id}?v=${encodeURIComponent(String(avatar.uploadedAt || 0))}` : null,
  };
}
function selfSecurity(user) {
  return { email: user.email || null, emailVerified: user.emailVerified === true, lastLoginAt: user.lastLoginAt || null };
}
function selfUser(user) {
  const avatar = avatarFor(user);
  return {
    id: user._id, name: user.name, displayName: user.displayName || null,
    uniqueId: user.uniqueId, email: user.email || '', avatar,
    profile: { bio: user.profile?.bio || '', location: user.profile?.location || '', website: user.profile?.website || '', interests: user.profile?.interests || [], avatar },
    socialStats: user.socialStats, settings: user.settings, lastActive: user.lastActive,
  };
}
module.exports = { NOTIFICATION_DEFAULTS, EMAIL_PATTERN, limits, resolveNotifications, notificationPatch, validateProfilePatch, validateEmail, validatePasswordChange, selfProfile, selfSecurity, selfUser };
