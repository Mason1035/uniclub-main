import PageShell from '../components/PageShell';
import ResourceQuickAccess from '../components/resources/ResourceQuickAccess';
import '../styles/resources.css';
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
  const [keyword,setKeyword]=usePageViewState('resource-keyword','');
  const items=query.data||[]; const options=['全部',...new Set(items.map(item=>item.category).filter((v):v is string=>!!v)),'最近'];
  const categorized=category==='最近'? [...items].sort((a,b)=>new Date(b.updatedAt||b.createdAt).getTime()-new Date(a.updatedAt||a.createdAt).getTime()).slice(0,10):category==='全部'?items:items.filter(item=>item.category===category);
  const needle=keyword.trim().toLocaleLowerCase();
  const visible=needle?categorized.filter(item=>[item.title,item.description,item.category].some(value=>value?.toLocaleLowerCase().includes(needle))):categorized;
  const scope = useRef<HTMLDivElement>(null);
  const capture = useFlipList(scope, `${mode}|${category}|${keyword}|${visible.map(item => item._id).join(',')}`);
  return <><PageShell ref={scope} className="resource-page editorial-titles"><div className="resource-workspace"><div className="resource-workspace__heading"><PageHeading tone="editorial" title="共享资源" description="把好用的工具、课程资料与学习经验放在一起。" actions={<div className="filter-options" role="group" aria-label="资源显示方式"><button className="filter-option" aria-pressed={mode==='list'} onClick={()=>{capture();setMode('list');}}>目录</button><button className="filter-option" aria-pressed={mode==='grid'} onClick={()=>{capture();setMode('grid');}}>分栏</button></div>}/></div><div className="resource-workspace__content"><div className="resource-search"><label htmlFor="resource-search">在共享资源中查找</label><div><input id="resource-search" type="search" value={keyword} placeholder="搜索标题、说明或分类" onChange={event=>{capture({leaving:true});setKeyword(event.target.value);}}/>{(keyword||category!=='全部')&&<button type="button" className="ed-button secondary" onClick={()=>{capture();setKeyword('');setCategory('全部');}}>清除筛选</button>}</div></div><FilterToolbar options={options} value={category} onBeforeChange={()=>capture({leaving:true})} onChange={setCategory} count={visible.length}/><ContentState illustration="resource" loading={query.isLoading} error={query.error} empty={!visible.length} emptyTitle={needle?'没有匹配的资源':'暂无相关资源'} emptyDescription={needle?'尝试其他关键词，或清除搜索与分类。':'资源发布后会出现在这里。'} onRetry={()=>void query.refetch()}><div className={mode==='grid'?'resource-grid':'resource-list'}>{visible.map(item=><ResourceCard key={item._id} id={item._id} {...item} fileSize={formatBytes(item.file?.size)||item.fileSize} updatedAt={item.updatedAt||item.createdAt} author={item.uploadedBy?.name}/>)}</div></ContentState></div></div></PageShell><ResourceQuickAccess/></>;
}
