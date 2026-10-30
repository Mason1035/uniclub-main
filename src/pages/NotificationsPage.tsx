import { useRef,useState,useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery,useQuery } from '@tanstack/react-query';
import ContentCard from '../components/ContentCard';
import PageShell from '../components/PageShell';
import { usePet } from '../features/pet/PetContext';
import { NOTIFICATION_DEFAULTS,PET_DEFAULTS } from '../features/pet/pet-config';
import type { PetSnapshot } from '../features/pet/types';
import api from '../lib/axios';
import { timeAgo,type Announcement } from '../lib/announcementMeta';
import { listFrom } from '../lib/contentFormat';
import { nextNotificationPage,notificationTarget,uniqueNotifications,type NotificationPage } from '../lib/notificationPresentation';
import PageHeading from '../components/PageHeading';
import ContentState from '../components/ContentState';
import AnnouncementCard from '../components/cards/AnnouncementCard';

const emptySnapshot:PetSnapshot={config:{...PET_DEFAULTS},account:null,error:null,available:false,status:'loading',notifications:{...NOTIFICATION_DEFAULTS}};
const noSubscribe=()=>()=>{};
const emptyGet=()=>emptySnapshot;
export default function NotificationsPage(){
  const {store}=usePet();
  const preferences=useSyncExternalStore(store?.subscribe||noSubscribe,store?.getSnapshot||emptyGet);
  const preferenceKey=JSON.stringify(preferences.notifications);
  const [pending,setPending]=useState<string|null>(null);
  const [error,setError]=useState('');
  const lock=useRef(false);
  const enabled=preferences.available&&preferences.status!=='saving';
  const query=useInfiniteQuery({
    queryKey:['notifications',store?.userId,preferenceKey,'pages'],enabled,initialPageParam:1,
    queryFn:async({pageParam,signal})=>{
      const data=(await api.get('/api/notifications',{params:{page:pageParam,limit:20},signal})).data;
      return {notifications:listFrom(data,'notifications'),pagination:data.pagination} as NotificationPage;
    },
    getNextPageParam:(last,pages)=>nextNotificationPage(last,pages.length),staleTime:30000,
  });
  const items=uniqueNotifications(query.data?.pages||[]);
  const announcements=useQuery({queryKey:['announcements','notifications',store?.userId],enabled:preferences.available&&preferences.notifications.announcements,queryFn:async()=>listFrom<Announcement>((await api.get('/api/announcements?limit=5')).data,'announcements')});
  const unread=useQuery({queryKey:['notification-unread',store?.userId,preferenceKey],enabled,queryFn:async()=>(await api.get('/api/notifications/unread-count')).data.count as number,staleTime:30000});
  const mark=async(id?:string)=>{
    if(lock.current)return;
    lock.current=true;setPending(id||'all');setError('');
    try{await api.put(id?`/api/notifications/${id}/read`:'/api/notifications/read-all');await Promise.all([query.refetch(),unread.refetch()]);}
    catch{setError('未能更新已读状态，请稍后重试。');}
    finally{lock.current=false;setPending(null);}
  };
  return <PageShell className="notifications-page"><PageHeading title="通知" description={unread.data===undefined?'查看班级通知和与你有关的消息。':`你有 ${unread.data} 条未读消息。`} actions={<button className="ed-button secondary" onClick={()=>void mark()} disabled={!!pending||!unread.data}>{pending==='all'?'正在更新…':'全部标为已读'}</button>}/>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <section className="mb-8"><div className="section-heading"><h2>与你有关</h2></div>
      <ContentState illustration="announcement" loading={query.isLoading} error={items.length?undefined:query.error} empty={!items.length} emptyTitle="暂无新通知" onRetry={()=>void query.refetch()}>
        <div className="notification-list">{items.map(item=>{
          const target=notificationTarget(item);
          const articleTitle=typeof item.article==='object'&&item.article?.title;
          return <ContentCard as="article" className="notification-entry" key={item._id}><div className="flex justify-between gap-3 flex-wrap"><h3 className="font-semibold">{item.actor?.displayName||item.actor?.name||'班级成员'}{({comment_reply:'回复了你的评论',comment_like:'赞了你的评论',comment_mention:'在评论中提到了你'} as Record<string,string>)[item.type]||'向你发送了新消息'}</h3><span className="entry-meta">{timeAgo(item.createdAt)}{!item.read&&<span className="status-label important">未读</span>}</span></div>{articleTitle&&<p className="text-sm mt-2">{articleTitle}</p>}{(item.comment?.content||item.comment?.text)&&<p className="entry-description">{item.comment.content||item.comment.text}</p>}<div className="notification-entry__actions">{target?<Link className="text-link min-h-11 text-sm" to={target} state={{referrer:'/notifications'}}>查看相关讨论 ↗</Link>:<span className="entry-meta">原内容已不可用或没有关联入口</span>}{!item.read&&<button className="text-link min-h-11 text-sm" disabled={!!pending} onClick={()=>void mark(item._id)}>{pending===item._id?'正在更新…':'标为已读'}</button>}</div></ContentCard>;
        })}</div>
      </ContentState>
      {items.length>0&&query.isError&&<p className="form-error" role="alert">{query.isFetchNextPageError?'后续通知未能加载，已显示的通知仍可查看。':'通知刷新失败，已显示的通知仍可查看。'}<button className="text-link min-h-11" onClick={()=>void (query.isFetchNextPageError?query.fetchNextPage():query.refetch())}>重新加载</button></p>}
      {query.hasNextPage&&<button className="ed-button secondary mt-5" disabled={query.isFetching||!!pending} onClick={()=>void query.fetchNextPage()}>{query.isFetchingNextPage?'正在加载…':'加载更多通知'}</button>}
    </section>
    {preferences.available&&preferences.notifications.announcements&&<section><div className="section-heading"><h2>近期班级公告</h2></div><ContentState illustration="announcement" loading={announcements.isLoading} error={announcements.error} empty={!announcements.data?.length} emptyTitle="暂无班级公告" onRetry={()=>void announcements.refetch()}><div className="announcement-list">{announcements.data?.map(item=><AnnouncementCard key={item._id} announcement={item}/>)}</div></ContentState></section>}
  </PageShell>;
}
