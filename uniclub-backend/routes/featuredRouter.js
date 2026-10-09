const express = require('express');
const router = express.Router();
const News = require('../models/News');
const Event = require('../models/Event');
const Resource = require('../models/Resource');
const { optional: activityReader } = require('../middleware/activityReadAccess').createActivityReadAccess();
const { activityPreview } = require('../middleware/activityReadAccess');
const { runtime, publicNewsFilter } = require('../utils/dailyNewsVisibility');

async function findFeaturedNews() {
  const state = await runtime();
  if (state.activeBatchId) {
    const daily = await News.findOne({ status: 'approved', publishedAt: { $lte: new Date() },
      origin: 'ai_daily', generationBatchId: state.activeBatchId,
    }).populate('author', 'name uniqueId').sort({ publishedAt: -1, automationIndex: 1 });
    if (daily) return daily;
  }
  const filter = publicNewsFilter(state.activeBatchId);
  return await News.findOne({ ...filter, isFeatured: true }).populate('author', 'name uniqueId').sort({ publishedAt: -1 }) ||
    await News.findOne({ ...filter, isTrending: true }).populate('author', 'name uniqueId').sort({ publishedAt: -1 }) ||
    await News.findOne(filter).populate('author', 'name uniqueId').sort({ publishedAt: -1 });
}

// GET /api/featured/news - Get single featured news article
router.get('/news', async (req, res) => {
  try {
    console.log('📰 API: Fetching featured news...');
    
    const featuredNews = await findFeaturedNews();
    
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
        origin: featuredNews.origin || 'manual',
        sourceReferences: featuredNews.sourceReferences || [],
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
router.get('/event', activityReader, async (req, res) => {
  try {
    if (!req.canReadActivities) return res.status(401).json({ error: '请登录当前班级账号后查看活动。' });
    console.log('📅 API: Fetching featured event...');
    
    const now = new Date();
    
    // Try to get a featured upcoming event
    let featuredEvent = await Event.findOne({
      isFeatured: true,
      status: 'published',
      deletedAt: null,
      startDate: { $gte: now }
    })
    .select('+mediaRefs').populate('organizer', 'name')

    .sort({ startDate: 1 });
    
    // If no featured upcoming event, get the closest upcoming event
    if (!featuredEvent) {
      featuredEvent = await Event.findOne({
        status: 'published',
      deletedAt: null,
        startDate: { $gte: now }
      })
      .select('+mediaRefs').populate('organizer', 'name')
  
      .sort({ startDate: 1 });
    }
    
    // Final fallback: most recent past event if no upcoming events
    if (!featuredEvent) {
      featuredEvent = await Event.findOne({ status: 'published', deletedAt: null })
        .select('+mediaRefs').populate('organizer', 'name')
    
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
      event: await activityPreview(featuredEvent, req.user.userId)
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
router.get('/all', activityReader, async (req, res) => {
  try {
    console.log('🌟 API: Fetching all featured content...');
    
    const [newsResponse, eventResponse, resourceResponse] = await Promise.allSettled([
      // Featured news
      (async () => {
        return findFeaturedNews();
      })(),
      
      // Featured event
      (async () => {
        if (!req.canReadActivities) return null;
        const now = new Date();
        let event = await Event.findOne({
          isFeatured: true,
          status: 'published',
      deletedAt: null,
          startDate: { $gte: now }
        })
        .select('+mediaRefs').populate('organizer', 'name')
    
        .sort({ startDate: 1 });
        
        if (!event) {
          event = await Event.findOne({
            status: 'published',
      deletedAt: null,
            startDate: { $gte: now }
          })
          .select('+mediaRefs').populate('organizer', 'name')
      
          .sort({ startDate: 1 });
        }
        
        if (!event) {
          event = await Event.findOne({ status: 'published', deletedAt: null })
            .select('+mediaRefs').populate('organizer', 'name')
        
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
        event: eventResponse.status === 'fulfilled' ? await activityPreview(eventResponse.value, req.user?.userId) : null,
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
