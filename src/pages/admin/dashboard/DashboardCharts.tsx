import { RoleDistribution, ContentComposition } from './RadialChart';
import ContentTimeline from './ContentTimeline';
import type { ContentDatum, DashboardDays, DashboardRole, DashboardTimeline } from './types';
import './dashboard-charts.css';
export default function DashboardCharts({ roles, timeline, content, onDaysChange, busy }: {
  roles:DashboardRole[]; timeline:DashboardTimeline; content:ContentDatum[]; onDaysChange:(days:DashboardDays)=>void; busy:boolean;
}) {
  return <div className="ch-dash__charts"><RoleDistribution roles={roles}/><ContentTimeline timeline={timeline} onDaysChange={onDaysChange} busy={busy}/><ContentComposition content={content}/></div>;
}
