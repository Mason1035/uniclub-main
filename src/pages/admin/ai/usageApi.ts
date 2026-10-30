import api from '@/lib/axios';
import type { UserRole } from '@/lib/roles';
import type { AssistantQuota } from '@/lib/memberAssistant';

export interface AssistantUsageTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requests: number;
  unreportedRequests: number;
  webSearchRequests: number;
}
export interface AssistantUsageUser extends AssistantUsageTotals {
  quota?: AssistantQuota;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  lastUsedAt: string | null;
}
export interface AssistantUsageReport {
  users: AssistantUsageUser[];
  totals: AssistantUsageTotals;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export async function getAssistantUsage(params: { page: number; limit: number; search: string }, signal?: AbortSignal): Promise<AssistantUsageReport> {
  return (await api.get('/api/assistant/usage', { params, signal })).data;
}
