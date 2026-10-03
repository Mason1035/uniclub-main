import type { Scenario } from './types';
import { streamingFields } from './streaming';

const LABELS: Partial<Record<Scenario, [string, string][]>> = {
  activity: [['title', '活动标题'], ['description', '活动介绍']],
  announcement: [['title', '公告标题'], ['body', '公告正文']],
  news: [['title', '新闻标题'], ['excerpt', '新闻摘要'], ['content', '新闻正文'], ['source', '新闻来源']],
  resource: [['title', '资源名称'], ['description', '资源说明'], ['linkUrl', '资源链接']],
};
export default function StreamingPreview({ scenario, text }: { scenario: Scenario; text: string }) {
  const fields = streamingFields(text);
  return <dl className="ai-streaming-preview space-y-5">{LABELS[scenario]?.map(([key, label]) => <div key={key}><dt className="mb-2 text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words border-l-2 border-primary/30 pl-3 text-sm leading-7">{fields[key] || '正在整理…'}</dd></div>)}</dl>;
}
