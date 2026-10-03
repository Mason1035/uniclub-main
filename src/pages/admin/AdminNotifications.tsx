/**
 * 通知管理 —— 班级公告 CRUD + 站内通知概览。
 *
 * 原有的 Notification 集合是「评论回复/点赞」的逐用户通知，无法用来发公告，
 * 因此公告是独立模型（Announcement），成员端在通知页顶部看到。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Pencil, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react';
import {
  createAnnouncement,
  deleteAnnouncement,
  errorMessage,
  getAnnouncementOverview,
  getAnnouncements,
  updateAnnouncement,
  type AdminAnnouncement,
  type AnnouncementLevel,
  type AnnouncementOverview,
  type Paged,
} from './adminApi';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Pagination, Panel, SelectInput, Td, TextArea, TextInput, Th, Tr } from './components';
import { validateAnnouncementForm } from './contentValidation';
import { formatDate, toLocalInputValue } from './formatting';

const PAGE_SIZE = 10;

const LEVELS: AnnouncementLevel[] = ['info', 'important', 'urgent'];
const LEVEL_LABEL: Record<AnnouncementLevel, string> = {
  info: '通知',
  important: '重要',
  urgent: '紧急',
};
const levelTone = (level: AnnouncementLevel) =>
  level === 'urgent' ? ('danger' as const) : level === 'important' ? ('warning' as const) : ('info' as const);

interface AnnouncementForm {
  title: string;
  body: string;
  level: AnnouncementLevel;
  pinned: boolean;
  isPublished: boolean;
  link: string;
  expiresAt: string;
}

const emptyForm = (): AnnouncementForm => ({
  title: '',
  body: '',
  level: 'info',
  pinned: false,
  isPublished: true,
  link: '',
  expiresAt: '',
});

const AdminNotifications: React.FC = () => {
  const [data, setData] = useState<Paged<AdminAnnouncement> | null>(null);
  const [overview, setOverview] = useState<AnnouncementOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<AdminAnnouncement | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, stats] = await Promise.all([
        getAnnouncements({
          page,
          limit: PAGE_SIZE,
          search: query || undefined,
          level: level === 'all' ? undefined : level,
          status: status === 'all' ? undefined : status,
        }),
        getAnnouncementOverview(),
      ]);
      setData(list);
      setOverview(stats);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, query, level, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (item: AdminAnnouncement) => {
    setEditing(item);
    setForm({
      title: item.title,
      body: item.body,
      level: item.level,
      pinned: item.pinned,
      isPublished: item.isPublished,
      link: item.link || '',
      expiresAt: toLocalInputValue(item.expiresAt),
    });
    setFormError('');
    setModalOpen(true);
  };

  const submit = async () => {
    setFormError('');
    const errors = validateAnnouncementForm(form);
    if (Object.keys(errors).length) {
      setFormError(Object.values(errors)[0]);
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      body: form.body.trim(),
      level: form.level,
      pinned: form.pinned,
      isPublished: form.isPublished,
      link: form.link.trim(),
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, payload);
      } else {
        await createAnnouncement(payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePinned = async (item: AdminAnnouncement) => {
    setBusyId(item.id);
    try {
      await updateAnnouncement(item.id, { pinned: !item.pinned });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const togglePublished = async (item: AdminAnnouncement) => {
    setBusyId(item.id);
    try {
      await updateAnnouncement(item.id, { isPublished: !item.isPublished });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteAnnouncement(deleting.id);
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
        title="通知管理"
        subtitle="发布班级公告，成员会在通知页看到"
        actions={
          <>
            <AdminButton variant="secondary" onClick={() => void load()} loading={loading}>
              刷新
            </AdminButton>
            <AdminButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              发布公告
            </AdminButton>
          </>
        }
      />

      {overview && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-sm border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">公告总数</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
              {overview.announcements.total}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              已发布 {overview.announcements.published} · 草稿 {overview.announcements.draft}
            </p>
          </div>
          <div className="rounded-sm border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">置顶公告</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
              {overview.announcements.pinned}
            </p>
          </div>
          <div className="rounded-sm border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">紧急公告</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-destructive">
              {overview.announcements.urgent}
            </p>
          </div>
          <div className="rounded-sm border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">站内通知</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
              {overview.notifications.total}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              未读 {overview.notifications.unread}（评论回复/点赞自动产生）
            </p>
          </div>
        </div>
      )}

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
              placeholder="搜索公告标题或内容"
              className="pl-9"
            />
          </form>
          <div className="w-full sm:w-36">
            <SelectInput
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: '全部级别' },
                ...LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l] })),
              ]}
            />
          </div>
          <div className="w-full sm:w-36">
            <SelectInput
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'published', label: '已发布' },
                { value: 'draft', label: '草稿' },
              ]}
            />
          </div>
        </div>

        {loading && !data ? (
          <LoadingState label="正在加载公告…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title={query ? '没有匹配的公告' : '还没有公告'}
            description={
              query ? '换个关键词试试。' : '发布第一条班级公告，成员会在通知页看到。'
            }
            action={!query && <AdminButton onClick={openCreate}>发布公告</AdminButton>}
          />
        ) : (
          <>
            <DataTable
              head={
                <>
                  <Th>公告</Th>
                  <Th>级别</Th>
                  <Th>状态</Th>
                  <Th>发布时间</Th>
                  <Th className="text-right">操作</Th>
                </>
              }
            >
              {data.items.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.pinned && (
                        <Pin className="h-3.5 w-3.5 text-primary" aria-label="已置顶" />
                      )}
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">{item.body}</p>
                  </Td>
                  <Td>
                    <Badge tone={levelTone(item.level)}>{LEVEL_LABEL[item.level]}</Badge>
                  </Td>
                  <Td>
                    {item.isPublished ? <Badge tone="success">已发布</Badge> : <Badge tone="neutral">草稿</Badge>}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(item.publishedAt, true)}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <AdminButton
                        variant="ghost"
                        loading={busyId === item.id}
                        onClick={() => void togglePinned(item)}
                      >
                        {item.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        {item.pinned ? '取消置顶' : '置顶'}
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        loading={busyId === item.id}
                        onClick={() => void togglePublished(item)}
                      >
                        {item.isPublished ? '转草稿' : '发布'}
                      </AdminButton>
                      <AdminButton variant="ghost" onClick={() => openEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </AdminButton>
                      <AdminButton variant="ghost" onClick={() => setDeleting(item)}>
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
        title={editing ? '编辑公告' : '发布公告'}
        description="已发布的公告会立即出现在成员端通知页顶部。"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </AdminButton>
            <AdminButton loading={saving} onClick={() => void submit()}>
              {editing ? '保存修改' : '发布'}
            </AdminButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="标题" required>
              <TextInput
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例如：本周五算法课调至实验楼 A302"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="内容" required>
              <TextArea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="写清楚时间、地点、需要准备什么"
                className="min-h-[140px]"
              />
            </Field>
          </div>
          <Field label="级别">
            <SelectInput
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value as AnnouncementLevel })}
              options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l] }))}
            />
          </Field>
          <Field label="相关链接" hint="可选，例如报名表或会议链接">
            <TextInput
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label="到期时间" hint="留空表示长期有效，到期后成员端不再展示">
            <TextInput
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </Field>
          <div className="flex items-end gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-500"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              />
              置顶
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-500"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              />
              立即发布
            </label>
          </div>
          {formError && <p className="text-xs text-destructive sm:col-span-2">{formError}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        title="删除公告"
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
          即将删除公告 <span className="font-medium text-foreground">{deleting?.title}</span>，成员端将立即不再显示。
        </p>
      </Modal>
    </>
  );
};

export default AdminNotifications;
