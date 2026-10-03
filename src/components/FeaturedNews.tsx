import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User } from 'lucide-react';

interface FeaturedNewsProps {
  _id: string;
  title: string;
  summary: string;
  imageUrl: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
}

const FeaturedNews: React.FC<FeaturedNewsProps> = ({
  _id,
  title,
  summary,
  imageUrl,
  author,
  date,
  readTime,
  category
}) => {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`/article/${_id}`)}
      className="relative bg-background dark:bg-card rounded-sm overflow-hidden   transition-shadow cursor-pointer border border-border dark:border-border"
    >
      <div className="relative h-64 overflow-hidden">
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-full object-cover transition-transform "
        />
        <div className="absolute inset-0 bg-primary from-black/60 to-transparent" />
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
            {category}
          </span>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-xl font-bold text-primary-foreground mb-2 line-clamp-2">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
            {summary}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>{author}</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{date}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{readTime}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturedNews; 