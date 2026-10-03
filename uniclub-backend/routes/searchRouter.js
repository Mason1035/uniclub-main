const express = require('express');
const router = express.Router();
const News = require('../models/News');
const Event = require('../models/Event');
const PastEvent = require('../models/PastEvent');
const Resource = require('../models/Resource');
const SocialPost = require('../models/SocialPost');

// GET /api/search - global search across all content
router.get('/', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        results: []
      });
    }
    
    const searchQuery = q.trim();
    const searchRegex = new RegExp(searchQuery, 'i');
    const limitNum = parseInt(limit);
    
    // Search across all content types in parallel
    const [news, upcomingEvents, pastEvents, resources, socialPosts] = await Promise.all([
      // Search News
      News.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { category: searchRegex }
        ]
      })
      .select('title description category thumbnail createdAt')
      .limit(limitNum)
      .sort({ createdAt: -1 }),
      
      // Search Upcoming Events
      Event.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { location: searchRegex }
        ]
      })
      .select('title description date location poster')
      .limit(limitNum)
      .sort({ date: 1 }),
      
      // Search Past Events
      PastEvent.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { location: searchRegex }
        ]
      })
      .select('title description date location imageUrl')
      .limit(limitNum)
      .sort({ date: -1 }),
      
      // Search Resources
      Resource.find({
        status: 'approved',
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { type: searchRegex },
          { category: searchRegex },
          { tags: searchRegex }
        ]
      })
      .select('title description type category tags thumbnailUrl')
      .limit(limitNum)
      .sort({ downloadCount: -1, views: -1 }),
      
      // Search Social Posts
      SocialPost.find({
        $or: [
          { content: searchRegex }
        ]
      })
      .populate('author', 'name profile.avatar')
      .select('content media createdAt')
      .limit(limitNum)
      .sort({ createdAt: -1 })
    ]);
    
    // Format results with consistent structure
    const results = [];
    
    // Add news results
    news.forEach(item => {
      results.push({
        id: item._id,
        type: 'News',
        category: 'News',
        title: item.title,
        description: item.description,
        thumbnail: item.thumbnail,
        date: item.createdAt,
        url: `/news/${item._id}`
      });
    });
    
    // Add upcoming events
    upcomingEvents.forEach(item => {
      results.push({
        id: item._id,
        type: 'Event',
        category: 'Events',
        title: item.title,
        description: item.description,
        thumbnail: item.poster,
        date: item.date,
        location: item.location,
        url: `/event/${item._id}`
      });
    });
    
    // Add past events
    pastEvents.forEach(item => {
      results.push({
        id: item._id,
        type: 'Past Event',
        category: 'Events',
        title: item.title,
        description: item.description,
        thumbnail: item.imageUrl,
        date: item.date,
        location: item.location,
        url: `/past-events`
      });
    });
    
    // Add resources
    resources.forEach(item => {
      results.push({
        id: item._id,
        type: item.type,
        category: 'Resources',
        title: item.title,
        description: item.description,
        thumbnail: item.thumbnailUrl,
        tags: item.tags,
        url: `/resource/${item._id}`
      });
    });
    
    // Add social posts
    socialPosts.forEach(item => {
      results.push({
        id: item._id,
        type: 'Post',
        category: 'Social',
        title: item.content.substring(0, 50) + (item.content.length > 50 ? '...' : ''),
        description: item.content,
        thumbnail: item.media && item.media.length > 0 ? item.media[0].url : null,
        author: item.author,
        date: item.createdAt,
        url: `/social`
      });
    });
    
    // Sort by relevance (you can improve this with a scoring algorithm)
    // For now, we'll keep them sorted by their original query order
    
    res.json({
      success: true,
      query: searchQuery,
      count: results.length,
      results: results.slice(0, limitNum)
    });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to perform search', 
      details: error.message 
    });
  }
});

module.exports = router;

