import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import FeeImage from '../../components/fees/FeeImage';
import FeeImagePicker from '../../components/fees/FeeImagePicker';
import FeeProofDialog from '../../components/fees/FeeProofDialog';
import { feesApi } from '../../lib/feesApi';
import type { FeeSubmission, FeeStatus } from '../../types/fees';
import { errorMessage } from './adminApi';
import { useAdminSession } from './adminSession';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Pagination, Panel, SelectInput, Td, Th, Tr } from './components';
import { formatDate } from './formatting';
import '../../styles/fees.css';

export default function AdminFees() {
  const admin = useAdminSession();
  const sessionKey = admin?.id || admin?.uniqueId || '';
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<FeeStatus | ''>('');
  const settings = useQuery({ queryKey: ['fees-settings', sessionKey], queryFn: feesApi.settings, staleTime: 0, refetchOnWindowFocus: true });
  const records = useQuery({ queryKey: ['admin-fees', sessionKey, page, status], queryFn: () => feesApi.list(page, status), staleTime: 0, refetchOnWindowFocus: true });
  const [qr, setQr] = useState<File | null>(null);
  const [savingQr, setSavingQr] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [proof, setProof] = useState<FeeSubmission | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<FeeSubmission | null>(null);
  const [qrError, setQrError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [message, setMessage] = useState('');
  const qrBusy = useRef(false);
  const confirmBusy = useRef(false);

  const saveQr = async () => {
    if (!qr || qrBusy.current) return;
    qrBusy.current = true; setSavingQr(true); setQrError(''); setMessage('');
    try {
      const saved = await feesApi.saveQr(qr);
      client.setQueryData(['fees-settings', sessionKey], saved);
      void client.invalidateQueries({ queryKey: ['fees-settings'] });
      setQr(null); setMessage('付款二维码已更新');
    } catch (cause) { setQrError(errorMessage(cause)); }
    finally { qrBusy.current = false; setSavingQr(false); }
  };

  const confirm = async () => {
    if (!confirmTarget || confirmBusy.current) return;
    confirmBusy.current = true; setConfirming(true); setConfirmError(''); setMessage('');
    try {
      await feesApi.confirm(confirmTarget.id);
      await client.invalidateQueries({ queryKey: ['admin-fees'] });
      void client.invalidateQueries({ queryKey: ['fees-me'] });
      setConfirmTarget(null); setMessage('已确认到账');
    } catch (cause) { setConfirmError(errorMessage(cause)); }
    finally { confirmBusy.current = false; setConfirming(false); }
  };

  return <div className="space-y-6">
    <PageHeader title="班费管理" subtitle="设置付款二维码，查看缴费凭证，人工确认实际到账。" actions={<AdminButton variant="secondary" onClick={() => { void settings.refetch(); void records.refetch(); }} disabled={settings.isFetching || records.isFetching}><RefreshCw size={16} aria-hidden="true"/>刷新</AdminButton>}/>
    {message && <p className="fee-success" role="status">{message}</p>}
    <Panel title="班费收款设置" description="当前付款二维码将显示在学生的班费缴纳页面。">
      {settings.isPending ? <LoadingState/> : settings.isError ? <ErrorState message={errorMessage(settings.error)} onRetry={() => void settings.refetch()}/> : <div className="fee-admin-settings">
        <div>{settings.data?.hasPaymentQr ? <>
          <FeeImage path="/api/fees/payment-qr" version={settings.data.updatedAt} sessionKey={sessionKey} alt="当前付款二维码" className="fee-admin-qr"/>
          <p className="fee-hint mt-3">更新时间：{formatDate(settings.data.updatedAt, true)}</p>
        </> : <EmptyState title="尚未设置付款二维码" description="请上传当前班费收款二维码。"/>}</div>
        <div className="space-y-4"><FeeImagePicker label={settings.data?.hasPaymentQr ? '更换付款码' : '上传付款码'} file={qr} onChange={value => { setQr(value); setQrError(''); }} disabled={savingQr}/>
          <AdminButton disabled={!qr} loading={savingQr} onClick={() => void saveQr()}>保存付款码</AdminButton>
          {qrError && <p className="fee-error" role="alert">{qrError}</p>}
        </div>
      </div>}
    </Panel>
    <Panel title="缴费记录" description="点击查看支付截图，核对微信实际到账后再确认。" padded={false} actions={<Field label="状态"><SelectInput aria-label="筛选缴费状态" value={status} onChange={event => { setStatus(event.target.value as FeeStatus | ''); setPage(1); }} options={[{ value: '', label: '全部' }, { value: 'SUBMITTED', label: '待确认' }, { value: 'CONFIRMED', label: '已确认' }]}/></Field>}>
      {records.isPending ? <LoadingState/> : records.isError ? <ErrorState message={errorMessage(records.error)} onRetry={() => void records.refetch()}/> : !records.data?.submissions.length ? <EmptyState title="暂无缴费记录" description={status ? '当前状态下没有缴费记录。' : '学生提交支付成功截图后会显示在这里。'}/> : <>
        <DataTable head={<><Th>提交人</Th><Th>备注</Th><Th>提交时间</Th><Th>支付凭证</Th><Th>状态</Th><Th>确认时间</Th><Th>操作</Th></>}>
          {records.data.submissions.map(row => <Tr key={row.id}>
            <Td><span className="font-medium">{row.user?.name || '未知用户'}</span><span className="block text-xs text-muted-foreground mt-1">{row.user?.uniqueId}</span></Td>
            <Td><span className="fee-table-remark">{row.remark || '—'}</span></Td>
            <Td>{formatDate(row.createdAt, true)}</Td>
            <Td><AdminButton variant="secondary" onClick={() => setProof(row)}>查看图片</AdminButton></Td>
            <Td><Badge tone={row.status === 'CONFIRMED' ? 'success' : 'warning'}>{row.status === 'CONFIRMED' ? '已确认' : '待确认'}</Badge></Td>
            <Td>{formatDate(row.confirmedAt, true)}</Td>
            <Td>{row.status === 'SUBMITTED' ? <AdminButton onClick={() => { setConfirmError(''); setConfirmTarget(row); }}>确认到账</AdminButton> : '—'}</Td>
          </Tr>)}
        </DataTable>
        <Pagination {...records.data.pagination} onChange={setPage}/>
      </>}
    </Panel>
    <FeeProofDialog submission={proof} sessionKey={sessionKey} onClose={() => setProof(null)}/>
    <Modal open={Boolean(confirmTarget)} title="确认到账" description="确认已经实际收到该用户的班费吗？" onClose={() => { if (!confirming) setConfirmTarget(null); }} width="max-w-lg" footer={<><AdminButton variant="secondary" disabled={confirming} onClick={() => setConfirmTarget(null)}>取消</AdminButton><AdminButton loading={confirming} onClick={() => void confirm()}>确认到账</AdminButton></>}>
      <p className="text-sm leading-7">提交人：{confirmTarget?.user?.name || '未知用户'}<br/>备注：{confirmTarget?.remark || '未填写'}</p>
      <p className="fee-hint mt-3">请先人工核对微信实际到账。确认后，该用户的缴费凭证将不可修改。</p>
      {confirmError && <p className="fee-error" role="alert">{confirmError}</p>}
    </Modal>
  </div>;
}
