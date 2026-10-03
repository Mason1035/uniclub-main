const axios = require('axios');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const { generateText } = require('./geminiClient');

const MIN_CONTENT_LENGTH = 200;
const MAX_CHARS_QUICK = 130;
const MAX_CHARS_WHY = 800;
const MAX_CHARS_PER_PARA = 500;

async function scrapeAndSummarizeArticle(url, title = '') {
  let articleText = '';
  try {
    console.log(`📥 [scrapeAndSummarize] Scraping: ${url}`);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
      console.log(`✅ [scrapeAndSummarize] Extracted ${articleText.length} characters`);
    } else {
      throw new Error('No content extracted');
    }
  } catch (err) {
    console.error(`❌ [scrapeAndSummarize] Scraping failed: ${err.message}`);
    return null;
  }

  if (!articleText || articleText.length < MIN_CONTENT_LENGTH) {
    console.log('⚠️ [scrapeAndSummarize] Content too short, skipping AI summary');
    return {
      raw: 'This article discusses an important development in AI/ML technology, presenting new technical insights and methodologies that are relevant for understanding current industry trends.\n\nFor AI students and practitioners, this development offers valuable learning opportunities and demonstrates the evolving nature of artificial intelligence and machine learning applications.',
      whyItMatters: 'This technological development represents significant progress in the AI/ML field, offering valuable insights for students learning about cutting-edge research and practical applications. The advancement demonstrates key technical principles that are essential for understanding modern artificial intelligence systems and their real-world implementations. For practitioners and aspiring developers, this development highlights emerging trends in the industry and provides learning opportunities for staying current with rapidly evolving technologies. The technical approaches and methodologies discussed showcase important concepts that can inform future projects and career development in artificial intelligence and machine learning domains.',
      quickSummary: 'This article covers a recent development in AI/ML technology with practical implications for students and practitioners.'
    };
  }

  try {
    // Generate main summary
    const systemPrompt = `You are a passionate tech writer for a university AI club app. Your audience is AI students and practitioners who want clear, engaging tech updates.

CRITICAL REQUIREMENTS:
1. Write EXACTLY 2 paragraphs
2. Each paragraph MUST be 100-500 characters
3. First paragraph: Explain the key development/breakthrough with technical details
4. Second paragraph: Focus on implications for AI students/practitioners
5. Use clear, engaging language
6. NO meta-commentary, labels, or prefixes
7. Output ONLY the two paragraphs`;

    const userPrompt = `Write a 2-paragraph summary of this tech article:\n\n${articleText}`;
    const fullSummaryPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const summaryText = await generateText(fullSummaryPrompt, {
      maxTokens: 400,
      temperature: 0.3,
    });
    let summary = summaryText?.trim() || '';
    
    // Validate summary structure
    const paragraphs = summary.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length !== 2 || 
        paragraphs[0].length > MAX_CHARS_PER_PARA || 
        paragraphs[1].length > MAX_CHARS_PER_PARA) {
      console.log('⚠️ [scrapeAndSummarize] Summary structure invalid, using fallback');
      summary = 'This article discusses an important development in AI/ML technology, presenting new technical insights and methodologies.\n\nFor AI students and practitioners, this development offers valuable learning opportunities and demonstrates the evolving nature of the field.';
    }

    // Generate quick summary for news card
    const quickSystemPrompt = `You are a tech news editor writing a concise summary for a news card.

CRITICAL REQUIREMENTS:
1. Your response MUST be EXACTLY ${MAX_CHARS_QUICK} characters or less - NOT ONE CHARACTER MORE
2. Write a single, engaging sentence that captures the essence of the article
3. Focus on the most important development or insight
4. Write in a clear, engaging style for AI students
5. Do NOT use any labels or prefixes
6. Output ONLY the summary sentence
7. If you cannot fit the summary in ${MAX_CHARS_QUICK} characters, write a shorter version that captures the key point`;

    const quickUserPrompt = `Write a summary of this tech article in EXACTLY ${MAX_CHARS_QUICK} characters or less:\n\n${articleText}`;
    const fullQuickPrompt = `${quickSystemPrompt}\n\n---\n\n${quickUserPrompt}`;

    const quickSummaryText = await generateText(fullQuickPrompt, {
      maxTokens: 100,
      temperature: 0.3,
    });
    let quickSummary = quickSummaryText?.trim() || '';
    
    // Validate quick summary length
    if (!quickSummary || quickSummary.length > MAX_CHARS_QUICK) {
      console.log(`⚠️ [scrapeAndSummarize] Quick summary too long (${quickSummary?.length || 0} chars), retrying with stricter prompt`);
      // Retry with stricter prompt
      const retrySystemPrompt = `You are a tech news editor. Your ONLY task is to write a summary in EXACTLY ${MAX_CHARS_QUICK} characters or less.
CRITICAL: Count every character (including spaces and punctuation) and ensure the total is ${MAX_CHARS_QUICK} or less.
If you cannot fit the main point in ${MAX_CHARS_QUICK} characters, write a shorter version that captures the essence.
Output ONLY the summary - no other text.`;
      const retryUserPrompt = `Rewrite this summary in ${MAX_CHARS_QUICK} characters or less:\n\n${quickSummary || ''}`;
      const fullRetryPrompt = `${retrySystemPrompt}\n\n---\n\n${retryUserPrompt}`;

      const retryText = await generateText(fullRetryPrompt, {
        maxTokens: 100,
        temperature: 0.1,
      });
      quickSummary = retryText?.trim() || '';
      
      // If still too long, truncate intelligently at sentence boundary
      if (quickSummary.length > MAX_CHARS_QUICK) {
        const sentences = quickSummary.match(/[^.!?]+[.!?]+/g) || [];
        let truncated = '';
        for (const sentence of sentences) {
          if ((truncated + sentence).length <= MAX_CHARS_QUICK) {
            truncated += sentence;
          } else {
            break;
          }
        }
        quickSummary = truncated || quickSummary.substring(0, MAX_CHARS_QUICK - 3) + '...';
      }
    }

    // Generate why it matters section
    const whySystemPrompt = `You are writing for university AI club members, ML engineers, and tech entrepreneurs. Write a compelling paragraph (750-800 characters) explaining why this technological development matters.
 
CRITICAL REQUIREMENTS:
1. Write EXACTLY one paragraph of 750-800 characters
2. Focus on practical relevance for AI students and tech practitioners
3. Emphasize technical insights, innovation implications, and industry impact
4. Use specific, engaging language that connects to their learning goals
5. Cover technical significance, industry trends, and future implications
6. Do NOT include any meta-commentary, labels, or prefixes like "Here's why..." or "This matters because..."
7. Output ONLY the paragraph content - nothing else
 
The paragraph should start directly with substantial content about the technology's significance.`;
    const whyUserPrompt = `Write a detailed "Why It Matters" paragraph (750-800 characters) about this tech development:\n\n${articleText}`;
    const fullWhyPrompt = `${whySystemPrompt}\n\n---\n\n${whyUserPrompt}`;

    const whyText = await generateText(fullWhyPrompt, {
      maxTokens: 500,
      temperature: 0.3,
    });
    let whyItMatters = whyText?.trim() || '';
    // Validate why it matters length
    if (!whyItMatters || whyItMatters.length > MAX_CHARS_WHY) {
      console.log(`⚠️ [scrapeAndSummarize] Why It Matters too long (${whyItMatters.length} chars), truncating at sentence boundary`);
      // Truncate at sentence boundary
      const sentences = whyItMatters.match(/[^.!?]+[.!?]+/g) || [];
      let truncated = '';
      for (const sentence of sentences) {
        if ((truncated + sentence).length <= MAX_CHARS_WHY) {
          truncated += sentence;
        } else {
          break;
        }
      }
      whyItMatters = truncated || whyItMatters.substring(0, MAX_CHARS_WHY - 3) + '...';
    }
    
    console.log('✅ [scrapeAndSummarize] AI summary generated successfully!');
    return {
      raw: summary,
      whyItMatters: whyItMatters,
      quickSummary: quickSummary
    };
  } catch (err) {
    console.error(`❌ [scrapeAndSummarize] AI summarization failed: ${err.message}`);
    return {
      raw: 'This article discusses an important development in AI/ML technology, presenting new technical insights and methodologies that are relevant for understanding current industry trends.\n\nFor AI students and practitioners, this development offers valuable learning opportunities and demonstrates the evolving nature of artificial intelligence and machine learning applications.',
      whyItMatters: 'This technological development represents significant progress in the AI/ML field, offering valuable insights for students learning about cutting-edge research and practical applications. The advancement demonstrates key technical principles that are essential for understanding modern artificial intelligence systems and their real-world implementations. For practitioners and aspiring developers, this development highlights emerging trends in the industry and provides learning opportunities for staying current with rapidly evolving technologies. The technical approaches and methodologies discussed showcase important concepts that can inform future projects and career development in artificial intelligence and machine learning domains.',
      quickSummary: 'This article covers a recent development in AI/ML technology with practical implications for students and practitioners.'
    };
  }
}

module.exports = { scrapeAndSummarizeArticle }; 