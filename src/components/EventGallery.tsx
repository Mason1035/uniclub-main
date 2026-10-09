import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { safeActivityMediaSource } from '../lib/activityMediaPolicy';
interface GalleryImage { id?: string; index?: number; url?: string; thumbnailUrl?: string; expiresAt?: string; contentType?: string; originalName?: string; caption?: string }
export default function EventGallery({ eventId, gallery, title = '活动相册', onRefresh }: { eventId: string; gallery: GalleryImage[]; title?: string; onRefresh?: () => Promise<void> }) {
  const [selected, setSelected] = useState<number | null>(null); const [zoom, setZoom] = useState(1); const [errors, setErrors] = useState<Set<string>>(new Set()); const [refreshing, setRefreshing] = useState(false); const touch = useRef<number | null>(null); const refreshLock = useRef(false);
  const src = (index: number) => safeActivityMediaSource(gallery[index]?.url) || (!gallery[index]?.id && /^[a-f\d]{24}$/i.test(eventId) ? `/api/past-events/${eventId}/gallery/${gallery[index]?.index ?? index}` : '');
  const thumb = (index: number) => safeActivityMediaSource(gallery[index]?.thumbnailUrl) || src(index);
  const move = (amount: number) => { setSelected(index => index === null ? null : Math.min(gallery.length - 1, Math.max(0, index + amount))); setZoom(1); };
  useEffect(() => { if (selected !== null && selected >= gallery.length) setSelected(null); }, [gallery.length, selected]);
  useEffect(() => {
    if (selected === null) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSelected(index => index === null ? null : Math.min(gallery.length - 1, Math.max(0, index + (event.key === 'ArrowLeft' ? -1 : 1)))); setZoom(1); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [selected, gallery.length]);
  const refresh = async () => {
    if (!onRefresh || refreshLock.current) return;
    refreshLock.current = true; setRefreshing(true);
    try { await onRefresh(); setErrors(new Set()); } finally { refreshLock.current = false; setRefreshing(false); }
  };
  const open = async (index: number) => {
    if (refreshLock.current) return;
    if (onRefresh && gallery[index]?.expiresAt && Date.parse(gallery[index].expiresAt!) <= Date.now() + 5000) await refresh();
    setSelected(index); setZoom(1);
  };
  if (!gallery.length) return null;
  return <section className="mt-8" aria-label={title}>
    <div className="section-heading"><h2>{title}</h2><span className="entry-meta">{gallery.length} 张照片</span></div>
    <div className="gallery-grid">{gallery.map((photo, index) => <button key={photo.id || index} aria-label={`查看第 ${index + 1} 张照片${photo.caption ? '：' + photo.caption : ''}`} onClick={() => void open(index)} disabled={refreshing || !src(index)}>{errors.has(thumb(index)) ? <span className="block aspect-[4/3] bg-secondary p-4 text-sm">图片暂时无法加载，点击重试浏览</span> : <img src={thumb(index)} alt={photo.caption || `活动照片 ${index + 1}`} loading="lazy" onError={() => setErrors(previous => new Set(previous).add(thumb(index)))}/>}</button>)}</div>
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) { setSelected(null); setZoom(1); } }}><DialogContent className="lightbox-panel"><DialogTitle className="pr-12">{selected !== null ? gallery[selected]?.caption || `活动照片 ${selected + 1}` : '活动照片'}</DialogTitle><DialogDescription className="sr-only">方向键或左右滑动切换照片，Esc 关闭，支持缩放。</DialogDescription>{selected !== null && <>
      <div className="lightbox-image" onTouchStart={event => { touch.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => { const end = event.changedTouches[0]?.clientX; if (zoom === 1 && touch.current !== null && end !== undefined && Math.abs(end - touch.current) > 60) move(end > touch.current ? -1 : 1); touch.current = null; }}>{errors.has(src(selected)) ? <div role="alert"><p>大图暂时无法加载。</p>{onRefresh && <button className="ed-button secondary mt-3" disabled={refreshing} onClick={() => void refresh()}>刷新图片</button>}</div> : <img key={src(selected)} src={src(selected)} alt={gallery[selected]?.caption || `活动照片 ${selected + 1}`} onError={() => setErrors(previous => new Set(previous).add(src(selected)))} style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}/>}</div>
      <div className="lightbox-controls"><button className="icon-control" aria-label="上一张照片" disabled={selected === 0} onClick={() => move(-1)}><ChevronLeft/></button><span className="text-sm">{selected + 1} / {gallery.length}</span><button className="icon-control" aria-label="下一张照片" disabled={selected === gallery.length - 1} onClick={() => move(1)}><ChevronRight/></button><button className="icon-control" aria-label="缩小照片" disabled={zoom === 1} onClick={() => setZoom(value => Math.max(1, value - .5))}><ZoomOut/></button><button className="icon-control" aria-label="放大照片" disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + .5))}><ZoomIn/></button><button className="filter-option" onClick={() => setZoom(1)}>还原</button></div>
    </>}</DialogContent></Dialog>
  </section>;
}
