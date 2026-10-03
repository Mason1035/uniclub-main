require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const EnrolledUser = require('./models/EnrolledUser');
const path = require('path');
const authenticateToken = require('./middleware/auth');
const requireAdmin = require('./middleware/admin');

const app = express();
// Nginx is the only trusted proxy in the ECS deployment.
if (process.env.TRUST_PROXY === 'loopback') app.set('trust proxy', 'loopback');

// IMPORTANT: Set body parser limits for Base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve uploads as static files
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
// Specifically serve avatar files (ensure avatars subdirectory is accessible)
app.use('/uploads/avatars', express.static(path.join(__dirname, 'public', 'uploads', 'avatars')));

// Log only important requests (disable body logging for performance)
app.use((req, res, next) => {
  // Only log in development, and skip body to improve performance
  if (process.env.NODE_ENV === 'development' && !req.url.includes('/api/')) {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
  }
  next();
});

const PORT = process.env.PORT || 5050;
const HOST = process.env.HOST || '0.0.0.0';

// CORS configuration with Vercel support
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080', 'http://127.0.0.1:8080', 'http://192.168.1.191:8080',
      'http://localhost:8081', 'http://127.0.0.1:8081', 'http://192.168.1.191:8081',
      'http://localhost:8082', 'http://127.0.0.1:8082', 'http://192.168.1.191:8082'
    ].concat((process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
    
    // Allow all Vercel preview and production URLs
    let isVercelDomain = false;
    try {
      const url = new URL(origin);
      isVercelDomain = process.env.NODE_ENV !== 'production' && url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
    } catch { /* Requests without an Origin header are handled below. */ }
    
    if (!origin || allowedOrigins.includes(origin) || isVercelDomain) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// MongoDB connection settings
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI environment variable is not set!');
  process.exit(1);
}

// Configure MongoDB connection with performance optimizations
const mongoOptions = {
  maxPoolSize: 10, // Connection pool size
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000, // Faster timeout
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000
};

// NOTE: the connection is deliberately started AFTER the routers are required
// (see the bottom of this file). Requiring the routers is synchronous and can
// block the event loop for several seconds on a cold module cache; starting the
// connection first would let serverSelectionTimeoutMS expire before the driver
// ever gets a chance to complete the handshake, killing the process on startup.
const connectToMongo = () => {
  console.log('🔗 Connecting to MongoDB...');
  return mongoose.connect(mongoUri, mongoOptions)
    .then(async () => {
      console.log('✅ Connected to MongoDB');
      console.log('📂 Database name:', mongoose.connection.db?.databaseName || 'connected');

      // Skip heavy queries on startup - just test connectivity
      try {
        const testCount = await EnrolledUser.countDocuments();
        console.log(`📊 EnrolledUser collection: ${testCount} users`);
      } catch (error) {
        console.error('❌ Error accessing EnrolledUser:', error);
      }
    })
    .catch((err) => {
      console.error('❌ Failed to connect to MongoDB:', err);
      process.exit(1);
    });
};

const authRouter = require('./routes/authRouter');

// Import routers
console.log('🔄 Loading routers...');
const newsRouter = require('./routes/newsRouter');
console.log('✅ News router loaded');
const userRouter = require('./routes/userRouter');
console.log('✅ User router loaded');

let chatRouter;
try {
  chatRouter = require('./routes/chatRouter');
  console.log('✅ Chat router loaded successfully');
} catch (error) {
  console.error('❌ Error loading chat router:', error.message);
  console.error('Stack:', error.stack);
}

let commentRouter;
try {
  commentRouter = require('./routes/commentRouter');
  console.log('✅ Comment router loaded successfully');
} catch (error) {
  console.error('❌ Error loading comment router:', error.message);
  console.error('Stack:', error.stack);
}

const socialRouter = require('./routes/socialRouter');
console.log('✅ Social router loaded');

const engagementRouter = require('./routes/engagementRouter');
console.log('✅ Engagement router loaded');

const eventRouter = require('./routes/eventRouter');
console.log('✅ Event router loaded');

const curationRouter = require('./routes/curationRouter');
console.log('✅ Curation router loaded');

const resourceRouter = require('./routes/resourceRouter');
console.log('✅ Resource router loaded');

const notificationRouter = require('./routes/notificationRouter');
console.log('✅ Notification router loaded');

const pastEventRouter = require('./routes/pastEventRouter');
console.log('✅ Past Event router loaded');


// Mount routers
console.log('🔗 Mounting routers...');
app.use('/api/auth', authRouter);
console.log('✅ Auth router mounted at /api/auth');
app.use('/api/news', newsRouter);
console.log('✅ News router mounted at /api/news');
app.use('/api/users', userRouter);
console.log('✅ User router mounted at /api/users');

if (chatRouter) {
  app.use('/api/chat', chatRouter);
  console.log('✅ Chat router mounted at /api/chat');
} else {
  console.error('❌ Chat router not mounted due to loading error');
}

if (commentRouter) {
  app.use('/api/comments', commentRouter);
  console.log('✅ Comment router mounted at /api/comments');
} else {
  console.error('❌ Comment router not mounted due to loading error');
}

app.use('/api/social', socialRouter);
console.log('✅ Social router mounted at /api/social');

app.use('/api/engagement', engagementRouter);
console.log('✅ Engagement router mounted at /api/engagement');

// Deprecation warning for legacy engagement endpoints
console.warn('⚠️  DEPRECATION NOTICE: Legacy engagement endpoints (/api/news/:id/like, /api/social/posts/:id/like, etc.) are deprecated');
console.warn('    Use unified engagement API: /api/engagement/* instead');

app.use('/api/events', eventRouter);
console.log('✅ Event router mounted at /api/events');

app.use('/api/curation', curationRouter);
console.log('✅ Curation router mounted at /api/curation');

app.use('/api/resources', resourceRouter);
console.log('✅ Resource router mounted at /api/resources');

app.use('/api/notifications', notificationRouter);
console.log('✅ Notification router mounted at /api/notifications');

app.use('/api/past-events', pastEventRouter);
console.log('✅ Past Event router mounted at /api/past-events');

// ClassHub admin console API (every route requires User.isAdmin === true)
const adminRouter = require('./routes/adminRouter');
app.use('/api/admin', adminRouter);
console.log('✅ Admin router mounted at /api/admin');

const quantificationRouter = require('./routes/quantificationRouter');
app.use('/api/quantification', quantificationRouter);

// Manual class-fee receipts use private MongoDB Binary images.
app.use('/api/fees', require('./routes/feesRouter'));

// 班级公告（成员端只读）
const announcementRouter = require('./routes/announcementRouter');
app.use('/api/announcements', announcementRouter);
console.log('✅ Announcement router mounted at /api/announcements');

// Featured router
const featuredRouter = require('./routes/featuredRouter');
app.use('/api/featured', featuredRouter);
console.log('✅ Featured router mounted at /api/featured');

// Search router
const searchRouter = require('./routes/searchRouter');
app.use('/api/search', searchRouter);
console.log('✅ Search router mounted at /api/search');

// Debug endpoint: 班级名单概览。
// ⚠️ 原实现**没有任何鉴权**，直接返回全部名单（学生邮箱 + 姓名 + 学号），
// 还会把整份名单 console.log 到服务器日志 —— 对真实班级来说是数据泄露。
// 现已改为仅管理员可访问，且不再打印名单内容。
app.get('/api/debug/enrolled', requireAdmin, async (req, res) => {
  try {
    const users = await EnrolledUser.find({}).select('email name uniqueId').lean();
    res.json({
      count: users.length,
      users,
      collectionName: EnrolledUser.collection.name
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable', message: 'ClassHub backend is running!' });
});

// All routers are loaded at this point, so the event loop is free for the
// MongoDB handshake to complete.
if (process.env.VERCEL && require.main !== module) {
  connectToMongo();
}

// Direct startup works in both development and production, after MongoDB is ready.
if (require.main === module) {
  connectToMongo().then(() => {
    // Persisted cleanup records survive restarts. No cloud call if unconfigured.
    const cleanupTimer = setInterval(() => {
      quantificationRouter.service.run(s => s.cleanup()).catch(() => console.error('[quantification] cleanup deferred'));
    }, 15 * 60 * 1000);
    cleanupTimer.unref();
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Backend API running at: http://localhost:${server.address().port}`);
      console.log('🚀 Available endpoints:');
      console.log('   🔐 Authentication: /api/auth/*');
      console.log('   📰 News: /api/news');
      console.log('   👥 Users: /api/users/*');
      console.log('   🎯 Engagement: /api/engagement/*');
      console.log('   📅 Events: /api/events/*');
      console.log('   📱 Social: /api/social/*');
      console.log('   💬 Comments: /api/comments/*');
      console.log('   🎨 Curation: /api/curation/*');
      console.log('   📚 Resources: /api/resources/*');
      console.log('   📜 Past Events: /api/past-events/*');
      console.log('   🛡️  Admin console API: /api/admin/*');
      console.log('   🔍 Debug: /api/debug/enrolled');
      console.log('   ❤️ Health: /api/health');
    });
  
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error('   On macOS this is usually the AirPlay Receiver (System Settings → General → AirDrop & Handoff).');
        console.error(`   Either turn AirPlay Receiver off, or start the API on another port:`);
        console.error(`   PORT=5050 npm run dev  (then set VITE_API_PROXY_TARGET=http://localhost:5050 for the frontend)\n`);
      } else {
        console.error('❌ Failed to start the server:', error);
      }
      process.exit(1);
    });
    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      clearInterval(cleanupTimer);
      const deadline = setTimeout(() => process.exit(1), 25000);
      deadline.unref();
      server.close(async () => {
        await mongoose.disconnect();
        clearTimeout(deadline);
        process.exit(0);
      });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  });
}

app.use('/api/cron', require('./routes/cronRouter'));

// Export for Vercel serverless functions
module.exports = app; 
