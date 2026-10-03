/**
 * 相册管理 —— 往期活动与其相册图片。
 *
 * 图片沿用原项目设计以 Base64 存库，所以列表只拿计数，
 * 缩略图直接走 /api/past-events/:id/poster 与 /:id/gallery/:index 两个服务端点，
 * 避免把几十 MB 的 Base64 拉进页面。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ImagePlus, Images, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import {
  createPastEvent,
  deleteGalleryImage,
  deletePastEvent,
  errorMessage,
  getPastEvent,
  getPastEvents,
  updatePastEvent,
  uploadGalleryImage,
  type AdminPastEvent,
  type Paged,
} from './adminApi';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Pagination, Panel, SelectInput, Td, TextArea, TextInput, Th, Tr } from './components';
import { formatDate, toLocalInputValue } from './formatting';

const PAGE_SIZE = 10;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const CATEGORIES = [
  'Orientation', 'Workshop', 'Masterclass', 'Tutorial',
  'Meetup', 'Hackathon', 'Seminar', 'Social', 'Other',
];

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });

interface EventForm {
  title: string;
  subtitle: string;
  date: string;
  category: string;
  body: string;
  attendance: string;
  tags: string;
  link: string;
  poster: string;
}

const emptyForm = (): EventForm => ({
  title: '',
  subtitle: '',
  date: '',
  category: 'Workshop',
  body: '',
  attendance: '',
  tags: '',
  link: '',
  poster: '',
});

const AdminGallery: React.FC = () => {
  const [data, setData] = useState<Paged<AdminPastEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<AdminPastEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleting, setDeleting] = useState<AdminPastEvent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [galleryFor, setGalleryFor] = useState<AdminPastEvent | null>(null);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(
        await getPastEvents({
          page,
          limit: PAGE_SIZE,
          search: query || undefined,
          category: category === 'all' ? undefined : category,
        })
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, query, category]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = async (event: AdminPastEvent) => {
    setFormError('');
    try {
      const detail = await getPastEvent(event.id);
      setEditing(event);
      setForm({
        title: detail.title || '',
        subtitle: detail.subtitle || '',
        date: toLocalInputValue(detail.date),
        category: detail.category || 'Other',
        body: detail.body || '',
        attendance: detail.attendance ? String(detail.attendance) : '',
        tags: (detail.tags || []).join(', '),
        link: detail.link || '',
        poster: '',
      });
      setModalOpen(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const pickPoster = async (file: File | undefined, target: 'form' | 'gallery') => {
    if (!file) return;
    const fail = (message: string) => {
      if (target === 'form') setFormError(message);
      else setGalleryError(message);
    };

    if (!file.type.startsWith('image/')) {
      fail('请选择图片文件。');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      fail('图片不能超过 4MB。');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (target === 'form') {
        setForm((prev) => ({ ...prev, poster: dataUrl }));
      } else if (galleryFor) {
        await addGalleryImage(galleryFor, dataUrl, file.name);
      }
    } catch (err) {
      fail(errorMessage(err));
    }
  };

  const addGalleryImage = async (event: AdminPastEvent, dataUrl: string, originalName: string) => {
    setGalleryBusy(true);
    setGalleryError('');
    try {
      const updated = await uploadGalleryImage(event.id, {
        data: dataUrl,
        caption: galleryCaption.trim(),
        originalName,
      });
      setGalleryFor(updated);
      setGalleryCaption('');
      await load();
    } catch (err) {
      setGalleryError(errorMessage(err));
    } finally {
      setGalleryBusy(false);
    }
  };

  const removeGalleryImage = async (index: number) => {
    if (!galleryFor) return;
    setGalleryBusy(true);
    setGalleryError('');
    try {
      const updated = await deleteGalleryImage(galleryFor.id, index);
      setGalleryFor(updated);
      await load();
    } catch (err) {
      setGalleryError(errorMessage(err));
    } finally {
      setGalleryBusy(false);
    }
  };

  const submit = async () => {
    setFormError('');
    if (!form.title.trim() || !form.subtitle.trim()) {
      setFormError('标题和副标题为必填项。');
      return;
    }
    if (!form.date) {
      setFormError('请选择活动日期。');
      return;
    }
    if (!editing && !form.body.trim()) {
      setFormError('正文为必填项。');
      return;
    }
    if (!editing && !form.poster) {
      setFormError('请上传活动海报。');
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      date: new Date(form.date).toISOString(),
      category: form.category,
      attendance: form.attendance ? Number(form.attendance) : 0,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      link: form.link.trim(),
    };
    if (form.body.trim()) payload.body = form.body.trim();
    if (form.poster) payload.poster = form.poster;

    setSaving(true);
    try {
      if (editing) {
        await updatePastEvent(editing.id, payload);
      } else {
        await createPastEvent(payload);
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
      await deletePastEvent(deleting.id);
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
        title="相册管理"
        subtitle="维护往期活动与其相册图片"
        actions={
          <>
            <AdminButton variant="secondary" onClick={() => void load()} loading={loading}>
              刷新
            </AdminButton>
            <AdminButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新建往期活动
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
              placeholder="搜索活动标题或副标题"
              className="pl-9"
            />
          </form>
          <div className="w-full sm:w-40">
            <SelectInput
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              options={[{ value: 'all', label: '全部分类' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
            />
          </div>
        </div>

        {loading && !data ? (
          <LoadingState label="正在加载往期活动…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title={query ? '没有匹配的往期活动' : '还没有往期活动'}
            description={
              query ? '换个关键词试试。' : '新建一条往期活动并上传现场照片，成员就能在相册里看到。'
            }
            action={!query && <AdminButton onClick={openCreate}>新建往期活动</AdminButton>}
          />
        ) : (
          <>
            <DataTable
              head={
                <>
                  <Th>活动</Th>
                  <Th>日期</Th>
                  <Th>分类</Th>
                  <Th>相册</Th>
                  <Th className="text-right">操作</Th>
                </>
              }
            >
              {data.items.map((event) => (
                <Tr key={event.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                        {event.hasPoster ? (
                          <img
                            src={event.posterUrl}
                            alt={`${event.title} 海报`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Images className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{event.title}</p>
                        <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-muted-foreground">
                          {event.subtitle}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(event.date)}</Td>
                  <Td>
                    <Badge tone="info">{event.category || 'Other'}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={event.galleryCount > 0 ? 'success' : 'neutral'}>
                      {event.galleryCount} 张
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <AdminButton
                        variant="ghost"
                        onClick={() => {
                          setGalleryError('');
                          setGalleryCaption('');
                          setGalleryFor(event);
                          void getPastEvent(event.id)
                            .then(setGalleryFor)
                            .catch((err) => setGalleryError(errorMessage(err)));
                        }}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        管理相册
                      </AdminButton>
                      <AdminButton variant="ghost" onClick={() => void openEdit(event)}>
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

      {/* 新建 / 编辑往期活动 */}
      <Modal
        open={modalOpen}
        title={editing ? '编辑往期活动' : '新建往期活动'}
        description={editing ? '正文留空则保持不变；海报不选则不替换。' : '海报为必填项，成员端列表用它做封面。'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </AdminButton>
            <AdminButton loading={saving} onClick={() => void submit()}>
              {editing ? '保存修改' : '创建'}
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
                placeholder="例如：2026 春季第一次班级团建"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="副标题" required>
              <TextInput
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="一句话概括"
              />
            </Field>
          </div>
          <Field label="活动日期" required>
            <TextInput
              type="datetime-local"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="分类">
            <SelectInput
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="参与人数">
            <TextInput
              type="number"
              min={0}
              value={form.attendance}
              onChange={(e) => setForm({ ...form, attendance: e.target.value })}
              placeholder="可选"
            />
          </Field>
          <Field label="回放/相关链接">
            <TextInput
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="正文" required={!editing}>
              <TextArea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="活动回顾，可分多段"
                className="min-h-[120px]"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="标签" hint="英文逗号分隔">
              <TextInput
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="团建, 破冰"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="活动海报" required={!editing} hint="PNG / JPEG / WebP / GIF，不超过 4MB">
              <div className="flex items-center gap-3">
                {form.poster && (
                  <img
                    src={form.poster}
                    alt="海报预览"
                    className="h-16 w-16 rounded-sm border border-border object-cover"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="poster-input"
                  onChange={(e) => {
                    void pickPoster(e.target.files?.[0], 'form');
                    e.target.value = '';
                  }}
                />
                <label
                  htmlFor="poster-input"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-border px-3.5 py-2 text-sm text-foreground transition-colors hover:bg-accent/10"
                >
                  <Upload className="h-4 w-4" />
                  选择图片
                </label>
              </div>
            </Field>
          </div>
          {formError && <p className="text-xs text-destructive sm:col-span-2">{formError}</p>}
        </div>
      </Modal>

      {/* 相册管理 */}
      <Modal
        open={Boolean(galleryFor)}
        title={`相册 · ${galleryFor?.title || ''}`}
        description="上传现场照片并填写说明，成员端相册按顺序展示。"
        onClose={() => setGalleryFor(null)}
        footer={
          <AdminButton variant="secondary" onClick={() => setGalleryFor(null)}>
            完成
          </AdminButton>
        }
      >
        <div className="space-y-4">
          <div className="rounded-sm border border-border p-3">
            <p className="mb-2 text-xs font-medium text-foreground">添加图片</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <TextInput
                value={galleryCaption}
                onChange={(e) => setGalleryCaption(e.target.value)}
                placeholder="图片说明（可选）"
                className="sm:flex-1"
              />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="gallery-input"
                onChange={(e) => {
                  void pickPoster(e.target.files?.[0], 'gallery');
                  e.target.value = '';
                }}
              />
              <label
                htmlFor="gallery-input"
                className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm px-3.5 py-2 text-sm font-medium transition-colors ${
                  galleryBusy ? 'pointer-events-none opacity-50' : ''
                } bg-primary text-primary-foreground hover:bg-primary/90`}
              >
                <Upload className="h-4 w-4" />
                上传图片
              </label>
            </div>
            {galleryError && <p className="mt-2 text-xs text-destructive">{galleryError}</p>}
          </div>

          {!galleryFor?.gallery || galleryFor.gallery.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">这个活动还没有照片。</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galleryFor.gallery.map((image) => (
                <figure key={image.index} className="overflow-hidden rounded-sm border border-border">
                  <img
                    src={image.url}
                    alt={image.caption || `相册图片 ${image.index + 1}`}
                    className="h-28 w-full object-cover"
                    loading="lazy"
                  />
                  <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="line-clamp-1 text-[11px] text-muted-foreground">
                      {image.caption || `#${image.index + 1}`}
                    </span>
                    <button
                      type="button"
                      disabled={galleryBusy}
                      onClick={() => void removeGalleryImage(image.index)}
                      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                      aria-label="删除这张图片"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 删除往期活动 */}
      <Modal
        open={Boolean(deleting)}
        title="删除往期活动"
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
          ，包含它的 {deleting?.galleryCount || 0} 张相册图片。此操作不可撤销。
        </p>
      </Modal>
    </>
  );
};

export default AdminGallery;
