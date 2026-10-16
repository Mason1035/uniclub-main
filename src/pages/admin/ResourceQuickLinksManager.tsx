import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import {
  DEFAULT_RESOURCE_QUICK_LINKS,
  RESOURCE_QUICK_LINKS_QUERY_KEY,
  resourceQuickLinksApi,
  validateResourceQuickLink,
  type ResourceQuickLink,
  type ResourceQuickLinkInput,
} from '@/lib/resourceQuickLinks';
import { errorMessage } from './adminApi';
import { AdminButton, Badge, Field, Modal, Panel, TextInput } from './components';

const emptyForm = (): ResourceQuickLinkInput => ({ name: '', url: '', description: '' });

// Keep the fixed links in their prescribed order when a mutation updates the cache.
const withDefaults = (links: ResourceQuickLink[]): ResourceQuickLink[] => [
  ...DEFAULT_RESOURCE_QUICK_LINKS,
  ...links.filter(link => !link.isDefault && !DEFAULT_RESOURCE_QUICK_LINKS.some(item => item.id === link.id)),
];

const ResourceQuickLinksManager = () => {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: RESOURCE_QUICK_LINKS_QUERY_KEY,
    queryFn: ({ signal }) => resourceQuickLinksApi.list(signal),
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const [form, setForm] = useState<ResourceQuickLinkInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<ResourceQuickLink | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const operationLock = useRef(false);
  const links = query.data ?? DEFAULT_RESOURCE_QUICK_LINKS;
  const busy = saving || deleteBusy;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (operationLock.current) return;
    setFormError('');
    setNotice('');
    const input = {
      name: form.name.trim(),
      url: form.url.trim(),
      description: form.description.trim(),
    };
    const validationError = validateResourceQuickLink(input);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    operationLock.current = true;
    setSaving(true);
    try {
      const created = await resourceQuickLinksApi.create(input);
      await cache.cancelQueries({ queryKey: RESOURCE_QUICK_LINKS_QUERY_KEY });
      cache.setQueryData<ResourceQuickLink[]>(RESOURCE_QUICK_LINKS_QUERY_KEY, previous =>
        withDefaults([...(previous ?? DEFAULT_RESOURCE_QUICK_LINKS).filter(link => link.id !== created.id), created])
      );
      setForm(emptyForm());
      setNotice(`已添加「${created.name}」，资源页快捷访问已同步。`);
      await cache.invalidateQueries({ queryKey: RESOURCE_QUICK_LINKS_QUERY_KEY });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      operationLock.current = false;
      setSaving(false);
    }
  };

  const closeDelete = () => {
    if (operationLock.current) return;
    setDeleting(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleting || deleting.isDefault || operationLock.current) return;
    operationLock.current = true;
    setDeleteBusy(true);
    setDeleteError('');
    setNotice('');
    try {
      await resourceQuickLinksApi.remove(deleting.id);
      await cache.cancelQueries({ queryKey: RESOURCE_QUICK_LINKS_QUERY_KEY });
      cache.setQueryData<ResourceQuickLink[]>(RESOURCE_QUICK_LINKS_QUERY_KEY, previous =>
        withDefaults((previous ?? DEFAULT_RESOURCE_QUICK_LINKS).filter(link => link.id !== deleting.id))
      );
      setNotice(`已删除「${deleting.name}」。`);
      setDeleting(null);
      await cache.invalidateQueries({ queryKey: RESOURCE_QUICK_LINKS_QUERY_KEY });
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      operationLock.current = false;
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <Panel
        title="快捷访问"
        description="显示在资源页右侧。四个默认链接固定保留，新增链接可删除。"
        actions={
          <AdminButton
            type="button"
            variant="secondary"
            disabled={busy}
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            刷新链接
          </AdminButton>
        }
      >
        {query.isError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            快捷链接加载失败：{errorMessage(query.error)}。请点击“刷新链接”重试。
          </p>
        )}
        {query.isPending && (
          <p role="status" className="mb-4 text-xs text-muted-foreground">正在加载新增链接…</p>
        )}
        <ul className="divide-y divide-border">
          {links.map(link => (
            <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0 flex-1 basis-48">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 max-w-full items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  >
                    <span className="break-words">{link.name}</span>
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  </a>
                  {link.isDefault && <Badge>默认链接</Badge>}
                </div>
                <p className="break-all text-xs text-muted-foreground">{link.url}</p>
                {link.description && <p className="mt-1 break-words text-xs text-muted-foreground">{link.description}</p>}
              </div>
              {!link.isDefault && (
                <AdminButton
                  type="button"
                  variant="danger-outline"
                  disabled={busy}
                  aria-label={`删除快捷链接：${link.name}`}
                  onClick={() => { setDeleteError(''); setDeleting(link); }}
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  删除
                </AdminButton>
              )}
            </li>
          ))}
        </ul>

        <form className="mt-6 border-t border-border pt-5" onSubmit={event => void submit(event)}>
          <h3 className="mb-4 text-sm font-semibold text-foreground">添加快捷链接</h3>
          <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label="链接名称" required>
              <TextInput
                name="quickLinkName"
                required
                maxLength={60}
                value={form.name}
                placeholder="例如：班级代码仓库"
                onChange={event => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="链接地址" required hint="使用 http:// 或 https:// 开头的完整地址">
              <TextInput
                name="quickLinkUrl"
                type="url"
                required
                maxLength={2048}
                value={form.url}
                placeholder="https://…"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={event => setForm({ ...form, url: event.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="简短说明" hint="选填，最多 160 字">
                <TextInput
                  name="quickLinkDescription"
                  maxLength={160}
                  value={form.description}
                  placeholder="说明链接的用途"
                  onChange={event => setForm({ ...form, description: event.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <AdminButton type="submit" loading={saving} disabled={deleteBusy}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                添加链接
              </AdminButton>
            </div>
          </fieldset>
          {formError && <p role="alert" className="mt-3 text-sm text-destructive">{formError}</p>}
        </form>
        <p role="status" aria-live="polite" className="mt-3 text-sm text-primary">{notice}</p>
      </Panel>

      <Modal
        open={Boolean(deleting)}
        title="删除快捷链接"
        width="max-w-md"
        onClose={closeDelete}
        footer={
          <>
            <AdminButton type="button" variant="secondary" disabled={deleteBusy} onClick={closeDelete}>取消</AdminButton>
            <AdminButton type="button" variant="danger" loading={deleteBusy} onClick={() => void confirmDelete()}>确认删除</AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          将从资源页快捷访问中删除 <span className="font-medium text-foreground">{deleting?.name}</span>。需要时可重新添加。
        </p>
        {deleteError && <p role="alert" className="mt-3 text-sm text-destructive">{deleteError}</p>}
      </Modal>
    </>
  );
};

export default ResourceQuickLinksManager;
