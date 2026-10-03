import { Link } from 'react-router-dom';
interface PastEventCardProps { id:string; title:string; subtitle:string; posterUrl?:string; galleryCount?:number; onClick?:()=>void; }
export default function PastEventCard({id,title,subtitle,posterUrl,galleryCount}:PastEventCardProps) {
  return <article className="archive-entry"><Link to={`/past-events/${id}`}>{posterUrl ? <img src={posterUrl} alt={title} loading="lazy"/> : <div className="aspect-[8/5] bg-secondary flex items-center justify-center mb-3 text-muted-foreground">暂无活动图片</div>}<h3>{title}</h3></Link>{subtitle && <p>{subtitle}</p>}{galleryCount !== undefined && <p>{galleryCount} 张照片</p>}</article>;
}
