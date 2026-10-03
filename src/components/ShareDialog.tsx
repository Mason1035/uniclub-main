import { useState } from 'react';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
interface ShareDialogProps { isOpen:boolean;onClose:()=>void;title:string;type:'news'|'event'|'social'|'resource';url?:string;onShare?:()=>void; }
export default function ShareDialog({isOpen,onClose,title,type,url=window.location.href,onShare}:ShareDialogProps) {
  const [status,setStatus]=useState(''); const [pending,setPending]=useState(false);
  const copy=async()=>{if(pending)return;setPending(true);setStatus('');try{await navigator.clipboard.writeText(url);setStatus('链接已复制，可以粘贴给同学。');onShare?.();}catch{setStatus('无法自动复制，请选择下方链接手动复制。');}finally{setPending(false);}};
  const share=async()=>{if(pending)return;setPending(true);try{await navigator.share({title,url});setStatus('分享已完成。');onShare?.();}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setStatus('分享未完成，可以复制链接。');}finally{setPending(false);}};
  return <Dialog open={isOpen} onOpenChange={open=>{if(!open){setStatus('');onClose();}}}><DialogContent><DialogTitle>分享{({news:'新闻',event:'活动',social:'动态',resource:'资源'})[type]}</DialogTitle><DialogDescription>{title}</DialogDescription><div className="form-field mt-4"><label htmlFor="share-url">内容链接</label><input id="share-url" value={url} readOnly onFocus={e=>e.currentTarget.select()}/></div><div className="flex flex-wrap gap-3"><button className="ed-button" disabled={pending} onClick={()=>void copy()}>{pending?'处理中…':'复制链接'}</button>{typeof navigator.share==='function'&&<button className="ed-button secondary" disabled={pending} onClick={()=>void share()}>系统分享</button>}</div>{status&&<p className="text-sm mt-4" role="status">{status}</p>}</DialogContent></Dialog>;
}
