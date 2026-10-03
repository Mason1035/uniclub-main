const express = require('express');
const router = express.Router();
const News = require('../models/News');
const Event = require('../models/Event');
const Resource = require('../models/Resource');

// GET /api/featured/news - Get single featured news article
router.get('/news', async (req, res) => {
  try {
    console.log('📰 API: Fetching featured news...');
    
    // Try to get a featured news article first, then fallback to top engagement
    let featuredNews = await News.findOne({ 
      isFeatured: true, 
      status: 'approved' 
    })
    .populate('author', 'name uniqueId')
    .sort({ publishedAt: -1 });
    
    // If no featured news, get the most recent trending news
    if (!featuredNews) {
      featuredNews = await News.findOne({ 
        isTrending: true, 
        status: 'approved' 
      })
      .populate('author', 'name uniqueId')
      .sort({ publishedAt: -1 });
    }
    
    // Final fallback: most recent approved news
    if (!featuredNews) {
      featuredNews = await News.findOne({ status: 'approved' })
        .populate('author', 'name uniqueId')
        .sort({ publishedAt: -1 });
    }
    
    if (!featuredNews) {
      return res.json({
        success: true,
        news: null,
        message: 'No news articles available'
      });
    }
    
    console.log('📰 Featured news selected:', featuredNews.title);
    
    res.json({
      success: true,
      news: {
        _id: featuredNews._id,
        title: featuredNews.title,
        excerpt: featuredNews.excerpt,
        summary: featuredNews.summary,
        source: featuredNews.source,
        originalAuthor: featuredNews.originalAuthor,
        imageUrl: featuredNews.imageUrl,
        publisherLogo: featuredNews.publisherLogo,
        publishedAt: featuredNews.publishedAt,
        engagement: featuredNews.engagement || { views: 0, comments: 0, likes: 0 },
        categories: featuredNews.categories,
        isFeatured: featuredNews.isFeatured,
        isTrending: featuredNews.isTrending
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching featured news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured news',
      details: error.message
    });
  }
});

// GET /api/featured/event - Get single featured upcoming event
router.get('/event', async (req, res) => {
  try {
    console.log('📅 API: Fetching featured event...');
    
    const now = new Date();
    
    // Try to get a featured upcoming event
    let featuredEvent = await Event.findOne({
      isFeatured: true,
      status: 'published',
      startDate: { $gte: now }
    })
    .populate('organizer', 'name uniqueId')

    .sort({ startDate: 1 });
    
    // If no featured upcoming event, get the closest upcoming event
    if (!featuredEvent) {
      featuredEvent = await Event.findOne({
        status: 'published',
        startDate: { $gte: now }
      })
      .populate('organizer', 'name uniqueId')
  
      .sort({ startDate: 1 });
    }
    
    // Final fallback: most recent past event if no upcoming events
    if (!featuredEvent) {
      featuredEvent = await Event.findOne({ status: 'published' })
        .populate('organizer', 'name uniqueId')
    
        .sort({ startDate: -1 });
    }
    
    if (!featuredEvent) {
      return res.json({
        success: true,
        event: null,
        message: 'No events available'
      });
    }
    
    console.log('📅 Featured event selected:', featuredEvent.title);
    
    res.json({
      success: true,
      event: {
        _id: featuredEvent._id,
        title: featuredEvent.title,
        description: featuredEvent.description,
        startDate: featuredEvent.startDate,
        endDate: featuredEvent.endDate,
        location: featuredEvent.location,
        eventType: featuredEvent.eventType,
        imageUrl: featuredEvent.imageUrl,
        organizer: featuredEvent.organizer,
        engagement: {
          rsvpCount: featuredEvent.engagement?.rsvpCount || 0,
          views: featuredEvent.engagement?.views || 0
        },
        maxAttendees: featuredEvent.maxAttendees,
        isVirtual: featuredEvent.isVirtual,
        meetingLink: featuredEvent.meetingLink,
        isFeatured: featuredEvent.isFeatured,
        tags: featuredEvent.tags
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching featured event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured event',
      details: error.message
    });
  }
});

// GET /api/featured/resource - Get single featured learning resource
router.get('/resource', async (req, res) => {
  try {
    console.log('📚 API: Fetching featured resource...');
    
    // Try to get a featured approved resource
    let featuredResource = await Resource.findOne({
      isFeatured: true,
      isApproved: true
    })
    .populate('uploadedBy', 'name uniqueId')
    .sort({ dateAdded: -1 });
    
    // If no featured resource, get the most downloaded resource
    if (!featuredResource) {
      featuredResource = await Resource.findOne({ isApproved: true })
        .populate('uploadedBy', 'name uniqueId')
        .sort({ downloadCount: -1, dateAdded: -1 });
    }
    
    // Final fallback: most recent approved resource
    if (!featuredResource) {
      featuredResource = await Resource.findOne({ isApproved: true })
        .populate('uploadedBy', 'name uniqueId')
        .sort({ dateAdded: -1 });
    }
    
    if (!featuredResource) {
      return res.json({
        success: true,
        resource: null,
        message: 'No resources available'
      });
    }
    
    console.log('📚 Featured resource selected:', featuredResource.title);
    
    res.json({
      success: true,
      resource: {
        _id: featuredResource._id,
        title: featuredResource.title,
        description: featuredResource.description,
        type: featuredResource.type,
        category: featuredResource.category,
        fileSize: featuredResource.fileSize,
        downloadCount: featuredResource.downloadCount || 0,
        views: featuredResource.views || 0,
        uploadedBy: featuredResource.uploadedBy,
        dateAdded: featuredResource.dateAdded,
        thumbnailUrl: featuredResource.thumbnailUrl,
        tags: featuredResource.tags,
        difficulty: featuredResource.difficulty,
        estimatedTime: featuredResource.estimatedTime,
        isFeatured: featuredResource.isFeatured,
        isApproved: featuredResource.isApproved
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching featured resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured resource',
      details: error.message
    });
  }
});

// GET /api/featured/all - Get all featured content at once (for efficiency)
router.get('/all', async (req, res) => {
  try {
    console.log('🌟 API: Fetching all featured content...');
    
    const [newsResponse, eventResponse, resourceResponse] = await Promise.allSettled([
      // Featured news
      (async () => {
        let news = await News.findOne({ isFeatured: true, status: 'approved' })
          .populate('author', 'name uniqueId')
          .sort({ publishedAt: -1 });
        
        if (!news) {
          news = await News.findOne({ isTrending: true, status: 'approved' })
            .populate('author', 'name uniqueId')
            .sort({ publishedAt: -1 });
        }
        
        if (!news) {
          news = await News.findOne({ status: 'approved' })
            .populate('author', 'name uniqueId')
            .sort({ publishedAt: -1 });
        }
        
        return news;
      })(),
      
      // Featured event
      (async () => {
        const now = new Date();
        let event = await Event.findOne({
          isFeatured: true,
          status: 'published',
          startDate: { $gte: now }
        })
        .populate('organizer', 'name uniqueId')
    
        .sort({ startDate: 1 });
        
        if (!event) {
          event = await Event.findOne({
            status: 'published',
            startDate: { $gte: now }
          })
          .populate('organizer', 'name uniqueId')
      
          .sort({ startDate: 1 });
        }
        
        if (!event) {
          event = await Event.findOne({ status: 'published' })
            .populate('organizer', 'name uniqueId')
        
            .sort({ startDate: -1 });
        }
        
        return event;
      })(),
      
      // Featured resource
      (async () => {
        let resource = await Resource.findOne({
          isFeatured: true,
          isApproved: true
        })
        .populate('uploadedBy', 'name uniqueId')
        .sort({ dateAdded: -1 });
        
        if (!resource) {
          resource = await Resource.findOne({ isApproved: true })
            .populate('uploadedBy', 'name uniqueId')
            .sort({ downloadCount: -1, dateAdded: -1 });
        }
        
        if (!resource) {
          resource = await Resource.findOne({ isApproved: true })
            .populate('uploadedBy', 'name uniqueId')
            .sort({ dateAdded: -1 });
        }
        
        return resource;
      })()
    ]);
    
    const result = {
      success: true,
      data: {
        news: newsResponse.status === 'fulfilled' ? newsResponse.value : null,
        event: eventResponse.status === 'fulfilled' ? eventResponse.value : null,
        resource: resourceResponse.status === 'fulfilled' ? resourceResponse.value : null
      }
    };
    
    console.log('🌟 All featured content retrieved:', {
      news: result.data.news ? result.data.news.title : 'none',
      event: result.data.event ? result.data.event.title : 'none',
      resource: result.data.resource ? result.data.resource.title : 'none'
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error fetching all featured content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured content',
      details: error.message
    });
  }
});

module.exports = router;
