import { useQuery } from '@tanstack/react-query';
import { BookOpen, Code2, ExternalLink, Github, GraduationCap, Link2 } from 'lucide-react';
import LiquidGlass from '../LiquidGlass';
import { DEFAULT_RESOURCE_QUICK_LINKS, RESOURCE_QUICK_LINKS_QUERY_KEY, resourceQuickLinksApi } from '../../lib/resourceQuickLinks';

const icons = {
  'default-sicnu': GraduationCap,
  'default-github': Github,
  'default-educoder': Code2,
  'default-chaoxing': BookOpen,
};

export default function ResourceQuickAccess() {
  const query = useQuery({
    queryKey: RESOURCE_QUICK_LINKS_QUERY_KEY,
    queryFn: ({ signal }) => resourceQuickLinksApi.list(signal),
    staleTime: 30000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const links = query.data ?? DEFAULT_RESOURCE_QUICK_LINKS;
  return <aside className="resource-quick-access" aria-labelledby="resource-quick-access-title">
    <LiquidGlass as="section" className="content-card resource-quick-access__surface">
      <h2 id="resource-quick-access-title">快捷访问</h2>
      <p className="resource-quick-access__intro">常用的学习平台与开发工具，快速直达。</p>
      <nav aria-label="快捷访问"><ul className="resource-quick-access__list">
        {links.map(link => {
          const Icon = icons[link.id as keyof typeof icons] ?? Link2;
          return <li key={link.id}><a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${link.name}（在新标签页打开）`} className="resource-quick-access__link">
            <span className={`resource-quick-access__icon resource-quick-access__icon--${link.isDefault ? link.id.slice(8) : 'custom'}`} aria-hidden="true"><Icon size={24} strokeWidth={1.6}/></span>
            <span className="resource-quick-access__copy"><strong>{link.name}</strong><span>{link.description || new URL(link.url).hostname}</span></span>
            <ExternalLink size={16} aria-hidden="true" className="resource-quick-access__external"/>
          </a></li>;
        })}
      </ul></nav>
      {query.isPending && <p className="resource-quick-access__state" role="status">正在加载更多链接…</p>}
      {query.isError && <div className="resource-quick-access__state" role="status"><p>{query.data ? '链接未能刷新，当前内容仍可使用。' : '自定义链接暂时无法加载，默认入口仍可使用。'}</p><button type="button" className="text-link min-h-11" disabled={query.isFetching} onClick={() => void query.refetch()}>重新加载</button></div>}
    </LiquidGlass>
  </aside>;
}
