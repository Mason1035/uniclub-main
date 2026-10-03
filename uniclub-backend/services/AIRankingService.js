const { generateText } = require('../utils/geminiClient');

class AIRankingService {
  constructor() {
    // Gemini client handled via shared utility
  }

  /**
   * Get top 3 items from a category using AI ranking
   * @param {Array} items - Array of items to rank
   * @param {String} category - Category type (news, events, social, resources)
   * @returns {Array} Top 3 ranked items
   */
  async getTop3(items, category) {
    try {
      if (!items || items.length === 0) {
        console.log(`⚠️ No ${category} items to rank`);
        return [];
      }

      if (items.length <= 3) {
        console.log(`📊 ${category}: Returning all ${items.length} items (less than 3)`);
        return items;
      }

      // Prepare items for AI analysis
      const itemsForAI = items.map((item, index) => ({
        index: index,
        title: item.title,
        summary: item.summary || item.description || item.content?.substring(0, 200) || '',
        publishedAt: item.publishedAt || item.createdAt || item.startDate,
        engagement: {
          views: item.engagement?.views || 0,
          likes: item.engagement?.likes || 0,
          shares: item.engagement?.shares || 0,
          comments: item.engagement?.comments || 0,
          rsvpCount: item.engagement?.rsvpCount || 0
        }
      }));

             const prompt = `You are an AI content curator for a university AI club's social feed. 

Analyze these ${category} items and select the TOP 3 most engaging and relevant ones for students interested in AI, technology, and innovation.

Consider these factors:
1. **Relevance** to AI/tech students (40%)
2. **Engagement potential** (views, likes, shares) (30%) 
3. **Recency** and timeliness (20%)
4. **Educational value** or practical insights (10%)

Items to rank:
${JSON.stringify(itemsForAI, null, 2)}

CRITICAL: Respond with ONLY a JSON array of the top 3 item indices (0-based). No explanations, no extra text, just the array.
Example: [2, 0, 5]`;

      const aiResponse = (await generateText(prompt, {
        maxTokens: 100,
        temperature: 0.3,
      })).trim();
      console.log(`🤖 AI ranking response for ${category}:`, aiResponse);

      // Parse AI response
      const selectedIndices = JSON.parse(aiResponse);
      const top3Items = selectedIndices.map(index => items[index]).filter(Boolean);

      console.log(`✅ AI selected top 3 ${category} items:`, top3Items.map(item => item.title));
      return top3Items.slice(0, 3); // Ensure we only return max 3

    } catch (error) {
      console.error(`❌ Error in AI ranking for ${category}:`, error.message);
      // Fallback: return first 3 items sorted by engagement
      return this.getFallbackTop3(items);
    }
  }

  /**
   * Get the #1 item from top 3 using AI selection
   * @param {Array} top3Items - Top 3 items from getTop3
   * @param {String} category - Category type
   * @returns {Object} The #1 featured item
   */
  async getNumber1(top3Items, category) {
    try {
      if (!top3Items || top3Items.length === 0) {
        console.log(`⚠️ No top3 ${category} items to select #1 from`);
        return null;
      }

      if (top3Items.length === 1) {
        console.log(`📊 ${category}: Only 1 item, returning as #1`);
        return top3Items[0];
      }

      // Prepare items for AI final selection
      const itemsForAI = top3Items.map((item, index) => ({
        index: index,
        title: item.title,
        summary: item.summary || item.description || item.content?.substring(0, 200) || '',
        publishedAt: item.publishedAt || item.createdAt || item.startDate,
        engagement: {
          views: item.engagement?.views || 0,
          likes: item.engagement?.likes || 0,
          shares: item.engagement?.shares || 0,
          comments: item.engagement?.comments || 0,
          rsvpCount: item.engagement?.rsvpCount || 0
        }
      }));

             const prompt = `You are selecting the SINGLE most featured-worthy ${category} item for a university AI club's homepage hero section.

From these top 3 finalists, choose the ONE that would be most engaging and click-worthy for AI/tech students:

${JSON.stringify(itemsForAI, null, 2)}

Consider:
- Which would generate the most engagement and discussion?
- Which is most relevant to current AI/tech trends?
- Which has the best "wow factor" for the featured section?

CRITICAL: Respond with ONLY the index number (0, 1, or 2). No explanations, no extra text, just the number.`;

      const aiResponse = (await generateText(prompt, {
        maxTokens: 10,
        temperature: 0.3,
      })).trim();
      console.log(`🤖 AI #1 selection for ${category}:`, aiResponse);

      const selectedIndex = parseInt(aiResponse);
      const number1Item = top3Items[selectedIndex];

      if (number1Item) {
        console.log(`🏆 AI selected #1 ${category} item:`, number1Item.title);
        return number1Item;
      } else {
        console.log(`⚠️ Invalid AI selection, defaulting to first item`);
        return top3Items[0];
      }

    } catch (error) {
      console.error(`❌ Error in AI #1 selection for ${category}:`, error.message);
      // Fallback: return first item
      return top3Items[0];
    }
  }

  /**
   * Fallback ranking based on engagement metrics
   */
  getFallbackTop3(items) {
    console.log('🔄 Using fallback ranking based on engagement');
    return items
      .sort((a, b) => {
        const aScore = (a.engagement?.views || 0) + (a.engagement?.likes || 0) * 2 + (a.engagement?.shares || 0) * 3;
        const bScore = (b.engagement?.views || 0) + (b.engagement?.likes || 0) * 2 + (b.engagement?.shares || 0) * 3;
        return bScore - aScore;
      })
      .slice(0, 3);
  }

  /**
   * Get the featured item (alias for getNumber1)
   * @param {Array} top3Items - Top 3 items from getTop3
   * @param {String} category - Category type
   * @returns {Object} The #1 featured item
   */
  async getFeatured(top3Items, category) {
    return await this.getNumber1(top3Items, category);
  }

  /**
   * Complete ranking process: get top 3 and select #1 for a category
   */
  async rankCategory(items, category) {
    console.log(`🔄 Starting AI ranking for ${category} category (${items.length} items)`);
    
    const top3 = await this.getTop3(items, category);
    const number1 = await this.getNumber1(top3, category);
    
    return {
      top3,
      featured: number1
    };
  }
}

module.exports = new AIRankingService(); 