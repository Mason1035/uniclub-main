import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { useUser } from '../../context/userContextState';
import { changePassword, accountError } from './account-api';
import type { ClassHubPetConfigStore } from '../pet/pet-config';
export default function ChangePasswordDialog({ open, onClose, store }: { open: boolean; onClose: () => void; store: ClassHubPetConfigStore }) {
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState(''), [confirmPassword, setConfirm] = useState('');
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const lock = useRef(false); const { logout } = useUser(); const navigate = useNavigate();
  useEffect(() => { if (!open) { setCurrent(''); setNew(''); setConfirm(''); setError(''); } }, [open]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current) return; setError('');
    if (newPassword.length < 8) { setError('新密码至少需要 8 位。'); return; }
    if (new TextEncoder().encode(newPassword).length > 72) { setError('新密码过长，请缩短后重试。'); return; }
    if (newPassword !== confirmPassword) { setError('两次新密码不一致。'); return; }
    lock.current = true; setPending(true);
    try {
      await store.flushAll();
      const result = await changePassword({ currentPassword, newPassword, confirmPassword });
      if (!result.success || !result.requiresLogin) throw new Error('Invalid response');
      setCurrent(''); setNew(''); setConfirm(''); onClose(); logout();
      toast.success('密码已修改，请使用新密码重新登录。'); navigate('/auth', { replace: true });
    } catch (failure) { setError(accountError(failure, '密码暂时无法修改，请稍后重试。')); }
    finally { lock.current = false; setPending(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!value && !pending) onClose(); }}>
    <DialogContent className="account-password-dialog" onEscapeKeyDown={e => { if (pending) e.preventDefault(); }} onPointerDownOutside={e => { if (pending) e.preventDefault(); }}>
      <DialogTitle>修改密码</DialogTitle><DialogDescription>至少 8 位，建议使用安全且唯一的密码。修改后所有设备需要重新登录。</DialogDescription>
      <form onSubmit={event => void submit(event)} className="mt-5">
        <div className="form-field"><label htmlFor="current-password">当前密码</label><input id="current-password" type="password" autoComplete="current-password" required maxLength={1024} value={currentPassword} disabled={pending} onChange={e => setCurrent(e.target.value)}/></div>
        <div className="form-field"><label htmlFor="new-password">新密码</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={newPassword} disabled={pending} onChange={e => setNew(e.target.value)}/><p className="text-xs text-muted-foreground">{newPassword && newPassword.length < 8 ? '还需要增加长度。' : newPassword ? '长度符合要求；避免使用姓名、学号或常见密码。' : '字母、数字和符号均可使用。'}</p></div>
        <div className="form-field"><label htmlFor="confirm-password">确认新密码</label><input id="confirm-password" type="password" autoComplete="new-password" required maxLength={72} value={confirmPassword} disabled={pending} onChange={e => setConfirm(e.target.value)}/></div>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="detail-actions"><button type="button" className="ed-button secondary" disabled={pending} onClick={onClose}>取消</button><button className="ed-button" disabled={pending}>{pending ? '正在修改…' : '修改密码'}</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
