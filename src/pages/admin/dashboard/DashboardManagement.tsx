import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, FileText, Folder, Info, Settings2, Users, Zap } from 'lucide-react';
import { ROLE_LABELS, roleOf, type RoleIdentity } from '../../../lib/roles';
import type { DashboardStats } from './types';
export default function DashboardManagement({stats,session}:{stats:DashboardStats;session:RoleIdentity|null}) {
  const shortcuts=[{to:'/admin/events',label:'管理活动',Icon:CalendarDays,theme:'green'},{to:'/admin/news',label:'管理新闻',Icon:FileText,theme:'blue'},{to:'/admin/resources',label:'管理资源',Icon:Folder,theme:'coral'},{to:'/admin/members',label:'查看成员',Icon:Users,theme:'purple'}];
  const pending=[{label:'待审核资源',count:stats.breakdown.pendingResources,to:'/admin/resources',theme:'blue'},{label:'待审核新闻',count:stats.breakdown.pendingNews,to:'/admin/news',theme:'coral'},{label:'管理员账号',count:stats.breakdown.admins,to:'/admin/members',theme:'yellow'}];
  return <div className="ch-dash__management">
    <section className="ch-dash__panel ch-dash__module" data-dashboard-enter><header><h2><Zap/>快捷操作</h2></header><div className="ch-dash__shortcuts">{shortcuts.map(({Icon,...item})=><Link className={`ch-shortcut ch-shortcut--${item.theme}`} key={item.to} to={item.to}><span><Icon aria-hidden="true"/></span>{item.label}<ArrowUpRight className="ch-shortcut__arrow" aria-hidden="true"/></Link>)}</div></section>
    <section className="ch-dash__panel ch-dash__module" data-dashboard-enter><header><h2><Clock3/>待处理事项</h2></header><ul className="ch-dash__pending">{pending.map(item=><li key={item.to}><Link to={item.to}><i className={`ch-dash__dot ch-dash__dot--${item.theme}`}/><span>{item.label}</span><strong>{item.count}</strong><ArrowUpRight size={14} aria-hidden="true"/></Link></li>)}</ul></section>
    <section className="ch-dash__panel ch-dash__module" data-dashboard-enter><header><h2><Settings2/>系统状态</h2><span className="ch-dash__verified">身份已验证</span></header><ul className="ch-dash__status"><li><CheckCircle2/><span>已通过{ROLE_LABELS[roleOf(session)]}身份校验</span></li><li><Clock3/><span>数据更新时间：<time dateTime={stats.generatedAt}>{new Date(stats.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}</time></span></li><li><Info/><span>业务管理按身份授权，角色任免与系统配置分别校验权限。</span></li></ul></section>
  </div>;
}
