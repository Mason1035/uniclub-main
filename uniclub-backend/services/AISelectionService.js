const { NEWS_CONFIG } = require('../utils/newsConstants');
const ArticleFilterService = require('./ArticleFilterService');
const { generateText } = require('../utils/geminiClient');

class AISelectionService {
  constructor() {
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second
  }

  async selectBest20(articles) {
    if (articles.length === 0) {
      console.log('⚠️ No articles to select from');
      return [];
    }

    console.log(`\n🤖 Using AI to select best articles from ${articles.length} candidates...`);
    
    // Try AI selection first with retry logic
    let selectedArticles = await this.selectBestArticlesWithAI(articles);
    
    // Fallback to manual selection if AI fails
    if (selectedArticles.length === 0) {
      console.log('🔄 AI selection failed, falling back to manual selection...');
      selectedArticles = this.selectBestArticlesManually(articles);
    }
    
    console.log(`🏆 ${selectedArticles.length} articles selected`);
    return selectedArticles.slice(0, NEWS_CONFIG.TARGET_ARTICLES);
  }

  async selectBestArticlesWithAI(articles) {
    try {
      // Prepare article summaries for AI
      const articleSummaries = articles.map((article, index) => ({
        id: index + 1,
        title: article.title,
        description: article.description || '',
        source: article.source?.name || 'Unknown',
        category: ArticleFilterService.categorizeArticle(article),
        publishedAt: article.publishedAt
      }));

      const prompt = `You are a tech news curator for a university AI club platform. Your goal is to select EXACTLY 20 articles from the list below that are EDUCATIONAL and APPROPRIATE for students.

SELECTION STRATEGY:
1. **START with AI/ML articles** (highest priority for education)
2. **Then add tech startup/funding news** (business education)
3. **Fill remaining slots with EDUCATIONAL tech content**:
   - Software development and programming tutorials
   - Consumer tech and gadgets reviews
   - Gaming and entertainment technology
   - Business technology and platforms
   - Major tech company innovations
   - Cybersecurity and blockchain education
   - Hardware and infrastructure
   - Mobile and app development
   - Technology industry trends and analysis

**CRITICAL EXCLUSIONS** (NEVER select these):
- WAR, MILITARY, or COMBAT content (including military drones, weapons, defense)
- POLITICAL news, elections, government policy debates
- VIOLENT content, death, terrorism, crime
- CONTROVERSIAL social issues, scandals, lawsuits
- Any content involving conflict, weapons, or inappropriate topics

**EDUCATIONAL FOCUS**: Select articles that help students learn about:
- Technology innovation and breakthroughs
- Career opportunities in tech
- Technical skills and development
- Industry trends and market insights
- Startup ecosystem and entrepreneurship

**REMEMBER**: You MUST select exactly 20 articles. Focus on EDUCATIONAL VALUE and STUDENT APPROPRIATENESS. When in doubt about appropriateness, exclude the article.

Respond with ONLY a comma-separated list of exactly 20 article IDs (e.g., "1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,39").

ARTICLES TO ANALYZE:
` + articleSummaries.map(article => (
        `ID: ${article.id}
Title: ${article.title}
Description: ${article.description}
Source: ${article.source}
Category: ${article.category}
Published: ${new Date(article.publishedAt).toLocaleDateString()}
---`
      )).join('\n');

      const systemPrompt = 'You are a precise tech news curator for students. Respond with ONLY a comma-separated list of article IDs. Prioritize AI/ML content and exclude any war, military, political, or violent content. Focus on educational value.';
      const fullPrompt = `${systemPrompt}\n\n---\n\n${prompt}`;

      const responseText = await this.makeGeminiRequest(fullPrompt, {
        maxTokens: 200,
        temperature: 0.3,
      });

      // Parse the response to get selected article IDs
      const selectedIds = responseText
        .trim()
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id) && id > 0 && id <= articles.length);

      console.log(`✅ AI selected ${selectedIds.length} articles`);
      
      // Map selected IDs back to articles
      const selectedArticles = selectedIds.map(id => articles[id - 1]);
      
      return selectedArticles;
    } catch (error) {
      console.error('❌ Error in AI article selection:', error);
      return [];
    }
  }

  selectBestArticlesManually(articles) {
    console.log('🔄 Using manual scoring as fallback...');
    
    // Score articles based on keywords and recency
    const scoredArticles = articles.map(article => {
      const score = ArticleFilterService.calculateArticleScore(article);
      return { ...article, score };
    });
    
    // Sort by score and take top 20
    const selectedArticles = scoredArticles
      .sort((a, b) => b.score - a.score)
      .slice(0, NEWS_CONFIG.TARGET_ARTICLES);

    console.log(`✅ Manual selection found ${selectedArticles.length} articles`);
    return selectedArticles;
  }

  async selectFromPrevious(needed, previousArticles) {
    if (!previousArticles || previousArticles.length === 0) {
      return [];
    }

    try {
      console.log(`🤖 Using AI to select ${needed} articles from previous batch...`);
      
      // Convert previous articles to the same format
      const articleSummaries = previousArticles.slice(0, Math.min(50, previousArticles.length)).map((article, index) => ({
        id: index + 1,
        title: article.title,
        description: article.excerpt || article.content?.substring(0, 200) || '',
        source: article.source,
        category: article.categories?.[0] || 'Tech Industry',
        publishedAt: article.publishedAt
      }));

      const prompt = `You are selecting ${needed} articles from a previous batch to supplement today's AI club news feed. 

Select the ${needed} MOST RELEVANT and EDUCATIONAL articles for AI students and practitioners from this list. 

**PRIORITIZE:**
1. AI/ML content (highest educational priority)
2. Startup funding and tech industry news (business education)
3. Technical developments with educational value

**CRITICAL EXCLUSIONS** (NEVER select):
- WAR, MILITARY, or COMBAT content (including military drones, weapons)
- POLITICAL news, elections, government policy
- VIOLENT content, death, terrorism, crime
- CONTROVERSIAL social issues, scandals
- Any inappropriate or non-educational content

**EDUCATIONAL FOCUS**: Select articles that help students learn about technology, innovation, and career opportunities.

Respond with ONLY a comma-separated list of ${needed} article IDs.

ARTICLES TO ANALYZE:
` + articleSummaries.map(article => (
        `ID: ${article.id}
Title: ${article.title}
Description: ${article.description}
Source: ${article.source}
Category: ${article.category}
Published: ${new Date(article.publishedAt).toLocaleDateString()}
---`
      )).join('\n');

      const systemPrompt = `You are selecting ${needed} educational articles from previous batch. Exclude war, military, political, or violent content. Respond with ONLY comma-separated IDs.`;
      const fullPrompt = `${systemPrompt}\n\n---\n\n${prompt}`;

      const responseText = await this.makeGeminiRequest(fullPrompt, {
        maxTokens: 100,
        temperature: 0.3,
      });

      const selectedIds = responseText
        .trim()
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id) && id > 0 && id <= articleSummaries.length);

      console.log(`✅ AI selected ${selectedIds.length} articles from previous batch`);
      
      return selectedIds.map(id => previousArticles[id - 1]);
    } catch (error) {
      console.error('❌ Error in AI previous article selection:', error);
      // Fallback to scoring-based selection
      return previousArticles
        .sort((a, b) => (b.engagement?.likeCount || 0) - (a.engagement?.likeCount || 0))
        .slice(0, needed);
    }
  }

  async makeGeminiRequest(prompt, options = {}, retryCount = 0) {
    try {
      return await generateText(prompt, options);
    } catch (error) {
      console.error(`❌ Gemini API error (attempt ${retryCount + 1}):`, error.message);
      
      // Check if we should retry
      if (retryCount < this.maxRetries && this.shouldRetry(error)) {
        const delay = this.baseDelay * Math.pow(2, retryCount);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await this.sleep(delay);
        return this.makeAnthropicRequest(requestConfig, retryCount + 1);
      }
      
      throw error;
    }
  }

  shouldRetry(error) {
    // Retry on common transient errors (rate limits, server errors, network issues)
    const message = (error.message || '').toLowerCase();
    const status = error.status || error.code;

    if (status === 429 || status === 503 || status === 500) {
      return true;
    }

    const retryableHints = [
      'rate limit',
      'quota',
      'temporarily unavailable',
      'try again',
      'timeout',
      'network error',
    ];

    return retryableHints.some(hint => message.includes(hint));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AISelectionService;