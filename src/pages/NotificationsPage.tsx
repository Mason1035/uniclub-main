import ContentCard from '../components/ContentCard';
import PageShell from '../components/PageShell';
import { useSyncExternalStore } from 'react';
import { usePet } from '../features/pet/PetContext';
import { NOTIFICATION_DEFAULTS, PET_DEFAULTS } from '../features/pet/pet-config';
import type { PetSnapshot } from '../features/pet/types';
const emptySnapshot: PetSnapshot = { config: { ...PET_DEFAULTS }, account: null, error: null, available: false, status: 'loading', notifications: { ...NOTIFICATION_DEFAULTS } };
const noSubscribe = () => () => {};
const emptyGet = () => emptySnapshot;
import { useRef,useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { timeAgo,type Announcement } from '../lib/announcementMeta';
import { listFrom } from '../lib/contentFormat';
import PageHeading from '../components/PageHeading';
import ContentState from '../components/ContentState';
import AnnouncementCard from '../components/cards/AnnouncementCard';
interface Notification {_id:string;type:string;actor?:{name:string;displayName?:string};comment?:{content?:string;text?:string};article?:{title:string};read:boolean;createdAt:string;}
export default function NotificationsPage() {
  const {store}=usePet();
  const preferences=useSyncExternalStore(store?.subscribe||noSubscribe,store?.getSnapshot||emptyGet);
  const preferenceKey=JSON.stringify(preferences.notifications);
  const [pending,setPending]=useState<string|null>(null);const [error,setError]=useState('');const lock=useRef(false);
  const query=useQuery({queryKey:['notifications',store?.userId,preferenceKey],enabled:preferences.available&&preferences.status!=='saving',queryFn:async()=>listFrom<Notification>((await api.get('/api/notifications')).data,'notifications'),staleTime:30000});
  const announcements=useQuery({queryKey:['announcements','notifications'],enabled:preferences.available&&preferences.notifications.announcements,queryFn:async()=>listFrom<Announcement>((await api.get('/api/announcements?limit=5')).data,'announcements')});
  const unread=useQuery({queryKey:['notification-unread',store?.userId,preferenceKey],enabled:preferences.available&&preferences.status!=='saving',queryFn:async()=>(await api.get('/api/notifications/unread-count')).data.count as number,staleTime:30000});
  const mark=async(id?:string)=>{if(lock.current)return;lock.current=true;setPending(id||'all');setError('');try{await api.put(id?`/api/notifications/${id}/read`:'/api/notifications/read-all');await Promise.all([query.refetch(),unread.refetch()]);}catch{setError('未能更新已读状态，请稍后重试。');}finally{lock.current=false;setPending(null);}};
  return <PageShell className="notifications-page"><PageHeading title="通知" description={unread.data===undefined?'查看班级通知和与你有关的消息。':`你有 ${unread.data} 条未读消息。`} actions={<button className="ed-button secondary" onClick={()=>void mark()} disabled={!!pending||!unread.data}>{pending==='all'?'正在更新…':'全部标为已读'}</button>}/>{error&&<p className="form-error" role="alert">{error}</p>}<section className="mb-8"><div className="section-heading"><h2>与你有关</h2></div><ContentState illustration="announcement" loading={query.isLoading} error={query.error} empty={!query.data?.length} emptyTitle="暂无新通知" onRetry={()=>void query.refetch()}><div className="notification-list">{query.data?.map(item=><ContentCard as="article" className="notification-entry" key={item._id}><div className="flex justify-between gap-3 flex-wrap"><h3 className="font-semibold">{item.actor?.displayName||item.actor?.name||'班级成员'}{({comment_reply:'回复了你的评论',comment_like:'赞了你的评论',comment_mention:'在评论中提到了你'} as Record<string,string>)[item.type]||'向你发送了新消息'}</h3><span className="entry-meta">{timeAgo(item.createdAt)}{!item.read&&<span className="status-label important">未读</span>}</span></div>{item.article?.title&&<p className="text-sm mt-2">{item.article.title}</p>}{(item.comment?.content||item.comment?.text)&&<p className="entry-description">{item.comment.content||item.comment.text}</p>}{!item.read&&<button className="text-link min-h-11 text-sm" disabled={!!pending} onClick={()=>void mark(item._id)}>{pending===item._id?'正在更新…':'标为已读'}</button>}</ContentCard>)}</div></ContentState></section>{preferences.available&&preferences.notifications.announcements&&<section><div className="section-heading"><h2>近期班级公告</h2></div><ContentState illustration="announcement" loading={announcements.isLoading} error={announcements.error} empty={!announcements.data?.length} emptyTitle="暂无班级公告" onRetry={()=>void announcements.refetch()}><div className="announcement-list">{announcements.data?.map(item=><AnnouncementCard key={item._id} announcement={item}/>)}</div></ContentState></section>}</PageShell>;
}
