import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { readToken } from '../lib/session';
interface EngagementData { liked: boolean; saved: boolean; shared: boolean; viewed: boolean; }
interface EngagementStats { totalLikes: number; totalSaves: number; totalShares: number; totalViews: number; totalComments?: number; }
const initial: EngagementData = { liked:false,saved:false,shared:false,viewed:false };
const initialStats: EngagementStats = { totalLikes:0,totalSaves:0,totalShares:0,totalViews:0 };
export const useEngagement = (contentType: string, contentId: string) => {
  const client = useQueryClient(); const lock = useRef(false); const [loading,setLoading] = useState(false); const [error,setError] = useState<string|null>(null);
  const key = ['engagement',contentType,contentId]; const statsKey = ['stats',contentType,contentId];
  const user = useQuery({queryKey:key,enabled:!!contentId && !!readToken(),queryFn:async () => (await api.get(`/api/engagement/user/${contentType}/${contentId}`)).data.engagement as EngagementData,staleTime:30000});
  const counters = useQuery({queryKey:statsKey,enabled:!!contentId,queryFn:async () => (await api.get(`/api/engagement/stats/${contentType}/${contentId}`)).data.stats as EngagementStats,staleTime:30000});
  const engagement = user.data || initial; const stats = counters.data || initialStats;
  const mutate = async (action: 'like'|'save'|'share'): Promise<boolean | undefined> => {
    if (lock.current || !contentId) return;
    if (!readToken()) { setError('请先登录，再进行操作。'); return; }
    lock.current = true; setLoading(true); setError(null);
    await client.cancelQueries({queryKey:key}); await client.cancelQueries({queryKey:statsKey});
    const before = client.getQueryData<EngagementData>(key) || initial; const beforeStats = client.getQueryData<EngagementStats>(statsKey) || initialStats;
    const field = action === 'like' ? 'liked' : action === 'save' ? 'saved' : 'shared'; const count = action === 'like' ? 'totalLikes' : action === 'save' ? 'totalSaves' : 'totalShares';
    const next = action === 'share' ? true : !before[field];
    client.setQueryData(key,{...before,[field]:next}); client.setQueryData(statsKey,{...beforeStats,[count]:Math.max(0,beforeStats[count] + (next ? 1 : -1))});
    try {
      const {data} = await api.post(`/api/engagement/${action}/${contentType}/${contentId}`);
      if (!data.success) throw new Error('操作未完成');
      const actual = action === 'share' ? true : Boolean(data[field]);
      client.setQueryData(key,{...before,[field]:actual});
      void client.invalidateQueries({queryKey:statsKey}); void client.invalidateQueries({queryKey:['savedContent']}); void client.invalidateQueries({queryKey:['savedPosts']}); void client.invalidateQueries({queryKey:[contentType.toLowerCase()]});
      return actual;
    } catch {
      client.setQueryData(key,before); client.setQueryData(statsKey,beforeStats);
      // A comment may have changed while this mutation was pending. Refresh
      // after rollback so the earlier snapshot cannot become a fresh counter.
      void client.invalidateQueries({queryKey:statsKey});
      setError('操作未成功，已恢复原状态，请重试。'); return;
    } finally { lock.current = false; setLoading(false); }
  };
  return {engagement,stats,loading,error,ready:!!user.data && !!counters.data,countersReady:!!counters.data,countersError:counters.isError,toggleLike:() => mutate('like'),toggleSave:() => mutate('save'),recordShare:() => mutate('share'),refetch:() => { void user.refetch(); void counters.refetch(); }};
};
