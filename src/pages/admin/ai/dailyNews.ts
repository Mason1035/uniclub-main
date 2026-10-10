import api from '@/lib/axios';
import { aiErrorMessage } from './api';

export type DailyNewsCategory = 'ai' | 'technology' | 'software' | 'science' | 'education';
export type DailyNewsPhase = 'pending' | 'searching' | 'generating' | 'validating' | 'publishing' | 'success' | 'failed';
export interface DailyNewsConfig {
  enabled: boolean;
  time: string;
  timezone: 'Asia/Shanghai';
  articleCount: number;
  categories: DailyNewsCategory[];
  webSearch: boolean;
  reasoning: 'auto' | 'high';
}
export interface DailyNewsJob {
  _id: string;
  automationDate?: string;
  date?: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: DailyNewsPhase;
  articleCount: number;
  searchPerformed: boolean;
  searchResultCount: number;
  sourcesUsed: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}
export interface DailyNewsState {
  settings: DailyNewsConfig;
  activeBatchId: string | null;
  activeDate: string | null;
  lastRun: DailyNewsJob | null;
  nextRun: string | null;
  history: DailyNewsJob[];
  running: boolean;
  ai: { configured: boolean; provider: string; model: string };
  search: {
    provider: string;
    configured: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
    searchPerformed?: boolean;
    resultCount?: number;
    checkedAt?: string | null;
    checkedFeeds?: number;
    failedFeeds?: number;
    publisherCount?: number;
    primaryCount?: number;
    failureStage?: string;
  };
}

export const DAILY_NEWS_CATEGORIES: { value: DailyNewsCategory; label: string }[] = [
  { value: 'ai', label: '人工智能' },
  { value: 'technology', label: '科技' },
  { value: 'software', label: '软件工程' },
  { value: 'science', label: '科学' },
  { value: 'education', label: '教育' },
];
export const DAILY_NEWS_PHASES: Record<DailyNewsPhase, string> = {
  pending: '等待开始', searching: '正在联网搜索', generating: '正在整理新闻',
  validating: '正在核验来源', publishing: '正在发布', success: '成功', failed: '失败',
};
const ERROR_MESSAGES: Record<string, string> = {
  SEARCH_UNAVAILABLE: '联网搜索失败，请检查系统搜索服务后重试。',
  SEARCH_NO_RESULTS: '文章检索和实时新闻订阅均未找到符合时效要求的来源，本次未发布。',
  AI_UNAVAILABLE: 'AI 服务暂时不可用，请检查系统 AI Assistant 配置。',
  AI_TIMEOUT: 'AI 请求超时，请稍后重试。',
  AI_INVALID_RESPONSE: 'AI 返回的新闻格式不完整，本次未发布。',
  INSUFFICIENT_SOURCES: '可靠来源不足，暂时无法生成完整的每日新闻。',
  VALIDATION_FAILED: '新闻或来源未通过核验，本次未发布。',
  DATABASE_ERROR: '保存新闻失败，请稍后重试。',
  ALREADY_RUNNING: '已有每日新闻任务正在运行，请等待完成。',
};

export function dailyNewsError(error: unknown): string {
  const shaped = error as { response?: { data?: { code?: string; errorCode?: string; error?: string } } };
  const code = shaped?.response?.data?.errorCode || shaped?.response?.data?.code;
  return code && ERROR_MESSAGES[code] || aiErrorMessage(error);
}
export function dailyNewsJobError(job: Pick<DailyNewsJob, 'errorCode' | 'errorMessage'>): string {
  return job.errorCode && ERROR_MESSAGES[job.errorCode]
    || (job.errorMessage && /[\u4e00-\u9fff]/.test(job.errorMessage) ? job.errorMessage : '任务未完成，请检查 AI 和联网搜索服务后重试。');
}
export function dailyNewsTime(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value));
}
export function shanghaiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
export function todayHasDailyNews(state: DailyNewsState, now = new Date()): boolean {
  const today = shanghaiDate(now);
  return state.activeDate === today || state.history.some(job => job.status === 'success' && (job.automationDate || job.date) === today);
}

export const getDailyNews = async (signal?: AbortSignal): Promise<DailyNewsState> =>
  (await api.get('/api/admin/ai/daily-news', { signal })).data;
export const saveDailyNews = async (settings: DailyNewsConfig): Promise<void> => {
  await api.put('/api/admin/ai/daily-news', settings);
};
export const runDailyNews = async (force: boolean): Promise<{ started: boolean; alreadySucceeded?: boolean; job?: DailyNewsJob }> =>
  (await api.post('/api/admin/ai/daily-news/run', { confirm: true, force })).data;
