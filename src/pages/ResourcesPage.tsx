import PageShell from '../components/PageShell';
import { useRef } from 'react';
import { useFlipList } from '../hooks/useFlipList';
import { useQuery } from '@tanstack/react-query';
import { fetchContentPages } from '../lib/contentQuery';
import type { ApiResource } from '../types/content';
import { formatBytes } from '../lib/contentFormat';
import PageHeading from '../components/PageHeading';
import FilterToolbar from '../components/FilterToolbar';
import ContentState from '../components/ContentState';
import ResourceCard from '../components/cards/ResourceCard';
import { usePageViewState } from '../hooks/usePageViewState';
export default function ResourcesPage() {
  const [category,setCategory] = usePageViewState('resource-category','全部'); const [mode,setMode] = usePageViewState<'list'|'grid'>('resource-mode','list');
  const query=useQuery({queryKey:['resources','editorial'],queryFn:({signal})=>fetchContentPages<ApiResource>('/api/resources?status=approved',['resources'],signal),staleTime:120000});
  const items=query.data||[]; const options=['全部',...new Set(items.map(item=>item.category).filter((v):v is string=>!!v)),'最近'];
  const visible=category==='最近'? [...items].sort((a,b)=>new Date(b.updatedAt||b.createdAt).getTime()-new Date(a.updatedAt||a.createdAt).getTime()).slice(0,10):category==='全部'?items:items.filter(item=>item.category===category);
  const scope = useRef<HTMLDivElement>(null);
  const capture = useFlipList(scope, `${mode}|${category}|${visible.map(item => item._id).join(',')}`);
  return <PageShell ref={scope} className="resource-page editorial-titles"><PageHeading tone="editorial" title="共享资源" description="把好用的工具、课程资料与学习经验放在一起。" actions={<div className="filter-options" role="group" aria-label="资源显示方式"><button className="filter-option" aria-pressed={mode==='list'} onClick={()=>{capture();setMode('list');}}>目录</button><button className="filter-option" aria-pressed={mode==='grid'} onClick={()=>{capture();setMode('grid');}}>分栏</button></div>}/><FilterToolbar options={options} value={category} onBeforeChange={()=>capture({leaving:true})} onChange={setCategory} count={visible.length}/><ContentState illustration="resource" loading={query.isLoading} error={query.error} empty={!visible.length} emptyTitle="暂无相关资源" onRetry={()=>void query.refetch()}><div className={mode==='grid'?'resource-grid':'resource-list'}>{visible.map(item=><ResourceCard key={item._id} id={item._id} {...item} fileSize={formatBytes(item.file?.size)||item.fileSize} updatedAt={item.updatedAt||item.createdAt} author={item.uploadedBy?.name}/>)}</div></ContentState></PageShell>;
}
