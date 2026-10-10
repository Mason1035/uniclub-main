import { useRef,useState } from 'react';
import { useNavigate,useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useUser } from '../../context/userContextState';
import { timeAgo } from '../../lib/announcementMeta';
import api from '../../lib/axios';
import InteractionButtons from '../InteractionButtons';
import UserAvatarImage from '../UserAvatarImage';
import EventGallery from '../EventGallery';
import CreatePostDialog from '../CreatePostDialog';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import { DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem } from '../ui/dropdown-menu';
interface SocialCardProps {
  id: string;
  userName: string;
  userAvatar: string | null;
  timestamp: string;
  content: string;
  imageUrl?: string; // Legacy support
  media?: Array<{ url: string; type: string; filename?: string; size?: number }>; // New media array
  authorId: string; // Add author ID to check ownership
  currentUserId?: string; // Pass current user ID from parent to avoid useAuth issues
  group?: {
    _id: string;
    name: string;
    slug: string;
  };
  trending?: boolean;
  isCompact?: boolean;
  // Engagement data will be fetched by useEngagement hook in InteractionButtons
}


export default function SocialCard(post:SocialCardProps) {
  const {user}=useUser();const navigate=useNavigate();const location=useLocation();const client=useQueryClient();const [edit,setEdit]=useState(false);const [confirm,setConfirm]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
  const owner=!!post.authorId&&String(post.currentUserId||user.id)===String(post.authorId);const media=post.media?.length?post.media:post.imageUrl?[{url:post.imageUrl,type:'image'}]:[];
  const refresh=()=>{void client.invalidateQueries({queryKey:['socialPosts']});void client.invalidateQueries({queryKey:['social']});void client.invalidateQueries({queryKey:['savedContent']});};
  const remove=async()=>{if(lock.current)return;lock.current=true;setPending(true);setError('');try{await api.delete(`/api/social/posts/${post.id}`);setConfirm(false);refresh();}catch{setConfirm(false);setError('动态未能删除，请稍后重试。');}finally{lock.current=false;setPending(false);}};
  return <article className="social-entry"><div className="flex gap-3 items-start mb-4"><UserAvatarImage className="w-10 h-10 shrink-0 object-cover rounded-full" src={post.userAvatar} identity={post.authorId||post.userName} alt=""/><div className="flex-1"><h3 className="font-bold">{post.userName}</h3><time className="entry-meta">{timeAgo(post.timestamp)}</time>{post.group&&<p className="entry-meta">{post.group.name}</p>}</div>{owner&&<DropdownMenu><DropdownMenuTrigger asChild><button className="icon-control" aria-label="管理这条动态"><MoreHorizontal/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>setEdit(true)}>编辑动态</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={()=>setConfirm(true)}>删除动态</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div><p data-pet-avoid className={`whitespace-pre-wrap break-words ${post.isCompact?'line-clamp-4':''}`}>{post.content}</p>{media.filter(m=>m.type==='image').length>0&&<EventGallery eventId={post.id} title="动态图片" gallery={media.filter(m=>m.type==='image').map(m=>({url:m.url}))}/ >}{media.filter(m=>m.type==='video').map(m=><video key={m.url} src={m.url} controls preload="metadata" className="w-full max-h-96 mt-4"/>)}<InteractionButtons contentType="SocialPost" contentId={post.id} shareTitle={`${post.userName}的班级动态`} shareType="social" onCommentClick={()=>navigate(`/comments/social/${post.id}`,{state:{referrer:location.pathname}})}/>{error&&<p className="form-error mt-3" role="alert">{error}</p>}<CreatePostDialog isOpen={edit} onClose={()=>setEdit(false)} editMode editData={{id:post.id,content:post.content,postType:media.some(m=>m.type==='video')?'video':media.length?'image':'text',media}} onPostCreated={()=>{setEdit(false);refresh();}}/><ConfirmationDialog isOpen={confirm} onClose={()=>{if(!pending)setConfirm(false);}} title="删除动态" message="删除后将无法恢复这条动态，确认继续？" confirmText="删除" isLoading={pending} onConfirm={()=>void remove()}/></article>;
}
