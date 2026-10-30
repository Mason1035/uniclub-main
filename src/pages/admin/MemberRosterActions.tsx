import { useEffect, useState } from 'react';
import { Upload, UserPlus } from 'lucide-react';
import { addRosterEntry, bulkImportRoster, deleteRosterEntry, errorMessage, type BulkImportResult } from './adminApi';
import { AdminButton, Field, Modal, TextArea, TextInput } from './components';

interface Props {
  onChanged: () => Promise<void>;
  deleting: { id: string; name: string } | null;
  onDeleteClose: () => void;
}
export default function MemberRosterActions({ onChanged, deleting, onDeleteClose }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', uniqueId: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);

  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => { setDeleteError(''); }, [deleting?.id]);
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
      await onChanged();
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
      await onChanged();
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
    setDeleteError('');
    try {
      await deleteRosterEntry(deleting.id);
      onDeleteClose();
      await onChanged();
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  return <>
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
      {/* 添加单个成员 */}
      <Modal
        open={addOpen}
        title="添加班级成员"
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
        title="移出班级名单"
        width="max-w-md"
        onClose={() => onDeleteClose()}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => onDeleteClose()}>
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
          账号、密码、身份及历史内容会保留，该成员会显示为名单外账号。
        </p>
        {deleteError && <p role="alert" className="mt-3 text-sm text-destructive">{deleteError}</p>}
      </Modal>
  </>;
}
