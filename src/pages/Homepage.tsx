import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import type { ApiNews,ApiResource,ApiPastEvent,ApiSocialPost } from '../types/content';
import type { Announcement } from '../lib/announcementMeta';
import { type MongoEvent,transformToEventCard } from '../utils/eventTransform';
import { listFrom,formatDate,formatBytes } from '../lib/contentFormat';
import RisoArtwork from '../components/RisoArtwork';
import { useHomeScrollReveal } from '../hooks/useHomeScrollReveal';
import ContentState from '../components/ContentState';
import FeaturedContent from '../components/FeaturedContent';
import NewsCard from '../components/cards/NewsCard';
import EventCard from '../components/cards/EventCard';
import ResourceCard from '../components/cards/ResourceCard';
import PastEventCard from '../components/cards/PastEventCard';
import AnnouncementCard from '../components/cards/AnnouncementCard';
export default function Homepage() {
  const hero = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add({
      desktop: '(min-width: 768px)',
      mobile: '(max-width: 767px)',
      reduce: '(prefers-reduced-motion: reduce)',
    }, ({ conditions }) => {
      if (conditions?.reduce || !hero.current) return;
      const select = gsap.utils.selector(hero);
      const intro = gsap.timeline({
        defaults: { ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
      });
      intro.from(select('h1 > span'), { autoAlpha: 0, y: 24, duration: 0.42, stagger: 0.11 })
        .from(select('.hero-copy'), { autoAlpha: 0, y: 16, duration: 0.28 })
        .from(select('.hero-actions > *'), { autoAlpha: 0, y: 12, duration: 0.26, stagger: 0.06 });
      if (conditions?.desktop) {
        intro.from(select('[data-riso-layer]'), {
          autoAlpha: 0, y: 12, scale: 0.975,
          rotation: index => index % 2 ? 0.8 : -0.8,
          transformOrigin: '50% 50%', duration: 0.44, stagger: 0.1,
        }, 0.1);
        gsap.to(select('.riso-art'), {
          y: -14, ease: 'none',
          scrollTrigger: { trigger: hero.current, start: 'top top', end: 'bottom top', scrub: 0.5 },
        });
      }
      // A keyboard user can act immediately, even during the entrance.
      const finish = () => { intro.progress(1); };
      const element = hero.current;
      element.addEventListener('focusin', finish);
      return () => element.removeEventListener('focusin', finish);
    }, hero);
    return () => media.revert();
  }, { scope: hero });
  const news=useQuery({queryKey:['news','home'],queryFn:async()=>listFrom<ApiNews>((await api.get('/api/news?limit=4')).data,'news','articles')});
  const announcements=useQuery({queryKey:['announcements','home'],queryFn:async()=>listFrom<Announcement>((await api.get('/api/announcements?limit=3')).data,'announcements')});
  const events=useQuery({queryKey:['events','home'],queryFn:async()=>listFrom<MongoEvent>((await api.get('/api/events?status=published&limit=3')).data,'events')});
  const resources=useQuery({queryKey:['resources','home'],queryFn:async()=>listFrom<ApiResource>((await api.get('/api/resources?status=approved&limit=3')).data,'resources')});
  const posts=useQuery({queryKey:['social','home'],queryFn:async()=>listFrom<ApiSocialPost>((await api.get('/api/social/posts?limit=3')).data,'posts')});
  const past=useQuery({queryKey:['past-events'],queryFn:async()=>listFrom<ApiPastEvent>((await api.get('/api/past-events')).data,'data','events')});
  useHomeScrollReveal(page, [news, announcements, events, resources, posts, past].map(query => `${query.status}:${query.dataUpdatedAt}`).join('|'));
  return <div ref={page}><section ref={hero} className="hero"><div><h1><span className="print-offset">把我们的日常，</span><span>留在这里。</span></h1><p className="hero-copy">查公告、找资料、参与活动。<br/>和同学一起，记录值得记住的每一天。</p><div className="hero-actions"><Link className="ed-button" to="/announcements">查看班级公告</Link><Link className="text-link min-h-11 inline-flex items-center text-sm" to="/events">看看近期活动 →</Link></div></div><RisoArtwork/></section><section className="home-announcements"><div className="section-heading"><h2>近期公告</h2><Link className="text-link text-sm" to="/announcements">全部公告 →</Link></div><ContentState loading={announcements.isLoading} error={announcements.error} empty={!announcements.data?.length} emptyTitle="暂无新公告" onRetry={()=>void announcements.refetch()}>{announcements.data?.map(item=><AnnouncementCard key={item._id} announcement={item} clampBody/>)}</ContentState></section><FeaturedContent/><div className="home-columns"><div><section className="home-section"><div className="section-heading"><h2>接下来，一起参与</h2><Link className="text-link text-sm" to="/events">活动日程 →</Link></div><ContentState loading={events.isLoading} error={events.error} empty={!events.data?.length} emptyTitle="暂无近期活动" onRetry={()=>void events.refetch()}><div className="schedule-list">{events.data?.map(item=><EventCard key={item._id||item.id} {...transformToEventCard(item)} isCompact/>)}</div></ContentState></section><section className="home-section"><div className="section-heading"><h2>正在发生</h2><Link className="text-link text-sm" to="/news">全部新闻 →</Link></div><ContentState loading={news.isLoading} error={news.error} empty={!news.data?.length} emptyTitle="暂无新消息" onRetry={()=>void news.refetch()}>{news.data?.map(item=><NewsCard key={item._id} {...item}/>)}</ContentState></section></div><aside><section className="home-section"><div className="section-heading"><h2>共享资源</h2><Link className="text-link text-sm" to="/resources">资源目录 →</Link></div><ContentState loading={resources.isLoading} error={resources.error} empty={!resources.data?.length} emptyTitle="暂无共享资源" onRetry={()=>void resources.refetch()}>{resources.data?.map(item=><ResourceCard key={item._id} {...item} id={item._id} updatedAt={item.updatedAt||item.createdAt} fileSize={formatBytes(item.file?.size)||item.fileSize} author={item.uploadedBy?.name} isCompact/>)}</ContentState></section><section className="home-section"><div className="section-heading"><h2>班级动态</h2><Link className="text-link text-sm" to="/social">去聊聊 →</Link></div><ContentState loading={posts.isLoading} error={posts.error} empty={!posts.data?.length} emptyTitle="还没有新动态" onRetry={()=>void posts.refetch()}>{posts.data?.map(item=><article className="py-4 border-b border-border" key={item._id}><p className="font-semibold">{item.author?.name||'班级成员'}</p><time className="entry-meta">{formatDate(item.createdAt)}</time><p className="entry-description line-clamp-3">{item.content}</p><Link className="text-link text-sm" to={`/comments/social/${item._id}`}>查看动态与讨论 →</Link></article>)}</ContentState></section></aside></div><section className="home-section"><div className="section-heading"><h2>相聚的记忆</h2><Link className="text-link text-sm" to="/events">往期活动 →</Link></div><ContentState loading={past.isLoading} error={past.error} empty={!past.data?.length} emptyTitle="暂无活动相册" onRetry={()=>void past.refetch()}><div className="archive-strip">{past.data?.slice(0,2).map(item=><PastEventCard key={item._id} {...item} id={item._id}/>)}</div></ContentState></section></div>;
}
