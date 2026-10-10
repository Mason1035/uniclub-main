import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfMonth, startOfWeek } from 'date-fns';
import PageShell from '../components/PageShell';
import PageHeading from '../components/PageHeading';
import FilterToolbar from '../components/FilterToolbar';
import ContentState from '../components/ContentState';
import EventCard from '../components/cards/EventCard';
import PastEventCard from '../components/cards/PastEventCard';
import CalendarView from '../components/CalendarView';
import { usePageViewState } from '../hooks/usePageViewState';
import { activityApi } from '../lib/activityApi';
import { ACTIVITY_TYPES, activityTypeLabel } from '../lib/activityMeta';
import { listFrom, formatDate } from '../lib/contentFormat';
import { transformToEventCard } from '../utils/eventTransform';
import api from '../lib/axios';
import type { ApiPastEvent } from '../types/content';

function Pages({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button className="ed-button secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一页</button><span className="entry-meta">共 {total} 条 · {page} / {pages}</span><button className="ed-button secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>下一页</button></div>;
}
export default function EventsPage() {
  const [mode, setMode] = usePageViewState<'list' | 'calendar'>('event-mode', 'list');
  const [category, setCategory] = usePageViewState('event-category', '全部');
  const [view, setView] = useState<'upcoming' | 'ongoing'>('upcoming');
  const [search, setSearch] = useState(''); const [keyword, setKeyword] = useState('');
  const [year, setYear] = useState('all'); const [page, setPage] = useState(1); const [pastPage, setPastPage] = useState(1); const [legacyPage, setLegacyPage] = useState(1);
  const [range, setRange] = useState(() => { const first = startOfWeek(startOfMonth(new Date()), { weekStartsOn: 1 }); return { from: first.toISOString(), to: addDays(first, 42).toISOString() }; });
  const changeRange = useCallback((from: string, to: string) => { setRange(previous => previous.from === from && previous.to === to ? previous : { from, to }); setPage(1); }, []);
  const filters = { eventType: category === '全部' ? undefined : category, search: keyword || undefined };
  const query = useQuery({ queryKey: ['events', mode, view, category, keyword, page, mode === 'calendar' ? range : null], queryFn: ({ signal }) => activityApi.list({ ...filters, view: mode === 'calendar' ? 'calendar' : view, page, limit: mode === 'calendar' ? 100 : 12, ...(mode === 'calendar' ? range : {}) }, signal), staleTime: 30000 });
  const past = useQuery({ queryKey: ['events', 'past', category, keyword, year, pastPage], queryFn: ({ signal }) => activityApi.list({ ...filters, view: 'past', year: year === 'all' ? undefined : year, page: pastPage, limit: 12 }, signal), staleTime: 30000 });
  const legacy = useQuery({ queryKey: ['past-events', 'legacy', legacyPage], queryFn: async ({ signal }) => (await api.get('/api/past-events', { params: { page: legacyPage, limit: 8 }, signal })).data, staleTime: 60000 });
  const legacyItems = listFrom<ApiPastEvent>(legacy.data, 'data', 'events');
  const legacyPagination = legacy.data?.pagination;
  const types = new Map(ACTIVITY_TYPES.map(type => [type.value, type.label]));
  for (const type of [...query.data?.types || [], ...past.data?.types || []]) types.set(typeof type === 'string' ? type : type.value, typeof type === 'string' ? activityTypeLabel(type) : type.label);
  if (category !== '全部' && !types.has(category)) types.set(category, activityTypeLabel(category));
  const options = [{ value: '全部', label: '全部类型' }, ...Array.from(types, ([value, label]) => ({ value, label }))];
  const chooseCategory = (value: string) => { setCategory(value); setPage(1); setPastPage(1); };
  return <PageShell className="events-page editorial-content">
    <PageHeading tone="editorial" title="活动日程" description="安排下一次相聚，也回看我们走过的日子。" actions={<div className="filter-options" role="group" aria-label="活动显示方式"><button className="filter-option" aria-pressed={mode === 'list'} onClick={() => { setMode('list'); setPage(1); }}>列表</button><button className="filter-option" aria-pressed={mode === 'calendar'} onClick={() => { setMode('calendar'); setPage(1); }}>月历</button></div>}/>
    <form className="mb-4 flex gap-3" onSubmit={e => { e.preventDefault(); setKeyword(search.trim()); setPage(1); setPastPage(1); }}><input aria-label="搜索活动" placeholder="搜索活动标题或内容" value={search} onChange={e => setSearch(e.target.value)} className="min-h-11 min-w-0 flex-1 border border-border bg-background px-3 text-sm"/><button className="ed-button secondary" type="submit">搜索</button></form>
    <FilterToolbar options={options} value={category} onChange={chooseCategory} label="活动类型筛选"/>
    {mode === 'list' ? <><div className="section-heading"><h2>近期活动</h2><div className="filter-options" role="group" aria-label="近期活动状态"><button className="filter-option" aria-pressed={view === 'upcoming'} onClick={() => { setView('upcoming'); setPage(1); }}>即将开始</button><button className="filter-option" aria-pressed={view === 'ongoing'} onClick={() => { setView('ongoing'); setPage(1); }}>正在进行</button></div></div><ContentState illustration="activity" loading={query.isLoading} error={query.error} empty={!query.data?.events.length} emptyTitle={view === 'ongoing' ? '暂无正在进行的活动' : '暂无即将开始的活动'} onRetry={() => void query.refetch()}><div className="schedule-list">{query.data?.events.map(event => <EventCard key={event._id || event.id} {...transformToEventCard(event)}/>)}</div></ContentState></> : <><ContentState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}/><CalendarView events={query.data?.events || []} onRangeChange={changeRange}/></>}
    {query.data && <Pages page={page} pages={query.data.pagination.pages} total={query.data.pagination.total} onChange={setPage}/>}
    <section className="mt-12" aria-label="往期活动"><div className="section-heading"><h2>往期活动</h2><label className="entry-meta">回溯年份<select aria-label="往期活动年份" className="ml-2 min-h-11 border border-border bg-background px-3" value={year} onChange={e => { setYear(e.target.value); setPastPage(1); }}><option value="all">全部年份</option>{past.data?.years?.map(value => <option key={value} value={value}>{value} 年</option>)}</select></label></div><ContentState illustration="gallery" loading={past.isLoading} error={past.error} empty={!past.data?.events.length} emptyTitle="暂无符合筛选的往期活动" emptyDescription="活动结束后会留在这里；可以调整年份、类型或关键词。" onRetry={() => void past.refetch()}><div className="archive-strip">{past.data?.events.map(event => <article key={event._id || event.id} className="archive-entry"><Link to={`/events/${event._id || event.id}`} state={{ referrer: '/events' }}>{(event.coverUrl || event.imageUrl) ? <img src={event.coverUrl || event.imageUrl} alt={event.title} loading="lazy"/> : <div className="mb-3 flex aspect-[8/5] items-center justify-center bg-secondary text-sm text-muted-foreground">活动记录</div>}<h3>{event.title}</h3></Link><p>{formatDate(event.startDate)} · {activityTypeLabel(event.eventType)}</p><p className="line-clamp-2">{event.summary || event.description}</p></article>)}</div></ContentState>{past.data && <Pages page={pastPage} pages={past.data.pagination.pages} total={past.data.pagination.total} onChange={setPastPage}/>}</section>
    <section className="mt-12" aria-label="历史相册"><div className="section-heading"><h2>历史相册</h2><span className="entry-meta">原有活动记录，继续保留</span></div><ContentState illustration="gallery" loading={legacy.isLoading} error={legacy.error} empty={!legacyItems.length} emptyTitle="暂无历史相册" onRetry={() => void legacy.refetch()}><div className="archive-strip">{legacyItems.map(event => <PastEventCard key={event._id} {...event} id={event._id}/>)}</div></ContentState>{legacyPagination && <Pages page={legacyPage} pages={legacyPagination.pages || legacyPagination.totalPages || 1} total={legacyPagination.total || legacyItems.length} onChange={setLegacyPage}/>}</section>
  </PageShell>;
}
