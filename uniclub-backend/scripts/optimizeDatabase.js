const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Database Optimization Script
 * Creates indexes for optimal query performance across all social media models
 */

async function optimizeDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-club-today-feed');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    console.log('\n📊 Creating performance indexes...\n');

    // SocialPost indexes
    console.log('Creating SocialPost indexes...');
    await db.collection('socialposts').createIndex({ author: 1, createdAt: -1 });
    await db.collection('socialposts').createIndex({ status: 1, createdAt: -1 });
    await db.collection('socialposts').createIndex({ hashtags: 1 });
    await db.collection('socialposts').createIndex({ mentions: 1 });
    await db.collection('socialposts').createIndex({ groupId: 1, status: 1, createdAt: -1 });
    await db.collection('socialposts').createIndex({ postType: 1, status: 1, createdAt: -1 });
    await db.collection('socialposts').createIndex({ 'engagement.likeCount': -1 });
    await db.collection('socialposts').createIndex({ 'engagement.commentCount': -1 });
    await db.collection('socialposts').createIndex({ visibility: 1, status: 1, createdAt: -1 });
    await db.collection('socialposts').createIndex({ isPinned: 1, pinnedAt: -1 });
    
    // Compound index for feed generation
    await db.collection('socialposts').createIndex({ 
      status: 1, 
      visibility: 1, 
      createdAt: -1 
    });
    
    // Compound index for trending calculation
    await db.collection('socialposts').createIndex({ 
      status: 1, 
      createdAt: -1, 
      'engagement.likeCount': -1,
      'engagement.commentCount': -1 
    });

    // SocialInteraction indexes
    console.log('Creating SocialInteraction indexes...');
    await db.collection('socialinteractions').createIndex({ 
      userId: 1, 
      targetType: 1, 
      targetId: 1, 
      actionType: 1 
    }, { unique: true });
    await db.collection('socialinteractions').createIndex({ 
      targetType: 1, 
      targetId: 1, 
      actionType: 1, 
      isActive: 1 
    });
    await db.collection('socialinteractions').createIndex({ 
      userId: 1, 
      actionType: 1, 
      createdAt: -1 
    });
    await db.collection('socialinteractions').createIndex({ 
      targetType: 1, 
      targetId: 1, 
      createdAt: -1 
    });

    // SocialComment indexes
    console.log('Creating SocialComment indexes...');
    await db.collection('socialcomments').createIndex({ 
      postId: 1, 
      status: 1, 
      createdAt: -1 
    });
    await db.collection('socialcomments').createIndex({ 
      author: 1, 
      createdAt: -1 
    });
    await db.collection('socialcomments').createIndex({ 
      parentCommentId: 1, 
      createdAt: 1 
    });
    await db.collection('socialcomments').createIndex({ 
      mentions: 1, 
      createdAt: -1 
    });
    await db.collection('socialcomments').createIndex({ status: 1 });

    // Follow indexes
    console.log('Creating Follow indexes...');
    await db.collection('follows').createIndex({ 
      followerId: 1, 
      followingId: 1 
    }, { unique: true });
    await db.collection('follows').createIndex({ 
      followerId: 1, 
      status: 1 
    });
    await db.collection('follows').createIndex({ 
      followingId: 1, 
      status: 1 
    });
    await db.collection('follows').createIndex({ 
      followerId: 1, 
      relationshipType: 1 
    });
    await db.collection('follows').createIndex({ 
      status: 1, 
      createdAt: -1 
    });
    await db.collection('follows').createIndex({ 
      lastInteraction: -1 
    });
    await db.collection('follows').createIndex({ 
      interactionScore: -1 
    });

    // Group indexes
    console.log('Creating Group indexes...');
    await db.collection('groups').createIndex({ slug: 1 }, { unique: true });
    await db.collection('groups').createIndex({ privacy: 1, status: 1 });
    await db.collection('groups').createIndex({ category: 1, status: 1 });
    await db.collection('groups').createIndex({ tags: 1 });
    await db.collection('groups').createIndex({ adminIds: 1 });
    await db.collection('groups').createIndex({ memberIds: 1 });
    await db.collection('groups').createIndex({ createdAt: -1, status: 1 });
    await db.collection('groups').createIndex({ 'stats.memberCount': -1 });
    await db.collection('groups').createIndex({ lastActivityAt: -1 });

    // GroupMembership indexes
    console.log('Creating GroupMembership indexes...');
    await db.collection('groupmemberships').createIndex({ 
      groupId: 1, 
      userId: 1 
    }, { unique: true });
    await db.collection('groupmemberships').createIndex({ 
      groupId: 1, 
      status: 1, 
      role: 1 
    });
    await db.collection('groupmemberships').createIndex({ 
      userId: 1, 
      status: 1 
    });
    await db.collection('groupmemberships').createIndex({ 
      groupId: 1, 
      lastActiveAt: -1 
    });
    await db.collection('groupmemberships').createIndex({ 
      invitedBy: 1 
    });
    await db.collection('groupmemberships').createIndex({ 
      joinedAt: -1 
    });

    // User indexes (additional ones for social features)
    console.log('Creating additional User indexes...');
    await db.collection('users').createIndex({ 
      'socialStats.postsCreated': -1 
    });
    await db.collection('users').createIndex({ 
      'socialStats.articlesLiked': -1 
    });
    await db.collection('users').createIndex({ 
      'settings.profileVisibility': 1 
    });
    await db.collection('users').createIndex({ 
      lastActive: -1 
    });

    // UserEngagement indexes (if exists)
    console.log('Creating UserEngagement indexes...');
    await db.collection('userengagements').createIndex({ 
      user: 1, 
      contentType: 1, 
      contentId: 1 
    }, { unique: true });
    await db.collection('userengagements').createIndex({ 
      user: 1, 
      liked: 1 
    });
    await db.collection('userengagements').createIndex({ 
      user: 1, 
      saved: 1 
    });
    await db.collection('userengagements').createIndex({ 
      contentType: 1, 
      contentId: 1, 
      liked: 1 
    });
    await db.collection('userengagements').createIndex({ 
      lastEngagedAt: -1 
    });

    console.log('\n✅ All indexes created successfully!');
    
    // Show current indexes
    console.log('\n📋 Current indexes summary:');
    const collections = ['socialposts', 'socialinteractions', 'socialcomments', 'follows', 'groups', 'groupmemberships', 'users'];
    
    for (const collectionName of collections) {
      try {
        const indexes = await db.collection(collectionName).listIndexes().toArray();
        console.log(`\n${collectionName}: ${indexes.length} indexes`);
        indexes.forEach(index => {
          console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
        });
      } catch (error) {
        console.log(`  - Collection ${collectionName} not found (skipping)`);
      }
    }

    console.log('\n🚀 Database optimization complete!');
    
  } catch (error) {
    console.error('❌ Error optimizing database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the optimization
if (require.main === module) {
  optimizeDatabase();
}

module.exports = optimizeDatabase;
