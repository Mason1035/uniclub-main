const axios = require('axios');
const { URL } = require('url');

class DynamicLogoService {
  constructor() {
    // Cache for successful logo URLs to avoid repeated fetching
    this.logoCache = new Map();
    
    // Request timeout and retry settings
    this.requestTimeout = 5000;
    this.maxRetries = 2;
  }

  /**
   * Extract domain from article URL
   * @param {string} articleUrl - The article URL
   * @returns {string|null} - The domain or null if invalid
   */
  extractDomain(articleUrl) {
    try {
      if (!articleUrl) return null;
      const url = new URL(articleUrl);
      return url.hostname.replace(/^www\./, ''); // Remove www prefix
    } catch (error) {
      console.log(`⚠️  Invalid URL for domain extraction: ${articleUrl}`);
      return null;
    }
  }

  /**
   * Validate if a logo URL is accessible and returns valid image content
   * @param {string} logoUrl - The logo URL to validate
   * @returns {Promise<boolean>} - True if valid, false otherwise
   */
  async validateLogoUrl(logoUrl) {
    try {
      const response = await axios.get(logoUrl, {
        timeout: this.requestTimeout,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        responseType: 'stream', // Don't download full content, just check headers
        validateStatus: (status) => status === 200
      });

      const contentType = response.headers['content-type'] || '';
      const contentLength = parseInt(response.headers['content-length'] || '0');

      // Destroy the stream to avoid downloading full content
      response.data.destroy();

      // Validate it's an image with reasonable size
      const isValidImage = contentType.startsWith('image/') && contentLength > 100 && contentLength < 500000; // 100B to 500KB
      
      if (isValidImage) {
        console.log(`✅ Valid logo found: ${logoUrl} (${contentType}, ${contentLength} bytes)`);
      }
      
      return isValidImage;
    } catch (error) {
      return false;
    }
  }

  /**
   * Try multiple logo fetching strategies for a domain
   * @param {string} domain - The publisher domain
   * @returns {Promise<string|null>} - The logo URL or null if none found
   */
  async fetchLogoForDomain(domain) {
    if (!domain) return null;

    // Check cache first
    if (this.logoCache.has(domain)) {
      const cachedLogo = this.logoCache.get(domain);
      console.log(`📋 Using cached logo for ${domain}: ${cachedLogo}`);
      return cachedLogo;
    }

    console.log(`🔍 Fetching logo for domain: ${domain}`);

    const strategies = [
      // Strategy 1: Standard favicon location
      `https://${domain}/favicon.ico`,
      
      // Strategy 2: High-res Apple touch icon
      `https://${domain}/apple-touch-icon.png`,
      `https://${domain}/apple-touch-icon-180x180.png`,
      
      // Strategy 3: Common favicon locations
      `https://${domain}/favicon.png`,
      `https://${domain}/assets/favicon.ico`,
      `https://${domain}/static/favicon.ico`,
      
      // Strategy 4: Google S2 favicon service (reliable fallback)
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      
      // Strategy 5: Alternative favicon services
      `https://favicon.im/${domain}?larger=true`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`
    ];

    // Try each strategy in order
    for (const logoUrl of strategies) {
      try {
        console.log(`🧪 Trying strategy: ${logoUrl}`);
        
        const isValid = await this.validateLogoUrl(logoUrl);
        if (isValid) {
          console.log(`✅ Successfully found logo for ${domain}: ${logoUrl}`);
          
          // Cache the successful result
          this.logoCache.set(domain, logoUrl);
          return logoUrl;
        }
      } catch (error) {
        // Continue to next strategy
        continue;
      }
    }

    console.log(`❌ No valid logo found for domain: ${domain}`);
    
    // Cache null result to avoid repeated attempts
    this.logoCache.set(domain, null);
    return null;
  }

  /**
   * Get publisher logo with fallback to publisher name matching
   * @param {string} articleUrl - The article URL
   * @param {string} publisherName - The publisher name as fallback
   * @returns {Promise<string|null>} - The logo URL or null
   */
  async getPublisherLogo(articleUrl, publisherName = null) {
    try {
      // Primary strategy: Extract domain from URL
      const domain = this.extractDomain(articleUrl);
      if (domain) {
        const logoUrl = await this.fetchLogoForDomain(domain);
        if (logoUrl) {
          return logoUrl;
        }
      }

      // Fallback strategy: Try to extract domain from publisher name
      if (publisherName) {
        const normalizedName = publisherName.toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9]/g, '');
        
        // Common publisher name to domain mappings for edge cases
        const nameToDomain = {
          'techcrunch': 'techcrunch.com',
          'theverge': 'theverge.com', 
          'wired': 'wired.com',
          'arstechnica': 'arstechnica.com',
          'venturebeat': 'venturebeat.com',
          'engadget': 'engadget.com',
          'techradar': 'techradar.com',
          'thenextweb': 'thenextweb.com',
          'mittechnologyreview': 'technologyreview.com',
          'zdnet': 'zdnet.com',
          'hackernews': 'news.ycombinator.com',
          'reuters': 'reuters.com',
          'associatedpress': 'ap.org',
          'bbc': 'bbc.com',
          'cnn': 'cnn.com',
          'theguardian': 'theguardian.com',
          'businessinsider': 'businessinsider.com',
          'fortune': 'fortune.com'
        };

        const mappedDomain = nameToDomain[normalizedName];
        if (mappedDomain) {
          console.log(`🔄 Trying publisher name mapping: ${publisherName} -> ${mappedDomain}`);
          const logoUrl = await this.fetchLogoForDomain(mappedDomain);
          if (logoUrl) {
            console.log(`✅ Successfully found logo via name mapping for ${publisherName}: ${logoUrl}`);
            return logoUrl;
          } else {
            console.log(`❌ Failed to find logo via name mapping for ${publisherName} (${mappedDomain})`);
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ Error fetching publisher logo:`, error.message);
      return null;
    }
  }

  /**
   * Clear the logo cache (useful for testing or periodic cleanup)
   */
  clearCache() {
    this.logoCache.clear();
    console.log('🧹 Logo cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.logoCache.size,
      domains: Array.from(this.logoCache.keys())
    };
  }
}

module.exports = DynamicLogoService; 