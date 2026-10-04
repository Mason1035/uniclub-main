import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeading from '../components/PageHeading';
import FeeImage from '../components/fees/FeeImage';
import FeeImagePicker from '../components/fees/FeeImagePicker';
import FeeProofDialog from '../components/fees/FeeProofDialog';
import { useUser } from '../context/userContextState';
import { feesApi } from '../lib/feesApi';
import { errorMessage } from './admin/adminApi';
import { AdminButton, Badge, ErrorState, Field, LoadingState, TextArea } from './admin/components';
import { formatDate } from './admin/formatting';
import '../styles/fees.css';

export default function FeesPage() {
  const { user } = useUser();
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ['fees-settings', user.id], queryFn: feesApi.settings, enabled: Boolean(user.id), staleTime: 0, refetchOnWindowFocus: true });
  const mine = useQuery({ queryKey: ['fees-me', user.id], queryFn: feesApi.mine, enabled: Boolean(user.id), staleTime: 0, refetchOnWindowFocus: true });
  const [remark, setRemark] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [viewProof, setViewProof] = useState(false);
  const busy = useRef(false);
  const submission = mine.data;
  const confirmed = submission?.status === 'CONFIRMED';

  useEffect(() => {
    if (!dirty || confirmed) setRemark(submission?.remark || '');
    if (confirmed) { setFile(null); setDirty(false); }
  }, [submission?.remark, confirmed, dirty]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current || confirmed) return;
    if (!submission && !file) { setError('请上传支付成功截图。'); return; }
    busy.current = true;
    setSaving(true); setError(''); setMessage('');
    try {
      const saved = await feesApi.submit(remark, file, Boolean(submission));
      client.setQueryData(['fees-me', user.id], saved);
      setDirty(false); setFile(null); setRemark(saved.remark);
      setMessage('缴费凭证提交成功');
    } catch (cause) {
      setError(errorMessage(cause));
      // A confirmation may have raced with this edit. Refresh the server state.
      void mine.refetch();
    } finally { busy.current = false; setSaving(false); }
  };

  return <PageShell className="fee-page">
    <Link className="inline-flex items-center gap-2 text-primary mb-5 text-sm" to="/functions"><ArrowLeft size={16} aria-hidden="true"/>返回功能</Link>
    <PageHeading title="交班费" description="请完成付款后上传支付成功截图。"/>
    <div className="fee-workspace">
      <section className="fee-qr-desk" aria-labelledby="fee-qr-title">
        <h2 id="fee-qr-title">当前付款二维码</h2>
        {settings.isPending ? <LoadingState/> : settings.isError ? <ErrorState message={errorMessage(settings.error)} onRetry={() => void settings.refetch()}/> : settings.data?.hasPaymentQr ? <>
          <FeeImage path="/api/fees/payment-qr" version={settings.data.updatedAt} sessionKey={user.id} alt="班费付款二维码" className="fee-qr-image"/>
          <p className="fee-hint mt-4">请使用微信扫码完成付款，再提交支付成功截图。</p>
        </> : <EmptyState illustration="activity" title="管理员尚未设置付款二维码" description="请等待管理员设置付款码，或联系班委。"/>}
      </section>
      <section className="fee-submission-desk" aria-labelledby="fee-submit-title">
        <h2 id="fee-submit-title">我的缴费凭证</h2>
        {mine.isPending ? <LoadingState/> : mine.isError ? <ErrorState message={errorMessage(mine.error)} onRetry={() => void mine.refetch()}/> : <>
          {submission ? <div className="fee-receipt">
            <div className="flex flex-wrap items-center gap-2"><strong>{confirmed ? '班费已确认到账' : '缴费凭证已提交'}</strong><Badge tone={confirmed ? 'success' : 'warning'}>{confirmed ? '✓ 已确认' : '已提交 / 待确认'}</Badge></div>
            <dl className="fee-facts mt-4"><dt>备注</dt><dd>{submission.remark || '未填写'}</dd><dt>提交时间</dt><dd>{formatDate(submission.createdAt, true)}</dd>{confirmed && <><dt>确认时间</dt><dd>{formatDate(submission.confirmedAt, true)}</dd></>}<dt>支付凭证</dt><dd><AdminButton variant="secondary" onClick={() => setViewProof(true)}>查看图片</AdminButton></dd></dl>
          </div> : <p className="fee-hint mb-6">你还没有提交缴费凭证。</p>}
          {confirmed ? <p className="fee-notice"><CheckCircle2 size={18} aria-hidden="true"/>管理员已确认到账，当前凭证只读。</p> : <form className="fee-form" onSubmit={event => void submit(event)}>
            <Field label="备注" hint={`${remark.length} / 200 字符 · 非必填`}><TextArea maxLength={200} placeholder="请输入寝室号、付款人等备注，例如：6-301寝室" value={remark} disabled={saving} onChange={event => { setRemark(event.target.value); setDirty(true); setMessage(''); }}/></Field>
            <FeeImagePicker label="支付成功截图" required={!submission} existing={Boolean(submission)} disabled={saving} file={file} onChange={value => { setFile(value); setDirty(true); setMessage(''); }}/>
            <p className="fee-hint">提交后由管理员核对实际到账。待确认时可以修改备注或更换截图。</p>
            <div><AdminButton type="submit" loading={saving} disabled={!submission ? !file : !dirty}>{saving ? '正在提交…' : submission ? '保存修改' : '提交缴费凭证'}</AdminButton></div>
          </form>}
          {message && <p className="fee-success" role="status">{message}</p>}
          {error && <p className="fee-error" role="alert">{error}</p>}
        </>}
      </section>
    </div>
    <FeeProofDialog submission={viewProof && submission ? submission : null} sessionKey={user.id} onClose={() => setViewProof(false)}/>
  </PageShell>;
}
