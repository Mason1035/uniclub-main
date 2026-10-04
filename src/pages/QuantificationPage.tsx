import PageShell from '../components/PageShell';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, Download, Upload, ArrowLeft } from 'lucide-react';
import { useUser } from '../context/userContextState';
import ContentState from '../components/ContentState';
import PageHeading from '../components/PageHeading';
import QuantificationDownloads from '../components/QuantificationDownloads';
import { quantificationApi, quantificationBytes, quantificationDate, quantificationError, quantificationErrorCode, collectionAvailability, collectionStatusLabel } from '../lib/quantificationApi';
import { uploadQuantificationFile, validateQuantificationFile, type UploadProgress } from '../lib/quantificationUpload';
import type { DownloadLinks, SubmissionState, UploadSession } from '../types/quantification';
import '../styles/quantification.css';

type Phase = 'idle' | 'preparing' | 'uploading' | 'confirming' | 'success' | 'error' | 'cancelled';
export default function QuantificationPage() {
  const { user } = useUser();
  const cache = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [download, setDownload] = useState<DownloadLinks | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [, refreshClock] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const session = useRef<UploadSession | null>(null);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const fileValidation = useRef(0);
  const collections = useQuery({ queryKey: ['quantification', 'collections', user.id], queryFn: () => quantificationApi.collections(), enabled: Boolean(user.id), staleTime: 15000, refetchOnWindowFocus: true });
  const access = useQuery({ queryKey: ['quantification', 'access', user.id], queryFn: quantificationApi.access, enabled: Boolean(user.id) });
  const collectionId = selectedId || collections.data?.collections.find(c => collectionAvailability(c) === 'open')?.id || collections.data?.collections[0]?.id || '';
  const mineKey = ['quantification', 'mine', user.id, collectionId];
  const mine = useQuery({ queryKey: mineKey, queryFn: () => quantificationApi.mine(collectionId), enabled: Boolean(collectionId && user.id), staleTime: 10000, refetchOnWindowFocus: true });
  const collection = mine.data?.collection || collections.data?.collections.find(c => c.id === collectionId);
  const status = collection ? collectionAvailability(collection) : 'draft';
  const busy = ['preparing', 'uploading', 'confirming'].includes(phase);
  const canUpload = status === 'open' && collections.data?.storage.configured;

  useEffect(() => {
    mounted.current = true;
    const interval = setInterval(() => refreshClock(value => value + 1), 15000);
    return () => {
      mounted.current = false; clearInterval(interval);
      if (controller.current && !controller.current.signal.aborted) {
        controller.current.abort();
        if (session.current) void quantificationApi.abort(session.current.upload.id).catch(() => undefined);
      }
    };
  }, []);
  useEffect(() => {
    const beforeLeave = (event: BeforeUnloadEvent) => { if (locked.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeLeave);
    return () => window.removeEventListener('beforeunload', beforeLeave);
  }, []);

  const chooseFile = async (candidate: File | undefined) => {
    if (!candidate || locked.current) return;
    const sequence = ++fileValidation.current;
    try {
      await validateQuantificationFile(candidate);
      if (sequence !== fileValidation.current || !mounted.current) return;
      if (session.current) void quantificationApi.abort(session.current.upload.id).catch(() => undefined);
      session.current = null;
      setFile(candidate); setConfirmId(''); setPhase('idle'); setError(''); setProgress(null);
    } catch (err) { if (sequence === fileValidation.current && mounted.current) setError(quantificationError(err)); }
  };
  const confirmed = async (id: string) => {
    const result = await quantificationApi.complete(id);
    if (!mounted.current) return;
    cache.setQueryData<SubmissionState>(mineKey, current => current ? { ...current, submission: result.submission, pendingUpload: null } : current);
    await cache.invalidateQueries({ queryKey: mineKey });
    if (!mounted.current) return;
    setPhase('success'); setError(''); setConfirmId(''); setFile(null); session.current = null; controller.current = null;
  };
  const upload = async () => {
    if (locked.current || !file || !canUpload) return;
    locked.current = true; setError(''); setConfirmId(''); setPhase('preparing');
    const abort = new AbortController(); controller.current = abort;
    let transferred = false;
    try {
      if (!session.current || Date.parse(session.current.upload.expiresAt) <= Date.now()) session.current = await quantificationApi.init(collectionId, file);
      if (abort.signal.aborted) { await quantificationApi.abort(session.current.upload.id); throw new DOMException('Aborted', 'AbortError'); }
      if (!mounted.current) return;
      setPhase('uploading');
      await uploadQuantificationFile(file, session.current, abort.signal, p => { if (mounted.current) setProgress(p); });
      if (abort.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!mounted.current) return;
      transferred = true;
      setPhase('confirming'); setConfirmId(session.current.upload.id);
      // The server completes multipart uploads and checks the actual archive.
      controller.current = null;
      await confirmed(session.current.upload.id);
    } catch (err) {
      if (!mounted.current) return;
      if (abort.signal.aborted) { setPhase('cancelled'); setError(''); }
      else {
        setPhase('error'); setError(`${transferred ? '文件已传到 COS，提交确认尚未完成：' : ''}${quantificationError(err)}`);
        if (['UPLOAD_EXPIRED', 'VERSION_CONFLICT', 'ALREADY_REPLACED'].includes(quantificationErrorCode(err))) { session.current = null; setConfirmId(''); void mine.refetch(); }
      }
    } finally { locked.current = false; controller.current = null; }
  };
  const retryConfirm = async (id: string) => {
    if (locked.current) return;
    locked.current = true; setPhase('confirming'); setError('');
    try { await confirmed(id); }
    catch (err) { if (mounted.current) { setPhase('error'); setError(quantificationError(err)); } }
    finally { locked.current = false; }
  };
  const cancel = async () => {
    controller.current?.abort();
    const activeSession = session.current;
    session.current = null;
    setConfirmId('');
    if (activeSession) {
      try { await quantificationApi.abort(activeSession.upload.id); }
      catch (err) { if (mounted.current) setError(quantificationError(err)); }
    }
  };
  const downloadMine = async () => {
    if (!mine.data?.submission || downloading) return;
    setDownloading(true); setError('');
    try { setDownload({ links: [await quantificationApi.download(mine.data.submission.id)], errors: [] }); }
    catch (err) { setError(quantificationError(err)); }
    finally { setDownloading(false); }
  };
  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault(); setDragging(false);
    if (!canUpload || busy) return;
    if (event.dataTransfer.files.length !== 1) { setError('每次请选择一个 ZIP 压缩包。'); return; }
    void chooseFile(event.dataTransfer.files[0]);
  };
  const pendingId = confirmId || (!file ? mine.data?.pendingUpload?.id : '') || '';
  const transferredPending = Boolean(pendingId && progress?.percent === 100 && phase === 'error');

  return <PageShell className="quant-page"><Link className="text-primary text-sm inline-flex items-center gap-2 mb-4" to="/functions"><ArrowLeft size={16} aria-hidden="true"/>返回功能</Link><PageHeading title="上传量化文件" description="把材料整理成 ZIP，按收集期提交。" actions={access.data?.canManage && <Link className="ed-button secondary" to="/admin/quantification">管理收集</Link>}/>
    <ContentState illustration="resource" loading={collections.isPending} error={collections.error} onRetry={() => void collections.refetch()} empty={!collections.data?.collections.length} emptyTitle="暂时没有已发布的收集期" emptyDescription="管理员发布收集期后，你就可以在这里提交材料。">
      <div className="quant-toolbar"><label htmlFor="quant-period"><span className="text-sm">选择收集期</span><select id="quant-period" value={collectionId} disabled={busy} onChange={e => {
        if (session.current) void quantificationApi.abort(session.current.upload.id).catch(() => undefined);
        setSelectedId(e.target.value); setFile(null); setPhase('idle'); setError(''); setProgress(null); setConfirmId(''); session.current = null; fileValidation.current++;
      }}>{collections.data?.collections.map(c => <option key={c.id} value={c.id}>{c.title} · {collectionStatusLabel[collectionAvailability(c)]}</option>)}</select></label></div>
      <ContentState loading={mine.isPending} error={mine.error} onRetry={() => void mine.refetch()}>
        {collection && <div className="quant-workspace"><section className="quant-instructions"><p className="eyebrow">本期材料收集</p><h2>{collection.title}</h2><p className="quant-description">{collection.description || '请按班级要求整理材料，在截止时间前提交 ZIP 压缩包。'}</p><dl className="quant-facts"><dt>收集状态</dt><dd>{collectionStatusLabel[status]}</dd><dt>开始时间</dt><dd>{collection.startAt ? quantificationDate(collection.startAt) : '开放后即可提交'}</dd><dt>截止时间</dt><dd>{collection.deadline ? quantificationDate(collection.deadline) : '本期未设置截止时间'}</dd><dt>文件要求</dt><dd>ZIP 压缩包，最大 500MB</dd><dt>文件命名</dt><dd>建议使用“学号_姓名.zip”</dd></dl><p className="quant-note mt-6">{collections.data?.storage.provider === 'scf' ? '材料与当前登录账号关联，按原文件名保存到上传目录。同名文件不会覆盖，请先修改文件名；传输完成但确认失败时，可重新确认，无需重复上传。' : '材料与当前登录账号关联。新材料确认成功后才替换原提交；上传失败不会影响已提交材料。'}</p></section>
        <section className="quant-desk" aria-labelledby="quant-submit-heading"><h2 id="quant-submit-heading">我的提交</h2>
          {mine.data?.submission ? <div className="quant-receipt"><p className="quant-receipt-title"><CheckCircle2 size={18} aria-hidden="true"/>已提交 · 第 {mine.data.submission.version} 次</p><p className="quant-file-name">{mine.data.submission.originalFilename}</p><p className="text-sm text-muted-foreground">{quantificationBytes(mine.data.submission.fileSize)} · {quantificationDate(mine.data.submission.submittedAt)}</p><button type="button" className="ed-button secondary mt-4" onClick={() => void downloadMine()} disabled={downloading}><Download size={16} aria-hidden="true"/>{downloading ? '正在获取链接…' : '下载已提交材料'}</button></div> : <p className="text-sm text-muted-foreground mb-6">本期尚未提交材料。</p>}
          {!collections.data?.storage.configured && <p className="quant-note warning mb-4">文件上传尚未开通，请联系管理员配置对象存储。</p>}
          {status !== 'open' && <p className="quant-note mb-4">{status === 'scheduled' ? '收集尚未开始，请在开始时间后提交。' : '本期已截止，已提交材料仍可查看和下载。'}</p>}
          <input ref={input} className="sr-only" tabIndex={-1} type="file" accept=".zip,application/zip,application/x-zip-compressed" aria-label="选择量化 ZIP 文件" onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ''; }}/>
          <button type="button" className="quant-drop" data-dragging={dragging} disabled={!canUpload || busy} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); if (canUpload && !busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} aria-describedby="quant-file-help quant-error"><Upload size={28} aria-hidden="true"/><strong>{file ? '更换 ZIP 文件' : '选择 ZIP 文件'}</strong><span id="quant-file-help">也可以拖拽到这里<br/>单个文件，最大 500MB</span></button>
          {file && <div className="quant-file"><p className="quant-file-name"><Archive size={16} className="inline mr-2" aria-hidden="true"/>{file.name}</p><p className="text-sm text-muted-foreground">{quantificationBytes(file.size)}</p></div>}
          {progress && (busy || phase === 'error') && <div className="quant-progress"><progress value={progress.percent} max={100} aria-label="量化材料上传进度"/><div className="quant-progress-meta"><span>{progress.percent.toFixed(0)}% · {quantificationBytes(progress.loaded)} / {quantificationBytes(progress.total)}</span><span>{phase === 'confirming' ? '正在确认提交…' : `${quantificationBytes(progress.speed)}/秒`}</span></div></div>}
          <div id="quant-error" role={error ? 'alert' : undefined}>{error && <p className="form-error">{error}</p>}</div>
          {pendingId && !busy && <p className="quant-note mt-4">有一份上传尚未确认。传输完成后可重新确认；确认成功前，原提交保持有效。</p>}
          {phase === 'success' && <p role="status" className="quant-success">材料已确认，当前有效提交已更新。</p>}
          {phase === 'cancelled' && <p role="status" className="text-sm text-muted-foreground mt-4">已取消本次上传，原提交保持不变。</p>}
          <div className="quant-actions"><button className="ed-button" type="button" disabled={!file || !canUpload || busy} onClick={() => void (transferredPending ? retryConfirm(pendingId) : upload())}>{transferredPending ? '重新确认提交' : phase === 'preparing' ? '正在准备上传…' : phase === 'uploading' ? '正在上传…' : phase === 'confirming' ? '正在确认…' : phase === 'error' && file ? '重试上传' : mine.data?.submission ? '上传并重新提交' : '上传并提交'}</button>{phase === 'uploading' && <button className="ed-button secondary" type="button" onClick={() => void cancel()}>取消上传</button>}{pendingId && !transferredPending && canUpload && !busy && <button className="ed-button secondary" type="button" onClick={() => void retryConfirm(pendingId)}>重新确认提交</button>}</div>
        </section></div>}
      </ContentState>
    </ContentState><QuantificationDownloads result={download} onClose={() => setDownload(null)}/>
  </PageShell>;
}
