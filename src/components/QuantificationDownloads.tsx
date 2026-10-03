import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import type { DownloadLinks } from '../types/quantification';

export default function QuantificationDownloads({ result, onClose }: { result: DownloadLinks | null; onClose: () => void }) {
  const [started, setStarted] = useState(false);
  const [expired, setExpired] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const frames = useRef<HTMLIFrameElement[]>([]);
  useEffect(() => {
    setStarted(false); setExpired(false);
    if (!result) return;
    const ends = Math.min(...result.links.map(l => Date.parse(l.expiresAt)));
    const expiryTimer = Number.isFinite(ends) ? setTimeout(() => setExpired(true), Math.max(0, ends - Date.now())) : undefined;
    return () => { clearTimeout(expiryTimer); timers.current.forEach(clearTimeout); frames.current.forEach(f => f.remove()); timers.current = []; frames.current = []; };
  }, [result]);
  const startAll = () => {
    if (!result || expired) return;
    setStarted(true);
    result.links.forEach((link, index) => {
      timers.current.push(setTimeout(() => {
        const frame = document.createElement('iframe');
        frame.hidden = true; frame.title = `下载${link.originalFilename}`; frame.referrerPolicy = 'no-referrer'; frame.src = link.url;
        document.body.appendChild(frame); frames.current.push(frame);
      }, index * 600));
    });
  };
  return <Dialog open={Boolean(result)} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="quant-download-dialog"><DialogTitle>下载量化材料</DialogTitle><DialogDescription>链接有效期为 5 分钟。每份材料分别下载；浏览器可能需要你允许多文件下载。</DialogDescription>
    {expired && <p className="form-error" role="alert">下载链接已过期，请关闭后重新获取。</p>}
    {!!result?.errors.length && <div role="alert" className="form-error">{result.errors.map(error => <p key={error.submissionId}>{error.error}</p>)}</div>}
    <ul className="quant-download-list">{result?.links.map(link => <li key={link.submissionId}><span>{link.originalFilename}</span><a className="ed-button secondary" href={expired ? undefined : link.url} aria-disabled={expired} target="_blank" rel="noreferrer" download={link.originalFilename}><Download aria-hidden="true" size={16}/>下载</a></li>)}</ul>
    {(result?.links.length || 0) > 1 && <button type="button" className="ed-button" disabled={started || expired} onClick={startAll}>{started ? '已发起下载' : '下载全部选中文件'}</button>}
    {started && <p role="status" className="text-sm text-muted-foreground">请查看浏览器下载列表。如果被拦截，请允许多文件下载，或使用上方单文件入口。关闭此窗口会停止尚未发起的下载。</p>}
  </DialogContent></Dialog>;
}
