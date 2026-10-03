/**
 * 班级名单 - 按学号维护名单，并为新成员创建学生账号。
 * 新账号初始密码为学号；重复导入保留已有密码。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Search, Trash2, Upload, UserPlus } from 'lucide-react';
import {
  addRosterEntry,
  bulkImportRoster,
  deleteRosterEntry,
  errorMessage,
  getRoster,
  type BulkImportResult,
  type RosterPage,
} from './adminApi';
import {
  AdminButton,
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  Td,
  TextArea,
  TextInput,
  Th,
  Tr,
} from './components';

const PAGE_SIZE = 20;

const AdminRoster: React.FC = () => {
  const [data, setData] = useState<RosterPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', uniqueId: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);

  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getRoster({ page, limit: PAGE_SIZE, search: query || undefined }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitAdd = async () => {
    setFormError('');
    if (!form.name.trim() || !form.uniqueId.trim()) {
      setFormError('姓名、学号均为必填项。');
      return;
    }
    setSaving(true);
    try {
      await addRosterEntry({
        email: form.email.trim(),
        name: form.name.trim(),
        uniqueId: form.uniqueId.trim(),
      });
      setAddOpen(false);
      setForm({ email: '', name: '', uniqueId: '' });
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitBulk = async () => {
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const result = await bulkImportRoster(bulkText);
      setBulkResult(result);
      await load();
    } catch (err) {
      setBulkResult({
        created: 0,
        updated: 0,
        failed: 1,
        errors: [errorMessage(err)],
        total: 0,
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteRosterEntry(deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const summary = data?.summary;
  const pendingCount = summary ? Math.max(0, summary.total - summary.registered) : 0;

  return (
    <>
      <PageHeader
        title="班级名单"
        subtitle="按学号开通班级账号，新建学生账号的初始密码为学号"
        actions={
          <>
            <AdminButton variant="secondary" onClick={() => void load()} loading={loading}>
              刷新
            </AdminButton>
            <AdminButton
              variant="secondary"
              onClick={() => {
                setBulkText('');
                setBulkResult(null);
                setBulkOpen(true);
              }}
            >
              <Upload className="h-4 w-4" />
              批量导入
            </AdminButton>
            <AdminButton
              onClick={() => {
                setForm({ email: '', name: '', uniqueId: '' });
                setFormError('');
                setAddOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              添加成员
            </AdminButton>
          </>
        }
      />

      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-sm border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">名单总数</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{summary.total}</p>
          </div>
          <div className="rounded-sm border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">账号已创建</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-primary">
              {summary.registered}
            </p>
          </div>
          <div className="rounded-sm border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">待开通</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{pendingCount}</p>
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
              placeholder="搜索姓名 / 学号 / 联系邮箱"
              className="pl-9"
            />
          </form>
        </div>

        {loading && !data ? (
          <LoadingState label="正在加载名单…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            title={query ? '没有匹配的名单记录' : '名单还是空的'}
            description={
              query
                ? '换个关键词试试。'
                : '导入名单后会自动开通学生账号。可点右上角「批量导入」粘贴 Excel 中的学号和姓名两列，或运行 npm run roster:import 导入 CSV / JSON。'
            }
            action={
              !query && (
                <AdminButton
                  onClick={() => {
                    setBulkText('');
                    setBulkResult(null);
                    setBulkOpen(true);
                  }}
                >
                  批量导入名单
                </AdminButton>
              )
            }
          />
        ) : (
          <>
            <DataTable
              head={
                <>
                  <Th>姓名</Th>
                  <Th>联系邮箱</Th>
                  <Th>学号</Th>
                  <Th>状态</Th>
                  <Th className="text-right">操作</Th>
                </>
              }
            >
              {data.entries.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="font-medium">{entry.name}</Td>
                  <Td className="text-muted-foreground">{entry.email || '—'}</Td>
                  <Td>
                    <code className="font-mono text-xs text-muted-foreground">{entry.uniqueId}</code>
                  </Td>
                  <Td>
                    {entry.registered ? (
                      <Badge tone="success">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        账号已创建
                      </Badge>
                    ) : (
                      <Badge tone="warning">
                        <Clock className="mr-1 h-3 w-3" />
                        待开通
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <AdminButton
                      variant="ghost"
                      onClick={() => setDeleting({ id: entry.id, name: entry.name })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      移除
                    </AdminButton>
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

      {/* 添加单个成员 */}
      <Modal
        open={addOpen}
        title="添加名单成员"
        description="添加后自动开通账号，使用学号登录，初始密码为学号。已有账号保留原密码。"
        width="max-w-lg"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setAddOpen(false)}>
              取消
            </AdminButton>
            <AdminButton loading={saving} onClick={() => void submitAdd()}>
              保存
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="姓名" required>
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="张三"
            />
          </Field>
          <Field label="联系邮箱（选填）">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="可留空，不用于登录"
            />
          </Field>
          <Field label="学号" required>
            <TextInput
              value={form.uniqueId}
              onChange={(e) => setForm({ ...form, uniqueId: e.target.value })}
              placeholder="20230001"
            />
          </Field>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>
      </Modal>

      {/* 批量导入 */}
      <Modal
        open={bulkOpen}
        title="批量导入名单"
        description="每行一位同学，填写「学号, 姓名」。支持直接粘贴 Excel 两列，也兼容原有邮箱、姓名、学号格式；可带表头。"
        onClose={() => setBulkOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setBulkOpen(false)}>
              关闭
            </AdminButton>
            <AdminButton loading={bulkBusy} onClick={() => void submitBulk()} disabled={!bulkText.trim()}>
              开始导入
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="名单内容" hint="按学号更新名单；新账号初始密码为学号，重复导入不会覆盖已有密码。">
            <TextArea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'20230001,张三\n20230002,李四'}
              className="min-h-[180px] font-mono text-xs"
            />
          </Field>
          {bulkResult && (
            <div className="rounded-sm border border-border bg-background p-3 text-xs">
              <p className="text-foreground">
                新建 <span className="font-semibold text-primary">{bulkResult.created}</span> · 更新{' '}
                <span className="font-semibold text-primary">{bulkResult.updated}</span> · 失败{' '}
                <span className="font-semibold text-destructive">{bulkResult.failed}</span>
                {bulkResult.accountsCreated !== undefined && ` · 新开通账号 ${bulkResult.accountsCreated}`}
                {bulkResult.total > 0 && ` · 名单总数 ${bulkResult.total}`}
              </p>
              {bulkResult.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {bulkResult.errors.map((message) => (
                    <li key={message}>· {message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* 移除确认 */}
      <Modal
        open={Boolean(deleting)}
        title="从名单中移除"
        width="max-w-md"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setDeleting(null)}>
              取消
            </AdminButton>
            <AdminButton variant="danger" loading={deleteBusy} onClick={() => void confirmDelete()}>
              确认移除
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          将 <span className="font-medium text-foreground">{deleting?.name}</span> 从班级名单中移除。
          已有账号和密码会保留，仅移除名单记录。
        </p>
      </Modal>
    </>
  );
};

export default AdminRoster;
