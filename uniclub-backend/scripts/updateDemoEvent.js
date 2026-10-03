const mongoose = require('mongoose');
const Event = require('../models/Event');
require('dotenv').config();

async function updateEvent() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const updatedEvent = await Event.findOneAndUpdate(
      { title: /AI Product Development Workshop/i },
      {
        startDate: new Date("2026-02-25T09:00:00"),
        endDate: new Date("2026-02-25T12:00:00"),
        description: "This is a demo event\n\nJoin us for an interactive workshop on AI Product Development. Learn how to build AI-powered products from concept to deployment."
      },
      { new: true }
    );
    
    if (updatedEvent) {
      console.log('✅ Event updated successfully!');
      console.log('📅 Title:', updatedEvent.title);
      console.log('📅 Start Date:', updatedEvent.startDate);
      console.log('📅 End Date:', updatedEvent.endDate);
      console.log('📝 Description:', updatedEvent.description.substring(0, 80) + '...');
    } else {
      console.log('❌ Event not found');
      
      // List all events to help debug
      const allEvents = await Event.find({}).select('title startDate').limit(10);
      console.log('\n📋 Available events:');
      allEvents.forEach(event => {
        console.log(`  - ${event.title}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

updateEvent();
