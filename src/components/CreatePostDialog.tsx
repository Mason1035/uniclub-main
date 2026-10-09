import type { ApiSocialPost } from '../types/content';
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Image, Smile, X } from 'lucide-react';
import { useUser } from '../context/userContextState';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { isAxiosError } from 'axios';
import EmojiPicker from './EmojiPicker';
import UserAvatarImage from './UserAvatarImage';

interface CreatePostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
  editMode?: boolean;
  editData?: {
    id: string;
    content: string;
    postType: 'text' | 'image' | 'video';
    media?: Array<{ url: string; type: string }>;
  };
}

const CreatePostDialog: React.FC<CreatePostDialogProps> = ({
  isOpen,
  onClose,
  onPostCreated,
  editMode = false,
  editData
}) => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  // DEBUG: Log user data for profile picture debugging
  void 0;
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  useEffect(() => { const urls = selectedFiles.map(file => URL.createObjectURL(file)); setPreviewUrls(urls); return () => urls.forEach(url => URL.revokeObjectURL(url)); }, [selectedFiles]);
  const [postType, setPostType] = useState<'text' | 'image' | 'video'>('text');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const submitLock = useRef(false);
  const [markedForDeletion, setMarkedForDeletion] = useState<Array<{ url: string; type: string }>>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);


  const insertEmojiAtCursor = (emoji: string) => {
    const el = textAreaRef.current;
    if (!el) {
      setContent(prev => prev + emoji);
      // Don't close picker automatically - let user continue selecting emojis
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    // Don't close picker automatically - let user continue selecting emojis
    requestAnimationFrame(() => {
      const pos = start + emoji.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };


  // Populate form when editing
  useEffect(() => {
    if (editMode && editData) {
      setContent(editData.content);
      setPostType(editData.postType);
      // Reset marked for deletion when opening edit mode
      setMarkedForDeletion([]);
      // Note: Media files would need to be handled differently for editing
    }
  }, [editMode, editData]);

  // Get existing media count for display (accounting for marked for deletion images)
  const existingMediaCount = editMode && editData?.media ? editData.media.length - markedForDeletion.length : 0;
  const totalMediaCount = existingMediaCount + selectedFiles.length;
  const maxMediaAllowed = 4;
  
  // Log current state for debugging
  useEffect(() => {
    if (editMode) {
      void 0;
    }
  }, [editMode, existingMediaCount, selectedFiles.length, totalMediaCount, maxMediaAllowed]);
  
  // Function to mark existing media for deletion
  const handleMarkForDeletion = (indexToMark: number) => {
    if (editData?.media) {
      const imageToMark = editData.media[indexToMark];
      
      // Check if already marked for deletion
      if (markedForDeletion.some(img => img.url === imageToMark.url)) {
        // Unmark it (user changed their mind)
        setMarkedForDeletion(prev => prev.filter(img => img.url !== imageToMark.url));
        void 0;
      } else {
        // Mark it for deletion
        setMarkedForDeletion(prev => [...prev, imageToMark]);
        void 0;
      }
      
      void 0;
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      if (files.some(file => file.size > (file.type.startsWith('video/') ? 50 : 10) * 1024 * 1024)) {
        setErrorMessage('每张图片最多 10 MB，每个视频最多 50 MB，请选择较小的附件。');
        event.target.value = '';
        return;
      }
      // Check if adding these files would exceed the limit
      const availableSlots = maxMediaAllowed - existingMediaCount;
      const totalAfterAdding = existingMediaCount + files.length;
      
      void 0;
      
      if (totalAfterAdding > maxMediaAllowed) {
        const excess = totalAfterAdding - maxMediaAllowed;
        const allowedToAdd = maxMediaAllowed - existingMediaCount;
        
        if (allowedToAdd <= 0) {
          setErrorMessage(`每条动态最多 ${maxMediaAllowed} 张图片，请先移除部分已有图片。`);
        } else {
          setErrorMessage(`每条动态最多 ${maxMediaAllowed} 张图片，本次选择了前 ${allowedToAdd} 张。`);
          // Select only the allowed number of files
          const limitedFiles = files.slice(0, allowedToAdd);
          setSelectedFiles(limitedFiles);
          setPostType(limitedFiles[0].type.startsWith('video/') ? 'video' : 'image');
        }
        return;
      }
      
      // All files can be added
      setSelectedFiles(files);
      setPostType(files[0].type.startsWith('video/') ? 'video' : 'image');
      
      void 0;
    }
  };



  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock.current || (!content.trim() && selectedFiles.length === 0)) return;
    submitLock.current = true;
    setErrorMessage('');

    setIsSubmitting(true);
    try {
      // List caches have different display shapes; refresh them from the API.
      const applyUpdatedPostToCaches = (updatedPost: ApiSocialPost) => {
        if (!updatedPost) return;
        for (const key of ['socialPosts', 'socialFeed', 'trendingPosts']) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
        if (editData?.id) {
          queryClient.setQueryData(['socialPost', editData.id], updatedPost);
        }
      };
      if (editMode && editData) {
        // Edit existing post - handle media files properly
        if (selectedFiles.length > 0) {
          // If new files are selected, send them as FormData
          const formData = new FormData();
          formData.append('content', content.trim());
          formData.append('postType', postType);
          
          // Add new media files
          selectedFiles.forEach((file, index) => {
            formData.append('media', file);
          });
          
                     // Add information about images marked for deletion
           if (markedForDeletion.length > 0) {
             formData.append('imagesToDelete', JSON.stringify(markedForDeletion.map(img => img.url)));
             void 0;
           }
          
          void 0;
          
                     void 0;
           
           const response = await api.put(`/api/social/posts/${editData.id}`, formData, {
             timeout: 120_000,
             headers: {
               'Content-Type': 'multipart/form-data',
             },
           });
          
          // Check if the response indicates success
          const isSuccess = response.data.success || response.data.message === 'Post updated successfully' || response.status === 200;
          
          if (isSuccess) {
            void 0;
            void 0;
            
            // Immediately update caches to reflect new media
            applyUpdatedPostToCaches(response.data.post);

            // Force immediate refetch of the specific post to get updated media URLs
            try {
              // Invalidate and refetch social posts for edit mode
              await queryClient.invalidateQueries({ queryKey: ['socialPosts'] });
              await queryClient.invalidateQueries({ queryKey: ['socialFeed'] });
              await queryClient.invalidateQueries({ queryKey: ['trendingPosts'] });
              
              // Force refetch the specific post if we have its data
              if (response.data.post) {
                await queryClient.setQueryData(['socialPost', editData.id], response.data.post);
              }
              
              void 0;
            } catch (refetchError) {
              console.warn('⚠️ Error during query invalidation:', refetchError);
            }
            
            // Small delay to ensure queries are refetched before closing
            setTimeout(() => {
              onClose();
              onPostCreated?.();
            }, 500);
          } else {
            throw new Error(response.data.error || response.data.message || '动态更新未成功');
          }
                 } else {
           // No new files, but might have removed images
           const updateData: { content: string; postType: string; imagesToDelete?: string[] } = {
             content: content.trim(),
             postType: postType
           };
           
           // Add information about images marked for deletion if any
           if (markedForDeletion.length > 0) {
             updateData.imagesToDelete = markedForDeletion.map(img => img.url);
             void 0;
           }
           
           void 0;
           
           const response = await api.put(`/api/social/posts/${editData.id}`, updateData);

          // Check if the response indicates success (handle different response formats)
          const isSuccess = response.data.success || response.data.message === 'Post updated successfully' || response.status === 200;
          
          if (isSuccess) {
            void 0;
            void 0;
            
            // Immediately update caches to reflect content/media removals
            applyUpdatedPostToCaches(response.data.post);

            // Force immediate refetch of the specific post
            try {
              // Invalidate and refetch social posts for edit mode
              await queryClient.invalidateQueries({ queryKey: ['socialPosts'] });
              await queryClient.invalidateQueries({ queryKey: ['socialFeed'] });
              await queryClient.invalidateQueries({ queryKey: ['trendingPosts'] });
              
              // Force refetch the specific post if we have its data
              if (response.data.post) {
                await queryClient.setQueryData(['socialPost', editData.id], response.data.post);
              }
              
              void 0;
            } catch (refetchError) {
              console.warn('⚠️ Error during query invalidation:', refetchError);
            }
            
            // Small delay to ensure queries are refetched before closing
            setTimeout(() => {
              onClose();
              onPostCreated?.();
            }, 500);
          } else {
            throw new Error(response.data.error || response.data.message || '动态更新未成功');
          }
        }
      } else {
        // Create new post
        const formData = new FormData();
        formData.append('content', content.trim());
        formData.append('postType', postType);
        formData.append('visibility', 'club-members');

        // Add media files if any
        void 0;
        selectedFiles.forEach((file, index) => {
          formData.append('media', file);
        });
        
        void 0;
        for (const [key, value] of formData.entries()) {
          void 0;
        }

        const response = await api.post('/api/social/posts', formData, {
          timeout: 120_000,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        void 0;

        if (response.data.success) {
          void 0;
          
          // Invalidate and refetch social posts
          await queryClient.invalidateQueries({ queryKey: ['socialFeed'] });
          await queryClient.invalidateQueries({ queryKey: ['trendingPosts'] });

          // Reset form and close dialog
          setContent('');
          setSelectedFiles([]);
          setPostType('text');
          onClose();
          onPostCreated?.();
        } else {
          throw new Error(response.data.error || '动态发布未成功');
        }
      }
    } catch (error) {
      console.error('Error saving post:', error);
      // Show error message to user
      let reason = editMode ? '动态更新未成功' : '动态发布未成功';
      if (isAxiosError(error)) {
        const code = error.response?.data?.code;
        if (code === 'UPLOAD_STORAGE_UNAVAILABLE') {
          reason = '图片上传服务暂不可用，请联系管理员检查上传目录权限';
        } else if (code === 'FILE_TOO_LARGE' || error.response?.status === 413) {
          reason = '附件过大：每张图片最多 10 MB、每个视频最多 50 MB；也可能超过服务器请求限制';
        } else if (code === 'INVALID_FILE_TYPE') {
          reason = '不支持此附件格式，请选择 JPEG、PNG、GIF、WebP 或支持的视频';
        } else if (code === 'TOO_MANY_FILES') {
          reason = '附件数量过多，请减少附件后重试';
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          reason = '上传超时，请检查网络并稍后刷新列表确认是否已发布';
        } else if (!error.response) {
          reason = '无法连接上传服务，请检查网络';
        }
      }
      setErrorMessage(`${reason}。内容已保留。`);
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editMode ? '编辑动态' : '发布动态'}</DialogTitle><DialogDescription>分享班级近况和照片。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary dark:bg-card flex-shrink-0">
              <UserAvatarImage src={user.profileImage} identity={user.id||user.uniqueId||user.name} alt="头像" className="w-full h-full object-cover"/>
            </div>
            
            <div className="flex-1 relative">
              <label htmlFor="post-content" className="block text-sm font-semibold mb-2">动态内容</label>
              <textarea
                id="post-content" aria-label="动态内容"
                ref={textAreaRef}
                value={content}
                onChange={handleContentChange}
                placeholder="分享你的想法…"
                className="w-full p-3 bg-background dark:bg-card rounded-sm border border-border dark:border-border focus:outline-none focus:ring-2 focus:ring-ring dark:text-foreground placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                rows={4}
              />
              
              {/* Emoji Picker - Positioned relative to entire textarea container */}
              {showEmojiPicker && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-4 z-50">
                  <EmojiPicker
                    isOpen={showEmojiPicker}
                    onClose={() => setShowEmojiPicker(false)}
                    onEmojiSelect={insertEmojiAtCursor}
                    triggerRef={emojiButtonRef}
                  />
                </div>
              )}
              

              
              {/* Combined media display (existing + new) */}
              {(existingMediaCount > 0 || selectedFiles.length > 0) && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground dark:text-muted-foreground">
                      {editMode ? '动态图片' : '已选择的图片'}
                    </span>
                                                            <span className={`text-xs font-medium ${
                      totalMediaCount >= maxMediaAllowed 
                        ? 'text-destructive dark:text-destructive' 
                        : 'text-muted-foreground dark:text-muted-foreground'
                    }`}>
                      {totalMediaCount}/{maxMediaAllowed} 个文件
                      {totalMediaCount >= maxMediaAllowed && ' (已达到文件数量上限)'}
                    </span>
                                     </div>
                   

                   
                                      {/* Existing images */}
                   {editMode && editData?.media && editData.media.length > 0 && (
                     <div className="grid grid-cols-2 gap-2 mb-2">
                                               {editData.media.map((item, index) => (
                         <div key={`existing-${index}`} className="relative">
                                                     {item.type === 'image' ? (
                             <img 
                               src={item.url} 
                               alt={`已有图片 ${index + 1}`}
                               className={`w-full h-24 object-cover rounded-sm border transition-colors duration-200 ${
                                 markedForDeletion.some(img => img.url === item.url)
                                   ? 'border-destructive dark:border-destructive grayscale opacity-60'
                                   : 'border-border dark:border-border'
                               }`}
                             />
                          ) : (
                            <div className="w-full h-24 bg-secondary dark:bg-card rounded-sm flex items-center justify-center border border-border dark:border-border">
                              <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                                视频
                              </span>
                            </div>
                          )}
                                                                                <div className="absolute top-1 right-1 bg-foreground/50 text-primary-foreground text-xs px-2 py-1 rounded-full">
                              {index + 1}
                            </div>
                           <button
                             type="button"
                             onClick={() => handleMarkForDeletion(index)}
                             className={`absolute top-2 right-2 icon-control text-primary-foreground transition-colors duration-200 ${
                               markedForDeletion.some(img => img.url === item.url)
                                 ? 'bg-primary hover:bg-primary'
                                 : 'bg-destructive hover:bg-destructive'
                             }`}
                             aria-label="切换图片删除状态" title={markedForDeletion.some(img => img.url === item.url) ? '保留图片' : '移除图片'}
                           >
                             <X className="w-4 h-4" />
                           </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* New selected files */}
                  {selectedFiles.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedFiles.map((file, index) => (
                        <div key={`new-${index}`} className="relative">
                          {file.type.startsWith('image/') ? (
                            <img 
                              src={previewUrls[index]} 
                              alt="新选择的图片" 
                              className="w-full h-24 object-cover rounded-sm border border-border dark:border-border"
                            />
                          ) : (
                            <div className="w-full h-24 bg-secondary dark:bg-card rounded-sm flex items-center justify-center border border-border dark:border-border">
                              <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                                视频：{file.name}
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                            aria-label="移除这个文件" className="absolute top-2 right-2 icon-control bg-destructive text-primary-foreground hover:bg-destructive transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                            新添加
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex flex-wrap gap-3 items-center justify-between mt-3 relative">
                <div className="flex items-center space-x-2">
                  <button type="button" className="icon-control text-muted-foreground hover:text-primary" aria-label="添加照片或视频" disabled={isSubmitting || totalMediaCount >= maxMediaAllowed} onClick={() => mediaInputRef.current?.click()}>
                    <Image className="w-5 h-5" />
                  </button>
                  <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} disabled={isSubmitting || totalMediaCount >= maxMediaAllowed} className="sr-only" tabIndex={-1} aria-label="选择动态文件" />
                  {totalMediaCount < maxMediaAllowed ? (
                    <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                      还可添加 {maxMediaAllowed - totalMediaCount} 个文件
                    </span>
                  ) : (
                    <span className="text-xs text-destructive dark:text-destructive font-medium">
                      已达到文件数量上限
                    </span>
                  )}
                  <div className="relative overflow-visible">
                    <button
                      ref={emojiButtonRef}
                      type="button"
                      onClick={() => setShowEmojiPicker(prev => !prev)}
                      className="icon-control text-muted-foreground hover:text-primary hover:bg-background transition-colors"
                      title="添加表情" aria-label="添加表情"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <button
                   type="submit"
                   disabled={(!content.trim() && selectedFiles.length === 0) || isSubmitting || (editMode && content === editData?.content && selectedFiles.length === 0 && markedForDeletion.length === 0)}
                   className="ed-button"
                   title={editMode && content === editData?.content && selectedFiles.length === 0 && markedForDeletion.length === 0 ? '尚未修改内容' : ''}
                 >
                   {isSubmitting ? (editMode ? '正在保存…' : '正在发布…') : (editMode ? '保存修改' : '发布')}
                 </button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>);
};

export default CreatePostDialog;
