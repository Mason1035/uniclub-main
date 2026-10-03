require('dotenv').config();
const mongoose = require('mongoose');
const PastEvent = require('../models/PastEvent');

async function addYouTubeLink() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the Fireside Chat event
    console.log('🔍 Finding Fireside Chat event...');
    const firesideEvent = await PastEvent.findOne({ 
      title: { $regex: /Fireside.*Daniel George/i } 
    });

    if (!firesideEvent) {
      console.error('❌ Fireside Chat event not found in database');
      console.log('\n💡 Available events:');
      const allEvents = await PastEvent.find({}).select('title');
      allEvents.forEach(event => console.log(`   - ${event.title}`));
      process.exit(1);
    }

    console.log(`✅ Found event: ${firesideEvent.title} (ID: ${firesideEvent._id})`);

    // Add the YouTube link
    const youtubeLink = 'https://www.youtube.com/watch?v=l2Mob-Y2Ovw&t=4294s';
    
    console.log(`\n🎥 Adding YouTube link: ${youtubeLink}`);
    firesideEvent.link = youtubeLink;
    await firesideEvent.save();

    console.log('✅ YouTube link added successfully!');
    console.log(`\n🔗 Event ID: ${firesideEvent._id}`);
    console.log(`📺 YouTube Link: ${firesideEvent.link}`);

    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error adding YouTube link:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the update
addYouTubeLink();

