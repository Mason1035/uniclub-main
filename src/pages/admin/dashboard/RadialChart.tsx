import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChartPie, Users } from 'lucide-react';
import { percent, sectors, sectorPath } from './chartMath';
import { useChartReveal } from './useDashboardMotion';
import type { ContentDatum, DashboardRole } from './types';

const colors = {
  student: ['#a2eab4','#5fca88','#41a969'], committee: ['#acd1ff','#6aa7f9','#3e7ddd'],
  teacher: ['#dfcaff','#af8be8','#8763c7'], admin: ['#fff1a6','#f8d347','#d8a821'],
  news: ['#b5d6ff','#71a9fa','#3f7cda'], events: ['#fff0a8','#f9d14c','#dbac26'], resources: ['#ffc8c5','#ff8d8c','#e46069'],
};
interface Slice { key: keyof typeof colors; label: string; count: number; to?: string; }
export default function RadialChart({ rows, donut = false }: { rows: Slice[]; donut?: boolean }) {
  const id = useId().replace(/:/g,'');
  const [hovered, setHovered] = useState<string | null>(null), [selected, setSelected] = useState<string | null>(null);
  const active = hovered || selected;
  const progress = useChartReveal();
  const total = rows.reduce((sum,row)=>sum+row.count,0);
  const slices = sectors(rows);
  const activeRow = rows.find(row=>row.key===active);
  const title = donut ? '成员角色分布' : '平台内容构成';
  const toggle = (key: string) => setSelected(current=>current===key ? null : key);
  return <section className={`ch-dash__panel ch-chart ch-chart--${donut ? 'donut' : 'pie'}`} data-dashboard-enter aria-labelledby={`${id}-heading`}>
    <header className="ch-chart__header"><h2 id={`${id}-heading`}>{donut ? <Users/> : <ChartPie/>}{title}</h2>
      <Link className="ch-dash__text-link" to={donut ? '/admin/members' : '/admin/resources'}>查看详情 <ArrowUpRight size={14}/></Link></header>
    {total ? <div className="ch-chart__radial-layout">
      <svg className="ch-chart__radial" viewBox="0 0 260 230" aria-label={`${title}：${rows.map(row=>`${row.label}${row.count}${donut ? '人' : '条'}`).join('，')}`}>
        <defs>
          <radialGradient id={`${id}-ground`}><stop stopColor="#597b59" stopOpacity=".22"/><stop offset="1" stopColor="#597b59" stopOpacity="0"/></radialGradient>
          {rows.map(row=><linearGradient key={row.key} id={`${id}-${row.key}`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor={colors[row.key][0]}/><stop offset=".48" stopColor={colors[row.key][1]}/><stop offset="1" stopColor={colors[row.key][1]}/></linearGradient>)}
        </defs>
        <ellipse cx="131" cy="190" rx="113" ry="26" fill={`url(#${id}-ground)`}/>
        {slices.filter(row=>row.count>0).map(row=>{
          const end = row.start + (row.end-row.start)*progress;
          const path = sectorPath(row.start,end,donut ? 55 : 0);
          const mid=(row.start+row.end)/2;
          const shift=donut ? 0 : 5;
          return <g key={row.key} className="ch-chart__slice" data-active={active===row.key} data-dimmed={Boolean(active && active!==row.key)} style={{ transform: `translate(${Math.cos(mid)*shift}px, ${Math.sin(mid)*shift*.8+(active===row.key ? -5 : 0)}px)` }}
            onPointerEnter={()=>setHovered(row.key)} onPointerLeave={()=>setHovered(null)}>
            <path d={path} transform="translate(0 15)" fill={colors[row.key][2]} aria-hidden="true"/>
            {Array.from({length:14},(_,index)=>14-index).map(depth=><path key={depth} d={path} transform={`translate(0 ${depth})`} fill={colors[row.key][2]} aria-hidden="true"/>)}
            <path d={path} fill={`url(#${id}-${row.key})`} stroke="rgba(255,255,255,.55)" strokeWidth="1.3" fillRule="evenodd" aria-hidden="true"/>
            {row.to ? <Link to={row.to} onFocus={()=>setHovered(row.key)} onBlur={()=>setHovered(null)} aria-label={`${row.label} ${row.count} 条，占 ${percent(row.count,total)}，前往管理`}>
              <path className="ch-chart__hit" d={sectorPath(row.start,row.end,0)} fill="transparent"><title>{row.label}：{row.count} 条（{percent(row.count,total)}）</title></path></Link>
              : <path className="ch-chart__hit" d={sectorPath(row.start,row.end,55)} fill="transparent" tabIndex={0} role="button" aria-pressed={selected===row.key} aria-label={`${row.label} ${row.count} 人，占 ${percent(row.count,total)}，点击突出此身份`}
                onFocus={()=>setHovered(row.key)} onBlur={()=>setHovered(null)} onClick={()=>toggle(row.key)} onKeyDown={event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();toggle(row.key);}}}><title>{row.label}：{row.count} 人（{percent(row.count,total)}）</title></path>}
          </g>;
        })}
        {donut && <g className="ch-chart__center" pointerEvents="none"><text x="130" y="108" textAnchor="middle">{total.toLocaleString('zh-CN')}</text><text x="130" y="131" textAnchor="middle" className="ch-chart__center-label">总人数</text></g>}
      </svg>
      <ul className="ch-chart__legend">{rows.map(row=><li key={row.key}>
        {row.to ? <Link to={row.to} onPointerEnter={()=>setHovered(row.key)} onPointerLeave={()=>setHovered(null)} onFocus={()=>setHovered(row.key)} onBlur={()=>setHovered(null)}><i style={{background:colors[row.key][1]}}/><span>{row.label}</span><strong>{row.count}</strong><small>{percent(row.count,total)}</small></Link>
          : <button type="button" aria-pressed={selected===row.key} onClick={()=>toggle(row.key)} onPointerEnter={()=>setHovered(row.key)} onPointerLeave={()=>setHovered(null)} onFocus={()=>setHovered(row.key)} onBlur={()=>setHovered(null)}><i style={{background:colors[row.key][1]}}/><span>{row.label}</span><strong>{row.count}</strong><small>{percent(row.count,total)}</small></button>}
      </li>)}</ul>
    </div> : <div className="ch-chart__empty"><ChartPie size={36}/><strong>{donut ? '还没有成员账号' : '还没有平台内容'}</strong><span>{donut ? '添加成员后会显示真实身份分布。' : '创建新闻、活动或资源后即可查看占比。'}</span></div>}
    <div className="ch-chart__readout" role="status" aria-live="polite">{activeRow ? <><i style={{background:colors[activeRow.key][1]}}/>{activeRow.label} <strong>{activeRow.count}</strong> {donut ? '人' : '条'} · {percent(activeRow.count,total)}</> : donut ? '按账号当前身份统计 · 点击图例突出分类' : `共 ${total} 条内容 · 点击分类进入管理`}</div>
  </section>;
}
export function RoleDistribution({ roles }: { roles: DashboardRole[] }) {
  return <RadialChart rows={roles.map(row=>({key:row.role,label:row.label,count:row.count}))} donut/>;
}
export function ContentComposition({ content }: { content: ContentDatum[] }) {
  return <RadialChart rows={content} />;
}
