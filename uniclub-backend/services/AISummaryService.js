const { NEWS_CONFIG } = require('../utils/newsConstants');
const { generateText } = require('../utils/geminiClient');

class AISummaryService {
  constructor() {}

  async generateSummary(articleText, title = '') {
    if (!articleText || articleText.length < NEWS_CONFIG.CHAR_LIMITS.MIN_CONTENT_LENGTH) {
      console.log('⚠️ Content too short for AI summary, using fallback');
      return NEWS_CONFIG.FALLBACKS.summary;
    }

    try {
      console.log('🤖 Generating AI summary...');
      
      // Generate summaries sequentially with delays to avoid rate limits
      const mainSummary = await this.generateMainSummary(articleText);
      await this.delay(3000); // 3 second delay
      
      const quickSummary = await this.generateQuickSummary(articleText);
      await this.delay(3000); // 3 second delay
      
      const whyItMatters = await this.generateWhyItMatters(articleText);
      
      console.log('✅ AI summary generated successfully!');
      return {
        raw: mainSummary,
        quickSummary: quickSummary,
        whyItMatters: whyItMatters
      };
    } catch (err) {
      console.error(`❌ AI summarization failed: ${err.message}`);
      
      // Check if it's an overload error
      if (err.message.includes('overloaded') || err.message.includes('529')) {
        console.log('🔄 API overloaded, waiting 10 seconds before fallback...');
        await this.delay(10000);
      }
      
      return NEWS_CONFIG.FALLBACKS.summary;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateMainSummary(articleText) {
    const systemPrompt = `You are a professional tech journalist writing comprehensive article summaries. Write a neutral, informative summary that captures the key points and technical details.

CRITICAL REQUIREMENTS:
1. Write EXACTLY 2 substantial paragraphs
2. First paragraph (200-400 characters): Explain the main development, key technical details, companies involved, and what was announced/discovered
3. Second paragraph (200-400 characters): Cover the broader context, industry impact, technical significance, market implications, or future developments
4. Use clear, professional language with specific technical details
5. Be neutral and objective - do not tailor to any specific audience
6. Include concrete facts, numbers, and technical specifications when available
7. NO meta-commentary, labels, or prefixes
8. Output ONLY the two paragraphs

Focus on comprehensive coverage of the news story rather than opinion or audience-specific insights.`;

    const userPrompt = `Write a comprehensive 2-paragraph summary of this tech article, focusing on technical details and industry context:\n\n${articleText}`;
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const responseText = await generateText(fullPrompt, {
      maxTokens: 600,
      temperature: 0.3,
    });

    let summary = responseText?.trim() || '';
    
    // More lenient validation - accept good AI content
    const paragraphs = summary.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length < 1 || summary.length < 50) {
      console.log('⚠️ Summary too short, using fallback');
      summary = NEWS_CONFIG.FALLBACKS.summary.raw;
    } else {
      console.log('✅ AI summary validated successfully');
    }
    
    return summary;
  }

  async generateQuickSummary(articleText) {
    const systemPrompt = `You are a tech news editor writing a concise summary for a news card.

CRITICAL REQUIREMENTS:
1. Your response MUST be EXACTLY ${NEWS_CONFIG.CHAR_LIMITS.QUICK_SUMMARY} characters or less - NOT ONE CHARACTER MORE
2. Write a single, engaging sentence that captures the essence of the article
3. Focus on the most important development or insight
4. Write in a clear, engaging style for AI students
5. Do NOT use any labels or prefixes
6. Output ONLY the summary sentence
7. If you cannot fit the summary in ${NEWS_CONFIG.CHAR_LIMITS.QUICK_SUMMARY} characters, write a shorter version that captures the key point`;

    const userPrompt = `Write a summary of this tech article in EXACTLY ${NEWS_CONFIG.CHAR_LIMITS.QUICK_SUMMARY} characters or less:\n\n${articleText}`;
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const responseText = await generateText(fullPrompt, {
      maxTokens: 100,
      temperature: 0.3,
    });
    
    let quickSummary = responseText?.trim() || '';
    
    // More lenient validation for quick summary - allow slightly longer if good content
    const maxLength = NEWS_CONFIG.CHAR_LIMITS.QUICK_SUMMARY + 20; // Allow 20 chars buffer
    if (!quickSummary) {
      console.log('⚠️ No quick summary generated, using fallback');
      quickSummary = NEWS_CONFIG.FALLBACKS.summary.quickSummary;
    } else if (quickSummary.length > maxLength) {
      console.log(`⚠️ Quick summary too long (${quickSummary.length} chars), truncating intelligently`);
      quickSummary = this.truncateAtSentence(quickSummary, NEWS_CONFIG.CHAR_LIMITS.QUICK_SUMMARY);
    } else {
      console.log(`✅ Quick summary validated (${quickSummary.length} chars)`);
    }
    
    return quickSummary || NEWS_CONFIG.FALLBACKS.summary.quickSummary;
  }


  async generateWhyItMatters(articleText) {
    const systemPrompt = `You are writing for university AI club members, ML engineers, and tech entrepreneurs. Write a compelling paragraph (750-800 characters) explaining why this technological development matters.

CRITICAL REQUIREMENTS:
1. Write EXACTLY one paragraph of 750-800 characters
2. Focus on practical relevance for AI students and tech practitioners
3. Emphasize technical insights, innovation implications, and industry impact
4. Use specific, engaging language that connects to their learning goals
5. Cover technical significance, industry trends, and future implications
6. Do NOT include any meta-commentary, labels, or prefixes like "Here's why..." or "This matters because..."
7. Output ONLY the paragraph content - nothing else

The paragraph should start directly with substantial content about the technology's significance.`;

    const userPrompt = `Write a detailed "Why It Matters" paragraph (750-800 characters) about this tech development:\n\n${articleText}`;
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const responseText = await generateText(fullPrompt, {
      maxTokens: 500,
      temperature: 0.3,
    });
    
    let whyItMatters = responseText?.trim() || '';
    
    // More lenient validation for why it matters - allow good content
    const maxLength = NEWS_CONFIG.CHAR_LIMITS.WHY_IT_MATTERS + 100; // Allow 100 chars buffer  
    if (!whyItMatters) {
      console.log('⚠️ No "Why It Matters" generated, using fallback');
      whyItMatters = NEWS_CONFIG.FALLBACKS.summary.whyItMatters;
    } else if (whyItMatters.length > maxLength) {
      console.log(`⚠️ Why It Matters too long (${whyItMatters.length} chars), truncating intelligently`);
      whyItMatters = this.truncateAtSentence(whyItMatters, NEWS_CONFIG.CHAR_LIMITS.WHY_IT_MATTERS);
    } else {
      console.log(`✅ Why It Matters validated (${whyItMatters.length} chars)`);
    }
    
    return whyItMatters || NEWS_CONFIG.FALLBACKS.summary.whyItMatters;
  }

  truncateAtSentence(text, maxLength) {
    if (text.length <= maxLength) return text;
    
    // First try to truncate at sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    let truncated = '';
    
    for (const sentence of sentences) {
      if ((truncated + sentence).length <= maxLength) {
        truncated += sentence;
      } else {
        break;
      }
    }
    
    // If we got at least one complete sentence, return it
    if (truncated.length > 0) {
      return truncated.trim();
    }
    
    // If no complete sentences fit, try to truncate at word boundaries
    const words = text.split(' ');
    let wordTruncated = '';
    
    for (const word of words) {
      if ((wordTruncated + ' ' + word).length <= maxLength) {
        wordTruncated += (wordTruncated ? ' ' : '') + word;
      } else {
        break;
      }
    }
    
    // If we got at least some words, return without "..."
    if (wordTruncated.length > 20) {
      return wordTruncated.trim();
    }
    
    // Last resort: intelligent hard truncation without "..."
    const intelligentCut = text.substring(0, maxLength).trim();
    
    // Try to end at a logical point (comma, space, etc.)
    const lastComma = intelligentCut.lastIndexOf(',');
    const lastSpace = intelligentCut.lastIndexOf(' ');
    
    if (lastComma > intelligentCut.length - 20) {
      return intelligentCut.substring(0, lastComma).trim();
    } else if (lastSpace > intelligentCut.length - 10) {
      return intelligentCut.substring(0, lastSpace).trim();
    }
    
    return intelligentCut;
  }

  async processMultipleArticles(articles) {
    console.log(`\n🤖 Processing ${articles.length} articles with AI summaries...`);
    const processedArticles = [];
    
    for (const [index, article] of articles.entries()) {
      try {
        console.log(`🤖 Generating summary for article ${index + 1}/${articles.length}...`);
        
        const summary = await this.generateSummary(article.scrapedContent, article.title);
        
        processedArticles.push({
          ...article,
          aiSummary: summary
        });
        
        console.log('✅ Summary generated successfully');
        
        // Add delay between AI calls to prevent overload
        if (index < articles.length - 1) {
          console.log('⏳ Waiting 5 seconds...');
          await this.delay(5000); // Increased to 5 seconds
        }
        
      } catch (error) {
        console.error(`❌ Error processing article ${index + 1}:`, error.message);
        
        // Add article with fallback summary
        processedArticles.push({
          ...article,
          aiSummary: NEWS_CONFIG.FALLBACKS.summary
        });
      }
    }
    
    console.log(`✅ Processed ${processedArticles.length} articles with AI summaries`);
    return processedArticles;
  }
}

module.exports = AISummaryService; 