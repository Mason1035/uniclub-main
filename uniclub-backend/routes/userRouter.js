const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const { avatarUploadLimit } = require('../middleware/rateLimit');
const multer = require('multer');
const { resolveUserSettings, validateSettingsPatch } = require('../utils/petSettingsPolicy');
const { validateProfilePatch, validateEmail, selfProfile, selfSecurity, selfUser } = require('../utils/accountSettingsPolicy');
const { prepareAvatar } = require('../utils/avatarImage');
const { createRandomCallMembersService } = require('../services/RandomCallMembersService');
const randomCallMembers = createRandomCallMembersService();
const SETTINGS_FIELDS = 'name uniqueId displayName profile.bio profile.avatar.contentType profile.avatar.uploadedAt email emailVerified lastLoginAt settings';
const ownQuery = (req, res, next) => Object.keys(req.query).length
  ? res.status(400).json({ error: '只能管理当前账号，不能指定其他用户。' }) : next();
const bundle = user => ({ success: true, settings: resolveUserSettings(user.settings), profile: selfProfile(user), security: selfSecurity(user) });

router.get('/random-call-members', authenticateToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const members = await randomCallMembers(req.user.userId);
    res.json({ success: true, members });
  } catch (failure) {
    res.status(failure.status === 403 ? 403 : 503).json({
      error: failure.status === 403 ? failure.message : '暂时无法获取班级名单，请重新加载。',
    });
  }
});

router.get('/me/settings', authenticateToken, ownQuery, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const user = await User.findById(req.user.userId).select(SETTINGS_FIELDS).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(bundle(user));
  } catch { res.status(503).json({ error: '个人设置暂时无法加载。' }); }
});
router.patch('/me/settings', authenticateToken, ownQuery, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const { patch, error } = validateSettingsPatch(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const user = await User.findByIdAndUpdate(req.user.userId, { $set: patch }, { new: true, runValidators: true }).select(SETTINGS_FIELDS).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(bundle(user));
  } catch (failure) {
    res.status(failure.name === 'ValidationError' ? 400 : 503).json({ error: '个人设置暂时无法保存。' });
  }
});

// Existing profile API: real identity is read-only even for an administrator here.
router.put('/profile', authenticateToken, ownQuery, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const { patch, error } = validateProfilePatch(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const user = await User.findByIdAndUpdate(req.user.userId, { $set: patch }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: selfUser(user), profile: selfProfile(user) });
  } catch { res.status(503).json({ error: '个人资料暂时无法保存，请重试。' }); }
});
router.patch('/me/email', authenticateToken, ownQuery, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!req.body || Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, 'email')) return res.status(400).json({ error: '请仅提交邮箱地址。' });
  const { email, error } = validateEmail(req.body.email);
  if (error) return res.status(400).json({ error });
  try {
    if (email) {
      const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const occupied = await User.findOne({ _id: { $ne: req.user.userId }, email: new RegExp(`^${escaped}$`, 'i') }).select('_id');
      if (occupied) return res.status(409).json({ error: '该邮箱已被使用，请换一个邮箱。' });
    }
    const current = await User.findById(req.user.userId).select('email emailVerified');
    if (!current) return res.status(404).json({ error: 'User not found' });
    const unchanged = (current.email || '').toLowerCase() === (email || '');
    const update = email ? { $set: { email, emailVerified: unchanged ? current.emailVerified === true : false } }
      : { $unset: { email: '' }, $set: { emailVerified: false } };
    const user = await User.findByIdAndUpdate(req.user.userId, update, { new: true, runValidators: true }).select('email emailVerified lastLoginAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, security: selfSecurity(user) });
  } catch (failure) {
    res.status(failure.code === 11000 ? 409 : 503).json({ error: failure.code === 11000 ? '该邮箱已被使用，请换一个邮箱。' : '邮箱暂时无法保存，请重试。' });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
const avatarUpload = (req, res, next) => upload.single('avatar')(req, res, error => {
  if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? '头像不能超过 5MB。' : '请只上传一张头像图片。' });
  next();
});
router.post('/avatar', authenticateToken, ownQuery, avatarUploadLimit, avatarUpload, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const avatar = await prepareAvatar(req.file);
    const user = await User.findByIdAndUpdate(req.user.userId, { $set: { 'profile.avatar': avatar } }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, avatar: selfUser(user).avatar, profile: selfProfile(user) });
  } catch (failure) { res.status(failure.status || 503).json({ error: failure.status ? failure.message : '头像暂时无法保存，请重试。' }); }
});
router.delete('/avatar', authenticateToken, ownQuery, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const user = await User.findByIdAndUpdate(req.user.userId, { $unset: { 'profile.avatar': '' } }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, profile: selfProfile(user) });
  } catch { res.status(503).json({ error: '头像暂时无法移除，请重试。' }); }
});
router.get('/avatar/:userId', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) return res.status(404).json({ error: 'Avatar not found' });
  try {
    const user = await User.findById(req.params.userId).select('profile.avatar');
    const avatar = user?.profile?.avatar;
    if (!avatar?.data || !['image/jpeg', 'image/png', 'image/webp'].includes(avatar.contentType)) return res.status(404).json({ error: 'Avatar not found' });
    const data = Buffer.from(avatar.data.split(',')[1] || '', 'base64');
    if (!data.length) return res.status(404).json({ error: 'Avatar not found' });
    res.set({ 'Content-Type': avatar.contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600' });
    res.send(data);
  } catch { res.status(503).json({ error: '头像暂时无法加载。' }); }
});
router.get('/avatar-url/:userId', (req, res) => res.status(404).json({ error: 'Use /api/users/avatar/:userId' }));
router.get('/me', authenticateToken, ownQuery, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: selfUser(user) });
  } catch { res.status(503).json({ error: '个人资料暂时无法加载。' }); }
});
router.get('/ping', (req, res) => res.json({ status: 'ok', message: 'User router is working.' }));
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const users = await User.find({}, 'name uniqueId isAdmin isVerified profile.avatar.contentType').limit(Number(limit)).skip((Number(page) - 1) * Number(limit)).lean();
    res.json(users.map(user => ({ id: user._id, name: user.name, uniqueId: user.uniqueId, isAdmin: user.isAdmin === true, isVerified: user.isVerified === true, hasAvatar: Boolean(user.profile?.avatar?.contentType) })));
  } catch { res.status(500).json({ error: 'Failed to fetch users' }); }
});
module.exports = router;
