import type { ResourceType } from '../lib/resourceMeta';

export interface ContentAuthor {
  _id: string;
  name: string;
  uniqueId?: string;
  profile?: { avatar?: { data: string; contentType?: string } };
}

export interface ApiNews {
  _id: string;
  title: string;
  content?: string;
  originalUrl?: string;
  excerpt?: string;
  source: string;
  originalAuthor?: string;
  timestamp: string;
  publishedAt?: string;
  discussionCount?: number;
  imageUrl?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
  category: string;
  engagement?: { likes?: number; saves?: number; shares?: number; comments?: number; views?: number };
  summary?: { quickSummary?: string; raw?: string; whyItMatters?: string };
}

export interface ApiSocialPost {
  _id: string;
  author: ContentAuthor;
  content: string;
  media?: Array<{ url: string; type: string; filename?: string; size?: number }>;
  createdAt: string;
  likeCount?: number;
  shareCount?: number;
  engagement?: { likeCount?: number; shareCount?: number; commentCount?: number; views?: number };
}

export interface ApiResource {
  updatedAt?: string;
  file?: { type?: string; url?: string; originalName?: string; mimeType?: string; size?: number };
  _id: string;
  title: string;
  type: ResourceType;
  category?: string;
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  description?: string;
  fileSize?: string;
  thumbnailUrl?: string;
  linkUrl?: string;
  fileUrl?: string;
  tags?: string[];
  isApproved: boolean;
  uploadedBy?: ContentAuthor;
  downloadCount?: number;
  views?: number;
  likes?: number;
  createdAt: string;
}

export interface ApiPastEvent {
  date?: string;
  body?: string;
  category?: string;
  attendance?: number;
  link?: string;
  gallery?: Array<{index?:number;url?:string;contentType?:string;originalName?:string;caption?:string}>;
  _id: string;
  title: string;
  subtitle: string;
  posterUrl?: string;
  galleryCount?: number;
}
