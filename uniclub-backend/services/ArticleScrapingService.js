const axios = require('axios');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const { NEWS_CONFIG } = require('../utils/newsConstants');

class ArticleScrapingService {
  static async scrapeArticleContent(url, title = '') {
    let articleText = '';
    
    try {
      console.log(`📥 Scraping: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const dom = new JSDOM(response.data, { 
        url,
        resources: "usable",
        pretendToBeVisual: false
      });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      
      if (article && article.textContent) {
        articleText = article.textContent;
        console.log(`✅ Extracted ${articleText.length} characters`);
      } else {
        throw new Error('No content extracted');
      }
    } catch (err) {
      console.error(`❌ Scraping failed: ${err.message}`);
      return null;
    }

    if (!articleText || articleText.length < NEWS_CONFIG.CHAR_LIMITS.MIN_CONTENT_LENGTH) {
      console.log('⚠️ Content too short, skipping AI summary');
      return null;
    }

    return articleText;
  }

  static async scrapeMultipleArticles(articles) {
    console.log(`\n📥 Scraping ${articles.length} articles...`);
    const scrapedArticles = [];
    
    for (const [index, article] of articles.entries()) {
      console.log(`\n📰 Article ${index + 1}/${articles.length}: ${article.title}`);
      
      // Skip if no URL
      if (!article.url) {
        console.log('⚠️ No URL, skipping');
        continue;
      }
      
      // Scrape content
      const articleText = await this.scrapeArticleContent(article.url, article.title);
      
      if (!articleText) {
        console.log('⚠️ Skipping article due to failed scraping');
        continue;
      }
      
      // Add scraped content to article
      scrapedArticles.push({
        ...article,
        scrapedContent: articleText
      });
      
      console.log('✅ Success: Article content scraped');
      
      // Add delay between scraping to be respectful
      if (index < articles.length - 1) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`✅ Successfully scraped ${scrapedArticles.length}/${articles.length} articles`);
    return scrapedArticles;
  }

  static validateImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      
      // Basic protocol validation - must be HTTP or HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      
      // URL length validation - reasonable bounds
      if (url.length < 10 || url.length > 2000) {
        return false;
      }
      
      // Domain validation - exclude localhost and invalid domains
      const hostname = urlObj.hostname.toLowerCase();
      if (hostname === 'localhost' || 
          hostname.startsWith('127.') || 
          hostname.startsWith('192.168.') || 
          hostname.startsWith('10.') || 
          hostname === '::1') {
        return false;
      }
      
      // Exclude obvious placeholder/default URLs (case-insensitive)
      const urlLower = url.toLowerCase();
      const excludePatterns = [
        'placeholder',
        'default-image',
        'no-image',
        'missing-image',
        'image-not-found',
        'unavailable',
        'dummy',
        'sample',
        'blank.jpg',
        'blank.png',
        '1x1.gif',
        'transparent.gif'
      ];
      
      // Exclude specific test domains only, not all subdomains
      const excludeDomains = [
        'example.com',
        'test.com',
        'localhost.com'
      ];
      
      const hasExcludedPattern = excludePatterns.some(pattern => 
        urlLower.includes(pattern)
      );
      
      const hasExcludedDomain = excludeDomains.some(domain => 
        hostname === domain
      );
      
      if (hasExcludedPattern || hasExcludedDomain) {
        return false;
      }
      
      // Accept all other URLs - modern CDNs, APIs, and image services
      // use various URL patterns that don't follow traditional file extension rules
      return true;
      
    } catch (error) {
      // Invalid URL format
      return false;
    }
  }
}

module.exports = ArticleScrapingService; 