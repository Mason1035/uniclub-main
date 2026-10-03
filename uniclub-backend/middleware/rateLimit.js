const rateLimit = require('express-rate-limit');

/**
 * Rate limiting middleware for API endpoints
 * Prevents abuse and ensures fair usage
 */

// General API rate limit
const generalLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for post creation
const createPostLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 post creations per minute
  message: {
    error: 'Too many posts created, please wait before creating another post.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Comment creation rate limit
const createCommentLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 comments per minute
  message: {
    error: 'Too many comments posted, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Like/interaction rate limit
const interactionLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 interactions per minute
  message: {
    error: 'Too many interactions, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Follow/unfollow rate limit
const followLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 follow actions per minute
  message: {
    error: 'Too many follow/unfollow actions, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints rate limit (more restrictive)
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 failed auth requests per 15 minutes
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const curationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user.userId,
  message: { error: 'Too many curation runs, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordChangeLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5,
  skipSuccessfulRequests: true, keyGenerator: req => req.user.userId,
  message: { error: '密码尝试较频繁，请稍后再试。' }, standardHeaders: true, legacyHeaders: false });
const avatarUploadLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5,
  keyGenerator: req => req.user.userId, message: { error: '头像修改较频繁，请稍后再试。' } });

module.exports = {
  passwordChangeLimit,
  avatarUploadLimit,
  generalLimit,
  createPostLimit,
  createCommentLimit,
  interactionLimit,
  followLimit,
  authLimit,
  curationLimit
};
