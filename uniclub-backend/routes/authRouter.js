const express = require('express');
const User = require('../models/User');
const EnrolledUser = require('../models/EnrolledUser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authenticateToken = require('../middleware/auth');
const { authLimit, passwordChangeLimit } = require('../middleware/rateLimit');
const { validatePasswordChange } = require('../utils/accountSettingsPolicy');

const authRouter = express.Router();

/* -------------------------------------------------------------------------- */
/* Registration policy (configurable via uniclub-backend/.env)                 */
/* -------------------------------------------------------------------------- */
// ALLOWED_EMAIL_DOMAINS   - comma-separated allow-list, e.g. "stu.example.edu,example.edu".
//                           Leave empty to accept any valid email address.
// REQUIRE_ENROLLED_ROSTER - "false" disables the class-roster check.
const allowedEmailDomains = (process.env.ALLOWED_EMAIL_DOMAINS || '')
  .split(',')
  .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
  .filter(Boolean);

const requireEnrolledRoster =
  String(process.env.REQUIRE_ENROLLED_ROSTER ?? 'true').toLowerCase() !== 'false';

const EMAIL_PATTERN = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;
const MIN_PASSWORD_LENGTH = 8;

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

/** Case-insensitive email lookup so casing never locks a user out. */
const findByEmail = (email) =>
  User.findOne({ email: new RegExp(`^${escapeRegex(normalizeEmail(email))}$`, 'i') });

const isEmailAllowed = (email) => {
  const normalized = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalized)) return false;
  if (allowedEmailDomains.length === 0) return true;
  return allowedEmailDomains.some((domain) => normalized.endsWith(`@${domain}`));
};

const domainHint = () =>
  allowedEmailDomains.length
    ? `请使用班级邮箱注册（可用域名：${allowedEmailDomains.map((d) => '@' + d).join('、')}）`
    : '请输入有效的邮箱地址';

// Step 1: 校验邮箱是否可用于注册
// POST /api/auth/signup-step1 { email }
authRouter.post('/signup-step1', authLimit, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isEmailAllowed(email)) {
      return res.status(400).json({ error: domainHint() });
    }
    // Check if already registered
    const existingUser = await findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已注册，请直接登录。' });
    }
    res.json({ success: true, message: '邮箱可用。' });
  } catch (error) {
    console.error('❌ Error in signup-step1:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Step 2: 校验学号与邮箱是否在班级名单中
// POST /api/auth/signup-step2 { email, uniqueId }
authRouter.post('/signup-step2', authLimit, async (req, res) => {
  try {
    const { email, uniqueId } = req.body;
    if (!email || !uniqueId) {
      return res.status(400).json({ error: '邮箱和学号均为必填项。' });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedUniqueId = String(uniqueId).trim();

    if (!requireEnrolledRoster) {
      // 名单校验已关闭：姓名由注册者自己在第 3 步填写
      return res.json({ success: true, name: '', message: '未启用班级名单校验。' });
    }

    const enrolled = await EnrolledUser.findOne({
      email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i'),
      uniqueId: normalizedUniqueId
    });

    if (!enrolled) {
      return res.status(400).json({
        error: '未在班级名单中找到该邮箱与学号的组合，请联系管理员确认名单是否已导入。'
      });
    }

    res.json({ success: true, name: enrolled.name, message: '学号校验通过。' });
  } catch (error) {
    console.error('❌ Error in signup-step2:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Step 3: 设置密码并完成注册
// POST /api/auth/signup-step3 { email, uniqueId, password, name? }
authRouter.post('/signup-step3', authLimit, async (req, res) => {
  try {
    const { email, uniqueId, password, name } = req.body;
    if (!email || !uniqueId || !password) {
      return res.status(400).json({ error: '邮箱、学号和密码均为必填项。' });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `密码至少需要 ${MIN_PASSWORD_LENGTH} 位。` });
    }
    if (!isEmailAllowed(email)) {
      return res.status(400).json({ error: domainHint() });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedUniqueId = String(uniqueId).trim();

    // Check if already registered
    const existingUser = await findByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已注册，请直接登录。' });
    }

    // uniqueId 有唯一索引，先给出可读的错误而不是让 Mongo 抛 E11000
    const idTaken = await User.findOne({ uniqueId: normalizedUniqueId });
    if (idTaken) {
      return res.status(400).json({ error: '该学号已被注册，请联系管理员。' });
    }

    let displayName = (name && String(name).trim()) || '';

    if (requireEnrolledRoster) {
      const enrolled = await EnrolledUser.findOne({
        email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i'),
        uniqueId: normalizedUniqueId
      });
      if (!enrolled) {
        return res.status(400).json({ error: '未在班级名单中找到该邮箱与学号的组合。' });
      }
      displayName = displayName || enrolled.name;
    }

    if (!displayName) {
      return res.status(400).json({ error: '请填写姓名。' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      email: normalizedEmail,
      name: displayName,
      uniqueId: normalizedUniqueId,
      passwordHash,
      isEnrolled: true,
    });

    res.json({ success: true, message: '注册成功，请登录。' });
  } catch (error) {
    console.error('❌ Error in signup-step3:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/login { uniqueId, password }
// Numeric student IDs and existing administrator IDs use the same login flow.
authRouter.post('/login', authLimit, async (req, res) => {
  try {
    const { uniqueId, password } = req.body || {};
    if (typeof uniqueId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(uniqueId.trim()) ||
        typeof password !== 'string' || !password || password.length > 1024) {
      return res.status(400).json({ error: '请输入学号和密码。' });
    }
    const user = await User.findOne({ uniqueId: uniqueId.trim() });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(400).json({ error: '学号或密码不正确。' });
    }
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    const token = jwt.sign({
      userId: user._id, uniqueId: user.uniqueId, email: user.email || '',
      tokenVersion: user.tokenVersion || 0,
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email || '',
        name: user.name,
        displayName: user.displayName || null,
        uniqueId: user.uniqueId,
        isAdmin: user.isAdmin === true,
      },
    });
  } catch (error) {
    console.error('❌ Error in login:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Token validation endpoint
// GET /api/auth/validate
authRouter.get('/validate', authenticateToken, async (req, res) => {
  try {
    // Resolve admin status from the database so the client can gate admin UI.
    // A lookup failure must never invalidate an otherwise valid token.
    let isAdmin = false;
    try {
      const user = await User.findById(req.user.userId).select('isAdmin');
      isAdmin = Boolean(user && user.isAdmin === true);
    } catch (lookupError) {
      console.warn('⚠️ Could not resolve isAdmin during validation:', lookupError.message);
    }

    res.json({ valid: true, user: { ...req.user, isAdmin } });
  } catch (error) {
    console.error('❌ Error in token validation:', error);
    res.status(500).json({ error: 'Server error during validation.' });
  }
});

// Get current user profile
// GET /api/auth/me
authRouter.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Only ever expose non-sensitive fields. passwordHash is never returned.
    res.json({
      user: {
        id: user._id,
        email: user.email || '',
        name: user.name,
        displayName: user.displayName || null,
        uniqueId: user.uniqueId,
        avatar: user.profile?.avatar || null,
        isAdmin: user.isAdmin === true
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});


// A successful change revokes every previous JWT; the client signs out normally.
authRouter.post('/change-password', authenticateToken, passwordChangeLimit, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (Object.keys(req.query).length) return res.status(400).json({ error: '只能修改当前账号的密码。' });
  const error = validatePasswordChange(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const user = await User.findById(req.user.userId).select('passwordHash tokenVersion');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!await bcrypt.compare(req.body.currentPassword, user.passwordHash)) return res.status(400).json({ error: '当前密码不正确。' });
    const passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    const version = user.tokenVersion || 0;
    const filter = { _id: user._id, passwordHash: user.passwordHash,
      ...(version ? { tokenVersion: version } : { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }) };
    const result = await User.updateOne(filter, { $set: { passwordHash }, $inc: { tokenVersion: 1 } });
    if (result.modifiedCount !== 1) return res.status(409).json({ error: '账户状态已变化，请重新登录后再试。' });
    res.json({ success: true, requiresLogin: true, message: '密码已修改，请使用新密码重新登录。' });
  } catch { res.status(503).json({ error: '密码暂时无法修改，请稍后重试。' }); }
});

module.exports = authRouter;
