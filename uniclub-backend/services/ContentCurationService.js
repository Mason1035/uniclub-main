const AIRankingService = require('./AIRankingService');
const News = require('../models/News');
const Event = require('../models/Event');
const SocialPost = require('../models/SocialPost');

class ContentCurationService {
  constructor() {
    this.aiRanking = AIRankingService;
  }

  /**
   * Main curation function - implements the complete funnel
   * ALL CONTENT → AI SELECTS TOP 3 → HOMEPAGE → AI SELECTS #1 → FEATURED SECTION
   */
  async curateFeaturedContent() {
    try {
      console.log('🚀 Starting comprehensive content curation...');
      
      // Step 1: Fetch all content from database
      const allContent = await this.fetchAllContent();
      
      // Step 2: AI ranks each category (top 3 + #1 featured)
      const rankedContent = await this.rankAllCategories(allContent);
      
      // Step 3: Update database with ranking flags
      await this.updateContentRankings(rankedContent);
      
      console.log('✅ Content curation completed successfully');
      return rankedContent;
      
    } catch (error) {
      console.error('❌ Error in content curation:', error.message);
      throw error;
    }
  }

  /**
   * Fetch all content from database
   */
  async fetchAllContent() {
    console.log('📥 Fetching all content from database...');

    const [news, events, socialPosts] = await Promise.all([
      News.find({ status: 'approved' }).sort({ publishedAt: -1 }).limit(50),
      Event.find({
        status: 'published',
        startDate: { $gte: new Date() } // Only upcoming events for AI ranking
      }).sort({ startDate: -1 }).limit(50),
      SocialPost.find({}).sort({ createdAt: -1 }).limit(50)
    ]);

    console.log(`📊 Content fetched: ${news.length} news, ${events.length} upcoming events, ${socialPosts.length} social posts`);

    return {
      news,
      events,
      social: socialPosts
    };
  }

  /**
   * AI ranks all categories
   */
  async rankAllCategories(allContent) {
    console.log('🤖 Starting AI ranking for all categories...');
    
    const results = {};
    
    // Rank News
    if (allContent.news.length > 0) {
      console.log(`📰 Ranking ${allContent.news.length} news articles...`);
      results.news = await this.aiRanking.rankCategory(allContent.news, 'news');
    } else {
      console.log('📰 No news articles to rank');
      results.news = { top3: [], featured: null };
    }
    
    // Rank Events  
    if (allContent.events.length > 0) {
      console.log(`📅 Ranking ${allContent.events.length} events...`);
      results.events = await this.aiRanking.rankCategory(allContent.events, 'events');
    } else {
      console.log('📅 No events to rank');
      results.events = { top3: [], featured: null };
    }
    
    // Rank Social Posts
    if (allContent.social.length > 0) {
      console.log(`📱 Ranking ${allContent.social.length} social posts...`);
      results.social = await this.aiRanking.rankCategory(allContent.social, 'social');
    } else {
      console.log('📱 No social posts to rank');
      results.social = { top3: [], featured: null };
    }
    
    // Log results summary
    console.log('🏆 AI Ranking Results Summary:');
    console.log(`  📰 News: ${results.news.top3.length} top3, featured: ${results.news.featured ? results.news.featured.title : 'none'}`);
    console.log(`  📅 Events: ${results.events.top3.length} top3, featured: ${results.events.featured ? results.events.featured.title : 'none'}`);
    console.log(`  📱 Social: ${results.social.top3.length} top3, featured: ${results.social.featured ? results.social.featured.title : 'none'}`);
    
    return results;
  }

  /**
   * Update database with ranking flags
   */
  async updateContentRankings(rankedContent) {
    console.log('💾 Updating database with ranking flags...');
    
    try {
      // Clear all existing ranking flags
      await Promise.all([
        News.updateMany({}, { $unset: { isTop3: '', isFeatured: '' } }),
        Event.updateMany({}, { $unset: { isTop3: '', isFeatured: '' } }),
        SocialPost.updateMany({}, { $unset: { isTop3: '', isFeatured: '' } })
      ]);
      
      // Update News rankings
      if (rankedContent.news.top3.length > 0) {
        const newsTop3Ids = rankedContent.news.top3.map(item => item._id);
        await News.updateMany(
          { _id: { $in: newsTop3Ids } },
          { $set: { isTop3: true } }
        );
        console.log(`📰 Updated ${newsTop3Ids.length} news articles as top3`);
      }
      
      if (rankedContent.news.featured) {
        await News.updateOne(
          { _id: rankedContent.news.featured._id },
          { $set: { isFeatured: true } }
        );
        console.log(`📰 Updated featured news: ${rankedContent.news.featured.title}`);
      }
      
      // Update Events rankings
      if (rankedContent.events.top3.length > 0) {
        const eventsTop3Ids = rankedContent.events.top3.map(item => item._id);
        await Event.updateMany(
          { _id: { $in: eventsTop3Ids } },
          { $set: { isTop3: true } }
        );
        console.log(`📅 Updated ${eventsTop3Ids.length} events as top3`);
      }
      
      if (rankedContent.events.featured) {
        await Event.updateOne(
          { _id: rankedContent.events.featured._id },
          { $set: { isFeatured: true } }
        );
        console.log(`📅 Updated featured event: ${rankedContent.events.featured.title}`);
      }
      
      // Update Social Posts rankings
      if (rankedContent.social.top3.length > 0) {
        const socialTop3Ids = rankedContent.social.top3.map(item => item._id);
        await SocialPost.updateMany(
          { _id: { $in: socialTop3Ids } },
          { $set: { isTop3: true } }
        );
        console.log(`📱 Updated ${socialTop3Ids.length} social posts as top3`);
      }
      
      if (rankedContent.social.featured) {
        await SocialPost.updateOne(
          { _id: rankedContent.social.featured._id },
          { $set: { isFeatured: true } }
        );
        console.log(`📱 Updated featured social post: ${rankedContent.social.featured.title}`);
      }
      
      console.log('✅ Database ranking flags updated successfully');
      
    } catch (error) {
      console.error('❌ Error updating database rankings:', error.message);
      throw error;
    }
  }

  /**
   * Get curated content for homepage (top 3 per category)
   */
  async getHomepageContent() {
    try {
      console.log('🏠 Fetching homepage content (top 3 per category)...');

      const [newsTop3, eventsTop3, socialTop3] = await Promise.all([
        News.find({ isTop3: true, status: 'approved' }).sort({ publishedAt: -1 }).limit(3),
        Event.find({
          isTop3: true,
          status: 'published',
          startDate: { $gte: new Date() } // Only upcoming events
        }).sort({ startDate: -1 }).limit(3),
        SocialPost.find({ isTop3: true }).sort({ createdAt: -1 }).limit(3)
      ]);

      console.log(`🏠 Homepage content: ${newsTop3.length} news, ${eventsTop3.length} upcoming events, ${socialTop3.length} social`);

      return {
        news: newsTop3,
        events: eventsTop3,
        social: socialTop3
      };

    } catch (error) {
      console.error('❌ Error fetching homepage content:', error.message);
      throw error;
    }
  }

  /**
   * Get featured content for hero section (#2 per category based on engagement)
   * Updated to use engagement metrics instead of isFeatured flags
   */
  async getFeaturedContent() {
    try {
      console.log('🌟 Fetching featured content (#2 per category based on engagement)...');

      const Resource = require('../models/Resource');

      const [featuredNews, featuredEvents, featuredResources] = await Promise.all([
        // Featured news (top 2 highest likes)
        (async () => {
          const news = await News.find({ status: 'approved' })
            .populate('author', 'name uniqueId')
            .sort({ 'engagement.likes': -1, publishedAt: -1 }) // Sort by likes first, then recency
            .limit(2);

          console.log('🌟 Featured news selected:', news.length > 0 ? `${news.length} articles` : 'none');
          return news;
        })(),

        // Featured events (top 2 highest likes, only upcoming events)
        (async () => {
          const events = await Event.find({
            status: 'published',
            startDate: { $gte: new Date() } // Only upcoming events
          })
            .populate('organizer', 'name uniqueId')
            .sort({ 'engagement.likes': -1, startDate: 1 }) // Sort by likes first, then upcoming date
            .limit(2);

          console.log('🌟 Featured events selected:', events.length > 0 ? `${events.length} events` : 'none');
          return events;
        })(),

        // Featured resources (top 2 highest downloads for docs/tools, highest views for videos/tutorials)
        (async () => {
          // Get all approved resources
          const allResources = await Resource.find({ isApproved: true })
            .populate('uploadedBy', 'name uniqueId');

          if (allResources.length === 0) return [];

          // Sort by engagement score (downloads for docs/tools, views for videos/tutorials)
          const sortedResources = allResources.sort((a, b) => {
            const aScore = (a.type === 'Document' || a.type === 'Tool')
              ? (a.downloadCount || 0)
              : (a.views || 0);
            const bScore = (b.type === 'Document' || b.type === 'Tool')
              ? (b.downloadCount || 0)
              : (b.views || 0);
            return bScore - aScore; // Sort by engagement score descending
          });

          const resources = sortedResources.slice(0, 2);
          console.log('🌟 Featured resources selected:', resources.length > 0 ? `${resources.length} resources` : 'none');
          return resources;
        })()
      ]);

      console.log('🌟 Featured content summary:', {
        news: featuredNews.length > 0 ? `${featuredNews.length} articles` : 'none',
        events: featuredEvents.length > 0 ? `${featuredEvents.length} events` : 'none',
        resources: featuredResources.length > 0 ? `${featuredResources.length} resources` : 'none'
      });

      return {
        news: featuredNews,
        events: featuredEvents,
        resources: featuredResources
      };

    } catch (error) {
      console.error('❌ Error fetching featured content:', error.message);
      throw error;
    }
  }

  /**
   * Manual trigger for testing
   */
  async testCuration() {
    console.log('🧪 Testing content curation system...');
    
    const rankedContent = await this.curateFeaturedContent();
    const homepageContent = await this.getHomepageContent();
    const featuredContent = await this.getFeaturedContent();
    
    return {
      ranked: rankedContent,
      homepage: homepageContent,
      featured: featuredContent
    };
  }
}

module.exports = new ContentCurationService(); 