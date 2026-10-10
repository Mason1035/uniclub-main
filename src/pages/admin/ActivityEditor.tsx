import { useEffect, useRef, useState } from 'react';
import { createEvent, updateEvent } from './adminApi';
import { AdminButton, Field, Modal, SelectInput, TextArea, TextInput } from './components';
import { validateEventForm, type EventFormValues } from './contentValidation';
import { toLocalInputValue } from './formatting';
import { activityApi, activityError } from '../../lib/activityApi';
import { ACTIVITY_STATUS_LABELS, activityTypeOptions } from '../../lib/activityMeta';
import { ACTIVITY_IMAGE_ACCEPT, putActivityImage, validateActivityImage } from '../../lib/activityUpload';
import type { MongoEvent } from '../../utils/eventTransform';
import { needsNewActivityUpload } from '../../lib/activityMediaPolicy';
import type { ActivityUpload } from '../../types/activity';

function initialValues(event?: MongoEvent | null): EventFormValues {
  return { title: event?.title || '', description: event?.description || '', eventType: event?.eventType || 'LEAGUE_ACTIVITY', status: event?.status || 'draft', startDate: toLocalInputValue(event?.startDate), endDate: toLocalInputValue(event?.endDate), locationType: event?.location?.type || 'physical', address: event?.location?.address || '', room: event?.location?.room || '', virtualLink: event?.location?.virtualLink || '', category: event?.category?.[0] || '', maxCapacity: event?.maxCapacity == null ? '' : String(event.maxCapacity), imageUrl: '', rsvpDeadline: toLocalInputValue(event?.rsvpDeadline), rsvpLink: event?.rsvpLink || '' };
}
export default function ActivityEditor({ open, event, onClose, onSaved }: { open: boolean; event?: MongoEvent | null; onClose: () => void; onSaved: (id: string, created: boolean) => void | Promise<void> }) {
  const [form, setForm] = useState(initialValues(event)); const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState<number | null>(null);
  const choiceSequence = useRef(0);
  const openedFor = useRef<string | null>(null);
  const savedId = useRef<string | null>(null); const transfer = useRef<{ session: ActivityUpload; uploaded: boolean } | null>(null); const controller = useRef<AbortController | null>(null); const lock = useRef(false);
  useEffect(() => { if (!open) { openedFor.current = null; choiceSequence.current += 1; return; } const identity = event?._id || event?.id || 'new'; if (openedFor.current === identity) return; openedFor.current = identity; setForm(initialValues(event)); setFile(null); setError(''); setProgress(null); savedId.current = event?._id || event?.id || null; transfer.current = null; }, [open, event]);
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => () => controller.current?.abort(), []);
  const change = (key: keyof EventFormValues, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const pick = async (chosen?: File) => { if (!chosen) return; const sequence = ++choiceSequence.current; try { await validateActivityImage(chosen); if (sequence !== choiceSequence.current) return; setFile(chosen); transfer.current = null; setError(''); } catch (cause) { if (sequence === choiceSequence.current) setError(activityError(cause)); } };
  const save = async () => {
    if (lock.current) return;
    const errors = validateEventForm({ ...form, category: '' }, event?.eventType);
    if (Object.keys(errors).length) { setError(Object.values(errors)[0]); return; }
    lock.current = true; setBusy(true); setError(''); const abort = new AbortController(); controller.current = abort;
    try {
      const payload = { title: form.title.trim(), description: form.description.trim(), eventType: form.eventType, status: savedId.current ? form.status : 'draft', startDate: new Date(form.startDate).toISOString(), endDate: new Date(form.endDate).toISOString(), location: { type: form.locationType, address: form.address.trim(), room: form.room.trim(), virtualLink: form.virtualLink.trim() }, maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : null, rsvpDeadline: form.rsvpDeadline ? new Date(form.rsvpDeadline).toISOString() : null };
      if (savedId.current) await updateEvent(savedId.current, payload);
      else { const created = await createEvent(payload); savedId.current = created._id || created.id; }
      if (!savedId.current) throw new Error('活动保存未返回有效编号，请刷新列表确认。');
      if (file) {
        if (!transfer.current) transfer.current = { session: await activityApi.initUpload(savedId.current, file, 'COVER'), uploaded: false };
        if (!transfer.current.uploaded) { await putActivityImage(file, transfer.current.session, abort.signal, setProgress); transfer.current.uploaded = true; }
        await activityApi.completeUpload(savedId.current, transfer.current.session.upload.id); transfer.current = null;
      }
      await onSaved(savedId.current, !event);
    } catch (cause) {
      const code = (cause as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const reauthorize = needsNewActivityUpload(cause);
      if (reauthorize) transfer.current = null;
      setError(`${savedId.current && !event ? '活动草稿已保存。' : ''}${transfer.current?.uploaded ? '图片已传输，确认保存尚未完成；再次保存会重试确认。' : ''}${reauthorize ? '再次保存将重新授权上传，确认替换当前封面。' : ''}${activityError(cause)}`);
    } finally { lock.current = false; setBusy(false); setProgress(null); }
  };
  return <Modal open={open} title={event ? '编辑活动基本信息' : '新建活动'} description={event ? '报名、相册和总结可在活动详情中管理。' : '先保存草稿和封面，在详情页确认后发布。'} onClose={() => { if (!busy) onClose(); }} footer={<><AdminButton variant="secondary" disabled={busy} onClick={onClose}>取消</AdminButton><AdminButton loading={busy} onClick={() => void save()}>{event ? '保存修改' : '保存草稿并继续'}</AdminButton></>}>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="活动标题" required><TextInput value={form.title} onChange={e => change('title', e.target.value)} maxLength={200}/></Field></div>
      <div className="sm:col-span-2"><Field label="活动介绍" required><TextArea value={form.description} onChange={e => change('description', e.target.value)} maxLength={2000} className="min-h-40"/></Field></div>
      <Field label="活动类型" required><SelectInput value={form.eventType} onChange={e => change('eventType', e.target.value)} options={activityTypeOptions(form.eventType)}/></Field>
      {event && <Field label="活动状态"><SelectInput value={form.status} onChange={e => change('status', e.target.value)} options={Object.entries(ACTIVITY_STATUS_LABELS).map(([value, label]) => ({ value, label }))}/></Field>}
      <Field label="开始时间" required><TextInput type="datetime-local" value={form.startDate} onChange={e => change('startDate', e.target.value)}/></Field>
      <Field label="结束时间" required><TextInput type="datetime-local" value={form.endDate} onChange={e => change('endDate', e.target.value)}/></Field>
      <Field label="报名截止时间" hint="留空表示活动结束时截止"><TextInput type="datetime-local" value={form.rsvpDeadline || ''} onChange={e => change('rsvpDeadline', e.target.value)}/></Field>
      <Field label="举办形式"><SelectInput value={form.locationType} onChange={e => change('locationType', e.target.value)} options={[{ value: 'physical', label: '线下' }, { value: 'virtual', label: '线上' }, { value: 'hybrid', label: '线上线下结合' }]}/></Field>
      <Field label="人数上限" hint="留空表示不限；名额以审核通过人数计算。"><TextInput type="number" min={1} value={form.maxCapacity} onChange={e => change('maxCapacity', e.target.value)}/></Field>
      <Field label="地址" hint="线下或混合活动必填"><TextInput value={form.address} onChange={e => change('address', e.target.value)}/></Field>
      <Field label="教室 / 房间"><TextInput value={form.room} onChange={e => change('room', e.target.value)}/></Field>
      <div className="sm:col-span-2"><Field label="线上链接" hint="线上或混合活动必填"><TextInput value={form.virtualLink} onChange={e => change('virtualLink', e.target.value)}/></Field></div>
      <div className="sm:col-span-2"><Field label="上传活动封面" hint="JPEG、PNG、WebP，每张不超过 10MB。"><input type="file" accept={ACTIVITY_IMAGE_ACCEPT} disabled={busy} onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} className="block w-full text-sm"/>{(preview || event?.coverUrl || event?.imageUrl) && <img src={preview || event?.coverUrl || event?.imageUrl} alt="活动封面预览" className="mt-3 max-h-48 w-full object-contain"/>}{file && <AdminButton variant="ghost" disabled={busy} onClick={() => { setFile(null); transfer.current = null; }}>撤销新封面</AdminButton>}</Field></div>
      {progress !== null && <div className="sm:col-span-2" role="status"><progress max={100} value={progress} className="w-full"/>正在上传封面 {progress}%</div>}
      {error && <p className="text-sm text-destructive sm:col-span-2" role="alert">{error}</p>}
    </div>
  </Modal>;
}
