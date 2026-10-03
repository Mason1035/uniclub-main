require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const PastEvent = require('../models/PastEvent');

// Image folder path
const imageFolder = path.join(__dirname, '../../public/cometville');

// Compress and convert image to Base64
async function compressAndConvertToBase64(filePath) {
  try {
    // Compress image: resize to max 1920px width, 85% quality
    const compressedBuffer = await sharp(filePath)
      .resize(1920, null, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    const base64Image = compressedBuffer.toString('base64');
    const mimeType = 'image/jpeg';
    return {
      data: `data:${mimeType};base64,${base64Image}`,
      size: compressedBuffer.length
    };
  } catch (error) {
    console.error(`Error compressing ${filePath}:`, error);
    throw error;
  }
}

async function uploadGalleryImages() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the Cometville event by title
    console.log('🔍 Finding Cometville event...');
    const cometvilleEvent = await PastEvent.findOne({ 
      title: { $regex: /comet/i } 
    });

    if (!cometvilleEvent) {
      console.error('❌ Cometville event not found in database');
      console.log('\n💡 Available events:');
      const allEvents = await PastEvent.find({}).select('title');
      allEvents.forEach(event => console.log(`   - ${event.title}`));
      process.exit(1);
    }

    console.log(`✅ Found event: ${cometvilleEvent.title} (ID: ${cometvilleEvent._id})`);

    // Read all images from the folder
    console.log('📸 Reading images from folder...');
    const imageFiles = [
      '1756926457726.jpg',
      '1756926458123.jpg',
      '1756926460217.jpg'
    ];

    const gallery = [];

    for (const fileName of imageFiles) {
      const filePath = path.join(imageFolder, fileName);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Image not found: ${fileName}`);
        continue;
      }

      const originalStats = fs.statSync(filePath);
      console.log(`   Processing: ${fileName} (Original: ${(originalStats.size / 1024).toFixed(2)} KB)...`);
      
      const { data, size } = await compressAndConvertToBase64(filePath);

      gallery.push({
        data: data,
        contentType: 'image/jpeg',
        originalName: fileName,
        size: size,
        uploadedAt: new Date(),
        caption: '' // Can add captions later if needed
      });

      const compressionRatio = ((1 - size / originalStats.size) * 100).toFixed(1);
      console.log(`   ✅ Added ${fileName} (Compressed: ${(size / 1024).toFixed(2)} KB, saved ${compressionRatio}%)`);
    }

    const totalSize = gallery.reduce((sum, img) => sum + img.size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    console.log(`\n📊 Gallery Summary:`);
    console.log(`   Total images: ${gallery.length}`);
    console.log(`   Total size: ${totalSizeMB} MB`);
    
    if (totalSize > 15 * 1024 * 1024) { // 15MB safety margin
      console.warn(`⚠️ WARNING: Gallery size (${totalSizeMB} MB) is close to MongoDB's 16MB limit!`);
      console.warn(`   Consider uploading fewer images or compressing further.`);
    }

    // Update the event with the gallery
    console.log('\n💾 Updating event in database...');
    cometvilleEvent.gallery = gallery;
    await cometvilleEvent.save();

    console.log('✅ Gallery uploaded successfully!');
    console.log(`\n📸 Gallery images: ${gallery.length}`);
    console.log(`🔗 Event ID: ${cometvilleEvent._id}`);
    console.log(`📍 Access gallery at: /api/past-events/${cometvilleEvent._id}/gallery/:imageIndex`);
    console.log(`   (imageIndex: 0 to ${gallery.length - 1})`);

    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error uploading gallery:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the upload
uploadGalleryImages();

