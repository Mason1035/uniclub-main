import PageShell from '../components/PageShell';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '../lib/axios';
import type { ApiPastEvent } from '../types/content';
import { formatDate,categoryLabel } from '../lib/contentFormat';
import ContentState from '../components/ContentState';
import PageHeading from '../components/PageHeading';
import BackNavigation from '../components/BackNavigation';
import EventGallery from '../components/EventGallery';
import YouTubeEmbed from '../components/YouTubeEmbed';
export default function PastEventDetailPage() {
  const {id}=useParams();const query=useQuery({queryKey:['past-event',id],enabled:!!id,queryFn:async()=>(await api.get(`/api/past-events/${id}`)).data.data as ApiPastEvent});const event=query.data;
  return <PageShell className="reading-page"><BackNavigation contentType="event" fallbackReferrer="/events"/><ContentState illustration="gallery" loading={query.isLoading} error={query.error} empty={!event} emptyTitle="找不到这个往期活动" onRetry={()=>void query.refetch()}>{event&&<><PageHeading title={event.title} description={event.subtitle} tone="editorial"/><div className="detail-meta">{event.date&&<time>{formatDate(event.date)}</time>}{event.attendance!==undefined&&<span>{event.attendance} 人参加</span>}{event.category&&<span>{categoryLabel(event.category)}</span>}</div>{event.posterUrl&&<img className="detail-image" src={event.posterUrl} alt={event.title}/>}<div data-pet-avoid className="reading-body">{event.body?.split(/\n\s*\n/).map((paragraph,index)=><p className="whitespace-pre-wrap" key={index}>{paragraph.replace(/[━─═]{20,}/g,'')}</p>)}</div>{event.link&&<div className="my-8"><YouTubeEmbed url={event.link} title="活动记录视频"/></div>}{event.gallery?.length&&id?<EventGallery eventId={id} gallery={event.gallery}/>:null}</>}</ContentState></PageShell>;
}
