import { useId, useMemo, useState } from 'react';
import { ChartColumnIncreasing } from 'lucide-react';
import { axisTicks, timelineBuckets, type TimelineBucket } from './chartMath';
import { useChartReveal } from './useDashboardMotion';
import type { DashboardDays, DashboardTimeline } from './types';
const series = [
  { key:'news', label:'新闻', light:'#c4ddff', fill:'#75b0ff', dark:'#4b87df' },
  { key:'events', label:'活动', light:'#fff3bd', fill:'#ffdb59', dark:'#dcaf2a' },
  { key:'resources', label:'资源', light:'#ffd2cd', fill:'#ff9996', dark:'#df6870' },
] as const;
const dateLabel = (value: string) => value.slice(5).replace('-', '/');
function rangeLabel(row: TimelineBucket) { return row.date === row.endDate ? row.date : `${row.date} 至 ${row.endDate}`; }
export default function ContentTimeline({ timeline, onDaysChange, busy }: { timeline:DashboardTimeline; onDaysChange:(days:DashboardDays)=>void; busy:boolean }) {
  const id=useId().replace(/:/g,'');
  const buckets=useMemo(()=>timelineBuckets(timeline.points),[timeline.points]);
  const ticks=axisTicks(Math.max(0,...buckets.flatMap(row=>[row.news,row.events,row.resources])));
  const maximum=ticks.at(-1)!;
  const [active, setActive]=useState<{index:number;key:typeof series[number]['key']} | null>(null);
  const reveal=useChartReveal(timeline);
  const baseline=205, plotHeight=154, plotWidth=338, step=plotWidth/Math.max(1,buckets.length);
  const width=Math.min(18,(step-14)/3);
  const current=active ? buckets[active.index] : null;
  const missing=timeline.undated.news+timeline.undated.events+timeline.undated.resources;
  return <section className="ch-dash__panel ch-chart ch-chart--bars" data-dashboard-enter aria-labelledby={`${id}-title`} aria-busy={busy}>
    <header className="ch-chart__header"><h2 id={`${id}-title`}><ChartColumnIncreasing/>内容新增情况</h2>
      <label className="ch-chart__range"><span className="sr-only">内容新增统计时间范围</span><select aria-label="内容新增统计时间范围" value={timeline.days} disabled={busy} onChange={event=>{setActive(null);onDaysChange(Number(event.target.value) as DashboardDays);}}>
        <option value={7}>近 7 天</option><option value={30}>近 30 天</option><option value={90}>近 90 天</option>
      </select></label>
    </header>
    <svg className="ch-chart__bars" viewBox="0 0 420 252" aria-label={`近${timeline.days}天内容新增，按创建时间统计，单位：条`}>
      <defs>{series.map(item=><linearGradient key={item.key} id={`${id}-${item.key}`}><stop stopColor={item.light}/><stop offset=".42" stopColor={item.fill}/><stop offset="1" stopColor={item.fill}/></linearGradient>)}</defs>
      <text x="18" y="24" className="ch-chart__unit">条</text>
      {ticks.map(value=>{const y=baseline-value/maximum*plotHeight;return <g key={value}><path d={`M40 ${y}H390`} className="ch-chart__gridline"/><text x="30" y={y+4} textAnchor="end" className="ch-chart__axis">{value}</text></g>;})}
      <path d={`M40 42V${baseline}H390`} className="ch-chart__axis-line"/>
      {buckets.map((bucket,index)=>{
        const x=48+index*step;
        return <g key={bucket.date}>
          <text x={x+step/2-3} y="227" textAnchor="middle" className="ch-chart__axis">{dateLabel(bucket.date)}</text>
          {series.map((item,column)=>{
            const count=bucket[item.key], height=count/maximum*plotHeight;
            const selected=active?.index===index && active.key===item.key;
            return <g key={item.key} transform={`translate(${x+column*(width+3)} ${baseline})`} className="ch-chart__bar-control" tabIndex={0} role="img" aria-label={`${rangeLabel(bucket)}，${item.label}新增 ${count} 条`}
              onPointerEnter={()=>setActive({index,key:item.key})} onPointerLeave={()=>setActive(null)} onFocus={()=>setActive({index,key:item.key})} onBlur={()=>setActive(null)} data-active={selected}>
              {count > 0 && <g className="ch-chart__bar" style={{transform:`scaleY(${height/100*reveal})`}}>
                <path d={`M0 -100H${width}V0H0Z`} fill={`url(#${id}-${item.key})`}/>
                <path d={`M${width} -100L${width+5} -104V-4L${width} 0Z`} fill={item.dark}/>
                <path d={`M0 -100L5 -104H${width+5}L${width} -100Z`} fill={item.light} stroke="rgba(255,255,255,.45)" strokeWidth=".6"/>
                <path d="M1 -98V-3" stroke="white" strokeOpacity=".45"/>
              </g>}
              <rect x="-2" y={-Math.max(12,height+8)} width={width+8} height={Math.max(12,height+8)} fill="transparent" className="ch-chart__bar-hit"><title>{rangeLabel(bucket)} · {item.label}：{count} 条</title></rect>
            </g>;
          })}
        </g>;
      })}
      {buckets.every(row=>row.news+row.events+row.resources===0) && <text x="215" y="116" textAnchor="middle" className="ch-chart__empty-text">此范围暂无新增内容</text>}
    </svg>
    <ul className="ch-chart__series">{series.map(item=><li key={item.key}><i style={{background:item.fill}}/>{item.label}</li>)}</ul>
    <div className="ch-chart__readout" role="status" aria-live="polite">{current && active ? <>{dateLabel(current.date)}{current.endDate!==current.date ? `–${dateLabel(current.endDate)}` : ''} · {series.find(item=>item.key===active.key)?.label} <strong>{current[active.key]}</strong> 条</>
      : `${dateLabel(timeline.startDate)}–${dateLabel(timeline.endDate)} · ${timeline.points.length>7 ? `每组最多 ${Math.ceil(timeline.points.length/7)} 天合计` : '逐日统计'} · 上海时区`}</div>
    {missing>0 && <p className="ch-chart__note">{missing} 条历史内容缺少创建日期，计入总数，不计入趋势。</p>}
    <details className="ch-chart__data"><summary>查看逐日数据</summary><div tabIndex={0} role="region" aria-label="逐日新增数据表"><table><caption>按创建日期统计，上海时区，单位：条</caption><thead><tr><th>日期</th>{series.map(item=><th key={item.key}>{item.label}</th>)}</tr></thead><tbody>{timeline.points.map(row=><tr key={row.date}><th scope="row">{row.date}</th><td>{row.news}</td><td>{row.events}</td><td>{row.resources}</td></tr>)}</tbody></table></div></details>
  </section>;
}
