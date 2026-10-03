import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { AdminButton, Field, Modal, TextInput } from '../components';
import { aiErrorMessage, deleteAiKey, saveAiKey, testAiConnection } from './api';
import type { AiSettings } from './types';

export default function KeySettings({ settings, onChange, onTested, disabled }: { settings: AiSettings | null; onChange: (value: AiSettings) => void; onTested: (ok: boolean) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false), [deleting, setDeleting] = useState(false);
  const [value, setValue] = useState(''), [busy, setBusy] = useState(false), [testing, setTesting] = useState(false), [error, setError] = useState('');
  const edit = () => { setValue(''); setError(''); setOpen(true); };
  const save = async () => {
    if (busy || !value.trim()) return;
    setBusy(true); setError('');
    try { onChange(await saveAiKey(value)); setValue(''); setOpen(false); onTested(false); toast.success('DeepSeek API Key 已安全保存。'); }
    catch (e) { setError(aiErrorMessage(e)); setValue(''); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { onChange(await deleteAiKey()); setDeleting(false); onTested(false); toast.success('DeepSeek API Key 已删除。'); }
    catch (e) { setError(aiErrorMessage(e)); }
    finally { setBusy(false); }
  };
  const test = async () => {
    if (testing) return;
    setTesting(true); setError('');
    try { const result = await testAiConnection(); onTested(true); toast.success(result.message); }
    catch (e) { onTested(false); setError(aiErrorMessage(e)); }
    finally { setTesting(false); }
  };
  return <section aria-label="DeepSeek API Key" className="mb-6 border-y border-border py-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">DeepSeek API Key</p><p className="mt-1 text-xs text-muted-foreground">{settings?.configured ? `已安全保存 · 末四位 ${settings.last4}` : '未配置 · 配置后即可生成内容'}</p></div></div>
      <div className="flex flex-wrap gap-2">
        {settings?.configured && <AdminButton variant="secondary" loading={testing} disabled={disabled || busy} onClick={() => void test()}>测试连接</AdminButton>}
        <AdminButton variant={settings?.configured ? 'secondary' : 'primary'} disabled={disabled || busy || testing || !settings} onClick={edit}>{settings?.configured ? '更换 API Key' : '配置 API Key'}</AdminButton>
        {settings?.configured && <AdminButton variant="ghost" disabled={disabled || busy || testing} onClick={() => { setError(''); setDeleting(true); }}>删除</AdminButton>}
      </div>
    </div>
    {error && !open && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
    <Modal open={open} onClose={() => { if (!busy) { setOpen(false); setValue(''); setError(''); } }} title={settings?.configured ? '更换 DeepSeek API Key' : '配置 DeepSeek API Key'} description="密钥仅用于服务器调用 DeepSeek。保存后包括你本人在内的管理员均无法再次查看或复制。" width="max-w-lg" footer={<><AdminButton variant="secondary" disabled={busy} onClick={() => { setOpen(false); setValue(''); }}>取消</AdminButton><AdminButton loading={busy} disabled={!value.trim()} onClick={() => void save()}>安全保存</AdminButton></>}>
      <Field label="完整的新 API Key" required><TextInput type="password" value={value} onChange={e => setValue(e.target.value)} autoComplete="off" spellCheck={false} placeholder="sk-…" maxLength={256} disabled={busy} /></Field>
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
    </Modal>
    <Modal open={deleting} onClose={() => { if (!busy) setDeleting(false); }} title="删除 DeepSeek API Key" description="删除后 AI 助手将暂停服务。需要重新输入完整密钥才能恢复。" width="max-w-lg" footer={<><AdminButton variant="secondary" disabled={busy} onClick={() => setDeleting(false)}>取消</AdminButton><AdminButton variant="danger" loading={busy} onClick={() => void remove()}>确认删除</AdminButton></>}>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</Modal>
  </section>;
}
