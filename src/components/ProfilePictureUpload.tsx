import { useEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useUser } from '../context/userContextState';
import AvatarManagementModal from './AvatarManagementModal';
interface ProfilePictureUploadProps {size?:'sm'|'md'|'lg'|'xl';showUploadButton?:boolean;allowDelete?:boolean;className?:string;onAvatarUpdate?:(avatar:string|null)=>void;}
export default function ProfilePictureUpload({size='md',showUploadButton=true,allowDelete=false,className='',onAvatarUpdate}:ProfilePictureUploadProps) {
  const {user}=useUser();const [open,setOpen]=useState(false);const previous=useRef(user.profileImage);
  useEffect(()=>{if(previous.current!==user.profileImage){previous.current=user.profileImage;onAvatarUpdate?.(user.profileImage);}},[user.profileImage,onAvatarUpdate]);
  const sizes={sm:'w-8 h-8',md:'w-10 h-10',lg:'w-16 h-16',xl:'w-20 h-20'};
  const picture=<span className={`${sizes[size]} inline-flex items-center justify-center overflow-hidden rounded-full bg-secondary text-primary`}>{user.profileImage?<img className="w-full h-full object-cover" src={user.profileImage} alt="个人头像"/>:<UserRound className="w-1/2 h-1/2"/>}</span>;
  return <span className={className}>{showUploadButton||allowDelete?<button aria-label="管理个人头像" className="min-h-11 min-w-11" onClick={()=>setOpen(true)}>{picture}</button>:picture}<AvatarManagementModal isOpen={open} onClose={()=>setOpen(false)}/></span>;
}
