const express = require('express');
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const News = require('../models/News');
const authenticateToken = require('../middleware/auth');
const { DeepSeekAssistant } = require('../services/DeepSeekAssistant');
const { AiError } = require('../utils/aiSecret');
const { NEWS_LIMITS, clip, validateQuestion, buildNewsContext, safeSources } = require('../utils/newsAiContext');
const { createAiRateLimiter, sendAiError, aiRequest } = require('../utils/aiHttp');
const { articleVisible } = require('../utils/dailyNewsVisibility');

function newsError(error) {
  const code = error instanceof AiError ? error.code : 'AI_UNAVAILABLE';
  const input = {
    INVALID_ARTICLE_ID: ['新闻地址无效。', 400], ARTICLE_NOT_FOUND: ['这篇新闻不存在或暂未公开。', 404],
    EMPTY_ARTICLE: ['这篇新闻暂无正文，暂时无法问答。', 400], INVALID_QUESTION: ['请输入你想问的问题。', 400],
    QUESTION_TOO_LONG: ['问题最多 1000 字，请缩短后再发送。', 400],
  };
  if (Object.hasOwn(input, code)) return new AiError(code, ...input[code]);
  if (code === 'CANCELLED') return new AiError(code, '请求已取消。', 499);
  if (code === 'PROVIDER_RATE_LIMIT') return new AiError(code, 'AI 请求较多，请稍后再试。', 429);
  if (code === 'PROVIDER_TIMEOUT') return new AiError(code, 'AI 回答超时，请稍后再试。', 504);
  if (['INCOMPLETE_STREAM', 'INVALID_PROVIDER_STREAM', 'EMPTY_OUTPUT', 'OUTPUT_TOO_LONG'].includes(code)) return new AiError(code, 'AI 回答未完整接收，请稍后重试。', 502);
  return new AiError('AI_UNAVAILABLE', 'AI 暂时无法回答，请稍后再试。', 503);
}

function displayMessages(messages) {
  return (Array.isArray(messages) ? messages : []).filter(message => ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string')
    .slice(-NEWS_LIMITS.displayMessages).map(message => ({
      role: message.role, content: clip(message.content, 64000), timestamp: message.timestamp,
      ...(message.role === 'assistant' && { sources: safeSources(message.sources), warning: typeof message.warning === 'string' ? clip(message.warning, 2000) : null, reasoning: message.reasoning === true }),
    }));
}

function createChatRouter({ assistant = new DeepSeekAssistant(), newsModel = News, chatModel = Chat, requestTimeoutMs = 240000, requestLimit = 20 } = {}) {
  const router = express.Router();
  router.use(authenticateToken);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const articleFor = async id => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AiError('INVALID_ARTICLE_ID', '新闻地址无效。');
    const article = await newsModel.findById(id)
      .select('title excerpt content summary source publishedAt author originalAuthor originalUrl status origin generationBatchId automationCommittedAt sourceReferences')
      .populate('author', 'name').lean();
    if (!(await articleVisible(article))) throw new AiError('ARTICLE_NOT_FOUND', '这篇新闻不存在或暂未公开。', 404);
    return article;
  };
  router.get('/:articleId', async (req, res) => {
    try {
      // Recheck visibility even for a conversation about a subsequently archived item.
      await articleFor(req.params.articleId);
      const chat = await chatModel.findOne({ articleId: req.params.articleId, userId: req.user.userId });
      res.json(displayMessages(chat?.messages));
    } catch (error) { sendAiError(res, error, false, newsError); }
  });
  router.post('/:articleId', createAiRateLimiter(requestLimit), aiRequest(async (req, options) => {
    const question = validateQuestion(req.body?.content), articleId = req.params.articleId, userId = req.user.userId;
    // Context, visibility and history come from the database, never client article/history.
    const article = await articleFor(articleId);
    buildNewsContext(article, question);
    let chat = await chatModel.findOne({ articleId, userId });
    const history = Array.isArray(chat?.messages) ? chat.messages : [];
    const timestamp = new Date();
    const result = await assistant.answerNews(article, question, history, options);
    if (options.signal.aborted) throw new AiError('CANCELLED', '请求已取消。', 499);
    if (typeof result.answer !== 'string' || !result.answer.trim() || result.answer.length > 16000) throw new AiError('EMPTY_OUTPUT', 'AI 回答未完整接收。', 502);
    const sources = safeSources(result.sources), warning = typeof result.warning === 'string' ? clip(result.warning, 2000) : null;
    const userMessage = { role: 'user', content: question, timestamp };
    const assistantMessage = { role: 'assistant', content: result.answer, timestamp: new Date(), sources, warning, reasoning: result.reasoning === true };
    if (!chat) chat = new chatModel({ articleId, userId, messages: [] });
    // Failed/cancelled partial streams are never saved as completed answers.
    chat.messages = [...history.slice(-(NEWS_LIMITS.savedMessages - 2)), userMessage, assistantMessage];
    chat.lastUpdated = new Date();
    await chat.save();
    return {
      answer: result.answer, messages: displayMessages(chat.messages), sources, warning,
      reasoning: result.reasoning === true, usedWebSearch: result.usedWebSearch === true && sources.length > 0,
      elapsedMs: result.elapsedMs,
    };
  }, { requestTimeoutMs, mapError: newsError }));
  return router;
}

module.exports = createChatRouter();
module.exports.createChatRouter = createChatRouter;
