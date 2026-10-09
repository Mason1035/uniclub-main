import { useEffect,useRef,useState } from 'react';
import api from '../lib/axios';
import { useUser } from '../context/userContextState';
import type { AccountProfile } from '../features/settings/types';
import { readToken } from '../lib/session';
import { accountError } from '../features/settings/account-api';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
import ConfirmationDialog from './ui/ConfirmationDialog';
import UserAvatarImage from './UserAvatarImage';
export default function AvatarManagementModal({isOpen,onClose,onSaved}: {isOpen:boolean;onClose:()=>void;onSaved?:(profile:AccountProfile)=>void}) {
  const {user,updateProfileImage}=useUser();const [file,setFile]=useState<File|null>(null);const [preview,setPreview]=useState('');const [pending,setPending]=useState(false);const [error,setError]=useState('');const [confirm,setConfirm]=useState(false);const lock=useRef(false);const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  useEffect(()=>{if(!isOpen){setFile(null);setError('');setConfirm(false);}},[isOpen]);
  const mutate=async(remove:boolean)=>{
    if(lock.current)return;lock.current=true;setPending(true);setError('');const token=readToken();
    try {
      if(remove){const {data}=await api.delete('/api/users/avatar');if(readToken()!==token)return;await updateProfileImage(null);onSaved?.(data.profile);}
      else if(file){const form=new FormData();form.append('avatar',file);const {data}=await api.post('/api/users/avatar',form,{headers:{'Content-Type':'multipart/form-data'}});if(readToken()!==token)return;const avatar=data.avatar?.data;if(!avatar)throw new Error('Invalid avatar response');await updateProfileImage(avatar);onSaved?.(data.profile);}
      setConfirm(false);onClose();
    }catch(failure){setError(accountError(failure,remove?'头像删除未成功，请重试。':'头像上传未成功，请检查网络与文件后重试。'));setConfirm(false);}
    finally{lock.current=false;setPending(false);}
  };
  return <><Dialog open={isOpen} onOpenChange={open=>{if(!open&&!pending)onClose();}}><DialogContent className="account-avatar-dialog"><DialogTitle>管理头像</DialogTitle><DialogDescription>支持 JPEG、PNG、WebP，原图不超过 5 MB；保存为适合头像的小图。</DialogDescription><UserAvatarImage className="w-48 h-48 object-cover rounded-full mx-auto my-5 border border-border" src={preview||user.profileImage} identity={user.id||user.uniqueId||user.name} alt="头像预览"/><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="选择头像图片" onChange={event=>{const next=event.target.files?.[0];if(!next)return;setError('');if(!['image/jpeg','image/png','image/webp'].includes(next.type)){setFile(null);event.target.value='';setError('请选择 JPEG、PNG 或 WebP 图片。');return;}if(next.size>5*1024*1024){setFile(null);event.target.value='';setError('图片超过 5 MB，请压缩后重新选择。');return;}setFile(next);}}/>{error&&<p className="form-error" role="alert">{error}</p>}<div className="detail-actions"><button className="ed-button secondary" disabled={pending} onClick={()=>input.current?.click()}>选择图片</button>{file&&<button className="ed-button" disabled={pending} onClick={()=>void mutate(false)}>{pending?'正在上传…':'保存头像'}</button>}{user.profileImage&&!file&&<button className="ed-button secondary" disabled={pending} onClick={()=>setConfirm(true)}>移除头像</button>}</div></DialogContent></Dialog><ConfirmationDialog isOpen={confirm} onClose={()=>{if(!pending)setConfirm(false);}} title="移除头像" message="移除后将显示默认头像。你可以随时上传新图片。" confirmText="移除头像" onConfirm={()=>void mutate(true)} isLoading={pending}/></>;
}
