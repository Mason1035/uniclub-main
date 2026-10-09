const { AiError } = require('./aiSecret');

const MESSAGES = Object.freeze({
  SEARCH_UNAVAILABLE: ['联网搜索暂不可用，请检查搜索服务后重试。', 503],
  SEARCH_NO_RESULTS: ['没有检索到近期新闻，本次保留上一批每日新闻。', 503],
  AI_UNAVAILABLE: ['系统 AI Assistant 暂不可用，请检查统一 AI 配置。', 503],
  AI_TIMEOUT: ['AI 生成超时，请稍后重试。', 504],
  AI_INVALID_RESPONSE: ['AI 返回的文章格式不完整，本次未发布新闻。', 502],
  INSUFFICIENT_SOURCES: ['没有足够可靠的新闻来源，本次未发布新闻。', 422],
  VALIDATION_FAILED: ['新闻事实或来源验证未通过，本次未发布新闻。', 422],
  DATABASE_ERROR: ['每日新闻未能保存，本次保留上一批每日新闻。', 503],
  ALREADY_RUNNING: ['已有每日新闻任务正在运行，请稍候。', 409],
  ALREADY_GENERATED: ['今天已经生成过每日新闻，重新生成需要确认。', 409],
  INVALID_SETTINGS: ['每日新闻设置无效，请检查时间、数量与新闻偏好。', 400],
  CONFIRM_REQUIRED: ['请先确认运行每日新闻任务。', 400],
});

class DailyNewsError extends AiError {
  constructor(code, message, status) {
    const safeCode = Object.hasOwn(MESSAGES, code) ? code : 'DATABASE_ERROR';
    const [defaultMessage, defaultStatus] = MESSAGES[safeCode];
    super(safeCode, message || defaultMessage, status || defaultStatus);
  }
}

// Never forward provider error text: axios errors may contain credentials or
// prompts. The same safe mapping is used by background jobs and admin routes.
function errorForDailyNews(error) {
  if (error instanceof DailyNewsError) return error;
  if (error?.code === 'LOST_LEASE') return new DailyNewsError('ALREADY_RUNNING');
  if (error?.code === 'PROVIDER_TIMEOUT') return new DailyNewsError('AI_TIMEOUT');
  if (['NOT_CONFIGURED', 'MASTER_KEY_UNAVAILABLE', 'SECRET_UNREADABLE', 'INVALID_API_KEY', 'INSUFFICIENT_BALANCE',
    'PROVIDER_RATE_LIMIT', 'PROVIDER_NETWORK', 'PROVIDER_UNAVAILABLE', 'PROVIDER_BAD_REQUEST'].includes(error?.code)) {
    return new DailyNewsError('AI_UNAVAILABLE');
  }
  if (['EMPTY_OUTPUT', 'OUTPUT_TOO_LONG', 'INCOMPLETE_STREAM', 'INVALID_PROVIDER_STREAM'].includes(error?.code)) {
    return new DailyNewsError('AI_INVALID_RESPONSE');
  }
  return new DailyNewsError(Object.hasOwn(MESSAGES, error?.code) ? error.code : 'DATABASE_ERROR');
}

module.exports = { DailyNewsError, errorForDailyNews };
