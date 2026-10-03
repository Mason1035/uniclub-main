// Ensure environment variables are loaded
require('dotenv').config();

const mongoose = require('mongoose');
const crypto = require('crypto');
const News = require('../models/News');
const User = require('../models/User');
const NewsAPIService = require('./NewsAPIService');
const ArticleFilterService = require('./ArticleFilterService');
const AISelectionService = require('./AISelectionService');
const ArticleScrapingService = require('./ArticleScrapingService');
const AISummaryService = require('./AISummaryService');
const DynamicLogoService = require('./DynamicLogoService');
const { NEWS_CONFIG } = require('../utils/newsConstants');

class NewsCurationService {
  constructor() {
    this.newsAPIService = new NewsAPIService();
    this.aiSelectionService = new AISelectionService();
    this.aiSummaryService = new AISummaryService();
    this.dynamicLogoService = new DynamicLogoService();
    this.logLevel = process.env.LOG_LEVEL || 'info'; // debug, info, warn, error
  }

  log(level, message, data = null) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.logLevel] || 1;
    
    if (levels[level] >= currentLevel) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      
      if (level === 'error') {
        console.error(logMessage, data ? JSON.stringify(data, null, 2) : '');
      } else if (level === 'warn') {
        console.warn(logMessage, data ? JSON.stringify(data, null, 2) : '');
      } else {
        console.log(logMessage, data ? JSON.stringify(data, null, 2) : '');
      }
    }
  }

  // Dynamic publisher logo fetching - automatically detects logos from any publisher
  async getPublisherLogo(articleUrl, publisherName) {
    try {
      return await this.dynamicLogoService.getPublisherLogo(articleUrl, publisherName);
    } catch (error) {
      console.error(`❌ Error fetching dynamic publisher logo:`, error.message);
      return null;
    }
  }

  async runMidnightCuration() {
    const startTime = Date.now();
    let stepMetrics = {};
    
    try {
      console.log('\n🌅 Starting Daily News Curation at:', new Date().toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }));
      
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB');
      
      // 1. Fetch new articles from news API
      const step1Start = Date.now();
      console.log('\n📡 Step 1: Fetching articles from News API...');
      this.log('debug', 'Starting article fetch from NewsAPI');
      const rawArticles = await this.newsAPIService.fetchLatestArticles();
      stepMetrics.fetchArticles = Date.now() - step1Start;
      this.log('info', `Fetched ${rawArticles.length} raw articles`, { count: rawArticles.length, timeMs: stepMetrics.fetchArticles });
      
      if (rawArticles.length === 0) {
        console.log('⚠️ No articles fetched from API, keeping old articles');
        return;
      }
      
      // 2. Filter with positive/negative keywords
      const step2Start = Date.now();
      console.log('\n🔬 Step 2: Filtering articles by keywords...');
      this.log('debug', 'Starting keyword filtering');
      const filteredArticles = ArticleFilterService.filterByKeywords(rawArticles);
      stepMetrics.filterArticles = Date.now() - step2Start;
      this.log('info', `Filtered to ${filteredArticles.length} relevant articles`, { 
        original: rawArticles.length, 
        filtered: filteredArticles.length, 
        timeMs: stepMetrics.filterArticles 
      });
      
      if (filteredArticles.length === 0) {
        console.log('⚠️ No relevant articles found after filtering, keeping old articles');
        return;
      }
      
      // 3. AI selects best 20 articles
      const step3Start = Date.now();
      console.log('\n🤖 Step 3: AI selecting best articles...');
      const selectedArticles = await this.aiSelectionService.selectBest20(filteredArticles);
      stepMetrics.aiSelection = Date.now() - step3Start;
      
      // 4. If <20, fill with previous batch (engagement + AI priority)
      const step4Start = Date.now();
      console.log('\n🔄 Step 4: Ensuring 20 articles...');
      const finalArticles = await this.ensureTwentyArticles(selectedArticles);
      stepMetrics.ensureArticles = Date.now() - step4Start;
      
      // 5. Scrape full content for each article
      const step5Start = Date.now();
      console.log('\n📥 Step 5: Scraping full article content...');
      const scrapedArticles = await ArticleScrapingService.scrapeMultipleArticles(finalArticles);
      stepMetrics.scrapeContent = Date.now() - step5Start;
      
      if (scrapedArticles.length === 0) {
        console.log('⚠️ No articles successfully scraped, keeping old articles');
        return;
      }
      
      // 6. AI summarize each article  
      const step6Start = Date.now();
      console.log('\n🤖 Step 6: Generating AI summaries...');
      const processedArticles = await this.aiSummaryService.processMultipleArticles(scrapedArticles);
      stepMetrics.generateSummaries = Date.now() - step6Start;
      
      // 7. Save new articles with importance ranking
      const step7Start = Date.now();
      console.log('\n💾 Step 7: Saving articles with rankings...');
      const savedArticles = await this.saveWithRanking(processedArticles);
      stepMetrics.saveArticles = Date.now() - step7Start;
      
      // 8. Clear old articles ONLY after success
      const step8Start = Date.now();
      console.log('\n🧹 Step 8: Clearing old articles...');
      await this.clearOldArticles();
      stepMetrics.clearOldArticles = Date.now() - step8Start;
      
      const totalTime = Date.now() - startTime;
      console.log(`\n🎉 SUCCESS! Created ${savedArticles.length} articles`);
      console.log(`📊 Categories: ${[...new Set(savedArticles.map(a => a.categories[0]))].join(', ')}`);
      console.log(`⏱️ Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
      console.log(`📈 Performance breakdown:`);
      Object.entries(stepMetrics).forEach(([step, duration]) => {
        console.log(`   ${step}: ${(duration / 1000).toFixed(2)}s`);
      });
      
      return savedArticles;
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('❌ Error in daily news curation:', error.message);
      console.error('💀 Keeping old articles due to curation failure');
      console.error(`⏱️ Failed after: ${(totalTime / 1000).toFixed(2)}s`);
      throw error;
    } finally {
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
    }
  }

  async ensureTwentyArticles(selectedArticles) {
    if (selectedArticles.length >= NEWS_CONFIG.TARGET_ARTICLES) {
      console.log(`✅ Found ${selectedArticles.length} articles, taking top ${NEWS_CONFIG.TARGET_ARTICLES}`);
      return selectedArticles.slice(0, NEWS_CONFIG.TARGET_ARTICLES);
    }
    
    const needed = NEWS_CONFIG.TARGET_ARTICLES - selectedArticles.length;
    console.log(`⚠️ Only found ${selectedArticles.length} articles, need ${needed} more from fallback`);
    
    // Get source hashes of current articles to avoid duplicates
    const currentHashes = selectedArticles.map(article => 
      ArticleFilterService.generateSourceHash(article)
    );
    
    // Priority 1: Highest engaged articles from previous batch
    const engagedPrevious = await this.getHighestEngagedPrevious(needed, currentHashes);
    
    if (engagedPrevious.length >= needed) {
      console.log(`✅ Found ${engagedPrevious.length} highly engaged previous articles`);
      return [...selectedArticles, ...engagedPrevious.slice(0, needed)];
    }
    
    // Priority 2: AI selects most important from old batch
    let remainingNeeded = needed - engagedPrevious.length;
    let aiSelectedPrevious = [];
    
    if (remainingNeeded > 0) {
      console.log(`🤖 Need ${remainingNeeded} more, using AI to select from previous batch...`);
      const previousArticles = await this.getPreviousArticles(remainingNeeded * 3, currentHashes);
      aiSelectedPrevious = await this.aiSelectionService.selectFromPrevious(remainingNeeded, previousArticles);
      
      console.log(`✅ AI selected ${aiSelectedPrevious.length} additional articles from previous batch`);
      remainingNeeded -= aiSelectedPrevious.length;
    }
    
    // Priority 3: FORCE additional articles if still needed (guarantees 20)
    if (remainingNeeded > 0) {
      console.log(`🔄 Still need ${remainingNeeded} more articles, getting ANY previous articles...`);
      const anyPrevious = await this.getAnyPreviousArticles(remainingNeeded, currentHashes);
      console.log(`✅ Found ${anyPrevious.length} additional fallback articles`);
      
      return [...selectedArticles, ...engagedPrevious, ...aiSelectedPrevious, ...anyPrevious];
    }
    
    return [...selectedArticles, ...engagedPrevious, ...aiSelectedPrevious];
  }

  async getHighestEngagedPrevious(needed, excludeHashes) {
    try {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const engagedArticles = await News.find({
        createdAt: { $gte: fortyEightHoursAgo }, // Use createdAt for consistency across system
        sourceHash: { $nin: excludeHashes },
        status: 'approved',
        $or: [
          { 'engagement.likeCount': { $gt: 0 } },
          { 'engagement.saveCount': { $gt: 0 } },
          { 'engagement.views': { $gt: 10 } }
        ]
      })
      .sort({ 
        'engagement.likeCount': -1,
        'engagement.saveCount': -1,
        'engagement.views': -1,
        createdAt: -1 // Consistent with cleanup logic
      })
      .limit(needed)
      .lean();
      
      console.log(`📊 Found ${engagedArticles.length} highly engaged previous articles`);
      return engagedArticles;
    } catch (error) {
      console.error('❌ Error getting engaged previous articles:', error);
      return [];
    }
  }

  async getPreviousArticles(limit, excludeHashes) {
    try {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const previousArticles = await News.find({
        createdAt: { $gte: fortyEightHoursAgo }, // Changed to createdAt
        sourceHash: { $nin: excludeHashes },
        status: 'approved'
      })
      .sort({ createdAt: -1 }) // Changed to createdAt
      .limit(limit)
      .lean();
      
      return previousArticles;
    } catch (error) {
      console.error('❌ Error getting previous articles:', error);
      return [];
    }
  }

  async getAnyPreviousArticles(needed, excludeHashes) {
    try {
      // First try the last 48 hours (consistent with cleanup policy)
      let previousArticles = await News.find({
        createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }, // 48h retention policy
        sourceHash: { $nin: excludeHashes },
        status: 'approved'
      })
      .sort({ createdAt: -1 }) // Most recent first
      .limit(needed)
      .lean();

      // If still not enough, expand to last 7 days
      if (previousArticles.length < needed) {
        console.log(`🔄 Expanding search to last 7 days for fallback articles...`);
        const remainingNeeded = needed - previousArticles.length;
        
        const olderArticles = await News.find({
          createdAt: { 
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            $lt: new Date(Date.now() - 48 * 60 * 60 * 1000)
          },
          sourceHash: { $nin: [...excludeHashes, ...previousArticles.map(a => a.sourceHash)] },
          status: 'approved'
        })
        .sort({ createdAt: -1 }) // Consistent sorting
        .limit(remainingNeeded)
        .lean();

        previousArticles = [...previousArticles, ...olderArticles];
      }

      console.log(`📊 Found ${previousArticles.length} fallback articles for guaranteed 20`);
      return previousArticles.slice(0, needed);
    } catch (error) {
      console.error('❌ Error getting any previous articles:', error);
      return [];
    }
  }

  async saveWithRanking(processedArticles) {
    const systemUser = await this.getOrCreateSystemUser();
    
    console.log(`💾 Preparing ${processedArticles.length} articles for batch save with AI importance ranking...`);
    
    try {
      // Step 1: Generate all sourceHashes for batch duplicate detection
      const articleHashes = processedArticles.map(article => 
        ArticleFilterService.generateSourceHash(article)
      );
      
      // Step 2: Check for existing duplicates in single query
      const existingArticles = await News.find({ 
        sourceHash: { $in: articleHashes } 
      }).select('sourceHash').lean();
      
      const existingHashes = new Set(existingArticles.map(article => article.sourceHash));
      console.log(`🔍 Found ${existingHashes.size} duplicate articles to skip`);
      
      // Step 3: Prepare articles for batch insertion (filter out duplicates)
      const articlesToInsert = [];
      let skippedCount = 0;
      
      for (const [index, article] of processedArticles.entries()) {
        const sourceHash = ArticleFilterService.generateSourceHash(article);
        
        if (existingHashes.has(sourceHash)) {
          console.log(`⏭️  Skipping duplicate article: ${article.title.substring(0, 50)}...`);
          skippedCount++;
          continue;
        }
        
        // Calculate initial importance score
        const importanceScore = this.calculateImportanceScore(article, index);
        
        // Fetch publisher logo dynamically
        const publisherLogo = await this.getPublisherLogo(
          article.url || article.originalUrl, 
          article.source?.name || article.source
        );
        
        // Prepare article document for batch insertion
        const newsArticle = {
          title: article.title || 'Tech News Update',
          excerpt: article.description || article.aiSummary?.quickSummary || NEWS_CONFIG.FALLBACKS.excerpt,
          content: article.scrapedContent || article.description || NEWS_CONFIG.FALLBACKS.content,
          source: article.source?.name || article.source || 'Tech News',
          author: systemUser._id,
          originalAuthor: article.author || article.source?.name || article.source || 'Tech News',
          originalUrl: article.url,
          sourceHash: sourceHash,
          
          // Set category properly
          categories: [ArticleFilterService.categorizeArticle(article)],
          
          // Media
          imageUrl: ArticleScrapingService.validateImageUrl(article.urlToImage) ? 
            article.urlToImage : NEWS_CONFIG.FALLBACKS.imageUrl,
          publisherLogo: publisherLogo,
          
          // Publishing info with importance-based ranking
          publishedAt: new Date(article.publishedAt),
          status: 'approved',
          isFeatured: index < 3, // Top 3 most important are featured
          isTrending: index < 5, // Top 5 most important are trending
          
          // AI Summary fields
          summary: {
            raw: article.aiSummary?.raw || NEWS_CONFIG.FALLBACKS.summary.raw,
            quickSummary: article.aiSummary?.quickSummary || NEWS_CONFIG.FALLBACKS.summary.quickSummary,
            whyItMatters: article.aiSummary?.whyItMatters || NEWS_CONFIG.FALLBACKS.summary.whyItMatters,
            lastUpdated: new Date()
          },
          
          // Initial engagement (will be updated by user interactions)
          engagement: {
            views: 0,
            likeCount: 0,
            saveCount: 0
          },
          
          // Store importance score for reference
          _importanceScore: importanceScore
        };
        
        articlesToInsert.push(newsArticle);
      }
      
      // Step 4: Batch insert all new articles in single operation
      let savedArticles = [];
      if (articlesToInsert.length > 0) {
        console.log(`🚀 Batch inserting ${articlesToInsert.length} new articles...`);
        const insertResult = await News.insertMany(articlesToInsert, { ordered: false });
        savedArticles = insertResult;
        console.log(`✅ Successfully saved ${savedArticles.length} articles in single batch operation`);
      }
      
      // Step 5: Log summary
      console.log(`📊 Batch save summary: ${savedArticles.length} saved, ${skippedCount} duplicates skipped`);
      
      return savedArticles;
      
    } catch (error) {
      console.error('❌ Error in batch article save:', error.message);
      
      // Fallback to individual saves if batch fails
      console.log('🔄 Falling back to individual saves...');
      return await this.saveWithRankingFallback(processedArticles, systemUser);
    }
  }

  // Fallback method for individual saves if batch operation fails
  async saveWithRankingFallback(processedArticles, systemUser) {
    const savedArticles = [];
    
    console.log(`💾 Using fallback individual saves for ${processedArticles.length} articles...`);
    
    for (const [index, article] of processedArticles.entries()) {
      try {
        // Generate sourceHash for duplicate detection
        const sourceHash = ArticleFilterService.generateSourceHash(article);
        
        // Check if article already exists
        const existingArticle = await News.findOne({ sourceHash });
        if (existingArticle) {
          console.log(`⏭️  Skipping duplicate article: ${article.title.substring(0, 50)}...`);
          continue;
        }
        
        // Calculate initial importance score
        const importanceScore = this.calculateImportanceScore(article, index);
        
        // Fetch publisher logo dynamically
        const publisherLogo = await this.getPublisherLogo(
          article.url || article.originalUrl, 
          article.source?.name || article.source
        );
        
        // Create the news article
        const newsArticle = new News({
          title: article.title || 'Tech News Update',
          excerpt: article.description || article.aiSummary?.quickSummary || NEWS_CONFIG.FALLBACKS.excerpt,
          content: article.scrapedContent || article.description || NEWS_CONFIG.FALLBACKS.content,
          source: article.source?.name || article.source || 'Tech News',
          author: systemUser._id,
          originalAuthor: article.author || article.source?.name || article.source || 'Tech News',
          originalUrl: article.url,
          sourceHash: sourceHash,
          
          // Set category properly
          categories: [ArticleFilterService.categorizeArticle(article)],
          
          // Media
          imageUrl: ArticleScrapingService.validateImageUrl(article.urlToImage) ? 
            article.urlToImage : NEWS_CONFIG.FALLBACKS.imageUrl,
          publisherLogo: publisherLogo,
          
          // Publishing info with importance-based ranking
          publishedAt: new Date(article.publishedAt),
          status: 'approved',
          isFeatured: index < 3, // Top 3 most important are featured
          isTrending: index < 5, // Top 5 most important are trending
          
          // AI Summary fields
          summary: {
            raw: article.aiSummary?.raw || NEWS_CONFIG.FALLBACKS.summary.raw,
            quickSummary: article.aiSummary?.quickSummary || NEWS_CONFIG.FALLBACKS.summary.quickSummary,
            whyItMatters: article.aiSummary?.whyItMatters || NEWS_CONFIG.FALLBACKS.summary.whyItMatters,
            lastUpdated: new Date()
          },
          
          // Initial engagement (will be updated by user interactions)
          engagement: {
            views: 0,
            likeCount: 0,
            saveCount: 0
          },
          
          // Store importance score for reference
          _importanceScore: importanceScore
        });
        
        await newsArticle.save();
        savedArticles.push(newsArticle);
        console.log(`✅ Fallback article ${index + 1} saved: ${article.title.substring(0, 50)}...`);
        
      } catch (error) {
        console.error(`❌ Error saving fallback article ${index + 1}:`, error.message);
      }
    }
    
    return savedArticles;
  }

  calculateImportanceScore(article, aiRankingIndex) {
    let score = 0;
    
    // AI ranking is most important (lower index = higher importance)
    score += (NEWS_CONFIG.TARGET_ARTICLES - aiRankingIndex) * 10;
    
    // Additional scoring based on content
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    
    // Category-based scoring with AI/ML priority
    for (const [category, config] of Object.entries(NEWS_CONFIG.TECH_KEYWORDS)) {
      const matchCount = config.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      ).length;
      
      if (matchCount > 0) {
        score += matchCount * config.priority;
      }
    }
    
    // Recency bonus
    const hoursOld = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursOld < 6) score += 20;
    else if (hoursOld < 12) score += 15;
    else if (hoursOld < 18) score += 10;
    
    return score;
  }

  async clearOldArticles() {
    try {
      // Standardized cleanup: delete articles older than 48 hours based on database storage time
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const result = await News.deleteMany({
        createdAt: { $lt: fortyEightHoursAgo }, // Use createdAt for consistency
        status: 'approved'
      });
      
      console.log(`🗑️ Cleared ${result.deletedCount} approved articles (stored >48h ago)`);
      
      // Clean up draft/rejected articles older than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const draftResult = await News.deleteMany({
        createdAt: { $lt: oneDayAgo },
        status: { $in: ['draft', 'rejected'] }
      });
      
      if (draftResult.deletedCount > 0) {
        console.log(`🗑️ Cleared ${draftResult.deletedCount} old draft/rejected articles`);
      }
      
      console.log(`📊 Article cleanup completed - retention policy: 48h approved, 24h drafts`);
    } catch (error) {
      console.error('❌ Error clearing old articles:', error);
    }
  }

  async getOrCreateSystemUser() {
    try {
      let systemUser = await User.findOne({ email: 'system@newsbot.ai' });
      
      if (!systemUser) {
        systemUser = new User({
          email: 'system@newsbot.ai',
          name: 'AI News Bot',
          uniqueId: 'NEWSBOT001',
          passwordHash: crypto.randomBytes(32).toString('hex'),
          isEnrolled: true
        });
        await systemUser.save();
        console.log('✅ Created system user for news articles');
      }
      
      return systemUser;
    } catch (error) {
      console.error('❌ Error with system user:', error.message);
      throw error;
    }
  }

  // Real-time engagement ranking update with throttling
  static _lastEngagementUpdate = 0;
  static _engagementUpdateThrottle = 5 * 60 * 1000; // 5 minutes

  static async updateEngagementRanking(force = false) {
    try {
      // Throttle updates to prevent excessive computation
      const now = Date.now();
      if (!force && (now - this._lastEngagementUpdate) < this._engagementUpdateThrottle) {
        console.log('⏭️ Skipping engagement ranking update (throttled)');
        return;
      }

      console.log('📊 Updating article ranking based on engagement...');
      this._lastEngagementUpdate = now;
      
      // Get all current articles
      const articles = await News.find({ status: 'approved' }).lean();
      
      // Calculate engagement scores and rerank
      const rankedArticles = articles.map(article => {
        const engagementScore = this.calculateEngagementScore(article);
        return { ...article, engagementScore };
      }).sort((a, b) => b.engagementScore - a.engagementScore);
      
      // Update featured and trending flags based on new ranking
      for (const [index, article] of rankedArticles.entries()) {
        await News.findByIdAndUpdate(article._id, {
          isFeatured: index < 3,
          isTrending: index < 5
        });
      }
      
      console.log('✅ Engagement ranking updated');
    } catch (error) {
      console.error('❌ Error updating engagement ranking:', error);
    }
  }

  static calculateEngagementScore(article) {
    // Your specified formula: likes, shares, saves, comments (high weight)
    // Now using direct fields (no views for news)
    const score = (article.likes || 0) * NEWS_CONFIG.ENGAGEMENT_WEIGHTS.likeCount +
                  (article.saves || 0) * NEWS_CONFIG.ENGAGEMENT_WEIGHTS.saveCount +
                  (article.shares || 0) * NEWS_CONFIG.ENGAGEMENT_WEIGHTS.shareCount +
                  (article.comments || 0) * NEWS_CONFIG.ENGAGEMENT_WEIGHTS.comments;
    
    return score;
  }
}

module.exports = NewsCurationService; 