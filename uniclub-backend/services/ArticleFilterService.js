const crypto = require('crypto');
const { NEWS_CONFIG } = require('../utils/newsConstants');

class ArticleFilterService {
  static filterByKeywords(articles) {
    console.log('\n🔬 Filtering articles by tech relevance...');
    
    // Step 1: Filter for tech relevance
    const techArticles = articles.filter(this.isTechRelevant);
    console.log(`🔬 ${techArticles.length} tech-relevant articles (after filtering events/non-tech)`);
    
    // Step 2: Remove duplicates
    const uniqueArticles = this.removeDuplicates(techArticles);
    console.log(`✨ ${uniqueArticles.length} unique articles`);
    
    // Step 3: Filter by recency (prioritize last 48 hours, then extend)
    const filteredByTime = this.filterByRecency(uniqueArticles);
    console.log(`🕒 ${filteredByTime.length} articles after recency filtering`);
    
    return filteredByTime;
  }

  static isTechRelevant(article) {
    const text = `${article.title} ${article.description || ''} ${article.content || ''}`.toLowerCase();
    
    // Exclude Hacker News / Y Combinator articles (often don't have thumbnails)
    const source = article.source?.name || article.source || '';
    if (source.toLowerCase().includes('hacker news') || 
        source.toLowerCase().includes('y combinator') ||
        article.url?.includes('news.ycombinator.com') ||
        article.title?.includes('Show HN:') ||
        article.title?.includes('Ask HN:')) {
      return false;
    }
    
    // STRICT EXCLUSION: Immediately exclude inappropriate content regardless of tech indicators
    // Use word boundary matching to avoid false positives (e.g., "software" containing "war")
    const hasExcludedContent = NEWS_CONFIG.EXCLUDED_KEYWORDS.some(keyword => {
      // Create a regex with word boundaries for single words, or exact phrase matching for multi-word phrases
      const pattern = keyword.includes(' ') 
        ? new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')  // Phrase matching
        : new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'); // Word boundary matching
      
      return pattern.test(text);
    });
    
    // CRITICAL: If article contains war/military/political/violent content, exclude it
    if (hasExcludedContent) {
      console.log(`🚫 Excluding inappropriate content: ${article.title.substring(0, 60)}...`);
      return false;
    }
    
    // EDUCATIONAL TECH INDICATORS - Focus on learning and innovation
    const educationalTechIndicators = [
      // Core educational tech terms
      'tech', 'technology', 'digital', 'app', 'software', 'platform', 'system',
      'innovation', 'startup', 'online', 'internet', 'web', 'mobile', 'device', 'electronic',
      
      // Major tech companies (educational context)
      'apple', 'google', 'microsoft', 'amazon', 'meta', 'facebook', 'tesla', 'nvidia',
      'intel', 'amd', 'samsung', 'sony', 'netflix', 'uber', 'airbnb', 'spotify', 'zoom',
      'salesforce', 'oracle', 'adobe', 'twitter', 'tiktok', 'snapchat', 'linkedin',
      
      // Programming & development (educational)
      'code', 'coding', 'programming', 'developer', 'algorithm', 'API',
      'database', 'framework', 'library', 'github', 'open source',
      
      // AI & Data (educational focus)
      'AI', 'artificial intelligence', 'machine learning', 'data analytics', 'neural',
      'automation', 'robot', 'chatbot', 'GPT', 'OpenAI',
      
      // Consumer tech (educational)
      'smartphone', 'iphone', 'android', 'laptop', 'computer', 'tablet', 'smartwatch',
      'gaming console', 'VR', 'AR', 'smart home', 'IoT', 'wearable', 'headphones',
      
      // Business tech (educational)
      'SaaS', 'cloud', 'server', 'network', 'cybersecurity', 'privacy', 'encryption',
      'blockchain', 'cryptocurrency', 'fintech', 'edtech', 'healthtech',
      
      // Startup/business terms (educational context)
      'tech startup', 'funding round', 'investment', 'IPO', 'acquisition', 'venture capital',
      'Series A', 'Series B', 'unicorn', 'tech company', 'software company'
    ];
    
    const hasEducationalTechIndicators = educationalTechIndicators.some(indicator => 
      text.includes(indicator.toLowerCase())
    );
    
    // Check for specific tech keywords from categories
    const hasTechKeywords = Object.values(NEWS_CONFIG.TECH_KEYWORDS)
      .flatMap(category => category.keywords)
      .some(keyword => text.includes(keyword.toLowerCase()));
    
    // EDUCATIONAL FOCUS: Only include if it has clear educational tech indicators
    return hasTechKeywords || hasEducationalTechIndicators;
  }

  static removeDuplicates(articles) {
    const uniqueArticles = [];
    const seen = new Set();
    
    for (const article of articles) {
      const hash = this.generateSourceHash(article);
      if (!seen.has(hash)) {
        seen.add(hash);
        uniqueArticles.push(article);
      }
    }
    
    return uniqueArticles;
  }

  static filterByRecency(articles) {
    const now = Date.now();
    
    // MUCH MORE PERMISSIVE: First try last 7 days
    let recentArticles = articles.filter(article => {
      const published = new Date(article.publishedAt).getTime();
      return now - published <= 7 * 24 * 60 * 60 * 1000; // 7 days instead of 48 hours
    });
    
    // If fewer than 50 articles, take everything we have (very permissive)
    if (recentArticles.length < 50) {
      const recentIds = new Set(recentArticles.map(a => a.url));
      const fillArticles = articles
        .filter(article => !recentIds.has(article.url))
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      recentArticles = [
        ...recentArticles,
        ...fillArticles // Take all remaining articles
      ];
    }
    
    // Return more articles to give AI more choices
    return recentArticles.slice(0, 100); // Increased from 30 to 100 potential articles
  }

  static generateSourceHash(article) {
    const content = `${article.title}|${article.url}|${article.source?.name || 'Unknown'}`;
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
  }

  static categorizeArticle(article) {
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    let bestCategory = 'Tech Industry';
    let maxMatches = 0;
    
    for (const [category, config] of Object.entries(NEWS_CONFIG.TECH_KEYWORDS)) {
      const matchCount = config.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      ).length;
      if (matchCount > maxMatches) {
        maxMatches = matchCount;
        bestCategory = category;
      }
    }
    
    return bestCategory;
  }

  static calculateArticleScore(article) {
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    let score = 0;
    
    // Category-based scoring with priority weights
    for (const [category, config] of Object.entries(NEWS_CONFIG.TECH_KEYWORDS)) {
      const matchCount = config.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      ).length;
      
      if (matchCount > 0) {
        score += matchCount * config.priority;
        
        // Extra boost for AI/ML articles
        if (category === 'AI/ML') {
          score += NEWS_CONFIG.RANKING_PRIORITIES.AI_ML_BOOST;
        }
      }
    }
    
    // Breakthrough keywords boost
    NEWS_CONFIG.BREAKTHROUGH_KEYWORDS.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        score += NEWS_CONFIG.RANKING_PRIORITIES.BREAKTHROUGH_BOOST;
      }
    });
    
    // Recency boost (newer articles get higher scores)
    const hoursOld = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursOld < 6) score += NEWS_CONFIG.RANKING_PRIORITIES.RECENCY_BOOST;
    else if (hoursOld < 12) score += NEWS_CONFIG.RANKING_PRIORITIES.RECENCY_BOOST * 0.7;
    else if (hoursOld < 18) score += NEWS_CONFIG.RANKING_PRIORITIES.RECENCY_BOOST * 0.4;
    
    // Source diversity boost
    const premiumSources = ['techcrunch', 'the-verge', 'wired', 'mit-technology-review'];
    if (premiumSources.includes(article.source?.id || article.source?.name?.toLowerCase())) {
      score += NEWS_CONFIG.RANKING_PRIORITIES.SOURCE_BOOST;
    }
    
    // Enhanced quality scoring
    score += this.calculateQualityScore(article);
    
    return score;
  }

  static calculateQualityScore(article) {
    let qualityScore = 0;
    
    // Content length quality (optimal range: 500-2000 chars)
    const contentLength = (article.description || '').length;
    if (contentLength > 200) {
      qualityScore += Math.min(20, contentLength / 100); // Up to 20 points
    }
    
    // Title quality (clear, descriptive titles)
    const titleLength = article.title?.length || 0;
    if (titleLength > 30 && titleLength < 120) {
      qualityScore += 15; // Optimal title length
    }
    
    // Source credibility (domain quality indicators)
    const sourceUrl = article.url || '';
    const credibilityIndicators = [
      { pattern: /\.edu|\.gov|ieee|acm|arxiv/, boost: 25 }, // Academic/institutional
      { pattern: /techcrunch|wired|ars-technica|mit\.technology/, boost: 20 }, // Premium tech
      { pattern: /github\.com|stackoverflow/, boost: 15 }, // Developer sources
      { pattern: /medium\.com|dev\.to/, boost: 10 } // Community sources
    ];
    
    credibilityIndicators.forEach(({ pattern, boost }) => {
      if (pattern.test(sourceUrl.toLowerCase())) {
        qualityScore += boost;
      }
    });
    
    // Engagement potential (title/description indicators)
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    const engagementKeywords = [
      'breakthrough', 'revolutionary', 'first-ever', 'new', 'latest',
      'announces', 'launches', 'releases', 'introduces', 'unveils',
      'billion', 'million', 'funding', 'investment', 'acquisition'
    ];
    
    engagementKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        qualityScore += 5;
      }
    });
    
    // Avoid clickbait (penalty for excessive caps, exclamation)
    const excessiveCaps = (article.title?.match(/[A-Z]/g) || []).length;
    const totalChars = article.title?.length || 1;
    if (excessiveCaps / totalChars > 0.3) {
      qualityScore -= 10;
    }
    
    const exclamationCount = (article.title?.match(/!/g) || []).length;
    if (exclamationCount > 1) {
      qualityScore -= 15;
    }
    
    return Math.max(0, qualityScore); // No negative quality scores
  }
}

module.exports = ArticleFilterService; 