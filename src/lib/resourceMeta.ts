/**
 * ClassHub 资源元数据 —— 后台与前台共用，避免两边各写一份枚举。
 *
 * 两个维度是正交的：
 *   type     = 资源形态（文档 / 教程 / 工具 / 视频）
 *   category = 业务分类（AI工具 / GitHub项目 / 比赛 / 证书 / 学习网站 / 开发工具）
 * 例如「某开源项目的使用教程」= type: Tutorial, category: GitHub项目。
 */

export const RESOURCE_TYPES = ['Document', 'Tutorial', 'Tool', 'Video'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  Document: '文档',
  Tutorial: '教程',
  Tool: '工具',
  Video: '视频',
};

export const RESOURCE_CATEGORIES = [
  'AI工具',
  'GitHub项目',
  '比赛',
  '证书',
  '学习网站',
  '开发工具',
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

/** 业务分类的说明与强调色 */
export const RESOURCE_CATEGORY_META: Record<string, { description: string; tone: string }> = {
  AI工具: { description: '对话、绘图、写作等 AI 工具', tone: 'text-violet-500' },
  GitHub项目: { description: '值得阅读与参与的开源项目', tone: 'text-slate-500' },
  比赛: { description: '竞赛、黑客松与报名信息', tone: 'text-amber-500' },
  证书: { description: '认证路径与备考资料', tone: 'text-emerald-500' },
  学习网站: { description: '课程、文档与练习平台', tone: 'text-sky-500' },
  开发工具: { description: '编辑器、CLI 与效率工具', tone: 'text-rose-500' },
};

export const resourceTypeLabel = (type?: string): string =>
  (type && RESOURCE_TYPE_LABELS[type]) || type || '—';

export const resourceCategoryDescription = (category?: string): string =>
  (category && RESOURCE_CATEGORY_META[category]?.description) || '';
