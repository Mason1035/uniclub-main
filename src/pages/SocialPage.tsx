import PageShell from '../components/PageShell';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchContentPages } from '../lib/contentQuery';
import type { ApiSocialPost } from '../types/content';
import { usePageViewState } from '../hooks/usePageViewState';
import { useUser } from '../context/userContextState';
import PageHeading from '../components/PageHeading';
import ContentState from '../components/ContentState';
import SocialCard from '../components/cards/SocialCard';
import CreatePostDialog from '../components/CreatePostDialog';
export default function SocialPage() {
  const [create,setCreate]=useState(false);const [limit,setLimit]=usePageViewState('social-visible',10);const {user}=useUser();const query=useQuery({queryKey:['socialPosts'],queryFn:({signal})=>fetchContentPages<ApiSocialPost>('/api/social/posts',['posts'],signal),staleTime:120000});
  return <PageShell className="social-page"><PageHeading tone="signature" title="班级动态" description="分享近况、交流想法，让日常有迹可循。" actions={<button className="ed-button" onClick={()=>setCreate(true)}>发布动态</button>}/><ContentState illustration="pulse" loading={query.isLoading} error={query.error} empty={!query.data?.length} emptyTitle="还没有班级动态" emptyDescription="点击发布动态，和同学分享你的近况。" onRetry={()=>void query.refetch()}><div className="social-feed">{query.data?.slice(0,limit).map(post=><SocialCard key={post._id} id={post._id} userName={post.author?.name||'班级成员'} userAvatar={post.author?.profile?.avatar?.data||null} timestamp={post.createdAt} content={post.content} media={post.media} authorId={post.author?._id||''} currentUserId={user.id}/>)}</div>{(query.data?.length||0)>limit&&<button className="ed-button secondary mt-6" onClick={()=>setLimit(limit+10)}>加载更多动态</button>}</ContentState><CreatePostDialog isOpen={create} onClose={()=>setCreate(false)} onPostCreated={()=>{setCreate(false);void query.refetch();}}/></PageShell>;
}
