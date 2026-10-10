import { useQuery } from '@tanstack/react-query';
import { useParams,useLocation,useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import type { ApiNews, NewsSourceReference } from '../types/content';
import { formatDate,categoryLabel } from '../lib/contentFormat';
import ContentState from '../components/ContentState';
import PageHeading from '../components/PageHeading';
import BackNavigation from '../components/BackNavigation';
import ArticleContent from '../components/ArticleContent';
import InteractionButtons from '../components/InteractionButtons';
import ChatBubble from '../components/chat/ChatBubble';
import NotFound from './NotFound';
import { isMissingContent } from '../lib/routeState';
function validSourceReference(source: NewsSourceReference): boolean {
  if (!source || typeof source.url !== 'string') return false;
  try {
    const url = new URL(source.url);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
export default function ArticlePage() {
  const {id}=useParams();const location=useLocation();const navigate=useNavigate();
  const query=useQuery({queryKey:['article',id],enabled:!!id,retry:(count,error)=>!isMissingContent(error)&&count<2,queryFn:async()=>(await api.get(`/api/news/${id}`)).data as ApiNews});const article=query.data;
  const references = Array.isArray(article?.sourceReferences) ? article.sourceReferences.filter(validSourceReference) : [];
  if (isMissingContent(query.error) || (query.isSuccess && !article)) return <NotFound />;
  return <article className="page-shell reading-page editorial-content"><BackNavigation referrer={location.state?.referrer} contentType="news" fallbackReferrer="/news"/><ContentState illustration="news" loading={query.isLoading} error={query.error} empty={!article} emptyTitle="找不到这篇新闻" onRetry={()=>void query.refetch()}>{article&&<><PageHeading title={article.title} tone="editorial"/><div className="detail-meta"><span>{article.source}</span>{article.origin === 'ai_daily' && <span>AI 每日精选</span>}{article.originalAuthor&&article.originalAuthor!==article.source&&<span>作者：{article.originalAuthor}</span>}<time>{formatDate(article.publishedAt||article.timestamp)}</time>{article.category&&<span>{categoryLabel(article.category)}</span>}</div>{article.imageUrl&&<img src={article.imageUrl} alt="" className="detail-image"/>}<ArticleContent content={article.content||article.excerpt||''} summary={article.summary} originalUrl={article.originalUrl}/>{references.length > 0 && <section className="mb-6 mt-8 border-t border-border pt-5" aria-label="新闻参考来源"><h2 className="font-editorial text-lg font-semibold">参考来源</h2><ol className="mt-3 space-y-3 font-body text-sm">{references.map((reference,index) => <li key={`${reference.url}-${index}`}><a className="text-link break-words" href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title || reference.url} ↗</a><p className="mt-1 text-xs text-muted-foreground">{reference.publisher}{reference.publishedAt && ` · ${formatDate(reference.publishedAt)}`}</p></li>)}</ol></section>}<div className="border-t border-border py-4"><InteractionButtons contentType="News" contentId={id||''} engagement={article.engagement} shareTitle={article.title} shareType="news" onCommentClick={()=>navigate(`/comments/news/${id}`,{state:{referrer:location.pathname}})}/></div>{id&&<ChatBubble articleId={id} articleTitle={article.title}/>}</>}</ContentState></article>;
}
