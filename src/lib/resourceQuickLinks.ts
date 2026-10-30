import api from './axios';

export interface ResourceQuickLink {
  id: string;
  name: string;
  url: string;
  description: string;
  isDefault: boolean;
}
export interface ResourceQuickLinkInput { name: string; url: string; description: string }

export const RESOURCE_QUICK_LINKS_QUERY_KEY = ['resource-quick-links'] as const;
// Immediate fallback mirrors the immutable defaults owned by the server.
export const DEFAULT_RESOURCE_QUICK_LINKS: ResourceQuickLink[] = [
  { id: 'default-sicnu', name: '四川师范大学官网', url: 'https://authserver.sicnu.edu.cn/', description: '学校平台入口', isDefault: true },
  { id: 'default-github', name: 'GitHub', url: 'https://github.com/', description: '代码托管与项目协作', isDefault: true },
  { id: 'default-educoder', name: '头歌平台', url: 'https://www.educoder.net/', description: '编程实践与课程学习', isDefault: true },
  { id: 'default-chaoxing', name: '学习通', url: 'https://passport2.chaoxing.com/', description: '课程学习与教学资源', isDefault: true },
];

export function validateResourceQuickLink(input: ResourceQuickLinkInput): string {
  if (!input.name.trim()) return '请填写链接名称。';
  if (input.name.trim().length > 60) return '链接名称不能超过 60 字。';
  if (input.description.trim().length > 160) return '链接说明不能超过 160 字。';
  const value = input.url.trim();
  if (!value || value.length > 2048 || Array.from(value).some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return '请填写有效的 HTTP(S) 链接地址。';
  try {
    const url = new URL(value);
    if (!/^https?:\/\//i.test(value) || !['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return '请填写有效的 HTTP(S) 链接地址，不要包含账号或密码。';
  } catch { return '请填写有效的 HTTP(S) 链接地址。'; }
  return '';
}

export const resourceQuickLinksApi = {
  async list(signal?: AbortSignal): Promise<ResourceQuickLink[]> {
    const { data } = await api.get<{ links: ResourceQuickLink[] }>('/api/resource-quick-links', { signal });
    if (!Array.isArray(data?.links)) throw new Error('快捷访问暂时无法加载。');
    for (const link of data.links) {
      if (!link || typeof link.id !== 'string' || typeof link.name !== 'string' || typeof link.url !== 'string' || typeof link.description !== 'string' || typeof link.isDefault !== 'boolean' || validateResourceQuickLink(link)) throw new Error('快捷访问暂时无法加载。');
    }
    return data.links;
  },
  async create(input: ResourceQuickLinkInput): Promise<ResourceQuickLink> {
    const payload = { name: input.name.trim(), url: input.url.trim(), description: input.description.trim() };
    return (await api.post<{ link: ResourceQuickLink }>('/api/admin/resource-quick-links', payload)).data.link;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/api/admin/resource-quick-links/${encodeURIComponent(id)}`);
  },
};
