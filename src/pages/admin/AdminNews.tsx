/**
 * 新闻管理 - list / create / edit / delete articles.
 * Reuses: POST /api/news, PUT /api/news/:id, DELETE /api/news/:id,
 *         GET /api/admin/news. Daily automation shares the AI Assistant settings.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  createNews,
  deleteNews,
  errorMessage,
  getNews,
  updateNews,
  type AdminNews,
  type Paged,
} from './adminApi';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Pagination, Panel, SelectInput, Td, TextArea, TextInput, Th, Tr } from './components';
import { validateNewsForm } from './contentValidation';
import { formatDate } from './formatting';

const PAGE_SIZE = 10;

const CATEGORIES = [
  'AI/ML',
  'Startups',
  'Tech Industry',
  'Cybersecurity',
  'Software Development',
  'Gaming',
  'Gadgets',
  'IoT',
  'Mobile Tech',
  'Hardware',
];
const STATUSES = ['draft', 'pending', 'approved', 'archived'];

const statusTone = (status: string) => {
  if (status === 'approved') return 'success' as const;
  if (status === 'pending') return 'warning' as const;
  if (status === 'archived') return 'neutral' as const;
  return 'info' as const;
};

const statusLabel: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已发布',
  archived: '已归档',
};

interface NewsForm {
  title: string;
  excerpt: string;
  content: string;
  source: string;
  category: string;
  imageUrl: string;
  status: string;
  isFeatured: boolean;
  isTrending: boolean;
}

const emptyForm = (): NewsForm => ({
  title: '',
  excerpt: '',
  content: '',
  source: '',
  category: '',
  imageUrl: '',
  status: 'approved',
  isFeatured: false,
  isTrending: false,
});

const AdminNewsPage: React.FC = () => {
  const [data, setData] = useState<Paged<AdminNews> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<AdminNews | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NewsForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<AdminNews | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(
        await getNews({
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

  const openEdit = (article: AdminNews) => {
    setEditing(article);
    setForm({
      title: article.title || '',
      excerpt: article.excerpt || '',
      content: '',
      source: article.source || '',
      category: (article.categories && article.categories[0]) || '',
      imageUrl: article.imageUrl || '',
      status: article.status || 'approved',
      isFeatured: article.isFeatured,
      isTrending: article.isTrending,
    });
    setFormError('');
    setModalOpen(true);
  };

  const submit = async () => {
    setFormError('');
    const errors = validateNewsForm(form, Boolean(editing));
    if (Object.keys(errors).length) {
      setFormError(Object.values(errors)[0]);
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      source: form.source.trim(),
      categories: form.category ? [form.category] : [],
      imageUrl: form.imageUrl.trim(),
      status: form.status,
      isFeatured: form.isFeatured,
      isTrending: form.isTrending,
    };
    if (form.excerpt.trim()) payload.excerpt = form.excerpt.trim();
    if (form.content.trim()) payload.content = form.content.trim();

    setSaving(true);
    try {
      if (editing) {
        await updateNews(editing._id, payload);
      } else {
        await createNews(payload);
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
      await deleteNews(deleting._id);
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
        title="新闻管理"
        subtitle="发布、编辑与删除资讯内容"
        actions={
          <>
            <AdminButton variant="secondary" onClick={() => void load()} loading={loading}>
              刷新
            </AdminButton>
            <Link className="inline-flex min-h-11 items-center rounded-sm border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" to="/admin/ai#daily-news">AI 每日新闻</Link>
            <AdminButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              发布新闻
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
              placeholder="搜索标题、摘要或来源"
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
          <LoadingState label="正在加载新闻…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="还没有新闻"
            description="手动发布一篇，或前往 AI 助手设置每日新闻。"
            action={<AdminButton onClick={openCreate}>发布新闻</AdminButton>}
          />
        ) : (
          <>
            <DataTable
              head={
                <>
                  <Th>标题</Th>
                  <Th>来源</Th>
                  <Th>状态</Th>
                  <Th>发布时间</Th>
                  <Th className="text-right">操作</Th>
                </>
              }
            >
              {data.items.map((article) => (
                <Tr key={article._id}>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{article.title}</span>
                      {article.origin === 'ai_daily' && <Badge>AI 每日精选</Badge>}
                      {article.isFeatured && <Badge tone="info">精选</Badge>}
                      {article.isTrending && <Badge tone="warning">热门</Badge>}
                    </div>
                    <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">
                      {article.excerpt}
                    </p>
                  </Td>
                  <Td className="text-muted-foreground">{article.source}</Td>
                  <Td>
                    <Badge tone={statusTone(article.status)}>
                      {statusLabel[article.status] || article.status}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(article.publishedAt || article.createdAt, true)}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <AdminButton variant="ghost" onClick={() => openEdit(article)}>
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </AdminButton>
                      <AdminButton variant="danger-outline" onClick={() => setDeleting(article)}>
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
        title={editing ? '编辑新闻' : '发布新闻'}
        description={editing ? '正文留空则保持不变。' : '新建的新闻会立即发布到成员端。'}
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
                placeholder="新闻标题"
              />
            </Field>
          </div>
          <Field label="来源" required>
            <TextInput
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="例如：TechCrunch"
            />
          </Field>
          <Field label="分类">
            <SelectInput
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={[{ value: '', label: '未分类' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="摘要" required={!editing}>
              <TextArea
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                placeholder="一到两句话概括这条新闻"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="正文" required={!editing} hint={editing ? '留空表示不修改正文' : undefined}>
              <TextArea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="正文内容"
                className="min-h-[160px]"
              />
            </Field>
          </div>
          <Field label="封面图链接">
            <TextInput
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label="状态">
            <SelectInput
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={STATUSES.map((s) => ({ value: s, label: statusLabel[s] }))}
            />
          </Field>
          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-500"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
              />
              设为精选
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-500"
                checked={form.isTrending}
                onChange={(e) => setForm({ ...form, isTrending: e.target.checked })}
              />
              标记热门
            </label>
          </div>
          {formError && <p className="text-xs text-destructive sm:col-span-2">{formError}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        title="删除新闻"
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
          ，同时会清理该文章的评论。此操作不可撤销。
        </p>
      </Modal>
    </>
  );
};

export default AdminNewsPage;
