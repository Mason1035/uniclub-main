import type { RegistrationStatus } from '../types/activity';
import metadata from '../../shared/activity-v2.json';

export const ACTIVITY_TYPES = metadata.types;
export const LEGACY_ACTIVITY_TYPES = metadata.legacyTypes.map(type => type.value);
export function activityTypeLabel(value: string): string {
  return ACTIVITY_TYPES.find(type => type.value === value)?.label || metadata.legacyTypes.find(type => type.value === value)?.label || value;
}
export function activityTypeOptions(current?: string) {
  const options: Array<{ value: string; label: string }> = [...ACTIVITY_TYPES];
  if (current && !options.some(type => type.value === current)) options.push({ value: current, label: `保留：${activityTypeLabel(current)}` });
  return options;
}
export const REGISTRATION_LABELS: Record<RegistrationStatus | 'UNREGISTERED', string> = { PENDING: '等待审核', APPROVED: '报名已通过', REJECTED: '报名未通过', CANCELLED: '已取消', UNREGISTERED: '尚未报名' };
export const ACTIVITY_STATUS_LABELS: Record<string, string> = { draft: '草稿', published: '已发布', cancelled: '已取消', completed: '已完成', archived: '已归档' };
export const PHASE_LABELS: Record<string, string> = { UPCOMING: '即将开始', ONGOING: '正在进行', ENDED: '已结束' };
