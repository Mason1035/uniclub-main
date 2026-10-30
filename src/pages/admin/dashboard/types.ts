import type { UserRole } from '../../../lib/roles';
export type DashboardDays = 7 | 30 | 90;
export interface DashboardRole { role: UserRole; label: string; count: number; }
export interface TimelinePoint { date: string; news: number; events: number; resources: number; }
export interface DashboardTimeline {
  days: DashboardDays;
  timeZone: 'Asia/Shanghai';
  basis: 'createdAt';
  startDate: string;
  endDate: string;
  points: TimelinePoint[];
  undated: { news: number; events: number; resources: number };
}
export interface ContentDatum { key: 'news' | 'events' | 'resources'; label: string; count: number; to: string; }
export interface DashboardStats {
  users: number; events: number; news: number; resources: number;
  breakdown: { admins: number; pendingResources: number; pendingNews: number };
  roles: DashboardRole[];
  timeline: DashboardTimeline;
  generatedAt: string;
}
