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
  const [pendingAction,setPendingAction] = useState<'like'|'save'|null>(null);
  const {engagement,stats,loading,error,ready,countersReady,countersError,toggleLike,toggleSave,recordShare} = useEngagement(props.contentType,props.contentId);
  const backendType = ({News:'news',Event:'event',Resource:'resource',SocialPost:'social',Comment:'comment'} as Record<string,string>)[props.contentType];
  // New backends return comments with stats. Keep the old endpoint only as a
  // compatibility fallback, or when stats fail but comments can still load.
  const comments = useQuery({queryKey:['comment-count',backendType,props.contentId],enabled:!!props.contentId&&props.contentType!=='Comment'&&(countersError||countersReady&&stats.totalComments===undefined),queryFn:async()=>(await api.get(`/api/comments/${backendType}/${props.contentId}/count`)).data.count as number,staleTime:30000});
  const commentCount = (countersError ? comments.data ?? stats.totalComments : stats.totalComments ?? comments.data) ?? props.commentCount ?? props.engagement?.comments ?? 0;
  const likes = ready ? stats.totalLikes : props.engagement?.likes ?? props.likeCount ?? props.reactions?.likes ?? 0;
  const saves = ready ? stats.totalSaves : props.engagement?.saves ?? props.saveCount ?? 0;
  const updateEngagement = async (action: 'like'|'save') => {
    if (loading || pendingAction) return;
    setPendingAction(action);
    try {
      const result = await (action === 'like' ? toggleLike() : toggleSave());
      if (result !== undefined) {
        if (action === 'like') props.onLike?.(result);
        else props.onSave?.(result);
      }
    } finally { setPendingAction(null); }
  };
  return <div className="interactions" aria-busy={loading} onClick={event=>event.stopPropagation()}>
    <button type="button" className="interaction" aria-label={engagement.liked?'取消点赞':'点赞'} aria-pressed={engagement.liked} aria-busy={loading&&pendingAction==='like'} disabled={loading||!props.contentId} onClick={()=>void updateEngagement('like')}><Heart aria-hidden="true" fill={engagement.liked?'currentColor':'none'}/><span className="min-w-[2ch] tabular-nums text-center">{likes}</span></button>
    <button type="button" className="interaction" onClick={props.onCommentClick} aria-label="查看评论"><MessageCircle aria-hidden="true"/><span className="min-w-[2ch] tabular-nums text-center">{commentCount}</span></button>
    {props.showSave!==false&&<button type="button" className="interaction" aria-label={engagement.saved?'取消收藏':'收藏'} aria-pressed={engagement.saved} aria-busy={loading&&pendingAction==='save'} disabled={loading||!props.contentId} onClick={()=>void updateEngagement('save')}><Bookmark aria-hidden="true" fill={engagement.saved?'currentColor':'none'}/><span className="inline-grid"><span className="invisible col-start-1 row-start-1" aria-hidden="true">已收藏</span><span className="col-start-1 row-start-1">{engagement.saved?'已收藏':'收藏'}</span></span><span className="min-w-[2ch] tabular-nums text-center">{saves>0?saves:''}</span></button>}
    <button type="button" className="interaction" aria-label="分享内容" onClick={()=>{if(props.onShareClick)props.onShareClick();else setShareOpen(true);}}><Share2 aria-hidden="true"/><span>分享</span></button>
    {error&&<p className="interaction-error" role="alert">{error}</p>}
    <ShareDialog isOpen={shareOpen} onClose={()=>setShareOpen(false)} type={props.shareType||'news'} url={`${window.location.origin}${props.contentType==='News'?'/article/':props.contentType==='Event'?'/event/':props.contentType==='Resource'?'/resource/':'/comments/social/'}${props.contentId}`} title={props.shareTitle||'班级内容'} onShare={()=>void recordShare()}/>
  </div>;
}
