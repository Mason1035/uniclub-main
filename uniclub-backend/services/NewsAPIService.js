const { NEWS_CONFIG } = require('../utils/newsConstants');

class NewsAPIService {
  constructor() {
    this.NEWS_API_KEY = process.env.NEWS_API_KEY;
    if (!this.NEWS_API_KEY) {
      throw new Error('NEWS_API_KEY environment variable is required');
    }
  }

  async fetchLatestArticles() {
    console.log('\n📡 Fetching fresh articles from all sources...');
    const allArticles = [];
    
    for (let i = 0; i < NEWS_CONFIG.TECH_QUERIES.length; i++) {
      console.log(`📡 Query ${i + 1}/${NEWS_CONFIG.TECH_QUERIES.length}...`);
      const articles = await this.fetchNewsFromAPI(NEWS_CONFIG.TECH_QUERIES[i]);
      allArticles.push(...articles);
      
      // Add delay between requests to respect rate limits
      if (i < NEWS_CONFIG.TECH_QUERIES.length - 1) {
        await this.sleep(NEWS_CONFIG.API_DELAY);
      }
    }
    
    console.log(`📰 Found ${allArticles.length} total articles`);
    return allArticles;
  }

  async fetchNewsFromAPI(query, retryCount = 0) {
    try {
      const url = `https://newsapi.org/v2/everything?` +
        `q=${encodeURIComponent(query)}&` +
        `sources=${NEWS_CONFIG.TECH_SOURCES.join(',')}&` +
        `language=en&` +
        `sortBy=publishedAt&` +
        `pageSize=20&` +
        `from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`;
      
      const response = await fetch(url, {
        headers: { 
          'X-Api-Key': this.NEWS_API_KEY,
          'User-Agent': 'AI-Club-News-Bot/1.0'
        }
      });
      
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your NEWS_API_KEY in .env file');
      }
      
      if (response.status === 429) {
        // Rate limit hit
        if (retryCount < NEWS_CONFIG.MAX_RETRIES) {
          const waitTime = Math.pow(2, retryCount) * 5000; // Exponential backoff
          console.log(`⏳ Rate limit hit, waiting ${waitTime/1000}s before retry ${retryCount + 1}/${NEWS_CONFIG.MAX_RETRIES}...`);
          await this.sleep(waitTime);
          return this.fetchNewsFromAPI(query, retryCount + 1);
        } else {
          throw new Error('Rate limit exceeded after maximum retries');
        }
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(`API Error: ${data.message}`);
      }
      
      return data.articles || [];
    } catch (error) {
      console.error(`❌ Failed to fetch query "${query}":`, error.message);
      
      // Retry logic for non-rate-limit errors
      if (retryCount < NEWS_CONFIG.MAX_RETRIES && 
          !error.message.includes('Rate limit exceeded') && 
          !error.message.includes('Invalid API key')) {
        console.log(`🔄 Retrying query (${retryCount + 1}/${NEWS_CONFIG.MAX_RETRIES})...`);
        await this.sleep(NEWS_CONFIG.API_DELAY * (retryCount + 1));
        return this.fetchNewsFromAPI(query, retryCount + 1);
      }
      
      return [];
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NewsAPIService; 