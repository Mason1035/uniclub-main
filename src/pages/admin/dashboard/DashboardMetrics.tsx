import { Link } from 'react-router-dom';
import MetricIcon from './MetricIcon';
import { useAnimatedCount } from './useDashboardMotion';
import type { DashboardStats } from './types';
function Count({value}:{value:number}) {
  const node=useAnimatedCount(value);
  return <><span ref={node} aria-hidden="true">{value.toLocaleString('zh-CN')}</span><span className="sr-only">{value.toLocaleString('zh-CN')}</span></>;
}
export default function DashboardMetrics({ stats }: { stats:DashboardStats }) {
  const metrics = [
    {key:'users',label:'用户数量',value:stats.users,hint:`其中管理员 ${stats.breakdown.admins} 人`,to:'/admin/members'},
    {key:'events',label:'活动数量',value:stats.events,hint:'包含草稿与已发布活动',to:'/admin/events'},
    {key:'news',label:'新闻数量',value:stats.news,hint:`待审核 ${stats.breakdown.pendingNews} 篇`,to:'/admin/news'},
    {key:'resources',label:'资源数量',value:stats.resources,hint:`待审核 ${stats.breakdown.pendingResources} 个`,to:'/admin/resources'},
  ] as const;
  return <div className="ch-dash__metrics">{metrics.map(metric=><Link key={metric.key} to={metric.to} className={`ch-metric ch-metric--${metric.key}`} data-dashboard-enter aria-label={`${metric.label} ${metric.value}，${metric.hint}，进入管理`}>
    <div className="ch-metric__copy"><h2>{metric.label}</h2><p className="ch-metric__value"><Count value={metric.value}/></p><p className="ch-metric__hint">{metric.hint}</p></div><MetricIcon kind={metric.key}/>
  </Link>)}</div>;
}
