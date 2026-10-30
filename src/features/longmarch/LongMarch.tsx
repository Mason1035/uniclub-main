import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Compass, Download, ExternalLink, HelpCircle, List, MapPin, Search, Share2, X } from 'lucide-react';
import RouteMap from './RouteMap';
import { earlyEvents } from './data/early';
import { lateEvents } from './data/late';
import { artifacts } from './data/artifacts';
import { eventMedia, heroImage } from './data/media';
import type { MarchEvent, MarchImage, Source } from './data/types';
import './longmarch.css';

const events: MarchEvent[] = [...earlyEvents, ...lateEvents].map(e => ({ ...e, image: eventMedia[e.id] || e.image })).sort((a, b) => a.startDate.localeCompare(b.startDate));
type Tab = 'background' | 'process' | 'significance' | 'sources';
type Topic = 'sichuan' | 'artifacts' | 'themes' | 'sources';
const tabNames: { id: Tab; title: string }[] = [{ id: 'background', title: '历史背景' }, { id: 'process', title: '事件经过' }, { id: 'significance', title: '重要意义' }, { id: 'sources', title: '资料来源' }];
const topicNames: { id: Topic; title: string }[] = [{ id: 'sichuan', title: '四川长征' }, { id: 'artifacts', title: '文物记忆' }, { id: 'themes', title: '主题认识' }, { id: 'sources', title: '资料来源' }];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const initialEvent = () => {
  const id = new URLSearchParams(window.location.search).get('event');
  return events.some(e => e.id === id) ? id! : 'zunyi';
};

function Photo({ image, className = '', eager = false, caption = true }: { image: MarchImage; className?: string; eager?: boolean; caption?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image.src]);
  return <figure className={`march-photo ${className}`}>
    {failed ? (caption ? <a className="march-photo-failure" href={image.sourceUrl} target="_blank" rel="noreferrer"><BookOpen size={22}/><span>在来源页查看这张图片</span><ExternalLink size={14}/></a> : <span className="march-photo-failure">查看事件图片</span>) : <img src={image.src} alt={image.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)}/>}
    {caption && <figcaption><span>{image.type}</span>{image.caption}<a href={image.sourceUrl} target="_blank" rel="noreferrer" aria-label={`图片来源：${image.credit}`}><ExternalLink size={12}/></a></figcaption>}
  </figure>;
}

function SourceLinks({ sources }: { sources: Source[] }) {
  return <ul className="march-source-links">{sources.map((s, i) => <li key={s.url}><span>{String(i + 1).padStart(2, '0')}</span><a href={s.url} target="_blank" rel="noreferrer">{s.title}<small>{s.publisher}</small></a><ExternalLink size={13}/></li>)}</ul>;
}

function Timeline({ items, selectedId, onSelect, onList }: { items: MarchEvent[]; selectedId: string; onSelect: (id: string) => void; onList: () => void }) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const parent = strip.current;
    const current = parent?.querySelector<HTMLElement>(`[data-event="${selectedId}"]`);
    if (parent && current) parent.scrollTo({ left: Math.max(0, current.offsetLeft - parent.offsetLeft - parent.clientWidth / 2 + current.clientWidth / 2), behavior: reduced() ? 'instant' : 'smooth' });
  }, [selectedId, items]);
  const move = (direction: number) => strip.current?.scrollBy({ left: direction * Math.max(250, strip.current.clientWidth * .7), behavior: reduced() ? 'instant' : 'smooth' });
  return <section className="march-timeline" aria-label="长征事件时间轴">
    <div className="march-timeline-head"><div><span className="march-small-line"/><h2>循迹长征</h2><span className="march-muted">1934 — 1936</span></div><div><button className="march-text-button" onClick={onList}><List size={15}/>事件列表</button><button className="march-icon-button" aria-label="向前滚动时间轴" onClick={() => move(-1)}><ChevronLeft size={18}/></button><button className="march-icon-button" aria-label="向后滚动时间轴" onClick={() => move(1)}><ChevronRight size={18}/></button></div></div>
    <div className="march-timeline-strip" ref={strip}>{items.map((e, i) => <button className={`march-timeline-event ${e.id === selectedId ? 'is-current' : ''}`} key={e.id} data-event={e.id} onClick={() => onSelect(e.id)} aria-current={e.id === selectedId ? 'step' : undefined} aria-label={`${e.dateLabel}，${e.title}`}>
      <time dateTime={e.startDate}>{e.dateLabel}</time><span className="march-time-dot"/><strong>{e.title}</strong><Photo image={e.image} caption={false}/><span className="march-time-number">{String(i + 1).padStart(2, '0')}</span>
    </button>)}</div>
  </section>;
}

export default function LongMarch() {
  const [selectedId, setSelectedId] = useState(initialEvent);
  const [tab, setTab] = useState<Tab>('background');
  const [army, setArmy] = useState<'central' | 'all'>(() => events.find(e => e.id === initialEvent())?.group === 'central' ? 'central' : 'all');
  const [exploring, setExploring] = useState(false);
  const [fitToken, setFitToken] = useState(0);
  const [overlay, setOverlay] = useState<'search' | 'help' | 'full' | 'list' | null>(null);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<Topic>('sichuan');
  const [copied, setCopied] = useState(false);
  const dialogOpener = useRef<HTMLElement | null>(null);
  const detailScroll = useRef<HTMLDivElement>(null);
  const selected = events.find(e => e.id === selectedId) || events[0];
  const visible = useMemo(() => army === 'central' ? events.filter(e => e.group === 'central') : events, [army]);
  const currentIndex = visible.findIndex(e => e.id === selected.id);
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? events.filter(e => [e.title, e.dateLabel, e.location, e.currentLocation, e.summary, ...e.people, ...e.troops, ...e.themes].join(' ').toLocaleLowerCase().includes(q)) : events;
  }, [query]);
  const allSources = useMemo(() => Array.from(new Map([...events.flatMap(e => e.sources), ...artifacts.flatMap(a => a.sources)].map(s => [s.url, s])).values()), []);

  const select = useCallback((id: string) => {
    const event = events.find(e => e.id === id);
    if (!event) return;
    setSelectedId(id); setTab('background');
    if (event.group !== 'central') setArmy('all');
    const url = new URL(window.location.href);
    url.searchParams.set('event', id);
    window.history.pushState({ event: id }, '', url);
    detailScroll.current?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!events.some(e => e.id === url.searchParams.get('event'))) {
      url.searchParams.set('event', selectedId);
      window.history.replaceState({ event: selectedId }, '', url);
    }
    const pop = () => { const id = initialEvent(); setSelectedId(id); if (events.find(e => e.id === id)?.group !== 'central') setArmy('all'); setTab('background'); };
    const shortcut = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOverlay('search'); } };
    window.addEventListener('popstate', pop); window.addEventListener('keydown', shortcut);
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('keydown', shortcut); };
  }, []);

  useEffect(() => { document.title = `${selected.title}｜长征的力量 · 四川师范大学第二组`; }, [selected]);

  const advance = (direction: number) => { const next = visible[currentIndex + direction]; if (next) select(next.id); };
  const showTopic = (next: Topic) => { setTopic(next); window.setTimeout(() => document.getElementById('march-topics')?.scrollIntoView({ behavior: reduced() ? 'instant' : 'smooth', block: 'start' }), 0); };
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2200); }
    catch { setOverlay('full'); }
  };
  const chooseArmy = (next: 'central' | 'all') => {
    setArmy(next);
    if (next === 'central' && selected.group !== 'central') select('departure');
    setFitToken(t => t + 1);
  };

  return <div className={`march-site ${exploring ? 'is-exploring' : ''}`}>
    <a className="march-skip" href="#march-event-details">跳到事件正文</a>
    <header className="march-header">
      <a className="march-brand" href="/temp/" aria-label="长征的力量首页"><img src="/temp/mark.svg" alt=""/><span>长征的力量</span></a>
      <nav aria-label="主导航"><a href="#march-explore" className="is-current">长征足迹</a>{topicNames.map(n => <button key={n.id} onClick={() => showTopic(n.id)}>{n.title}</button>)}</nav>
      <div className="march-header-actions">
        <a className="march-ppt-download" href="/temp/downloads/long-march-presentation.pptx" download="长征的力量_主题成果展示.pptx"><Download size={16} aria-hidden="true"/><span>下载毛概展示PPT</span></a>
        <button aria-label="搜索事件、人物或地点" className="march-icon-button" onClick={() => setOverlay('search')}><Search size={20}/></button><button aria-label="使用帮助" className="march-icon-button" onClick={() => setOverlay('help')}><HelpCircle size={20}/></button>
      </div>
    </header>

    <main>
      <section className="march-explorer" id="march-explore" aria-label="长征地图与事件探索">
        <aside className="march-intro">
          <img className="march-intro-landscape" src={heroImage.src} alt="" aria-hidden="true"/>
          <div className="march-anniversary"><span>1936</span><i/><span>2026</span><b>胜利九十周年</b></div>
          <h1>长征<span>的力量</span></h1>
          <p className="march-subtitle">循着历史足迹<br/>读懂长征精神</p>
          <p className="march-intro-description">从于都出发，越过江河与雪山。<br/>沿着一个个历史坐标，<br/>走近一段改变中国命运的征程。</p>
          <button className="march-primary march-start" onClick={() => { setExploring(!exploring); if (!exploring) select('departure'); }}><Compass size={17}/>{exploring ? '展开导览' : '开始探索'}<ArrowRight size={17}/></button>
          <div className="march-team"><span className="march-small-line"/><p>四川师范大学第二组<small>毛概课实践成果展示</small></p></div>
        </aside>

        <RouteMap events={visible} allEvents={events} selected={selected} onSelect={select} fitToken={fitToken} exploring={exploring}/>

        <Timeline items={visible} selectedId={selectedId} onSelect={select} onList={() => setOverlay('list')}/>

        <aside className="march-event-panel" id="march-event-details" aria-label="当前事件详情">
          <div className="march-panel-top"><span>足迹档案</span><span>{String(events.indexOf(selected) + 1).padStart(2, '0')} / {events.length}</span><button className="march-icon-button" onClick={share} aria-label="复制当前事件链接">{copied ? <Check size={15}/> : <Share2 size={15}/>}</button></div>
          <div className="march-event-scroll" ref={detailScroll}>
            <time className="march-event-date" dateTime={selected.startDate}>{selected.dateLabel}</time>
            <h2 aria-live="polite">{selected.title}</h2>
            <p className="march-event-place"><MapPin size={14}/>{selected.location}</p>
            <p className="march-event-troops">{selected.troops.join('、')}</p>
            <p className="march-event-summary">{selected.summary}</p>
            <Photo image={selected.image} eager/>
            <div className="march-event-tabs" role="tablist" aria-label="事件内容">{tabNames.map(t => <button role="tab" id={`march-tab-${t.id}`} key={t.id} aria-selected={tab === t.id} aria-controls="march-tab-content" tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = (tabNames.findIndex(x => x.id === tab) + (e.key === 'ArrowRight' ? 1 : 3)) % 4; setTab(tabNames[n].id); document.getElementById(`march-tab-${tabNames[n].id}`)?.focus(); } }}>{t.title}</button>)}</div>
            <div className="march-tab-content" id="march-tab-content" role="tabpanel" aria-labelledby={`march-tab-${tab}`} tabIndex={0}>{tab === 'sources' ? <SourceLinks sources={selected.sources}/> : selected[tab].map((paragraph, i) => <p key={`${selected.id}-${tab}-${i}`}>{paragraph}</p>)}</div>
          </div>
          <div className="march-panel-bottom"><div><button onClick={() => advance(-1)} disabled={currentIndex <= 0}><ArrowLeft size={15}/>上一事件</button><button onClick={() => advance(1)} disabled={currentIndex === visible.length - 1}>下一事件<ArrowRight size={15}/></button></div><button className="march-read-more" onClick={() => setOverlay('full')}><BookOpen size={16}/>阅读完整事件<ArrowRight size={16}/></button></div>
        </aside>
      </section>

      <div className="march-explore-footer"><div className="march-army-filter" aria-label="部队范围"><button aria-pressed={army === 'central'} onClick={() => chooseArmy('central')}>中央红军主线</button><button aria-pressed={army === 'all'} onClick={() => chooseArmy('all')}>全部部队与会师</button></div><button className="march-text-button" onClick={() => setFitToken(t => t + 1)}><Compass size={15}/>回到全景</button><span className="march-explore-footnote">点击节点或时间轴，沿历史前行</span><button className="march-text-button march-discover" onClick={() => showTopic('sichuan')}>继续阅读<ArrowDown size={14}/></button></div>

      <section className="march-topics" id="march-topics" aria-label="长征专题研究">
        <div className="march-topics-heading"><div><p>从历史足迹，到今天的认识</p><h2>读懂一段征程</h2></div><nav aria-label="专题内容">{topicNames.map(n => <button className={topic === n.id ? 'is-current' : ''} onClick={() => setTopic(n.id)} key={n.id}>{n.title}</button>)}</nav></div>

        {topic === 'sichuan' && <div className="march-sichuan"><div className="march-sichuan-essay"><span className="march-section-label">江河 · 雪山 · 草地</span><h3>山河之间，<br/>留下共同的记忆。</h3><p>四川是理解长征的重要窗口。渡河争取前路，雪山考验体力，草地逼近生存极限；彝海结盟则说明，相互尊重与团结同样能够打开道路。</p><p>下面的事件分别注明部队与时间。1935年中央红军的行程，与1936年红二、红四方面军的北上经历，应放在各自的历史背景中阅读。</p><p className="march-local-note">安仁建川博物馆可作为成都本地的展览观察窗口。本页依据公开史料整理，不虚构小组实地参观、采访或活动记录。</p></div><div className="march-sichuan-events">{events.filter(e => e.sichuan).map(e => <button key={e.id} onClick={() => { select(e.id); document.getElementById('march-explore')?.scrollIntoView({ behavior: reduced() ? 'instant' : 'smooth' }); }}><time>{e.dateLabel}</time><strong>{e.title}</strong><span>{e.currentLocation}</span><ArrowRight size={17}/></button>)}</div></div>}

        {topic === 'artifacts' && <div className="march-artifacts">{artifacts.map((artifact) => <article key={artifact.id}><Photo image={artifact.image}/><div><span className="march-section-label">{artifact.collection}</span><h3>{artifact.title}</h3><h4>历史处境</h4><p>{artifact.context}</p><h4>人物行动</h4><p>{artifact.action}</p><h4>主题认识</h4><p>{artifact.reflection}</p><SourceLinks sources={artifact.sources}/></div></article>)}</div>}

        {topic === 'themes' && <div className="march-themes">{[
          { title: '坚定信念', description: '信念并非抽象的宣示。湘江突围后的继续前行、雪山草地中的相互扶持，都使“走下去”成为具体而艰难的选择。', ids: ['xiangjiang', 'jiajin', 'grassland'] },
          { title: '实事求是', description: '遵义会议从严重挫折中总结教训；四渡赤水因敌情、地形和兵力变化调整行动。认识来自事实，也要在实践中不断修正。', ids: ['zunyi', 'chishui'] },
          { title: '群众路线', description: '于都群众支援渡河，彝海结盟建立信任，白利寺收据留下借粮的凭证。理解这些细节，才能理解红军与各族群众之间的关系。', ids: ['departure', 'yihai'] },
          { title: '团结互助', description: '会师意味着不同部队走过各自的艰难道路后重新汇合。1935年到达陕北与1936年三大主力会师，是相互关联而不应混同的历史节点。', ids: ['maogong', 'ganzi', 'huining', 'jiangtaibao'] },
        ].map(t => <article key={t.title}><h3>{t.title}</h3><p>{t.description}</p><div>{t.ids.map(id => { const e = events.find(e => e.id === id)!; return <button key={id} onClick={() => { select(id); setOverlay('full'); }}>{e.title}<ArrowRight size={13}/></button>; })}</div></article>)}</div>}

        {topic === 'sources' && <div className="march-sources-page"><div><h3>让每一段叙述，<br/>都有可以回到的出处。</h3><p>史实综合共产党员网、新华社、人民日报、中国军网及纪念馆公开资料。时间区间保留原有精度；1935年到达陕北与1936年三大主力会师分别列出。</p><p>图片逐张标注历史照片、当代遗址、环境照片、文物或美术作品，完整图注和来源可在事件详情中查看。图片权利归原作者或发布机构，按来源标注使用信息；课堂展示不等于开放商用授权。</p><p>地图节点为事件所在地或遗址代表点，底图来自 OpenStreetMap，本地省界来自公有领域 Natural Earth。连接线仅表示事件时序关联，并非真实行军轨迹。</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap 署名与授权<ExternalLink size={13}/></a><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth 数据说明<ExternalLink size={13}/></a></div><SourceLinks sources={allSources}/><div className="march-image-register"><h3>图片来源索引</h3>{events.map(e => <p key={e.id}><strong>{e.title}</strong><span>{e.image.type} · {e.image.credit}</span><a href={e.image.sourceUrl} target="_blank" rel="noreferrer">查看来源<ExternalLink size={12}/></a></p>)}</div></div>}
      </section>
    </main>

    <footer className="march-footer"><span>长征的力量</span><p>四川师范大学第二组 · 毛概课实践成果展示</p><p>纪念红军长征胜利90周年 · 2026</p></footer>

    <Dialog.Root open={overlay !== null} onOpenChange={open => { if (!open) { setOverlay(null); setQuery(''); } }}>
      <Dialog.Portal><Dialog.Overlay className="march-dialog-overlay"/><Dialog.Content className={`march-dialog ${overlay === 'full' ? 'march-dialog--article' : ''}`} aria-describedby="march-dialog-description" onOpenAutoFocus={() => { dialogOpener.current = document.activeElement as HTMLElement | null; }} onCloseAutoFocus={e => { e.preventDefault(); dialogOpener.current?.focus({ preventScroll: true }); }}>
        <Dialog.Close className="march-dialog-close" aria-label="关闭窗口"><X size={22}/></Dialog.Close>
        <Dialog.Title className="march-dialog-title">{overlay === 'search' ? '寻找一段足迹' : overlay === 'help' ? '如何探索这段历史' : overlay === 'list' ? '长征事件目录' : selected.title}</Dialog.Title>
        <Dialog.Description id="march-dialog-description" className={overlay === 'full' ? 'march-muted' : 'march-dialog-description'}>{overlay === 'search' ? '输入事件、人物或地点，例如“刘伯承”“泸定”“会师”。' : overlay === 'help' ? '地图、时间轴和事件正文始终指向同一个事件。' : overlay === 'list' ? '按时间顺序独立浏览，也可以不操作地图。' : `${selected.dateLabel} · ${selected.location}`}</Dialog.Description>
        {(overlay === 'search' || overlay === 'list') && <><label className="march-search-input"><Search size={20}/><span className="march-sr-only">搜索事件、人物或地点</span><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索事件、人物或地点"/></label><p className="march-result-count" role="status">找到 {matches.length} 个事件</p><div className="march-search-results">{matches.map(e => <button key={e.id} onClick={() => { select(e.id); setOverlay(null); setQuery(''); }}><time>{e.dateLabel}</time><strong>{e.title}</strong><span>{e.location}</span><ArrowRight size={16}/></button>)}{matches.length === 0 && <p className="march-empty">没有找到匹配的事件。可以尝试“赤水”“朱德”或“1935”。</p>}</div></>}
        {overlay === 'help' && <div className="march-help"><section><Compass/><div><h3>从一个节点开始</h3><p>点击地图节点、时间轴或上一／下一事件，同步查看地点和史料。数字圆点代表邻近事件，点击即可放大展开。</p></div></section><section><MapPin/><div><h3>自由查看地图</h3><p>使用加减按钮缩放，“回到全景”恢复全线视野。默认滚轮用于正常浏览页面，开启“地图操作”后才使用滚轮缩放或手机手势平移。</p></div></section><section><BookOpen/><div><h3>读原文，也读出处</h3><p>四个标签分别呈现背景、经过、意义与来源。“阅读完整事件”集中展示全文、图片图注和坐标说明。</p></div></section><section><Share2/><div><h3>把同一段历史分享出去</h3><p>事件编号保存在网址中。点击详情面板的分享按钮复制链接，刷新或发送给同学后仍能打开同一事件。</p></div></section><p className="march-help-note">支持 Tab 键浏览、方向键切换详情标签、Esc 关闭窗口；遵循系统“减少动态效果”偏好。</p></div>}
        {overlay === 'full' && <article className="march-full-article"><dl><div><dt>历史地点</dt><dd>{selected.location}</dd></div><div><dt>今地名</dt><dd>{selected.currentLocation}</dd></div><div><dt>相关部队</dt><dd>{selected.troops.join('、')}</dd></div><div><dt>主要人物</dt><dd>{selected.people.join('、')}</dd></div></dl><p className="march-article-lead">{selected.summary}</p><Photo image={selected.image}/>{tabNames.filter(t => t.id !== 'sources').map(t => <section key={t.id}><h3>{t.title}</h3>{selected[t.id as Exclude<Tab, 'sources'>].map((p, i) => <p key={i}>{p}</p>)}</section>)}<section><h3>资料来源</h3><SourceLinks sources={selected.sources}/><p className="march-article-note">地图位置说明：{selected.coordinateNote} 图片：{selected.image.credit}。{selected.image.usage}</p></section><div className="march-full-share"><button className="march-primary" onClick={share}>{copied ? <Check size={16}/> : <Share2 size={16}/>} {copied ? '链接已复制' : '复制本事件链接'}</button><a href={`/temp/?event=${selected.id}`}>本事件固定链接<ExternalLink size={14}/></a></div></article>}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </div>;
}
