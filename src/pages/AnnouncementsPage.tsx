import PageShell from '../components/PageShell';
import { Link, useSearchParams } from 'react-router-dom';
import { useRef } from 'react';
import { useFlipList } from '../hooks/useFlipList';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { type Announcement } from '../lib/announcementMeta';
import { listFrom } from '../lib/contentFormat';
import PageHeading from '../components/PageHeading';
import FilterToolbar from '../components/FilterToolbar';
import ContentState from '../components/ContentState';
import AnnouncementCard from '../components/cards/AnnouncementCard';
import { usePageViewState } from '../hooks/usePageViewState';
export default function AnnouncementsPage() {
  const [search] = useSearchParams();
  const noticeId = search.get('notice');
  const detail = useQuery({
    queryKey: ['announcements', 'detail', noticeId], enabled: !!noticeId,
    queryFn: async ({ signal }) => (await api.get(`/api/announcements/${encodeURIComponent(noticeId!)}`, { signal })).data as Announcement,
    staleTime: 60000, retry: false,
  });
  const [level,setLevel] = usePageViewState('announcement-level','all');
  const query = useQuery({queryKey:['announcements','list'],enabled:!noticeId,queryFn:async()=>listFrom<Announcement>((await api.get('/api/announcements?limit=50')).data,'announcements'),staleTime:120000});
  const visible = (query.data||[]).filter(item=>level==='all'||item.level===level);
  const scope = useRef<HTMLDivElement>(null);
  const capture = useFlipList(scope, `${level}|${visible.map(item => item._id).join(',')}`);
  if (noticeId) {
    const missing = detail.isError && (detail.error as {response?:{status?:number}})?.response?.status === 404;
    return <PageShell className="announcement-page editorial-content">
      <PageHeading tone="editorial" title="公告详情" description="查看这条班级通知的完整安排。" actions={<Link className="text-link min-h-11 inline-flex items-center" to="/announcements">全部公告 ↗</Link>}/>
      <ContentState illustration="announcement" loading={detail.isLoading} error={missing ? undefined : detail.error} empty={missing || !detail.data} emptyTitle="这条公告已撤下或过期" onRetry={() => void detail.refetch()}>
        {detail.data && <AnnouncementCard announcement={detail.data}/>}
      </ContentState>
    </PageShell>;
  }
  return <PageShell ref={scope} className="announcement-page editorial-content"><PageHeading tone="editorial" title="班级公告" description="重要事项、班级通知，一处查阅。置顶事项优先显示。"/><FilterToolbar options={[{value:'all',label:'全部'},{value:'urgent',label:'紧急'},{value:'important',label:'重要'},{value:'info',label:'通知'}]} value={level} onBeforeChange={()=>capture({leaving:true})} onChange={setLevel} count={visible.length}/><ContentState illustration="announcement" loading={query.isLoading} error={query.error} empty={!visible.length} emptyTitle="暂无相关公告" onRetry={()=>void query.refetch()}><div className="announcement-list">{visible.map(item=><AnnouncementCard key={item._id} announcement={item}/>)}</div></ContentState></PageShell>;
}
