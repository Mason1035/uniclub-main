import PageShell from '../components/PageShell';
import { useQuery } from '@tanstack/react-query';
import { Link,useNavigate,useLocation } from 'react-router-dom';
import api from '../lib/axios';
import { formatDate } from '../lib/contentFormat';
import { usePageViewState } from '../hooks/usePageViewState';
import PageHeading from '../components/PageHeading';
import FilterToolbar from '../components/FilterToolbar';
import ContentState from '../components/ContentState';
import InteractionButtons from '../components/InteractionButtons';
interface SavedItem {_id:string;title?:string;content?:string;description?:string;excerpt?:string;createdAt?:string;publishedAt?:string;timestamp?:string;startDate?:string;author?:{name?:string};}
type Kind='news'|'events'|'resources'|'social';
const kinds:Kind[]=['news','events','resources','social'];
const labels:Record<Kind,string>={news:'新闻',events:'活动',resources:'资源',social:'动态'};
const types={news:'News',events:'Event',resources:'Resource',social:'SocialPost'} as const;
const paths={news:'/article/',events:'/event/',resources:'/resource/',social:'/comments/social/'};
export default function SavedPostsPage() {
  const [filter,setFilter]=usePageViewState('saved-type','all');const navigate=useNavigate();const location=useLocation();
  const query=useQuery({queryKey:['savedContent'],queryFn:async()=>{try{const {data}=await api.get('/api/engagement/user/saved?limit=100');if(!data.success)throw new Error();return data.content as Record<Kind,SavedItem[]>;}catch{const responses=await Promise.all(kinds.map(kind=>api.get(`/api/engagement/user/saved/${types[kind]}?limit=50`)));return Object.fromEntries(kinds.map((kind,index)=>[kind,responses[index].data.content||[]])) as Record<Kind,SavedItem[]>;}},staleTime:30000});
  const items=kinds.flatMap(kind=>(query.data?.[kind]||[]).map(item=>({...item,kind}))).filter(item=>filter==='all'||item.kind===filter);
  return <PageShell className="saved-page"><PageHeading title="我的收藏" description="把想再读一遍的内容，放在这里。" actions={<button className="ed-button secondary" onClick={()=>void query.refetch()} disabled={query.isFetching}>{query.isFetching?'正在刷新…':'刷新收藏'}</button>}/><FilterToolbar options={[{value:'all',label:'全部'},...kinds.map(value=>({value,label:labels[value]}))]} value={filter} onChange={setFilter} count={items.length}/><ContentState illustration="resource" loading={query.isLoading} error={query.error} empty={!items.length} emptyTitle="暂无相关收藏" emptyDescription="在新闻、活动、资源或动态中点击收藏，便可在这里找到。" onRetry={()=>void query.refetch()}><div className="saved-list">{items.map(item=><article className="news-entry" key={item.kind+item._id}><div className="entry-meta"><span>{labels[item.kind]}</span><time>{formatDate(item.publishedAt||item.createdAt||item.timestamp||item.startDate)}</time></div><h3 className="mt-2"><Link to={paths[item.kind]+item._id} state={{referrer:location.pathname}}>{item.title||item.content?.slice(0,90)||'班级内容'}</Link></h3>{(item.description||item.excerpt)&&<p className="entry-description line-clamp-2">{item.description||item.excerpt}</p>}<InteractionButtons contentType={types[item.kind]} contentId={item._id} shareTitle={item.title||'班级动态'} shareType={item.kind==='events'?'event':item.kind==='resources'?'resource':item.kind} onSave={()=>void query.refetch()} onCommentClick={()=>navigate(`/comments/${item.kind==='events'?'event':item.kind==='resources'?'resource':item.kind}/${item._id}`,{state:{referrer:location.pathname}})}/></article>)}</div></ContentState></PageShell>;
}
