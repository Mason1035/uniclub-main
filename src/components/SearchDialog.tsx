import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import api from '../lib/axios';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import './SearchDialog.css';

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

export default function SearchDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!isOpen || !query.trim()) {
      if (!isOpen) setQuery('');
      setResults([]);
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
        if (!controller.signal.aborted) setResults(data.results || []);
      } catch {
        if (!controller.signal.aborted) { setError(true); setResults([]); }
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }, SEARCH_DELAY);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, isOpen, retry]);

  return <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="search-panel" aria-describedby={undefined} onOpenAutoFocus={event => {
      event.preventDefault();
      input.current?.focus({ preventScroll: true });
    }}>
      <DialogTitle className="search-title">搜索任何内容</DialogTitle>
      <Command shouldFilter={false} label="搜索关键词">
        <div className="search-field">
          <Search className="search-field__icon" aria-hidden="true"/>
          <Command.Input ref={input} value={query} onValueChange={setQuery}
            maxLength={200} placeholder="输入关键词..." className="search-field__input"/>
        </div>
        {query.trim() && <Command.List label="搜索结果" className="search-results" aria-busy={pending}>
          {pending ? <p className="search-status" role="status">正在搜索…</p>
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
            </Command.Item>)}
        </Command.List>}
      </Command>
    </DialogContent>
  </Dialog>;
}
