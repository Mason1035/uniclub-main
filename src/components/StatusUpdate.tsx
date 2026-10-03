import React, { useState } from 'react';
import { Image, Smile, X } from 'lucide-react';
import { useUser } from '../context/userContextState';

const StatusUpdate: React.FC = () => {
  const { user } = useUser();
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle post submission
    void 0;
    setContent('');
    setSelectedImage(null);
  };

  return (
    <div className="bg-background dark:bg-card rounded-sm p-4  border border-border dark:border-border">
      <form onSubmit={handleSubmit}>
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary dark:bg-card flex-shrink-0">
            {user.profileImage ? (
              <img src={user.profileImage} alt="头像" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground dark:text-muted-foreground">
                {user.name.charAt(0)}
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="分享点什么？"
              className="w-full p-3 bg-background dark:bg-card rounded-sm border border-border dark:border-border focus:outline-none focus:ring-2 focus:ring-ring dark:text-foreground placeholder-gray-400 dark:placeholder-gray-500 resize-none"
              rows={3}
            />
            
            {selectedImage && (
              <div className="relative mt-2">
                <img 
                  src={selectedImage} 
                  alt="已选择的图片" 
                  className="max-h-48 rounded-sm object-cover"
                />
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 p-1 bg-foreground/50 rounded-full text-primary-foreground hover:bg-foreground/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-2">
                <label className="p-2 text-muted-foreground dark:text-muted-foreground hover:text-primary dark:hover:text-primary cursor-pointer rounded-full hover:bg-background dark:hover:bg-card transition-colors">
                  <Image className="w-5 h-5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  className="p-2 text-muted-foreground dark:text-muted-foreground hover:text-primary dark:hover:text-primary rounded-full hover:bg-background dark:hover:bg-card transition-colors"
                >
                  <Smile className="w-5 h-5" />
                </button>
              </div>
              
              <button
                type="submit"
                disabled={!content.trim() && !selectedImage}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                发布
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StatusUpdate; 