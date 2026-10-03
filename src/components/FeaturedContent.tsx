import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
interface Featured { _id:string;title:string; }
export default function FeaturedContent() {
  const query=useQuery({queryKey:['featuredContent'],queryFn:async()=>(await api.get('/api/curation/featured')).data.data as {news?:Featured[];events?:Featured[];resources?:Featured[]},staleTime:300000});
  const items=[...(query.data?.news||[]).slice(0,1).map(i=>({...i,url:`/article/${i._id}`,label:'新闻'})),...(query.data?.events||[]).slice(0,1).map(i=>({...i,url:`/event/${i._id}`,label:'活动'})),...(query.data?.resources||[]).slice(0,1).map(i=>({...i,url:`/resource/${i._id}`,label:'资源'}))];
  if (!items.length) return null;
  return <div className="py-4 border-b border-border"><span className="status-label important">内容推荐</span><div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">{items.map(i=><Link className="text-link text-sm" key={i.url} to={i.url}>{i.label} · {i.title}</Link>)}</div></div>;
}
