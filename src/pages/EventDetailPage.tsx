import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import ContentState from '../components/ContentState';
import PageHeading from '../components/PageHeading';
import BackNavigation from '../components/BackNavigation';
import InteractionButtons from '../components/InteractionButtons';
import ActivityAlbum from '../components/ActivityAlbum';
import { activityApi, activityError } from '../lib/activityApi';
import { ACTIVITY_STATUS_LABELS, PHASE_LABELS, REGISTRATION_LABELS, activityTypeLabel } from '../lib/activityMeta';
import { formatDate } from '../lib/contentFormat';
import { formatEventLocation } from '../utils/eventTransform';
import NotFound from './NotFound';
import { isMissingContent } from '../lib/routeState';
import { isWebUrl } from './admin/contentValidation';

export default function EventDetailPage() {
  const { id = '' } = useParams(); const location = useLocation(); const navigate = useNavigate(); const client = useQueryClient();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [failed, setFailed] = useState(false); const lock = useRef(false);
  const query = useQuery({ queryKey: ['event', id], enabled: !!id, retry: (count, error) => !isMissingContent(error) && count < 2, queryFn: ({ signal }) => activityApi.detail(id, false, signal), staleTime: 15000, refetchInterval: 240000, refetchOnWindowFocus: true });
  const mine = useQuery({ queryKey: ['rsvp', id], enabled: !!query.data?.event, queryFn: ({ signal }) => activityApi.mine(id, signal), staleTime: 5000, refetchOnWindowFocus: true });
  const event = query.data?.event; const rsvp = mine.data; const status = rsvp?.status;
  if (isMissingContent(query.error) || (query.isSuccess && !event)) return <NotFound/>;
  const change = async (cancel: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage(''); setFailed(false);
    try {
      const updated = cancel ? await activityApi.cancel(id) : await activityApi.apply(id);
      client.setQueryData(['rsvp', id], updated);
      setMessage(cancel ? '报名已取消，申请记录继续保留。' : '报名申请已提交，请等待管理员审核。');
      void client.invalidateQueries({ queryKey: ['event', id] }); void client.invalidateQueries({ queryKey: ['events'] });
    } catch (cause) { setFailed(true); setMessage(activityError(cause)); void mine.refetch(); void query.refetch(); }
    finally { lock.current = false; setBusy(false); }
  };
  const open = event?.registrationOpen === true;
  const cancellationOpen = event?.cancellationOpen ?? open;
  const activeRegistration = status === 'PENDING' || status === 'APPROVED';
  return <PageShell className="reading-page editorial-content">
    <BackNavigation referrer={location.state?.referrer} contentType="event" fallbackReferrer="/events"/>
    <ContentState illustration="activity" loading={query.isLoading} error={query.error} empty={!event} emptyTitle="找不到这个活动" onRetry={() => void query.refetch()}>{event && <>
      <PageHeading tone="editorial" title={event.title} description={activityTypeLabel(event.eventType)}/>
      <div className="detail-meta"><time>{formatDate(event.startDate)} {new Date(event.startDate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time><span>至 {formatDate(event.endDate)} {new Date(event.endDate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span><span>{formatEventLocation(event.location)}</span>{event.phase && <span>{PHASE_LABELS[event.phase]}</span>}{event.status !== 'published' && <span>{ACTIVITY_STATUS_LABELS[event.status || ''] || event.status}</span>}</div>
      {event.location?.address && <p className="entry-meta mb-3">地址：{event.location.address}{event.location.room ? `，${event.location.room}` : ''}</p>}
      {event.location?.virtualLink && isWebUrl(event.location.virtualLink) && <a className="text-link mb-4 inline-flex min-h-11 items-center" href={event.location.virtualLink} target="_blank" rel="noopener noreferrer">进入线上活动</a>}
      {(event.coverUrl || event.imageUrl) && <img className="detail-image" src={event.coverUrl || event.imageUrl} alt={event.title}/>}
      <div data-pet-avoid className="reading-body whitespace-pre-wrap">{event.description}</div>
      {event.prerequisites?.length ? <section className="mt-8"><h2 className="mb-3 text-xl font-bold">参加前准备</h2><ul className="list-disc space-y-2 pl-5">{event.prerequisites.map(item => <li key={item}>{item}</li>)}</ul></section> : null}
      {event.rsvpDeadline && <p className="entry-meta mt-6">报名截止：{formatDate(event.rsvpDeadline)} {new Date(event.rsvpDeadline).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>}
      <section className="mt-8 border-y border-border py-6" aria-label="活动报名"><h2 className="mb-3 text-xl font-bold">参与活动</h2><p className="mb-4 text-sm text-muted-foreground">{event.approvedCount == null ? '已报名' : '已通过'} {event.approvedCount ?? event.rsvpCount ?? 0} 人{event.maxCapacity ? ` / 名额 ${event.maxCapacity}` : ''}。提交申请后由管理员审核。</p>
        {mine.isLoading ? <p role="status">正在查询报名状态…</p> : mine.error ? <div role="alert"><p>报名状态暂时无法读取。</p><button className="ed-button secondary mt-3" onClick={() => void mine.refetch()}>重新查询</button></div> : <><p className="mb-3 font-medium" aria-live="polite">{REGISTRATION_LABELS[status || 'UNREGISTERED']}</p>{rsvp?.reviewNote && <p className="mb-3 whitespace-pre-wrap text-sm">审核说明：{rsvp.reviewNote}</p>}{!open && <p className="mb-4 text-sm text-muted-foreground">{event.registrationClosedReason || '当前不接受报名。'}</p>}<div className="detail-actions">{activeRegistration ? <button className="ed-button secondary" disabled={busy || !cancellationOpen} onClick={() => void change(true)}>{busy ? '正在处理…' : '取消报名'}</button> : <button className="ed-button" disabled={busy || !open} onClick={() => void change(false)}>{busy ? '正在提交…' : status === 'REJECTED' || status === 'CANCELLED' ? '重新申请' : '提交报名申请'}</button>}{event.rsvpLink && isWebUrl(event.rsvpLink) && <a className="ed-button secondary" href={event.rsvpLink} target="_blank" rel="noopener noreferrer">相关报名链接</a>}</div></>}
        {message && <p className={`mt-4 text-sm ${failed ? 'text-destructive' : ''}`} role={failed ? 'alert' : 'status'}>{message}</p>}
      </section>
      {event.summary && <section className="mt-10"><div className="section-heading"><h2>活动总结</h2></div><div data-pet-avoid className="reading-body whitespace-pre-wrap">{event.summary}</div></section>}
      <ActivityAlbum key={id} id={id}/>
      <InteractionButtons contentType="Event" contentId={id} likeCount={event.likeCount || event.likes} shareCount={event.shareCount || event.shares} saveCount={event.saveCount || event.saves} commentCount={event.commentCount || event.discussionCount} shareTitle={event.title} shareType="event" onCommentClick={() => navigate(`/comments/event/${id}`, { state: { referrer: location.pathname } })}/>
    </>}</ContentState>
  </PageShell>;
}
