import type { ReactNode } from 'react';
import EmptyState from './EmptyState';
import type { IllustrationKind } from './Illustration';
export default function ContentState({ loading, error, empty, onRetry, emptyTitle = '暂无内容', emptyDescription = '新内容发布后会出现在这里。', illustration, children }: { loading?: boolean; error?: unknown; empty?: boolean; onRetry?: () => void; emptyTitle?: string; emptyDescription?: string; illustration?: IllustrationKind; children?: ReactNode }) {
  if (loading) return <div className="content-state" role="status" aria-live="polite"><p>正在加载…</p><div className="loading-line"/><div className="loading-line"/></div>;
  if (error) return <div className="content-state" role="alert"><h3>暂时无法加载</h3><p>请检查网络连接，或稍后重试。</p>{onRetry && <button className="ed-button secondary" onClick={onRetry}>重新加载</button>}</div>;
  if (empty) return illustration ? <EmptyState title={emptyTitle} description={emptyDescription} illustration={illustration}/> : <div className="content-state"><h3>{emptyTitle}</h3><p>{emptyDescription}</p></div>;
  return <>{children}</>;
}
