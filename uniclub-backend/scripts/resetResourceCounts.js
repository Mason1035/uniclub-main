const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Reset all resource counts to 0
const resetResourceCounts = async () => {
  try {
    const Resource = require('../models/Resource');
    
    const result = await Resource.updateMany(
      {},
      {
        $set: {
          downloadCount: 0,
          views: 0,
          likes: 0,
          comments: 0,
          saves: 0,
          shares: 0
        }
      }
    );
    
    console.log(`✅ Reset engagement counts for ${result.modifiedCount} resources`);
    console.log('📊 All metrics (downloads, views, likes, comments, saves, shares) set to 0');
    
  } catch (error) {
    console.error('❌ Error resetting resource counts:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await resetResourceCounts();
    mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

main();

