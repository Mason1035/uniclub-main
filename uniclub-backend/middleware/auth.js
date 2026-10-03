const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

const authenticateToken = async (req, res, next) => {
  // Allow OPTIONS requests to pass through without authentication (for CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Reduced logging for production
  if (process.env.NODE_ENV === 'development') {
    console.log('🔐 AUTH:', req.method, req.url);
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // NOTE: the original "portfolio-demo-token" backdoor (which authenticated
    // anyone as a hard-coded user) has been removed. ClassHub only accepts real
    // JWTs signed with JWT_SECRET.
    const user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!user || typeof user !== 'object' || !mongoose.Types.ObjectId.isValid(user.userId)) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const account = await User.findById(user.userId).select('tokenVersion');
    if (!account || (account.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ error: 'Session expired; please sign in again' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.log('❌ Token validation failed:', error.message);
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError' && error.name !== 'NotBeforeError') {
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateToken; 