import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/userContextState';
import { useTheme } from '../context/themeContextState';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from './ui/dialog';
import ProfilePictureUpload from './ProfilePictureUpload';
import AvatarManagementModal from './AvatarManagementModal';
export default function UserProfile({isOpen,onClose}: {isOpen:boolean;onClose:()=>void}) {
  const {user,logout}=useUser();const {isDarkMode,toggleDarkMode}=useTheme();const [avatar,setAvatar]=useState(false);
  return <><Dialog open={isOpen} onOpenChange={open=>{if(!open)onClose();}}><DialogContent><DialogTitle>个人资料</DialogTitle><DialogDescription>查看账号信息，管理头像与阅读设置。</DialogDescription><div className="flex items-center gap-5 py-6"><button className="shrink-0" aria-label="管理头像" onClick={()=>setAvatar(true)}><ProfilePictureUpload size="xl" showUploadButton={false} allowDelete={false}/></button><div><h2 className="text-xl font-bold">{user.displayName||user.name||'班级成员'}</h2><p className="entry-meta break-all">{user.email}</p><p className="entry-meta">学号：{user.memberId||user.uniqueId}</p><button className="text-link text-sm min-h-11" onClick={()=>setAvatar(true)}>修改头像</button></div></div><div className="flex flex-col">{[['/settings','个人设置'],['/notifications','通知'],['/saved-posts','我的收藏']].map(([url,label])=><Link key={url} to={url} className="min-h-12 flex items-center border-t border-border" onClick={onClose}>{label} →</Link>)}<button className="min-h-12 text-left border-t border-border" onClick={toggleDarkMode}>{isDarkMode?'切换浅色模式':'切换深色模式'}</button><button className="min-h-12 text-left border-y border-border text-destructive" onClick={()=>{onClose();logout();}}>退出登录</button></div></DialogContent></Dialog><AvatarManagementModal isOpen={avatar} onClose={()=>setAvatar(false)}/></>;
}
