import { useMemo, useRef } from 'react';
import { useCalendarMotion } from '../hooks/useCalendarMotion';
import { Link } from 'react-router-dom';
import { addMonths,addDays,startOfMonth,startOfWeek,isSameDay,isSameMonth,format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft,ChevronRight } from 'lucide-react';
import { usePageViewState } from '../hooks/usePageViewState';
import type { MongoEvent } from '../utils/eventTransform';
import { formatEventLocation } from '../utils/eventTransform';
export default function CalendarView({events}: {events:MongoEvent[]}) {
  const [date,setDate]=usePageViewState('calendar-month',new Date().toISOString()); const [selected,setSelected]=usePageViewState('calendar-day',new Date().toISOString());
  const month=new Date(date); const chosen=new Date(selected); const days=useMemo(()=>{const first=startOfWeek(startOfMonth(new Date(date)),{weekStartsOn:1});return Array.from({length:42},(_,i)=>addDays(first,i));},[date]);
  const eventsOn=(day:Date)=>events.filter(e=>{const start=new Date(e.startDate); const end=new Date(e.endDate||e.startDate); return isSameDay(day,start) || (day>=startOfDay(start)&&day<=startOfDay(end));});
  const agenda=eventsOn(chosen);
  const scope = useRef<HTMLElement>(null);
  const direction = useRef(0);
  useCalendarMotion(scope, date, selected, direction);
  return <section ref={scope} aria-label="活动月历"><div className="calendar-header"><h2 className="text-xl font-bold">{format(month,'yyyy年M月',{locale:zhCN})}</h2><div className="flex gap-2"><button className="icon-control" aria-label="上个月" onClick={()=>{direction.current=-1;setDate(addMonths(month,-1).toISOString());}}><ChevronLeft/></button><button className="filter-option" onClick={()=>{direction.current=0;const now=new Date().toISOString();setDate(now);setSelected(now);}}>今天</button><button className="icon-control" aria-label="下个月" onClick={()=>{direction.current=1;setDate(addMonths(month,1).toISOString());}}><ChevronRight/></button></div></div><div className="calendar-month-body"><div className="grid grid-cols-7">{['一','二','三','四','五','六','日'].map(d=><div key={d} className="calendar-weekday">周{d}</div>)}</div><div className="calendar-grid">{days.map(day=>{const matches=eventsOn(day);return <div key={day.toISOString()} className={`calendar-cell ${isSameMonth(day,month)?'':'calendar-other'}`} data-events={!!matches.length}><button className="calendar-day" aria-pressed={isSameDay(day,chosen)} data-today={isSameDay(day,new Date())} aria-label={`${format(day,'M月d日')}，${matches.length} 个活动`} onClick={()=>setSelected(day.toISOString())}>{format(day,'d')}</button>{matches.slice(0,2).map(e=><Link className="calendar-event" key={e._id||e.id} to={`/event/${e._id||e.id}`}>{e.title}</Link>)}{matches.length>2&&<span className="calendar-event">另有 {matches.length-2} 个活动</span>}</div>;})}</div></div><div className="calendar-agenda" aria-live="polite"><h3 className="font-bold mb-3">{format(chosen,'M月d日 EEEE',{locale:zhCN})}</h3>{agenda.length?agenda.map(e=><div className="py-3 border-b border-border" key={e._id||e.id}><Link className="text-link" to={`/event/${e._id||e.id}`}>{e.title}</Link><p className="entry-meta mt-2">{format(new Date(e.startDate),'HH:mm')} · {formatEventLocation(e.location)}</p></div>):<p className="text-muted-foreground">这一天没有已发布的活动。</p>}</div></section>;
}
function startOfDay(date:Date) { const copy=new Date(date);copy.setHours(0,0,0,0);return copy; }
