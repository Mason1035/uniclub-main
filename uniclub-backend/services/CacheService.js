/**
 * Cache Service - In-memory caching for improved performance
 * In production, consider using Redis for distributed caching
 */
class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttlMap = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Set a cache entry with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = this.defaultTTL) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, value);
    this.ttlMap.set(key, expiry);
  }

  /**
   * Get a cache entry
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if expired/not found
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const expiry = this.ttlMap.get(key);
    if (expiry && Date.now() > expiry) {
      this.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  /**
   * Delete a cache entry
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
    this.ttlMap.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.ttlMap.clear();
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    if (!this.cache.has(key)) {
      return false;
    }

    const expiry = this.ttlMap.get(key);
    if (expiry && Date.now() > expiry) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get or set pattern - if key exists return it, otherwise compute and cache
   * @param {string} key - Cache key
   * @param {Function} computeFn - Function to compute value if not cached
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<any>}
   */
  async getOrSet(key, computeFn, ttl = this.defaultTTL) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await computeFn();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Invalidate cache entries by pattern
   * @param {string} pattern - Pattern to match (simple string matching)
   */
  invalidatePattern(pattern) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.ttlMap.entries()) {
      if (now > expiry) {
        this.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryUsage: process.memoryUsage()
    };
  }

  // Specific cache key generators for social media
  
  /**
   * Generate cache key for user feed
   * @param {string} userId - User ID
   * @param {string} algorithm - Feed algorithm
   * @param {string} cursor - Pagination cursor
   * @returns {string}
   */
  static generateFeedKey(userId, algorithm, cursor = '') {
    return `feed:${userId}:${algorithm}:${cursor}`;
  }

  /**
   * Generate cache key for trending posts
   * @param {number} timeframe - Timeframe in hours
   * @param {number} limit - Number of posts
   * @returns {string}
   */
  static generateTrendingKey(timeframe, limit) {
    return `trending:${timeframe}h:${limit}`;
  }

  /**
   * Generate cache key for user profile
   * @param {string} userId - User ID
   * @returns {string}
   */
  static generateUserKey(userId) {
    return `user:${userId}`;
  }

  /**
   * Generate cache key for group data
   * @param {string} groupId - Group ID
   * @returns {string}
   */
  static generateGroupKey(groupId) {
    return `group:${groupId}`;
  }

  /**
   * Generate cache key for post engagement data
   * @param {string} postId - Post ID
   * @returns {string}
   */
  static generatePostEngagementKey(postId) {
    return `post_engagement:${postId}`;
  }
}

module.exports = new CacheService();
