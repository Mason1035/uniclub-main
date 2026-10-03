import type { AnnouncementFormValues, EventFormValues, NewsFormValues, ResourceFormValues } from '../contentValidation';

export type Scenario = 'activity' | 'announcement' | 'news' | 'news_summary' | 'resource' | 'notice' | 'activity_summary' | 'polish' | 'expand' | 'shorten' | 'free' | 'vision';
export type PublishType = 'activity' | 'announcement' | 'news' | 'resource';
export interface AiScenario { key: Scenario; label: string; description: string; publishType?: PublishType; }
export interface AiSettings { configured: boolean; provider: 'deepseek'; model: 'deepseek-flash'; last4: string; updatedAt: string | null; updatedBy: string | null; }
export interface AiStatus extends AiSettings { scenarios: AiScenario[]; limits: { prompt: number; images: number; imageBytes: number; historyMessages: number; historyChars: number; answer: number }; }
export interface AiActivityResult {
  title: string; description: string; startDate: string | null; endDate: string | null;
  location: { type: string | null; address: string; room: string; virtualLink: string };
  eventType: string | null; category: string[]; maxCapacity: number | null; rsvpDeadline: string | null; rsvpLink: string;
}
export interface AiAnnouncementResult { title: string; body: string; level: string; link: string; expiresAt: string | null; }
export interface AiNewsResult { title: string; excerpt: string; content: string; source: string; categories: string[]; }
export interface AiResourceResult { title: string; description: string; type: string | null; category: string | null; linkUrl: string; tags: string[]; }
export interface AiGeneration {
  success: boolean; scenario: Scenario; publishType: PublishType | null; answer: string;
  structured: AiActivityResult | AiAnnouncementResult | AiNewsResult | AiResourceResult | null;
  warning: string | null; elapsedMs: number;
}
export type PublishDraft =
  | { kind: 'activity'; values: EventFormValues }
  | { kind: 'announcement'; values: AnnouncementFormValues }
  | { kind: 'news'; values: NewsFormValues }
  | { kind: 'resource'; values: ResourceFormValues };
export interface HistoryMessage { role: 'user' | 'assistant'; content: string; }
export interface InputImage { id: string; file: File; preview: string; }
export interface PublishedRecord { id: string; kind: PublishType; title: string; viewUrl: string; manageUrl: string; }
export const PUBLICATION_LABELS: Record<PublishType, string> = { activity: '活动', announcement: '公告', news: '新闻', resource: '资源' };
