/**
 * 活动管理 - list / create / edit / delete events.
 * Reuses the existing Express endpoints: GET(POST/PUT/DELETE) /api/events.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  createEvent,
  deleteEvent,
  errorMessage,
  getEvents,
  updateEvent,
  type AdminEvent,
  type Paged,
} from './adminApi';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Pagination, Panel, SelectInput, Td, TextArea, TextInput, Th, Tr } from './components';
import { validateEventForm } from './contentValidation';
import { formatDate, toLocalInputValue } from './formatting';

const PAGE_SIZE = 10;

const EVENT_TYPES = ['Workshop', 'Masterclass', 'Tutorial', 'Meetup', 'Hackathon', 'Seminar', 'Social'];
const CATEGORIES = [
  'AI/ML',
  'Web Development',
  'Mobile Apps',
  'Data Science',
  'Cybersecurity',
  'Game Development',
  'Hardware',
  'Startups',
  'Career',
  'Social',
];
const STATUSES = ['draft', 'published', 'cancelled', 'completed'];

const statusTone = (status: string) => {
  if (status === 'published') return 'success' as const;
  if (status === 'draft') return 'warning' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'neutral' as const;
};

const statusLabel: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  cancelled: '已取消',
  completed: '已完成',
};

interface EventForm {
  title: string;
  description: string;
  eventType: string;
  status: string;
  startDate: string;
  endDate: string;
  locationType: string;
  address: string;
  room: string;
  virtualLink: string;
  category: string;
  maxCapacity: string;
  imageUrl: string;
}

const emptyForm = (): EventForm => ({
  title: '',
  description: '',
  eventType: 'Workshop',
  status: 'published',
  startDate: '',
  endDate: '',
  locationType: 'physical',
  address: '',
  room: '',
  virtualLink: '',
  category: '',
  maxCapacity: '',
  imageUrl: '',
});

const toForm = (event: AdminEvent): EventForm => ({
  title: event.title || '',
  description: event.description || '',
  eventType: event.eventType || 'Workshop',
  status: event.status || 'draft',
  startDate: toLocalInputValue(event.startDate),
  endDate: toLocalInputValue(event.endDate),
  locationType: event.location?.type || 'physical',
  address: event.location?.address || '',
  room: event.location?.room || '',
  virtualLink: event.location?.virtualLink || '',
  category: (event.category && event.category[0]) || '',
  maxCapacity: event.maxCapacity ? String(event.maxCapacity) : '',
  imageUrl: event.imageUrl || '',
});

const AdminEvents: React.FC = () => {
  const [data, setData] = useState<Paged<AdminEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<AdminEvent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(
        await getEvents({
          page,
          limit: PAGE_SIZE,
          search: query || undefined,
          status: status === 'all' ? undefined : status,
        })
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (event: AdminEvent) => {
    setEditing(event);
    setForm(toForm(event));
    setFormError('');
    setModalOpen(true);
  };

  const submit = async () => {
    setFormError('');
    const errors = validateEventForm(form);
    if (Object.keys(errors).length) {
      setFormError(Object.values(errors)[0]);
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      eventType: form.eventType,
      status: form.status,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      location: {
        type: form.locationType,
        ...(form.address.trim() && { address: form.address.trim() }),
        ...(form.room.trim() && { room: form.room.trim() }),
        ...(form.virtualLink.trim() && { virtualLink: form.virtualLink.trim() }),
      },
      category: form.category ? [form.category] : [],
      maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : null,
      ...(form.imageUrl.trim() && { imageUrl: form.imageUrl.trim() }),
    };

    setSaving(true);
    try {
      if (editing) {
        await updateEvent(editing._id, payload);
      } else {
        await createEvent(payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteEvent(deleting._id);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="活动管理"
        subtitle="创建、编辑与删除班级活动"
        actions={
          <>
            <AdminButton variant="secondary" onClick={() => void load()} loading={loading}>
              刷新
            </AdminButton>
            <AdminButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新建活动
            </AdminButton>
          </>
        }
      />

      <Panel padded={false}>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQuery(search.trim());
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索活动标题或描述"
              className="pl-9"
            />
          </form>
          <div className="w-full sm:w-40">
            <SelectInput
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: '全部状态' },
                ...STATUSES.map((s) => ({ value: s, label: statusLabel[s] })),
              ]}
            />
          </div>
        </div>

        {loading && !data ? (
          <LoadingState label="正在加载活动…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="还没有活动"
            description="创建第一个班级活动，成员即可在活动页看到它。"
            action={<AdminButton onClick={openCreate}>新建活动</AdminButton>}
          />
        ) : (
          <>
            <DataTable
              head={
                <>
                  <Th>活动</Th>
                  <Th>类型</Th>
                  <Th>开始时间</Th>
                  <Th>状态</Th>
                  <Th>报名</Th>
                  <Th className="text-right">操作</Th>
                </>
              }
            >
              {data.items.map((event) => (
                <Tr key={event._id}>
                  <Td>
                    <p className="font-medium">{event.title}</p>
                    <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">
                      {event.description}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone="info">{event.eventType}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(event.startDate, true)}
                  </Td>
                  <Td>
                    <Badge tone={statusTone(event.status)}>{statusLabel[event.status] || event.status}</Badge>
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">{event.rsvpCount}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <AdminButton variant="ghost" onClick={() => openEdit(event)}>
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </AdminButton>
                      <AdminButton variant="ghost" onClick={() => setDeleting(event)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </AdminButton>
                    </div>
                  </Td>
                </Tr>
              ))}
            </DataTable>
            <Pagination
              page={data.pagination.page}
              pages={data.pagination.pages}
              total={data.pagination.total}
              onChange={setPage}
            />
          </>
        )}
      </Panel>

      <Modal
        open={modalOpen}
        title={editing ? '编辑活动' : '新建活动'}
        description="保存后立即同步到成员端活动页。"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </AdminButton>
            <AdminButton loading={saving} onClick={() => void submit()}>
              {editing ? '保存修改' : '创建活动'}
            </AdminButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="活动标题" required>
              <TextInput
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例如：AI 应用实战工作坊"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="活动描述" required>
              <TextArea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="简要介绍活动内容、目标与安排"
              />
            </Field>
          </div>
          <Field label="活动类型" required>
            <SelectInput
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value })}
              options={EVENT_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </Field>
          <Field label="状态">
            <SelectInput
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={STATUSES.map((s) => ({ value: s, label: statusLabel[s] }))}
            />
          </Field>
          <Field label="开始时间" required>
            <TextInput
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="结束时间" required>
            <TextInput
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </Field>
          <Field label="举办形式" required>
            <SelectInput
              value={form.locationType}
              onChange={(e) => setForm({ ...form, locationType: e.target.value })}
              options={[
                { value: 'physical', label: '线下' },
                { value: 'virtual', label: '线上' },
                { value: 'hybrid', label: '线上线下结合' },
              ]}
            />
          </Field>
          <Field label="分类">
            <SelectInput
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={[{ value: '', label: '未分类' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
            />
          </Field>
          <Field label="地址" hint="线下/混合活动必填">
            <TextInput
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="例如：教学楼 201"
            />
          </Field>
          <Field label="教室 / 房间号">
            <TextInput
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
              placeholder="可选"
            />
          </Field>
          <Field label="线上链接" hint="线上/混合活动必填">
            <TextInput
              value={form.virtualLink}
              onChange={(e) => setForm({ ...form, virtualLink: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label="人数上限" hint="留空表示不限">
            <TextInput
              type="number"
              min={0}
              value={form.maxCapacity}
              onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })}
              placeholder="不限"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="封面图链接">
              <TextInput
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </div>
          {formError && <p className="text-xs text-destructive sm:col-span-2">{formError}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        title="删除活动"
        width="max-w-md"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setDeleting(null)}>
              取消
            </AdminButton>
            <AdminButton variant="danger" loading={deleteBusy} onClick={() => void confirmDelete()}>
              确认删除
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          即将删除活动 <span className="font-medium text-foreground">{deleting?.title}</span>
          ，同时会清理该活动的报名记录。此操作不可撤销。
        </p>
      </Modal>
    </>
  );
};

export default AdminEvents;
