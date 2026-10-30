import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import api from '../../lib/axios';

interface Result {
  id: string;
  type: 'announcement' | 'news' | 'event' | 'pastEvent' | 'resource' | 'social';
  title: string;
  description?: string;
  url: string;
}
const labels: Record<Result['type'], string> = {
  announcement: '公告', news: '新闻', event: '活动', pastEvent: '往期活动', resource: '资源', social: '班级动态',
};
const SEARCH_DELAY = 200;
const RESULT_LIMIT = 12;
export default function SiteSearchContent({ active, onClose }: { active: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [selectedResult, setSelectedResult] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const hasQuery = Boolean(query.trim());

  const changeQuery = (value: string) => {
    setQuery(value);
    setResults([]);
    setSelectedResult('');
    setPending(Boolean(value.trim()));
    setError(false);
  };

  useEffect(() => {
    if (!active || !query.trim()) {
      if (!active) setQuery('');
      setResults([]);
      setSelectedResult('');
      setPending(false);
      setError(false);
      return;
    }
    const controller = new AbortController();
    setPending(true);
    setError(false);
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api.get('/api/search', {
          params: { q: query.trim(), limit: RESULT_LIMIT }, signal: controller.signal,
        });
        if (!controller.signal.aborted) setResults(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!controller.signal.aborted) { setError(true); setResults([]); }
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }, SEARCH_DELAY);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, active, retry]);

  return <div className="assistant-site-search">
      <Command shouldFilter={false} label="搜索关键词" value={selectedResult} onValueChange={setSelectedResult}>
        <div className="search-field">
          <Search className="search-field__icon" aria-hidden="true"/>
          <Command.Input value={query} onValueChange={changeQuery}
            aria-label="搜索本站内容" maxLength={200} placeholder="输入关键词..." className="search-field__input"/>
        </div>
        {/* cmdk reads its list ref when updating selection, even for an empty
            query. Keep the list mounted so it always receives a NodeList. */}
        <Command.List label="搜索结果" className="search-results" hidden={!hasQuery} aria-busy={pending}>
          {hasQuery && (pending ? <p className="search-status" role="status">正在搜索…</p>
            : error ? <div className="search-status" role="alert">
              <p>搜索暂时不可用，请稍后重试。</p>
              <button className="ed-button secondary mt-3" onClick={() => setRetry(n => n + 1)}>重新搜索</button>
            </div>
            : !results.length ? <Command.Empty className="search-status">未找到相关内容</Command.Empty>
            // Preserve the API's global relevance order; regrouping by type would
            // incorrectly move weaker hits ahead of stronger hits in other types.
            : results.map(result => <Command.Item key={`${result.type}:${result.id}`}
              value={`${result.type}:${result.id}`} className="search-result"
              onSelect={() => { onClose(); navigate(result.url); }}>
              <div>
                <span className="search-result__type">{labels[result.type] || '内容'}</span>
                <h3>{result.title}</h3>
                {result.description && <p className="line-clamp-2">{result.description}</p>}
              </div>
            </Command.Item>))}
        </Command.List>
      </Command>
  </div>;
}
