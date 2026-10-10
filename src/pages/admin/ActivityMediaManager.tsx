import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { activityApi, activityError } from '../../lib/activityApi';
import { ACTIVITY_IMAGE_ACCEPT, putActivityImage, validateActivityImage } from '../../lib/activityUpload';
import { needsNewActivityUpload } from '../../lib/activityMediaPolicy';
import type { ActivityMedia, ActivityUpload } from '../../types/activity';
import { AdminButton, EmptyState, ErrorState, LoadingState, Modal, Pagination, Panel } from './components';
import EventGallery from '../../components/EventGallery';

interface UploadJob { key: string; file: File; preview: string; type: 'COVER' | 'PHOTO'; session?: ActivityUpload; transferred?: boolean; progress: number; state: 'ready' | 'uploading' | 'done' | 'error'; error?: string }
export default function ActivityMediaManager({ id, active, coverUrl, coverMediaId, onChanged }: { id: string; active: boolean; coverUrl?: string | null; coverMediaId?: string | null; onChanged: () => void }) {
  const client = useQueryClient(); const [page, setPage] = useState(1); const [jobs, setJobs] = useState<UploadJob[]>([]); const [busy, setBusy] = useState(false); const [batchBusy, setBatchBusy] = useState(false); const [error, setError] = useState(''); const [deleting, setDeleting] = useState<ActivityMedia | null>(null);
  const mounted = useRef(true);
  const abort = useRef<AbortController | null>(null); const locked = useRef(false); const previews = useRef<string[]>([]);
  const query = useQuery({ queryKey: ['activity-media', id, page], enabled: active, queryFn: ({ signal }) => activityApi.media(id, page, 24, signal), staleTime: 15000, refetchInterval: active ? 240000 : false, refetchOnWindowFocus: true });
  const photos = query.data?.media.filter(media => media.type === 'PHOTO') || [];
  useEffect(() => { mounted.current = true; const urls = previews.current; return () => { mounted.current = false; abort.current?.abort(); urls.forEach(url => URL.revokeObjectURL(url)); }; }, []);
  const refresh = () => { void client.invalidateQueries({ queryKey: ['activity-media', id] }); onChanged(); };
  const patch = (key: string, values: Partial<UploadJob>) => setJobs(previous => previous.map(job => job.key === key ? { ...job, ...values } : job));
  const upload = async (job: UploadJob) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); patch(job.key, { state: 'uploading', error: '' });
    const controller = new AbortController(); abort.current = controller;
    let session = job.session; let transferred = job.transferred;
    try {
      if (!session) { session = await activityApi.initUpload(id, job.file, job.type); patch(job.key, { session }); }
      if (!transferred) { await putActivityImage(job.file, session, controller.signal, progress => patch(job.key, { progress })); transferred = true; patch(job.key, { transferred: true }); }
      await activityApi.completeUpload(id, session.upload.id);
      patch(job.key, { state: 'done', progress: 100 }); refresh();
    } catch (cause) {
      const code = (cause as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const expired = needsNewActivityUpload(cause) || (!transferred && session && Date.parse(session.upload.expiresAt) <= Date.now());
      patch(job.key, { state: 'error', ...(expired ? { session: undefined, transferred: false, progress: 0 } : {}), error: controller.signal.aborted ? '上传已取消，可以重试。' : `${transferred && !expired ? '图片已传输，尚未确认保存；重试会继续确认。' : ''}${expired ? '重试将重新授权上传；如为封面替换，请确认当前封面。' : ''}${activityError(cause)}` });
      if (expired) { void query.refetch(); onChanged(); }
    } finally { locked.current = false; setBusy(false); }
  };
  const pick = async (files: FileList | null, type: 'COVER' | 'PHOTO') => {
    if (!files || busy || batchBusy) return;
    setError(''); const chosen = Array.from(files);
    if (chosen.length > 20) { setError('每次最多选择 20 张照片。'); return; }
    const next: UploadJob[] = [];
    for (const file of chosen) {
      try { await validateActivityImage(file); if (!mounted.current) return; const preview = URL.createObjectURL(file); previews.current.push(preview); next.push({ key: crypto.randomUUID(), file, preview, type, progress: 0, state: 'ready' }); }
      catch (cause) { setError(`${file.name}：${activityError(cause)}`); }
    }
    if (mounted.current) setJobs(previous => [...previous, ...next]);
  };
  const uploadAll = async () => { setBatchBusy(true); try { for (const job of jobs.filter(item => item.state !== 'done')) { await upload(job); if (abort.current?.signal.aborted) break; } } finally { setBatchBusy(false); } };
  const remove = async () => { if (!deleting || locked.current) return; locked.current = true; setBusy(true); try { if (deleting.id === 'legacy-cover') await activityApi.clearCover(id, query.data?.version || 0); else await activityApi.deleteMedia(id, deleting.id); setDeleting(null); refresh(); } catch (cause) { setError(activityError(cause)); } finally { locked.current = false; setBusy(false); } };
  const order = async (index: number, direction: number) => {
    if (locked.current || !query.data) return;
    const ids = photos.map(photo => photo.id); const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    locked.current = true; setBusy(true); setError('');
    try { await activityApi.orderMedia(id, ids, query.data.version); refresh(); }
    catch (cause) { setError(activityError(cause)); void query.refetch(); }
    finally { locked.current = false; setBusy(false); }
  };
  return <Panel title="活动封面与相册" description="封面用于活动列表；现场照片按展示顺序留在活动档案。">
    <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row">
      <label className="block flex-1 text-sm font-medium">上传 / 替换封面<input className="mt-2 block w-full text-sm" type="file" accept={ACTIVITY_IMAGE_ACCEPT} disabled={busy || batchBusy} onChange={e => { void pick(e.target.files, 'COVER'); e.target.value = ''; }}/></label>
      <label className="block flex-1 text-sm font-medium">添加活动照片<input className="mt-2 block w-full text-sm" type="file" accept={ACTIVITY_IMAGE_ACCEPT} multiple disabled={busy || batchBusy} onChange={e => { void pick(e.target.files, 'PHOTO'); e.target.value = ''; }}/></label>
    </div><p className="my-3 text-xs text-muted-foreground">JPEG、PNG、WebP，每张不超过 10MB；每次最多选择 20 张。</p>
    {jobs.some(job => job.state !== 'done') && <AdminButton disabled={busy || batchBusy} className="mb-4" onClick={() => void uploadAll()}>上传全部待保存图片</AdminButton>}
    {!!jobs.length && <ul className="mb-6 space-y-3" aria-label="图片上传队列">{jobs.map(job => <li key={job.key} className="flex items-center gap-3 border-b border-border pb-3"><img src={job.preview} alt="待上传图片预览" className="h-16 w-20 shrink-0 object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-sm">{job.file.name}</p><p className="text-xs text-muted-foreground">{job.type === 'COVER' ? '封面' : '相册照片'} · {job.state === 'done' ? '已保存' : job.state === 'uploading' ? `正在上传 ${job.progress}%` : job.state === 'error' ? '未保存' : '等待上传'}</p>{job.state === 'uploading' && <progress value={job.progress} max={100} className="w-full"/>}{job.error && <p role="alert" className="mt-1 text-xs text-destructive">{job.error}</p>}</div>{job.state !== 'done' && <AdminButton variant="secondary" disabled={busy || batchBusy} onClick={() => void upload(job)}>{job.state === 'error' ? '重试' : '上传'}</AdminButton>}</li>)}</ul>}
    {busy && <AdminButton variant="secondary" onClick={() => abort.current?.abort()}>取消当前上传</AdminButton>}
    {error && <p role="alert" className="my-3 text-sm text-destructive">{error}</p>}
    {coverUrl && !coverMediaId && <figure className="mb-5"><img src={coverUrl} alt="历史活动封面" className="max-h-48 w-full object-contain"/><figcaption className="mt-2 text-xs text-muted-foreground">历史封面继续保留</figcaption><AdminButton variant="danger-outline" disabled={busy || !query.data} onClick={() => setDeleting({ id: 'legacy-cover', type: 'COVER', url: coverUrl, thumbnailUrl: coverUrl, sortOrder: 0 })}>删除封面</AdminButton></figure>}
    {query.isLoading ? <LoadingState label="正在读取相册…"/> : query.error ? <ErrorState message={activityError(query.error)} onRetry={() => void query.refetch()}/> : !query.data?.media.length ? <EmptyState title="还没有活动照片" description="上传封面或现场照片，记录这次相聚。"/> : <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{query.data.media.map(media => <figure key={media.id}><img src={media.thumbnailUrl || media.url} alt={media.caption || (media.type === 'COVER' ? '活动封面' : '活动照片')} loading="lazy" className="aspect-[4/3] w-full object-cover"/><figcaption className="mt-2 text-xs">{media.type === 'COVER' ? '当前封面' : media.caption || '活动照片'}</figcaption><div className="mt-1 flex flex-wrap gap-1">{media.type === 'PHOTO' && <><AdminButton variant="ghost" disabled={busy || photos.findIndex(photo => photo.id === media.id) === 0} onClick={() => void order(photos.findIndex(photo => photo.id === media.id), -1)}>前移</AdminButton><AdminButton variant="ghost" disabled={busy || photos.findIndex(photo => photo.id === media.id) === photos.length - 1} onClick={() => void order(photos.findIndex(photo => photo.id === media.id), 1)}>后移</AdminButton></>}<AdminButton variant="danger-outline" disabled={busy} onClick={() => setDeleting(media)}>删除</AdminButton></div></figure>)}</div>
      <Pagination page={query.data.pagination.page} pages={Math.max(1, query.data.pagination.pages)} total={query.data.pagination.total} onChange={setPage}/>
      <EventGallery eventId={id} gallery={photos} title="浏览本页活动照片" onRefresh={async () => { await query.refetch(); }}/>
    </>}
    <Modal open={!!deleting} title={deleting?.type === 'COVER' ? '删除活动封面' : '删除活动照片'} onClose={() => { if (!busy) setDeleting(null); }} width="max-w-md" footer={<><AdminButton variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>取消</AdminButton><AdminButton variant="danger" loading={busy} onClick={() => void remove()}>确认删除</AdminButton></>}><p className="text-sm">删除后成员端不再展示这张图片，历史媒体记录仍保留。</p></Modal>
  </Panel>;
}
