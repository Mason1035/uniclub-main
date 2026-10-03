import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart,MessageCircle,Bookmark,Share2 } from 'lucide-react';
import ShareDialog from './ShareDialog';
import { useEngagement } from '../hooks/useEngagement';
import api from '../lib/axios';
interface InteractionButtonsProps {
  contentType: 'News' | 'SocialPost' | 'Event' | 'Comment' | 'Resource';
  contentId: string;
  engagement?: {
    likes?: number;
    saves?: number;
    shares?: number;
    comments?: number;
  };
  likeCount?: number;
  shareCount?: number;
  saveCount?: number;
  reactions?: {
    likes: number;
    userReaction?: boolean;
  };
  commentCount?: number;
  onCommentClick: () => void;
  onShareClick?: () => void;
  shareTitle?: string;
  shareType?: 'news' | 'event' | 'resource' | 'social';
  layout?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  showSave?: boolean;
  showBorder?: boolean;
  noBg?: boolean;
  onLike?: (liked: boolean) => void;
  onSave?: (saved: boolean) => void;
  cardType?: 'news' | 'event' | 'resource' | 'social';
  resourceType?: 'Document' | 'Video' | 'Tutorial' | 'Tool';
}


export default function InteractionButtons(props: InteractionButtonsProps) {
  const [shareOpen,setShareOpen] = useState(false);
  const {engagement,stats,loading,error,ready,toggleLike,toggleSave,recordShare} = useEngagement(props.contentType,props.contentId);
  const backendType = ({News:'news',Event:'event',Resource:'resource',SocialPost:'social',Comment:'comment'} as Record<string,string>)[props.contentType];
  const comments = useQuery({queryKey:['comment-count',backendType,props.contentId],enabled:!!props.contentId&&props.contentType!=='Comment',queryFn:async()=>(await api.get(`/api/comments/${backendType}/${props.contentId}/count`)).data.count as number,staleTime:30000});
  const likes = ready ? stats.totalLikes : props.engagement?.likes ?? props.likeCount ?? props.reactions?.likes ?? 0;
  const saves = ready ? stats.totalSaves : props.engagement?.saves ?? props.saveCount ?? 0;
  return <div className="interactions" onClick={event=>event.stopPropagation()}>
    <button className="interaction" aria-label={engagement.liked?'取消点赞':'点赞'} aria-pressed={engagement.liked} disabled={loading||!props.contentId} onClick={async()=>{const result=await toggleLike();if(result!==undefined)props.onLike?.(result);}}><Heart fill={engagement.liked?'currentColor':'none'}/><span>{loading?'处理中':likes}</span></button>
    <button className="interaction" onClick={props.onCommentClick} aria-label="查看评论"><MessageCircle/><span>{comments.data ?? props.commentCount ?? props.engagement?.comments ?? 0}</span></button>
    {props.showSave!==false&&<button className="interaction" aria-label={engagement.saved?'取消收藏':'收藏'} aria-pressed={engagement.saved} disabled={loading||!props.contentId} onClick={async()=>{const result=await toggleSave();if(result!==undefined)props.onSave?.(result);}}><Bookmark fill={engagement.saved?'currentColor':'none'}/><span>{engagement.saved?'已收藏':'收藏'}{saves>0&&` ${saves}`}</span></button>}
    <button className="interaction" aria-label="分享内容" onClick={()=>{if(props.onShareClick)props.onShareClick();else setShareOpen(true);}}><Share2/><span>分享</span></button>
    {error&&<p className="interaction-error" role="alert">{error}</p>}
    <ShareDialog isOpen={shareOpen} onClose={()=>setShareOpen(false)} type={props.shareType||'news'} url={`${window.location.origin}${props.contentType==='News'?'/article/':props.contentType==='Event'?'/event/':props.contentType==='Resource'?'/resource/':'/comments/social/'}${props.contentId}`} title={props.shareTitle||'班级内容'} onShare={()=>void recordShare()}/>
  </div>;
}
