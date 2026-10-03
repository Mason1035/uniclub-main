import { Dialog,DialogContent,DialogTitle,DialogDescription } from './dialog';
import { Button } from './button';
interface ConfirmationDialogProps {isOpen:boolean;onClose:()=>void;onConfirm:()=>void;title:string;message:string;confirmText?:string;cancelText?:string;type?:'danger'|'warning'|'info';isLoading?:boolean;}
export default function ConfirmationDialog({isOpen,onClose,onConfirm,title,message,confirmText='确认',cancelText='取消',type='danger',isLoading=false}:ConfirmationDialogProps) {
  return <Dialog open={isOpen} onOpenChange={open=>{if(!open&&!isLoading)onClose();}}><DialogContent onEscapeKeyDown={event=>{if(isLoading)event.preventDefault();}} onPointerDownOutside={event=>{if(isLoading)event.preventDefault();}}><DialogTitle>{title}</DialogTitle><DialogDescription>{message}</DialogDescription><div className="flex gap-3 mt-6"><Button variant="outline" className="flex-1" disabled={isLoading} onClick={onClose}>{cancelText}</Button><Button variant={type==='danger'?'destructive':'default'} className="flex-1" disabled={isLoading} onClick={onConfirm}>{isLoading?'正在处理…':confirmText}</Button></div></DialogContent></Dialog>;
}
