import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Archive } from 'lucide-react';
import { deleteEvent, getEvents, type AdminEvent, type Paged } from './adminApi';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, LoadingState, Modal, PageHeader, Pagination, Panel, SelectInput, Td, TextInput, Th, Tr } from './components';
import { formatDate } from './formatting';
import { ACTIVITY_STATUS_LABELS, ACTIVITY_TYPES, LEGACY_ACTIVITY_TYPES, activityTypeLabel } from '../../lib/activityMeta';
import { activityError } from '../../lib/activityApi';
import ActivityEditor from './ActivityEditor';
import type { MongoEvent } from '../../utils/eventTransform';

export default function AdminEvents() {
  const navigate = useNavigate(); const client = useQueryClient();
  const requestSequence = useRef(0);
  useEffect(() => () => { requestSequence.current += 1; }, []);
  const [data, setData] = useState<Paged<AdminEvent> | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [search, setSearch] = useState(''); const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all'); const [eventType, setEventType] = useState('all'); const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminEvent | null>(null); const [editorOpen, setEditorOpen] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [hiding, setHiding] = useState<AdminEvent | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current; setLoading(true); setError('');
    try { const response = await getEvents({ page, limit: 10, search: query || undefined, status: status === 'all' ? undefined : status, eventType: eventType === 'all' ? undefined : eventType, includeDeleted }); if (sequence === requestSequence.current) setData(response); }
    catch (cause) { if (sequence === requestSequence.current) setError(activityError(cause)); }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [page, query, status, eventType, includeDeleted]);
  useEffect(() => { void load(); }, [load]);
  const hide = async () => { if (!hiding || busy) return; setBusy(true); try { await deleteEvent(hiding._id); setHiding(null); await load(); } catch (cause) { setError(activityError(cause)); } finally { setBusy(false); } };
  return <>
    <PageHeader title="活动管理" subtitle="创建活动，管理报名，留下班级相聚的记录。" actions={<><AdminButton variant="secondary" onClick={() => void load()} loading={loading}>刷新</AdminButton><AdminButton onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="h-4 w-4"/>新建活动</AdminButton></>}/>
    <Panel padded={false}>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center">
        <form className="relative flex-1" onSubmit={e => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><TextInput aria-label="搜索活动" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索活动标题或介绍" className="pl-9"/></form>
        <SelectInput className="sm:w-36" aria-label="活动状态筛选" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} options={[{ value: 'all', label: '全部状态' }, ...Object.entries(ACTIVITY_STATUS_LABELS).map(([value, label]) => ({ value, label }))]}/>
        <SelectInput className="sm:w-44" aria-label="活动类型筛选" value={eventType} onChange={e => { setEventType(e.target.value); setPage(1); }} options={[{ value: 'all', label: '全部类型' }, ...ACTIVITY_TYPES, ...LEGACY_ACTIVITY_TYPES.map(value => ({ value, label: activityTypeLabel(value) }))]}/>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={includeDeleted} onChange={e => { setIncludeDeleted(e.target.checked); setPage(1); }}/>包含已隐藏活动</label>
      </div>
      {loading ? <LoadingState label="正在加载活动…"/> : error ? <ErrorState message={error} onRetry={() => void load()}/> : !data?.items.length ? <EmptyState title="没有匹配的活动" description="调整筛选，或创建新的班级活动。"/> : <><DataTable head={<><Th>活动</Th><Th>类型</Th><Th>时间</Th><Th>状态</Th><Th>报名</Th><Th>操作</Th></>}>{data.items.map(event => <Tr key={event._id}><Td><Link className="font-medium text-primary hover:underline" to={`/admin/events/${event._id}`}>{event.title}</Link><p className="mt-1 max-w-md line-clamp-1 text-xs text-muted-foreground">{event.description}</p></Td><Td><Badge>{activityTypeLabel(event.eventType)}</Badge></Td><Td className="whitespace-nowrap text-xs">{formatDate(event.startDate, true)}<br/>{formatDate(event.endDate, true)}</Td><Td><Badge tone={event.status === 'published' ? 'success' : 'neutral'}>{ACTIVITY_STATUS_LABELS[event.status] || event.status}</Badge>{event.deletedAt && <p className="mt-1 text-xs text-muted-foreground">成员端已隐藏</p>}</Td><Td><Link to={`/admin/events/${event._id}?tab=registrations`} className="text-primary hover:underline">{event.rsvpCount} 人</Link></Td><Td><div className="flex gap-1"><AdminButton variant="ghost" onClick={() => { setEditing(event); setEditorOpen(true); }}><Pencil className="h-4 w-4"/>编辑</AdminButton><AdminButton variant="ghost" onClick={() => setHiding(event)}><Archive className="h-4 w-4"/>隐藏</AdminButton></div></Td></Tr>)}</DataTable><Pagination page={data.pagination.page} pages={Math.max(1, data.pagination.pages)} total={data.pagination.total} onChange={setPage}/></>}
    </Panel>
    <ActivityEditor open={editorOpen} event={editing as unknown as MongoEvent | null} onClose={() => setEditorOpen(false)} onSaved={async (id, created) => { setEditorOpen(false); void client.invalidateQueries({ queryKey: ['events'] }); void client.invalidateQueries({ queryKey: ['event', id] }); void client.invalidateQueries({ queryKey: ['activity-admin', id] }); void client.invalidateQueries({ queryKey: ['activity-media', id] }); if (created) navigate(`/admin/events/${id}`); else await load(); }}/>
    <Modal open={!!hiding} title="隐藏活动" width="max-w-md" onClose={() => { if (!busy) setHiding(null); }} footer={<><AdminButton variant="secondary" disabled={busy} onClick={() => setHiding(null)}>取消</AdminButton><AdminButton variant="danger" loading={busy} onClick={() => void hide()}>确认隐藏</AdminButton></>}><p className="text-sm">隐藏「{hiding?.title}」后，成员端不再展示。报名和照片继续保留，管理员可通过详情链接查看并恢复。</p></Modal>
  </>;
}
