import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminButton, ErrorState, Field, LoadingState, Modal, TextInput } from './components';
import { quantificationApi, quantificationError } from '../../lib/quantificationApi';
import type { StorageConfiguration, StorageConfigurationInput } from '../../types/quantification';

const examples = {
  bucket: 'lianghuacailiao-2026-1306497854', region: 'ap-guangzhou',
  tokenEndpoint: 'https://1306497854-5j2alf1xxv.ap-guangzhou.tencentscf.com',
  functionUrl: 'https://1306497854-1s49l7lypj.ap-guangzhou.tencentscf.com',
};
const endpointFor = (bucket: string, region: string) => bucket && region ? `https://${bucket}.cos.${region}.myqcloud.com` : '';

function SettingsForm({ config, identity, onSaved }: { config: StorageConfiguration; identity: string; onSaved: (message: string) => void }) {
  const cache = useQueryClient();
  const [form, setForm] = useState<StorageConfigurationInput>(() => {
    const bucket = config.bucket || examples.bucket, region = config.region || examples.region;
    return { revision: config.revision, bucket, region, endpoint: config.endpoint || endpointFor(bucket, region), directoryPrefix: config.directoryPrefix,
      tokenEndpoint: config.tokenEndpoint || examples.tokenEndpoint, functionUrl: config.functionUrl || examples.functionUrl };
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const update = (key: keyof StorageConfigurationInput, value: string) => {
    setForm(previous => {
      const next = { ...previous, [key]: value };
      if (key === 'bucket' || key === 'region') next.endpoint = endpointFor(next.bucket, next.region);
      return next;
    });
    setDirty(true); setMessage(''); setError('');
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setSaving(true); setError(''); setMessage('');
    try {
      const saved = await quantificationApi.saveStorageConfig(form);
      setForm({ ...form, revision: saved.revision, endpoint: saved.endpoint, directoryPrefix: saved.directoryPrefix });
      setDirty(false);
      // Do not refetch/remount this form and lose the save confirmation.
      cache.setQueryData(['quantification-storage', identity], saved);
      await cache.invalidateQueries({ queryKey: ['quantification'] });
      const result = '配置已保存，后续上传和下载立即使用新配置。';
      setMessage(result); onSaved(result);
    } catch (err) { setError(quantificationError(err)); }
    finally { setSaving(false); lock.current = false; }
  };
  const test = async () => {
    if (lock.current) return;
    lock.current = true; setTesting(true); setError(''); setMessage('');
    try { setMessage((await quantificationApi.testStorageConfig()).message); }
    catch (err) { setError(quantificationError(err)); }
    finally { setTesting(false); lock.current = false; }
  };
  const busy = saving || testing;
  return <form onSubmit={event => void save(event)} className="space-y-4" aria-busy={busy}>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="存储桶 Bucket" required><TextInput value={form.bucket} required maxLength={100} disabled={busy} onChange={e => update('bucket', e.target.value)} autoComplete="off" /></Field>
      <Field label="地域 Region" required><TextInput value={form.region} required maxLength={40} disabled={busy} onChange={e => update('region', e.target.value)} placeholder="ap-guangzhou" autoComplete="off" /></Field>
    </div>
    <Field label="COS 地址 Endpoint" hint="修改存储桶或地域时自动更新；必须与它们对应。" required><TextInput type="url" value={form.endpoint} required maxLength={250} disabled={busy} onChange={e => update('endpoint', e.target.value)} autoComplete="off" /></Field>
    <Field label="上传目录 UploadDirectory / DIRECTORY_PREFIX" hint="例如 quantification/。修改后用于新上传，已有提交仍保留原路径。" required><TextInput value={form.directoryPrefix} required maxLength={128} disabled={busy} onChange={e => update('directoryPrefix', e.target.value)} autoComplete="off" /></Field>
    <Field label="上传凭证云函数 TOKEN_ENDPOINT" required><TextInput type="url" value={form.tokenEndpoint} required maxLength={250} disabled={busy} onChange={e => update('tokenEndpoint', e.target.value)} autoComplete="off" /></Field>
    <Field label="下载云函数 FUNCTION_URL" hint="填写根地址，系统自动使用 /list 和 /download。" required><TextInput type="url" value={form.functionUrl} required maxLength={250} disabled={busy} onChange={e => update('functionUrl', e.target.value)} autoComplete="off" /></Field>
    <p className="text-xs leading-relaxed text-muted-foreground">填写已部署云函数的 Function URL，保存后可检查连接。保存配置无需重启网站；已有材料时不能直接更换存储桶或地域。</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {message && <p role="status" className="form-success">{message}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      <AdminButton type="button" variant="secondary" loading={testing} disabled={busy || dirty || config.mode !== 'scf'} onClick={() => void test()}>检查已保存配置</AdminButton>
      <AdminButton type="submit" loading={saving} disabled={busy}>保存配置</AdminButton>
    </div>
  </form>;
}

export default function QuantificationStorageSettings({ identity, onClose, onSaved }: { identity: string; onClose: () => void; onSaved: (message: string) => void }) {
  const config = useQuery({ queryKey: ['quantification-storage', identity], queryFn: quantificationApi.storageConfig, staleTime: 0, retry: false });
  return <Modal open onClose={onClose} title="量化材料存储配置" description="统一配置学生上传和管理员下载所用的 COS 与云函数。">
    {config.isLoading ? <LoadingState label="正在读取配置…" /> : config.isError ? <ErrorState message={quantificationError(config.error)} onRetry={() => void config.refetch()} /> : config.data && <SettingsForm config={config.data} identity={identity} onSaved={onSaved} />}
  </Modal>;
}
