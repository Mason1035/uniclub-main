require('dotenv').config();
const mongoose = require('mongoose');
const Resource = require('../models/Resource');

async function cleanupUploadResources() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all upload-type resources first (to show what we're deleting)
    const uploadResources = await Resource.find({ 'file.type': 'upload' });
    
    if (uploadResources.length === 0) {
      console.log('✅ No upload-type resources found. Database is clean!');
      process.exit(0);
    }

    console.log(`📋 Found ${uploadResources.length} upload-type resource(s) to remove:\n`);
    
    uploadResources.forEach((resource, index) => {
      console.log(`${index + 1}. "${resource.title}"`);
      console.log(`   Type: ${resource.type}`);
      console.log(`   File: ${resource.file?.url || 'N/A'}`);
      console.log(`   Downloads: ${resource.downloadCount}, Views: ${resource.views}`);
      console.log('');
    });

    console.log('🗑️  Deleting upload-type resources...');
    
    const result = await Resource.deleteMany({ 'file.type': 'upload' });
    
    console.log(`✅ Successfully deleted ${result.deletedCount} resource(s)!\n`);
    
    // Show remaining resources count
    const remainingCount = await Resource.countDocuments({ status: 'approved' });
    console.log(`📊 Remaining approved resources: ${remainingCount}`);
    
    const linkTypeCount = await Resource.countDocuments({ 'file.type': 'link', status: 'approved' });
    console.log(`🔗 Link-type resources: ${linkTypeCount}\n`);
    
    console.log('✨ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed.');
    process.exit(0);
  }
}

// Run the cleanup
cleanupUploadResources();

