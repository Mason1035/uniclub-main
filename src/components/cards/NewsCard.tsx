import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ApiNews } from '../../types/content';
import InteractionButtons from '../InteractionButtons';
import { formatDate, categoryLabel } from '../../lib/contentFormat';
import Illustration from '../Illustration';
export default function NewsCard(article: ApiNews) {
  const location = useLocation(); const navigate = useNavigate();
  return <article className="news-entry" data-flip-id={`news-${article._id}`}><div className="news-entry-top"><div data-pet-avoid><div className="entry-meta">{article.category && <span>{categoryLabel(article.category)}</span>}<time>{formatDate(article.publishedAt || article.timestamp)}</time>{article.isFeatured && <span className="status-label important">推荐</span>}</div><h3 className="mt-2"><Link to={`/article/${article._id}`} state={{referrer:location.pathname}}>{article.title}</Link></h3>{(article.excerpt || article.summary?.quickSummary) && <p className="entry-description line-clamp-2">{article.excerpt || article.summary?.quickSummary}</p>}<p className="entry-meta">{article.source}{article.originalAuthor && ` · ${article.originalAuthor}`}</p></div>{article.imageUrl && <img className="entry-image" src={article.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.display='none'; }}/>}{!article.imageUrl && <Illustration kind="news" size="small" className="entry-illustration"/>}</div><InteractionButtons contentType="News" contentId={article._id} engagement={article.engagement} commentCount={article.discussionCount} shareTitle={article.title} shareType="news" onCommentClick={() => navigate(`/comments/news/${article._id}`,{state:{referrer:location.pathname}})}/></article>;
}
