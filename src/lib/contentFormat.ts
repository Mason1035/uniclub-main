export function formatDate(value?: string, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return '日期未提供';
  return new Date(value).toLocaleDateString('zh-CN', options);
}
export function formatBytes(value?: number | string): string | undefined {
  if (typeof value === 'string') return value || undefined;
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}
export function categoryLabel(value: string): string { return ({ 'AI/ML': '人工智能', Startups: '创业', 'Tech Industry': '科技产业', Gadgets: '数码', IoT: '物联网', Technology: '科技', General: '综合', Workshop: '工作坊', Social: '交流', Academic: '学习', Competition: '比赛' } as Record<string,string>)[value] || value; }
export function listFrom<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') for (const key of keys) { const found = (data as Record<string,unknown>)[key]; if (Array.isArray(found)) return found as T[]; }
  return [];
}
