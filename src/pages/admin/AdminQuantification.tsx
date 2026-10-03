import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, Clock, Download, Plus, Settings, Users } from 'lucide-react';
import { useAdminSession } from './adminSession';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Panel, SelectInput, StatCard, Td, TextArea, TextInput, Th } from './components';
import QuantificationStorageSettings from './QuantificationStorageSettings';
import QuantificationStorageFiles from './QuantificationStorageFiles';
import QuantificationDownloads from '../../components/QuantificationDownloads';
import { usePageViewState } from '../../hooks/usePageViewState';
import { quantificationApi, quantificationBytes, quantificationDate, quantificationError, collectionAvailability, collectionStatusLabel } from '../../lib/quantificationApi';
import type { CollectionInput, DownloadLinks, QuantificationCollection } from '../../types/quantification';
import '../../styles/quantification.css';

const initialForm: CollectionInput = { title: '', description: '', startAt: null, deadline: null, status: 'draft' };
const localTime = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function AdminQuantification() {
  const admin = useAdminSession();
  const identity = admin?.id || admin?.email || '';
  const cache = useQueryClient();
  const [view, setView] = usePageViewState(`quantification-admin:${identity}`, { collectionId: '', search: '', status: 'all', sort: 'studentId', direction: 'asc', page: 1 });
  const [keyword, setKeyword] = useState(view.search);
  const [selected, setSelected] = useState<string[]>([]);
  const [storageModal, setStorageModal] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<QuantificationCollection | null>(null);
  const [form, setForm] = useState<CollectionInput>(initialForm);
  const [start, setStart] = useState('');
  const [deadline, setDeadline] = useState('');
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [downloads, setDownloads] = useState<DownloadLinks | null>(null);
  const saveLock = useRef(false);
  const downloadLock = useRef(false);
  const collections = useQuery({ queryKey: ['quantification', 'admin-collections', identity], queryFn: () => quantificationApi.collections(true), staleTime: 10000 });
  const collectionId = collections.data?.collections.some(c => c.id === view.collectionId) ? view.collectionId : collections.data?.collections[0]?.id || '';
  const collection = collections.data?.collections.find(c => c.id === collectionId);
  const overview = useQuery({ queryKey: ['quantification', 'overview', identity, collectionId, keyword, view.status, view.sort, view.direction, view.page],
    queryFn: () => quantificationApi.overview(collectionId, { search: keyword, status: view.status, sort: view.sort, direction: view.direction, page: view.page, limit: 20 }), enabled: Boolean(collectionId), staleTime: 5000 });
  useEffect(() => { const timer = setTimeout(() => setKeyword(view.search), 250); return () => clearTimeout(timer); }, [view.search]);
  useEffect(() => { setSelected([]); }, [collectionId, keyword, view.status, view.sort, view.direction, view.page]);
  const openForm = (c: QuantificationCollection | null) => {
    setEditing(c); setForm(c ? { title: c.title, description: c.description, startAt: c.startAt, deadline: c.deadline, status: c.status } : { ...initialForm });
    setStart(localTime(c?.startAt || null)); setDeadline(localTime(c?.deadline || null)); setFormError(''); setModal(true);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saveLock.current) return;
    if (!form.title.trim()) { setFormError('请填写收集期标题。'); return; }
    if ((start && !Number.isFinite(Date.parse(start))) || (deadline && !Number.isFinite(Date.parse(deadline)))) { setFormError('开始或截止时间无效。'); return; }
    if (start && deadline && Date.parse(deadline) <= Date.parse(start)) { setFormError('截止时间必须晚于开始时间。'); return; }
    saveLock.current = true; setSaving(true); setFormError(''); setError('');
    try {
      const body = { ...form, title: form.title.trim(), startAt: start ? new Date(start).toISOString() : null, deadline: deadline ? new Date(deadline).toISOString() : null };
      const saved = editing ? await quantificationApi.editCollection(editing.id, body) : await quantificationApi.createCollection(body);
      await cache.invalidateQueries({ queryKey: ['quantification'] });
      setView({ ...view, collectionId: saved.id, page: 1 }); setModal(false); setMessage(editing ? '收集期已更新。' : '收集期已创建；设为开放提交后，同学即可看到。');
    } catch (err) { setFormError(quantificationError(err)); }
    finally { setSaving(false); saveLock.current = false; }
  };
  const download = async (ids: string[]) => {
    if (!ids.length || downloadLock.current) return;
    downloadLock.current = true; setDownloading(true); setError('');
    try { setDownloads(await quantificationApi.downloads(ids)); }
    catch (err) { setError(quantificationError(err)); }
    finally { setDownloading(false); downloadLock.current = false; }
  };
  const cleanup = async () => {
    if (cleaning) return;
    setCleaning(true); setError('');
    try { const result = await quantificationApi.cleanup(); setMessage(result.configured ? `已清理 ${result.processed} 个过期上传会话，${result.failed} 个等待重试。${result.retainedFiles ? 'COS 中的材料保留。' : '有效提交不会删除。'}` : '对象存储尚未配置，暂时无法清理。'); }
    catch (err) { setError(quantificationError(err)); }
    finally { setCleaning(false); }
  };
  const pageIds = overview.data?.rows.flatMap(r => r.submission ? [r.submission.id] : []) || [];
  const updateFilter = (key: 'search' | 'status' | 'sort' | 'direction', value: string) => setView({ ...view, [key]: value, page: 1 });
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  return <div className="quant-page"><PageHeader title="量化材料" subtitle="发布收集期，查看班级提交情况，下载同学材料。" actions={<><AdminButton variant="secondary" onClick={() => setStorageModal(true)}><Settings className="h-4 w-4"/>存储配置</AdminButton><AdminButton variant="secondary" onClick={() => void cleanup()} loading={cleaning}>清理过期上传</AdminButton><AdminButton onClick={() => openForm(null)}><Plus size={16} aria-hidden="true"/>新建收集期</AdminButton></>}/>
    {message && <p role="status" className="quant-note mb-4">{message}</p>}{error && <p role="alert" className="form-error mb-4">{error}</p>}
    {!collections.isPending && !collections.error && !collections.data?.storage.configured && <p className="quant-note warning mb-5">对象存储尚未接通。可以先创建收集期；请打开“存储配置”填写 COS 和云函数参数，并按配套说明配置云端权限与跨域规则。</p>}
    {collections.data?.storage.provider === 'scf' && <QuantificationStorageFiles identity={identity} enabled={collections.data.storage.configured}/>}
    {collections.isPending ? <LoadingState/> : collections.error ? <ErrorState message={quantificationError(collections.error)} onRetry={() => void collections.refetch()}/> : !collections.data?.collections.length ? <Panel><EmptyState title="还没有量化材料收集期" description="创建收集期并填写提交说明、开始与截止时间，再开放给同学。" action={<AdminButton onClick={() => openForm(null)}>创建第一个收集期</AdminButton>}/></Panel> : <>
      <div className="quant-toolbar"><label htmlFor="admin-quant-period"><span className="text-sm">收集期</span><select id="admin-quant-period" value={collectionId} onChange={e => setView({ ...view, collectionId: e.target.value, page: 1 })}>{collections.data?.collections.map(c => <option key={c.id} value={c.id}>{c.title} · {collectionStatusLabel[collectionAvailability(c)]}</option>)}</select></label><AdminButton variant="secondary" onClick={() => openForm(collection || null)}>编辑收集期</AdminButton><Link to="/quantification" className="ed-button secondary">查看学生页面</Link></div>
      {collection && <p className="text-sm text-muted-foreground mb-5">{collectionStatusLabel[collectionAvailability(collection)]} · 截止：{collection.deadline ? quantificationDate(collection.deadline) : '未设置'}</p>}
      {overview.isPending ? <LoadingState/> : overview.error ? <ErrorState message={quantificationError(overview.error)} onRetry={() => void overview.refetch()}/> : overview.data && <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"><StatCard icon={<Users size={20}/>} label="班级名单人数" value={overview.data.summary.total} hint="以当前班级名单为准"/><StatCard icon={<CheckCircle2 size={20}/>} label="名单已提交" value={overview.data.summary.submitted}/><StatCard icon={<Clock size={20}/>} label="名单未提交" value={overview.data.summary.missing} hint="包含尚未注册的名单成员"/></div>
        {overview.data.summary.outsideRoster > 0 && <p className="quant-note mb-4">另有 {overview.data.summary.outsideRoster} 份名单外账号提交，已单独标记，不计入班级人数。</p>}
        <Panel title="名单提交情况" description={`当前筛选 ${overview.data.pagination.total} 条；统计人数不受筛选影响。`}>
          <div className="quant-admin-toolbar"><Field label="搜索姓名、学号或文件名"><TextInput value={view.search} onChange={e => updateFilter('search', e.target.value)} placeholder="姓名 / 学号 / 文件名" maxLength={100}/></Field><Field label="提交状态"><SelectInput value={view.status} onChange={e => updateFilter('status', e.target.value)} options={[{ value: 'all', label: '全部' }, { value: 'submitted', label: '已提交' }, { value: 'missing', label: '未提交' }]}/></Field><Field label="排序"><SelectInput value={view.sort} onChange={e => updateFilter('sort', e.target.value)} options={[{ value: 'studentId', label: '学号' }, { value: 'name', label: '姓名' }, { value: 'submittedAt', label: '提交时间' }, { value: 'fileSize', label: '文件大小' }]}/></Field><AdminButton variant="secondary" onClick={() => updateFilter('direction', view.direction === 'asc' ? 'desc' : 'asc')}>{view.direction === 'asc' ? '升序' : '降序'}</AdminButton><AdminButton variant="ghost" onClick={() => setView({ ...view, search: '', status: 'all', sort: 'studentId', direction: 'asc', page: 1 })}>清空筛选</AdminButton></div>
          <div className="quant-selection"><span className="text-sm mr-2">已选 {selected.length} 份</span><AdminButton variant="secondary" disabled={!pageIds.length} onClick={() => setSelected(pageIds)}>全选本页</AdminButton><AdminButton variant="ghost" disabled={!selected.length} onClick={() => setSelected([])}>取消全选</AdminButton><AdminButton variant="ghost" disabled={!pageIds.length} onClick={() => setSelected(pageIds.filter(id => !selected.includes(id)))}>反选本页</AdminButton><AdminButton disabled={!selected.length} loading={downloading} onClick={() => void download(selected)}><Download size={16} aria-hidden="true"/>下载选中材料</AdminButton></div>
          {!overview.data.rows.length ? <EmptyState title={overview.data.summary.total === 0 && overview.data.summary.outsideRoster === 0 ? '班级名单为空' : '没有符合条件的记录'} description={overview.data.summary.total === 0 ? '上方存储桶材料可直接刷新和下载；导入名单后可统计谁还没有提交。' : '调整或清空筛选条件后重试。'} action={overview.data.summary.total === 0 && <Link className="ed-button secondary" to="/admin/roster">维护班级名单</Link>}/> : <DataTable head={<><Th>选择</Th><Th>姓名 / 学号</Th><Th>材料文件</Th><Th>大小</Th><Th>提交时间</Th><Th>状态</Th><Th>操作</Th></>}>
            {overview.data.rows.map(row => <tr key={row.id} className="quant-admin-row border-b border-border"><Td><label className="quant-check-label"><input className="quant-check" type="checkbox" aria-label={`选择${row.name}的材料`} disabled={!row.submission} checked={Boolean(row.submission && selected.includes(row.submission.id))} onChange={() => row.submission && toggle(row.submission.id)}/></label></Td><Td><strong className="block">{row.name}</strong><span className="font-mono text-xs text-muted-foreground">{row.studentId || '未提供学号'}</span>{row.outsideRoster && <span className="block text-xs text-muted-foreground">名单外账号</span>}</Td><Td><span className="quant-admin-filename">{row.submission?.originalFilename || '—'}</span></Td><Td>{row.submission ? quantificationBytes(row.submission.fileSize) : '—'}</Td><Td><span className="text-xs">{row.submission ? quantificationDate(row.submission.submittedAt) : '—'}</span></Td><Td><Badge tone={row.submission ? 'success' : 'neutral'}>{row.submission ? '已提交' : row.registered ? '未提交' : '未注册'}</Badge></Td><Td><AdminButton variant="secondary" disabled={!row.submission || downloading} onClick={() => row.submission && void download([row.submission.id])}>下载</AdminButton></Td></tr>)}
          </DataTable>}
          {overview.data.pagination.pages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm"><span>第 {overview.data.pagination.page} / {overview.data.pagination.pages} 页</span><div className="flex gap-2"><AdminButton variant="secondary" disabled={overview.data.pagination.page <= 1} onClick={() => setView({ ...view, page: overview.data!.pagination.page - 1 })}>上一页</AdminButton><AdminButton variant="secondary" disabled={overview.data.pagination.page >= overview.data.pagination.pages} onClick={() => setView({ ...view, page: overview.data!.pagination.page + 1 })}>下一页</AdminButton></div></div>}
        </Panel>
      </>}
    </>}
    <Modal open={modal} onClose={() => { if (!saving) setModal(false); }} title={editing ? '编辑收集期' : '新建收集期'} description="填写真实的收集安排。草稿只对管理员可见；开放后同学可以提交。"><form noValidate onSubmit={event => void save(event)} className="space-y-4" aria-busy={saving}><Field label="收集期标题" required><TextInput value={form.title} disabled={saving} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={100} required aria-describedby="collection-form-error" aria-invalid={Boolean(formError)} placeholder="填写本期量化材料收集名称"/></Field><Field label="提交说明"><TextArea value={form.description} disabled={saving} maxLength={5000} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="材料要求、整理方式及注意事项"/></Field><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="开始时间" hint="可留空，开放后即可提交"><TextInput type="datetime-local" value={start} disabled={saving} onChange={e => setStart(e.target.value)}/></Field><Field label="截止时间" hint="可留空；设置后截止即停止提交"><TextInput type="datetime-local" value={deadline} disabled={saving} onChange={e => setDeadline(e.target.value)}/></Field></div><Field label="收集状态"><SelectInput value={form.status} disabled={saving} onChange={e => setForm({ ...form, status: e.target.value as CollectionInput['status'] })} options={[{ value: 'draft', label: '草稿，暂不发布' }, { value: 'open', label: '开放提交' }, { value: 'closed', label: '关闭提交' }]}/></Field><div id="collection-form-error">{formError && <p role="alert" className="form-error">{formError}</p>}</div><div className="flex flex-wrap justify-end gap-3"><AdminButton variant="secondary" disabled={saving} onClick={() => setModal(false)} type="button">取消</AdminButton><AdminButton loading={saving} type="submit">保存收集期</AdminButton></div></form></Modal>
    {storageModal && <QuantificationStorageSettings identity={identity} onClose={() => setStorageModal(false)} onSaved={setMessage}/>}
    <QuantificationDownloads result={downloads} onClose={() => setDownloads(null)}/>
  </div>;
}
