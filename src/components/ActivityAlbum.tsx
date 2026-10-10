import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../lib/activityApi';
import ContentState from './ContentState';
import EventGallery from './EventGallery';
export default function ActivityAlbum({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['activity-media', id, page], queryFn: ({ signal }) => activityApi.media(id, page, 24, signal), staleTime: 30000, refetchInterval: 240000, refetchOnWindowFocus: true });
  const photos = query.data?.media.filter(media => media.type === 'PHOTO') || [];
  return <section className="mt-10" aria-label="活动照片"><ContentState illustration="gallery" loading={query.isLoading} error={query.error} empty={!photos.length} emptyTitle="活动照片尚未上传" emptyDescription="现场照片会保留在这里，方便日后回顾。" onRetry={() => void query.refetch()}><EventGallery eventId={id} gallery={photos} onRefresh={async () => { await query.refetch(); }}/>{query.data && query.data.pagination.pages > 1 && <div className="mt-5 flex items-center justify-between gap-3"><button className="ed-button secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页照片</button><span className="entry-meta">{page} / {query.data.pagination.pages}</span><button className="ed-button secondary" disabled={page >= query.data.pagination.pages} onClick={() => setPage(value => value + 1)}>下一页照片</button></div>}</ContentState></section>;
}
