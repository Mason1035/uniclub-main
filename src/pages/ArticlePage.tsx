import { useQuery } from '@tanstack/react-query';
import { useParams,useLocation,useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import type { ApiNews } from '../types/content';
import { formatDate,categoryLabel } from '../lib/contentFormat';
import ContentState from '../components/ContentState';
import PageHeading from '../components/PageHeading';
import BackNavigation from '../components/BackNavigation';
import ArticleContent from '../components/ArticleContent';
import InteractionButtons from '../components/InteractionButtons';
import ChatBubble from '../components/chat/ChatBubble';
export default function ArticlePage() {
  const {id}=useParams();const location=useLocation();const navigate=useNavigate();
  const query=useQuery({queryKey:['article',id],enabled:!!id,queryFn:async()=>(await api.get(`/api/news/${id}`)).data as ApiNews});const article=query.data;
  return <article className="page-shell reading-page editorial-content"><BackNavigation referrer={location.state?.referrer} contentType="news" fallbackReferrer="/news"/><ContentState illustration="news" loading={query.isLoading} error={query.error} empty={!article} emptyTitle="找不到这篇新闻" onRetry={()=>void query.refetch()}>{article&&<><PageHeading title={article.title} tone="editorial"/><div className="detail-meta"><span>{article.source}</span>{article.originalAuthor&&article.originalAuthor!==article.source&&<span>作者：{article.originalAuthor}</span>}<time>{formatDate(article.publishedAt||article.timestamp)}</time>{article.category&&<span>{categoryLabel(article.category)}</span>}</div>{article.imageUrl&&<img src={article.imageUrl} alt="" className="detail-image"/>}<ArticleContent content={article.content||article.excerpt||''} summary={article.summary} originalUrl={article.originalUrl}/><div className="border-t border-border py-4"><InteractionButtons contentType="News" contentId={id||''} engagement={article.engagement} shareTitle={article.title} shareType="news" onCommentClick={()=>navigate(`/comments/news/${id}`,{state:{referrer:location.pathname}})}/></div>{id&&<ChatBubble articleId={id} articleTitle={article.title}/>}</>}</ContentState></article>;
}
