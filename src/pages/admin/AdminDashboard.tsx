import { useEffect, useState } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useAdminSession } from './adminSession';
import { errorMessage, getStats } from './adminApi';
import DashboardCharts from './dashboard/DashboardCharts';
import DashboardMetrics from './dashboard/DashboardMetrics';
import DashboardManagement from './dashboard/DashboardManagement';
import { useDashboardEntrance } from './dashboard/useDashboardMotion';
import type { ContentDatum, DashboardDays, DashboardStats } from './dashboard/types';
import './dashboard/dashboard.css';

function DashboardContent({stats,busy,onDaysChange}:{stats:DashboardStats;busy:boolean;onDaysChange:(days:DashboardDays)=>void}) {
  const root=useDashboardEntrance();
  const session=useAdminSession();
  const content:ContentDatum[]=[{key:'news',label:'新闻',count:stats.news,to:'/admin/news'},{key:'events',label:'活动',count:stats.events,to:'/admin/events'},{key:'resources',label:'资源',count:stats.resources,to:'/admin/resources'}];
  return <div ref={root} className="ch-dash__content"><DashboardMetrics stats={stats}/><DashboardCharts roles={stats.roles} timeline={stats.timeline} content={content} busy={busy} onDaysChange={onDaysChange}/><DashboardManagement stats={stats} session={session}/></div>;
}
function DashboardSkeleton() {
  return <div className="ch-dash__skeleton" role="status" aria-label="正在读取统计数据"><div className="ch-dash__metrics">{[0,1,2,3].map(key=><div key={key} className="ch-dash__placeholder"/>)}</div><div className="ch-dash__charts">{[0,1,2].map(key=><div key={key} className="ch-dash__placeholder ch-dash__placeholder--chart"/>)}</div><span className="sr-only">正在读取统计数据…</span></div>;
}
export default function AdminDashboard() {
  const [days,setDays]=useState<DashboardDays>(30),[refresh,setRefresh]=useState(0);
  const [stats,setStats]=useState<DashboardStats|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
  const session=useAdminSession();
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    setBusy(true);setError('');
    getStats(days,controller.signal).then(result=>{if(active)setStats(result);}).catch(failure=>{if(active&&!controller.signal.aborted)setError(errorMessage(failure));}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;controller.abort();};
  },[days,refresh,session?.id]);
  return <div className="ch-dashboard">
    <header className="ch-dash__heading"><div><h1 className="ch-dash__title">数据概览</h1><p>ClassHub 平台整体运行情况</p></div><button type="button" className="ch-dash__refresh" disabled={busy} onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={17} className={busy?'ch-dash__spin':''}/>{busy?'正在刷新':'刷新数据'}</button></header>
    {error&&<div className="ch-dash__error" role="alert"><TriangleAlert size={20}/><div><strong>{error}</strong>{stats&&<p>正在显示上次成功读取的数据，图表范围为近 {stats.timeline.days} 天。</p>}</div><button type="button" onClick={()=>setRefresh(value=>value+1)} disabled={busy}>重试</button></div>}
    {stats?<DashboardContent stats={stats} busy={busy} onDaysChange={setDays}/>:busy?<DashboardSkeleton/>:null}
    <p className="ch-dash__source">总量包含当前保存的各状态内容；新增趋势按创建日期统计。身份与内容数量均来自后台实时查询。</p>
  </div>;
}
