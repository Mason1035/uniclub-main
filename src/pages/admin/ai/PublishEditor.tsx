import type { ReactNode } from 'react';
import { RESOURCE_CATEGORIES, RESOURCE_TYPES, RESOURCE_TYPE_LABELS } from '@/lib/resourceMeta';
import { categoryLabel } from '@/lib/contentFormat';
import { EVENT_CATEGORIES, EVENT_TYPES, NEWS_CATEGORIES, isWebUrl, type FieldErrors } from '../contentValidation';
import { Field, SelectInput, TextArea, TextInput } from '../components';
import type { PublishDraft } from './types';

function PreviewField({ name, label, required, errors, children, hint }: { name: string; label: string; required?: boolean; errors: FieldErrors; children: ReactNode; hint?: string }) {
  return <div><Field label={label} required={required} hint={hint}>{children}</Field>{errors[name] && <p className="mt-1 text-xs text-destructive" id={`ai-error-${name}`}>{errors[name]}</p>}</div>;
}

export default function PublishEditor({ draft, errors, disabled, onChange }: { draft: PublishDraft; errors: FieldErrors; disabled: boolean; onChange: (draft: PublishDraft) => void }) {
  const v = draft.values;
  const field = (name: string, label: string, value: string, change: (s: string) => void, options: { required?: boolean; area?: boolean; type?: string; max?: number; hint?: string } = {}) => <PreviewField key={name} name={name} label={label} errors={errors} required={options.required} hint={options.hint}>{options.area ? <TextArea value={value} onChange={e => change(e.target.value)} maxLength={options.max} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `ai-error-${name}` : undefined} placeholder="未填写" rows={name === 'content' || name === 'body' || name === 'description' ? 7 : 3} /> : <TextInput value={value} onChange={e => change(e.target.value)} type={options.type || 'text'} maxLength={options.max} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `ai-error-${name}` : undefined} placeholder="未填写" />}</PreviewField>;
  const select = (name: string, label: string, value: string, change: (s: string) => void, options: { value: string; label: string }[], required = false) => <PreviewField name={name} label={label} errors={errors} required={required}><SelectInput value={value} onChange={e => change(e.target.value)} aria-invalid={Boolean(errors[name])} options={[{ value: '', label: required ? '未填写，请选择' : '不指定' }, ...options]} /></PreviewField>;
  const cover = draft.kind === 'activity' || draft.kind === 'news' ? draft.values.imageUrl : draft.kind === 'resource' ? draft.values.thumbnailUrl : '';
  return <fieldset disabled={disabled} className="min-w-0 space-y-4">
    {field('title', draft.kind === 'resource' ? '资源名称' : '标题', v.title, title => onChange({ ...draft, values: { ...draft.values, title } } as PublishDraft), { required: true, max: draft.kind === 'announcement' ? 120 : 200 })}
    {draft.kind === 'activity' && (() => {
      const value = draft.values;
      const update = (patch: Partial<typeof value>) => onChange({ kind: 'activity', values: { ...value, ...patch } });
      return <>
        {field('description', '活动介绍', value.description, description => update({ description }), { required: true, area: true, max: 2000, hint: '最多 2000 字，正文按纯文本发布' })}
        <div className="grid gap-4 sm:grid-cols-2">{field('startDate', '开始时间', value.startDate, startDate => update({ startDate }), { required: true, type: 'datetime-local' })}{field('endDate', '结束时间', value.endDate, endDate => update({ endDate }), { required: true, type: 'datetime-local' })}</div>
        <div className="grid gap-4 sm:grid-cols-2">{select('eventType', '活动类型', value.eventType, eventType => update({ eventType }), EVENT_TYPES.map(t => ({ value: t, label: categoryLabel(t) })), true)}{select('locationType', '活动形式', value.locationType, locationType => update({ locationType }), [{ value: 'physical', label: '线下' }, { value: 'virtual', label: '线上' }, { value: 'hybrid', label: '线上 + 线下' }], true)}</div>
        {value.locationType !== 'virtual' && field('address', '活动地址', value.address, address => update({ address }), { required: true })}
        {value.locationType !== 'virtual' && field('room', '教室 / 房间', value.room, room => update({ room }))}
        {value.locationType !== 'physical' && field('virtualLink', '线上活动链接', value.virtualLink, virtualLink => update({ virtualLink }), { required: ['virtual', 'hybrid'].includes(value.locationType), type: 'url' })}
        <div className="grid gap-4 sm:grid-cols-2">{select('category', '活动分类', value.category, category => update({ category }), EVENT_CATEGORIES.map(t => ({ value: t, label: categoryLabel(t) })))}{field('maxCapacity', '人数上限', value.maxCapacity, maxCapacity => update({ maxCapacity }), { type: 'number', hint: '留空表示不限' })}</div>
        {field('rsvpDeadline', '报名截止时间', value.rsvpDeadline || '', rsvpDeadline => update({ rsvpDeadline }), { type: 'datetime-local', hint: '留空表示不指定截止时间' })}
        {field('rsvpLink', '外部报名链接', value.rsvpLink || '', rsvpLink => update({ rsvpLink }), { type: 'url' })}
        {field('imageUrl', '活动封面链接（可选）', value.imageUrl, imageUrl => update({ imageUrl }), { type: 'url', hint: '与左侧 AI 输入图片独立，沿用活动管理的图片链接方式' })}
      </>;
    })()}
    {draft.kind === 'announcement' && (() => {
      const value = draft.values;
      const update = (patch: Partial<typeof value>) => onChange({ kind: 'announcement', values: { ...value, ...patch } });
      return <>
        {field('body', '公告正文', value.body, body => update({ body }), { required: true, area: true, max: 4000, hint: '最多 4000 字，正文按纯文本发布' })}
        {select('level', '重要程度', value.level, level => update({ level }), [{ value: 'info', label: '通知' }, { value: 'important', label: '重要' }, { value: 'urgent', label: '紧急' }], true)}
        {field('link', '相关链接', value.link, link => update({ link }), { type: 'url' })}
        {field('expiresAt', '公告下架时间', value.expiresAt, expiresAt => update({ expiresAt }), { type: 'datetime-local', hint: '可留空，业务截止日期请写在正文中' })}
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={value.pinned} onChange={e => update({ pinned: e.target.checked })} />置顶公告</label>
      </>;
    })()}
    {draft.kind === 'news' && (() => {
      const value = draft.values;
      const update = (patch: Partial<typeof value>) => onChange({ kind: 'news', values: { ...value, ...patch } });
      return <>
        {field('excerpt', '新闻摘要', value.excerpt, excerpt => update({ excerpt }), { required: true, area: true, max: 800 })}
        {field('content', '新闻正文', value.content, content => update({ content }), { required: true, area: true, max: 16000, hint: '正文按纯文本分段发布' })}
        {field('source', '新闻来源', value.source, source => update({ source }), { required: true, max: 200, hint: '填写真实来源，例如班级供稿人或原媒体名称' })}
        {select('category', '新闻分类', value.category, category => update({ category }), NEWS_CATEGORIES.map(t => ({ value: t, label: categoryLabel(t) })))}
        {field('imageUrl', '新闻封面链接（可选）', value.imageUrl, imageUrl => update({ imageUrl }), { type: 'url', hint: '与左侧 AI 输入图片独立，沿用新闻管理的图片链接方式' })}
      </>;
    })()}
    {draft.kind === 'resource' && (() => {
      const value = draft.values;
      const update = (patch: Partial<typeof value>) => onChange({ kind: 'resource', values: { ...value, ...patch } });
      return <>
        {field('description', '资源说明', value.description, description => update({ description }), { area: true, max: 1000, hint: '简介与详细说明合并保存，最多 1000 字' })}
        <div className="grid gap-4 sm:grid-cols-2">{select('type', '资源形态', value.type, type => update({ type }), RESOURCE_TYPES.map(t => ({ value: t, label: RESOURCE_TYPE_LABELS[t] })), true)}{select('category', '资源分类', value.category, category => update({ category }), RESOURCE_CATEGORIES.map(t => ({ value: t, label: t })), true)}</div>
        {field('linkUrl', '资源链接', value.linkUrl, linkUrl => update({ linkUrl }), { required: true, type: 'url', hint: '必须是真实的 HTTP(S) 资源地址' })}
        {field('tags', '标签', value.tags, tags => update({ tags }), { hint: '使用英文逗号分隔' })}
        {field('thumbnailUrl', '缩略图链接（可选）', value.thumbnailUrl, thumbnailUrl => update({ thumbnailUrl }), { type: 'url' })}
      </>;
    })()}
    {isWebUrl(cover) && <img className="max-h-52 w-full object-contain" src={cover} alt="管理员选定的发布封面" />}
  </fieldset>;
}
