import { apiFailure } from '../lib/apiFailure';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/authContextState';
import { useUser } from '../context/userContextState';
import api from '../lib/axios';

export interface Comment {
  _id: string;
  text: string;
  userId: {
    _id: string;
    name: string;
    uniqueId: string;
    profile?: {
      avatar?: {
        data: string;
        contentType: string;
      };
    };
  };
  contentId: string;
  contentType: string;
  parentCommentId?: string;
  likeCount: number;
  userHasLiked?: boolean;
  status: string;
  isEdited?: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
  replyCount?: number;
}

export interface CommentsData {
  comments: Comment[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalComments: number;
    hasMore: boolean;
  };
}

export interface UseCommentsReturn {
  comments: Comment[];
  commentCount: number;
  loading: boolean;
  error: string | null;
  addComment: (content: string, parentId?: string) => Promise<void>;
  likeComment: (commentId: string) => Promise<void>;
  editComment: (commentId: string, content: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalComments: number;
  };
}

export const useComments = (
  contentType: string, 
  contentId: string,
  options: {
    limit?: number;
    sort?: 'newest' | 'oldest' | 'mostLiked';
    autoFetch?: boolean;
  } = {}
): UseCommentsReturn => {
  const { user: authUser, getAuthHeaders } = useAuth();
  const { user: userProfile } = useUser();
  
  // Use the same logic as other components - try both contexts
  const user = authUser || userProfile;
  
  // DEBUG: Log user context in useComments
  void 0;
  
  const { limit = 20, sort = 'newest', autoFetch = true } = options;

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalComments, setTotalComments] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Fetch comments
  const fetchComments = useCallback(async (page = 1, append = false) => {
    if (!contentType || !contentId) return;

    try {
      setLoading(true);
      setError(null);

      void 0;

      const response = await fetch(
        `/api/comments/${contentType}/${contentId}?page=${page}&limit=${limit}&sort=${sort}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }

      const data: CommentsData = await response.json();
      void 0;
      
      // DEBUG: Check comment structure (NO REPLIES)
      if (data.comments && data.comments.length > 0) {
        const firstComment = data.comments[0];
        void 0;
      }

      if (append && page > 1) {
        setComments(prev => [...prev, ...data.comments]);
      } else {
        setComments(data.comments);
      }

      setCurrentPage(data.pagination.currentPage);
      setTotalPages(data.pagination.totalPages);
      setTotalComments(data.pagination.totalComments);
      setHasMore(data.pagination.hasMore);

    } catch (err) {
      console.error('❌ Error fetching comments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch comments');
    } finally {
      setLoading(false);
    }
  }, [contentType, contentId, limit, sort]);

  // Fetch comment count separately for faster loading
  const fetchCommentCount = useCallback(async () => {
    if (!contentType || !contentId) return;

    try {
      const response = await fetch(`/api/comments/${contentType}/${contentId}/count`);
      if (response.ok) {
        const data = await response.json();
        setCommentCount(data.count || 0);
      }
    } catch (err) {
      console.error('❌ Error fetching comment count:', err);
    }
  }, [contentType, contentId]);

  // Add a new comment
  const addComment = async (content: string, parentId?: string) => {
    if (!content.trim()) {
      throw new Error('Comment content cannot be empty');
    }

    if (!user) {
      throw new Error('You must be logged in to comment');
    }

    // DEBUG: Log complete request details
    void 0;

    try {
      setLoading(true);
      setError(null);

      void 0;

      const response = await api.post(`/api/comments/${contentType}/${contentId}`, {
        content, 
        parentComment: parentId 
      });

      const newComment: Comment = response.data;
      void 0;

      // Update comments list
      if (parentId) {
        // It's a reply - add it to the parent comment's replies
        setComments(prev => prev.map(comment => {
          if (comment._id === parentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newComment],
              replyCount: (comment.replyCount || 0) + 1
            };
          }
          return comment;
        }));
      } else {
        // It's a top-level comment - add it to the beginning
        setComments(prev => [newComment, ...prev]);
      }

      // Update counters
      setCommentCount(prev => prev + 1);
      setTotalComments(prev => prev + 1);

    } catch (err) {
      console.error('❌ Error adding comment:', err);
      
      // Handle specific error cases
      const failure = apiFailure(err, 'Failed to add comment');
      if (failure.status === 401) {
        const errorMessage = '请先登录再发表评论';
        setError(errorMessage);
        // Show toast notification for better UX
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:required', { 
            detail: { message: errorMessage }
          }));
        }
      } else {
        const errorMessage = failure.message;
        setError(errorMessage);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Like/unlike a comment
  const likeComment = async (commentId: string) => {
    if (!user) {
      throw new Error('You must be logged in to like comments');
    }

    try {
      void 0;

      const response = await fetch(`/api/engagement/like/Comment/${commentId}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle like');
      }

      const result = await response.json();
      void 0;

      // Update comment in the list
      const updateCommentLike = (comment: Comment): Comment => {
        if (comment._id === commentId) {
          return { 
            ...comment, 
            likeCount: result.likeCount,
            userHasLiked: result.userHasLiked 
          };
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map(updateCommentLike)
          };
        }
        return comment;
      };

      setComments(prev => prev.map(updateCommentLike));

    } catch (err) {
      console.error('❌ Error liking comment:', err);
      setError(err instanceof Error ? err.message : 'Failed to like comment');
      throw err;
    }
  };

  // Edit a comment
  const editComment = async (commentId: string, content: string) => {
    if (!content.trim()) {
      throw new Error('Comment content cannot be empty');
    }

    if (!user) {
      throw new Error('You must be logged in to edit comments');
    }

    try {
      void 0;

      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to edit comment');
      }

      const updatedComment: Comment = await response.json();
      void 0;

      // Update comment in the list
      const updateComment = (comment: Comment): Comment => {
        if (comment._id === commentId) {
          return updatedComment;
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map(updateComment)
          };
        }
        return comment;
      };

      setComments(prev => prev.map(updateComment));

    } catch (err) {
      console.error('❌ Error editing comment:', err);
      setError(err instanceof Error ? err.message : 'Failed to edit comment');
      throw err;
    }
  };

  // Delete a comment (hard delete - permanent removal)
  const deleteComment = async (commentId: string) => {
    if (!user) {
      throw new Error('You must be logged in to delete comments');
    }

    try {
      void 0;

      const response = await api.delete(`/api/comments/${commentId}`);

      void 0;

      // Remove comment and its replies completely from the UI
      const removeComment = (comments: Comment[]): Comment[] => {
        return comments
          .filter(comment => comment._id !== commentId) // Remove the target comment
          .map(comment => ({
            ...comment,
            replies: comment.replies ? removeComment(comment.replies) : [] // Remove from replies too
          }));
      };

      setComments(prev => removeComment(prev));

      // Update counters
      setCommentCount(prev => Math.max(0, prev - 1));
      setTotalComments(prev => Math.max(0, prev - 1));

    } catch (err) {
      console.error('❌ Error deleting comment:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
      throw err;
    }
  };

  // Load more comments (pagination)
  const loadMore = async () => {
    if (!hasMore || loading) return;
    await fetchComments(currentPage + 1, true);
  };

  // Refetch comments (refresh)
  const refetch = async () => {
    setCurrentPage(1);
    await fetchComments(1, false);
    await fetchCommentCount();
  };

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch && contentType && contentId) {
      void 0;
      fetchComments(1, false);
      fetchCommentCount();
    }
  }, [contentType, contentId, sort, autoFetch, fetchComments, fetchCommentCount]);

  return {
    comments,
    commentCount,
    loading,
    error,
    addComment,
    likeComment,
    editComment,
    deleteComment,
    refetch,
    loadMore,
    hasMore,
    pagination: {
      currentPage,
      totalPages,
      totalComments,
    },
  };
};

export default useComments;
