import PageShell from '../components/PageShell';
import { useQuery } from '@tanstack/react-query';
import { useParams,useLocation,Link } from 'react-router-dom';
import api from '../lib/axios';
import { useUser } from '../context/userContextState';
import { useComments } from '../hooks/useComments';
import PageHeading from '../components/PageHeading';
import ContentState from '../components/ContentState';
import BackNavigation from '../components/BackNavigation';
import CommentInput from '../components/CommentInput';
import CommentList from '../components/CommentList';
import EventGallery from '../components/EventGallery';
interface Post {_id:string;title?:string;content?:string;description?:string;excerpt?:string;author?:{name:string};media?:Array<{url:string;type:string}>;}
const endpoints:Record<string,string>={news:'/api/news/',event:'/api/events/',resource:'/api/resources/',social:'/api/social/posts/'};
const links:Record<string,string>={news:'/article/',event:'/event/',resource:'/resource/'};
export default function CommentsPage() {
  const {type='',id=''}=useParams();const location=useLocation();const {user}=useUser();
  const query=useQuery({queryKey:['post',type,id],enabled:!!endpoints[type]&&!!id,queryFn:async()=>{const {data}=await api.get(endpoints[type]+id);return (data.post||data.event||data.resource||data) as Post;}});
  const comments=useComments(type,id);const post=query.data;
  return <PageShell className="reading-page"><BackNavigation contentType={type} referrer={location.state?.referrer}/><PageHeading title="讨论" description="说说你的想法，和同学一起交流。"/><ContentState illustration="pulse" loading={query.isLoading} error={query.error} empty={!post} emptyTitle="找不到相关内容" onRetry={()=>void query.refetch()}>{post&&<><section className="pb-6 border-b border-border mb-6">{type==='social'?<><h2 className="font-bold mb-3">{post.author?.name||'班级成员'}的动态</h2><p className="whitespace-pre-wrap">{post.content}</p>{post.media?.some(m=>m.type==='image')&&<EventGallery title="动态图片" eventId={id} gallery={post.media.filter(m=>m.type==='image').map(m=>({url:m.url}))}/>}<div className="space-y-4 mt-4">{post.media?.filter(m=>m.type==='video').map(m=><video key={m.url} controls playsInline preload="metadata" className="w-full max-h-[60vh]" src={m.url} aria-label="动态视频"/>)}</div></>:<><Link className="text-link text-xl font-bold" to={(links[type]||'/')+id}>{post.title}</Link>{(post.description||post.excerpt)&&<p className="entry-description line-clamp-3">{post.description||post.excerpt}</p>}</>}</section><CommentInput onSubmit={comments.addComment} disabled={query.isLoading} loading={comments.loading}/><div className="section-heading mt-8"><h2>全部评论</h2><span className="entry-meta">{comments.commentCount} 条</span></div>{comments.error&&<div className="content-state" role="alert"><p>评论暂时无法更新，请重试。</p><button className="ed-button secondary" onClick={()=>void comments.refetch()}>重新加载评论</button></div>}<CommentList comments={comments.comments} loading={comments.loading} currentUser={user} onEdit={comments.editComment} onDelete={comments.deleteComment} onLoadMore={()=>void comments.loadMore()} hasMore={comments.hasMore}/></>}</ContentState></PageShell>;
}
