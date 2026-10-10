/**
 * 资源管理 - list / create / edit / delete learning resources.
 * Reuses: POST /api/resources, PUT /api/resources/:id, DELETE /api/resources/:id,
 *         GET /api/admin/resources.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  RESOURCE_CATEGORIES,
  RESOURCE_CATEGORY_META,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
} from '@/lib/resourceMeta';
import {
  createResource,
  deleteResource,
  errorMessage,
  getResources,
  updateResource,
  type AdminResource,
  type Paged,
} from './adminApi';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Pagination, Panel, SelectInput, Td, TextArea, TextInput, Th, Tr } from './components';
import { validateResourceForm } from './contentValidation';
import { formatDate } from './formatting';

const PAGE_SIZE = 10;

const TYPES = RESOURCE_TYPES;
const TYPE_LABEL = RESOURCE_TYPE_LABELS;
const CATEGORIES = RESOURCE_CATEGORIES;
const STATUSES = ['pending', 'approved', 'rejected', 'archived'];
const statusLabel: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  archived: '已归档',
};

const statusTone = (status: string) => {
  if (status === 'approved') return 'success' as const;
  if (status === 'pending') return 'warning' as const;
  if (status === 'rejected') return 'danger' as const;
  return 'neutral' as const;
};

interface ResourceForm {
  title: string;
  description: string;
  type: string;
  category: string;
  status: string;
  linkUrl: string;
  thumbnailUrl: string;
  tags: string;
}

const emptyForm = (): ResourceForm => ({
  title: '',
  description: '',
  type: 'Tool',
  category: '开发工具',
  status: 'approved',
  linkUrl: '',
  thumbnailUrl: '',
  tags: '',
});

const AdminResources: React.FC = () => {
  const [data, setData] = useState<Paged<AdminResource> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<AdminResource | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ResourceForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<AdminResource | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(
        await getResources({
          page,
          limit: PAGE_SIZE,
          search: query || undefined,
          status: status === 'all' ? undefined : status,
          type: type === 'all' ? undefined : type,
          category: category === 'all' ? undefined : category,
        })
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, query, status, type, category]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (resource: AdminResource) => {
    setEditing(resource);
    setForm({
      title: resource.title || '',
      description: resource.description || '',
      type: resource.type || 'Tool',
      category: resource.category || '开发工具',
      status: resource.status || 'approved',
      linkUrl: resource.linkUrl || '',
      thumbnailUrl: resource.thumbnailUrl || '',
      tags: (resource.tags || []).join(', '),
    });
    setFormError('');
    setModalOpen(true);
  };

  const submit = async () => {
    setFormError('');
    const errors = validateResourceForm(form);
    if (Object.keys(errors).length) {
      setFormError(Object.values(errors)[0]);
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      category: form.category,
      status: form.status,
      linkUrl: form.linkUrl.trim(),
      thumbnailUrl: form.thumbnailUrl.trim(),
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    setSaving(true);
    try {
      if (editing) {
        await updateResource(editing._id, payload);
      } else {
        await createResource(payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const approve = async (resource: AdminResource) => {
    setBusyId(resource._id);
    try {
      await updateResource(resource._id, { status: 'approved' });
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
      await deleteResource(deleting._id);
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
        title="资源管理"
        subtitle="AI 工具、GitHub 项目、比赛、证书与学习网站"
        actions={
          <>
            <AdminButton variant="secondary" onClick={() => void load()} loading={loading}>
              刷新
            </AdminButton>
            <AdminButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增资源
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
              placeholder="搜索资源标题或描述"
              className="pl-9"
            />
          </form>
          <div className="w-full sm:w-36">
            <SelectInput
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: '全部类型' },
                ...TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
              ]}
            />
          </div>
          <div className="w-full sm:w-36">
            <SelectInput
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: '全部分类' },
                ...CATEGORIES.map((c) => ({ value: c, label: c })),
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
                ...STATUSES.map((s) => ({ value: s, label: statusLabel[s] })),
              ]}
            />
          </div>
        </div>

        {loading && !data ? (
          <LoadingState label="正在加载资源…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="还没有资源"
            description="添加第一个学习资源，成员即可在资源页浏览。"
            action={<AdminButton onClick={openCreate}>新增资源</AdminButton>}
          />
        ) : (
          <>
            <DataTable
              head={
                <>
                  <Th>资源</Th>
                  <Th>分类</Th>
                  <Th>形态</Th>
                  <Th>状态</Th>
                  <Th>数据</Th>
                  <Th className="text-right">操作</Th>
                </>
              }
            >
              {data.items.map((resource) => (
                <Tr key={resource._id}>
                  <Td>
                    <p className="font-medium">{resource.title}</p>
                    <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">
                      {resource.description || '—'}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone="info">{resource.category}</Badge>
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {TYPE_LABEL[resource.type] || resource.type}
                  </Td>
                  <Td>
                    <Badge tone={statusTone(resource.status)}>
                      {statusLabel[resource.status] || resource.status}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    浏览 {resource.views} · 下载 {resource.downloadCount}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      {resource.status !== 'approved' && (
                        <AdminButton
                          variant="ghost"
                          loading={busyId === resource._id}
                          onClick={() => void approve(resource)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          通过
                        </AdminButton>
                      )}
                      <AdminButton variant="ghost" onClick={() => openEdit(resource)}>
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </AdminButton>
                      <AdminButton variant="danger-outline" onClick={() => setDeleting(resource)}>
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
        title={editing ? '编辑资源' : '新增资源'}
        description="管理员创建的资源会直接发布给成员。"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </AdminButton>
            <AdminButton loading={saving} onClick={() => void submit()}>
              {editing ? '保存修改' : '创建资源'}
            </AdminButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="资源标题" required>
              <TextInput
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例如：Cursor 高效开发指南"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="描述">
              <TextArea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="简要说明这个资源的用途"
              />
            </Field>
          </div>
          <Field label="业务分类" required hint={RESOURCE_CATEGORY_META[form.category]?.description}>
            <SelectInput
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="资源形态" required>
            <SelectInput
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
            />
          </Field>
          <Field label="状态">
            <SelectInput
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={STATUSES.map((s) => ({ value: s, label: statusLabel[s] }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="资源链接" required hint="GitHub 仓库、文档、视频或工具地址">
              <TextInput
                value={form.linkUrl}
                onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="缩略图链接">
              <TextInput
                value={form.thumbnailUrl}
                onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="标签" hint="使用英文逗号分隔，例如：AI, 效率工具">
              <TextInput
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="AI, 开发工具"
              />
            </Field>
          </div>
          {formError && <p className="text-xs text-destructive sm:col-span-2">{formError}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        title="删除资源"
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
          即将删除 <span className="font-medium text-foreground">{deleting?.title}</span>
          ，同时会清理相关评论。此操作不可撤销。
        </p>
      </Modal>
    </>
  );
};

export default AdminResources;
