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
  const [level,setLevel] = usePageViewState('announcement-level','all');
  const query = useQuery({queryKey:['announcements','list'],queryFn:async()=>listFrom<Announcement>((await api.get('/api/announcements?limit=50')).data,'announcements'),staleTime:120000});
  const visible = (query.data||[]).filter(item=>level==='all'||item.level===level);
  const scope = useRef<HTMLDivElement>(null);
  const capture = useFlipList(scope, `${level}|${visible.map(item => item._id).join(',')}`);
  return <div ref={scope}><PageHeading title="班级公告" description="重要事项、班级通知，一处查阅。置顶事项优先显示。"/><FilterToolbar options={[{value:'all',label:'全部'},{value:'urgent',label:'紧急'},{value:'important',label:'重要'},{value:'info',label:'通知'}]} value={level} onBeforeChange={()=>capture({leaving:true})} onChange={setLevel} count={visible.length}/><ContentState loading={query.isLoading} error={query.error} empty={!visible.length} emptyTitle="暂无相关公告" onRetry={()=>void query.refetch()}><div className="announcement-list">{visible.map(item=><AnnouncementCard key={item._id} announcement={item}/>)}</div></ContentState></div>;
}
