import PageShell from '../components/PageShell';
import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { fetchContentPages } from '../lib/contentQuery';
import { listFrom,categoryLabel } from '../lib/contentFormat';
import type { ApiPastEvent } from '../types/content';
import { type MongoEvent,transformToEventCard } from '../utils/eventTransform';
import PageHeading from '../components/PageHeading';
import FilterToolbar from '../components/FilterToolbar';
import ContentState from '../components/ContentState';
import EventCard from '../components/cards/EventCard';
import PastEventCard from '../components/cards/PastEventCard';
import CalendarView from '../components/CalendarView';
import { usePageViewState } from '../hooks/usePageViewState';
export default function EventsPage() {
  const [mode,setMode]=usePageViewState<'list'|'calendar'>('event-mode','list'); const [category,setCategory]=usePageViewState('event-category','全部');
  const query=useQuery({queryKey:['events','editorial'],queryFn:({signal})=>fetchContentPages<MongoEvent>('/api/events?upcoming=false&status=published',['events'],signal),staleTime:60000});
  const past=useQuery({queryKey:['past-events'],queryFn:async()=>listFrom<ApiPastEvent>((await api.get('/api/past-events')).data,'data','events'),staleTime:120000});
  const items=query.data||[]; const options=['全部',...new Set(items.map(e=>e.eventType).filter(Boolean))].map(value=>({value,label:categoryLabel(value)})); const visible=items.filter(e=>category==='全部'||e.eventType===category); const upcoming=visible.filter(e=>new Date(e.endDate||e.startDate).getTime()>=Date.now());
  const scope = useRef<HTMLDivElement>(null);
  const previousMode = useRef(mode);
  useGSAP(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    const media = gsap.matchMedia();
    media.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
      if (conditions?.reduce || scope.current?.querySelector('.content-state')) return;
      gsap.fromTo(scope.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, clearProps: 'opacity,visibility' });
    }, scope);
    return () => media.revert();
  }, { scope, dependencies: [mode], revertOnUpdate: true });
  return <PageShell className="events-page"><PageHeading title="活动日程" description="看好时间地点，把下一次相聚安排进日历。" actions={<div className="filter-options" role="group" aria-label="活动显示方式"><button className="filter-option" aria-pressed={mode==='list'} onClick={()=>setMode('list')}>列表</button><button className="filter-option" aria-pressed={mode==='calendar'} onClick={()=>setMode('calendar')}>月历</button></div>}/><FilterToolbar options={options} value={category} onChange={setCategory} count={mode==='calendar'?visible.length:upcoming.length}/><div ref={scope}><ContentState illustration="activity" loading={query.isLoading} error={query.error} empty={mode==='list'&&!upcoming.length} emptyTitle="暂无即将进行的活动" onRetry={()=>void query.refetch()}>{mode==='calendar'?<CalendarView events={visible}/>:<div className="schedule-list">{upcoming.map(e=><EventCard key={e._id||e.id} {...transformToEventCard(e)}/>)}</div>}</ContentState></div><section className="mt-12"><div className="section-heading"><h2>往期活动</h2><span className="entry-meta">把相聚留在这里</span></div><ContentState illustration="gallery" loading={past.isLoading} error={past.error} empty={!past.data?.length} emptyTitle="暂无往期活动" onRetry={()=>void past.refetch()}><div className="archive-strip">{past.data?.map(e=><PastEventCard key={e._id} {...e} id={e._id}/>)}</div></ContentState></section></PageShell>;
}
