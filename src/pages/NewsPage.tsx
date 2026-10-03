import { useRef } from 'react';
import { useFlipList } from '../hooks/useFlipList';
import { useQuery } from '@tanstack/react-query';
import { fetchContentPages } from '../lib/contentQuery';
import type { ApiNews } from '../types/content';
import { categoryLabel } from '../lib/contentFormat';
import PageHeading from '../components/PageHeading';
import FilterToolbar from '../components/FilterToolbar';
import ContentState from '../components/ContentState';
import NewsCard from '../components/cards/NewsCard';
import { usePageViewState } from '../hooks/usePageViewState';
export default function NewsPage() {
  const [category,setCategory] = usePageViewState('news-category','全部'); const [limit,setLimit] = usePageViewState('news-visible',10);
  const query = useQuery({queryKey:['news','editorial'],queryFn:({signal}) => fetchContentPages<ApiNews>('/api/news',['news','articles'],signal),staleTime:120000});
  const items = query.data || []; const options = ['全部',...new Set(items.map(item=>item.category).filter(Boolean))].map(value=>({value,label:categoryLabel(value)}));
  const visible = category==='全部' ? items : items.filter(item=>item.category===category);
  const scope = useRef<HTMLDivElement>(null);
  const capture = useFlipList(scope, `${category}|${limit}|${visible.slice(0,limit).map(item => item._id).join(',')}`);
  return <div ref={scope}><PageHeading title="新闻" description="值得关注的新消息，和我们一起阅读。"/><FilterToolbar options={options} value={category} onBeforeChange={()=>capture({leaving:true})} onChange={value=>{setCategory(value);setLimit(10);}} count={visible.length}/><ContentState loading={query.isLoading} error={query.error} empty={!visible.length} emptyTitle="暂无相关新闻" emptyDescription="换个分类看看，或等待新内容发布。" onRetry={()=>void query.refetch()}><div className="article-list">{visible.slice(0,limit).map(article=><NewsCard key={article._id} {...article}/>)}</div>{visible.length>limit && <button className="ed-button secondary mt-6" onClick={()=>{capture();setLimit(limit+10);}}>加载更多新闻</button>}</ContentState></div>;
}
