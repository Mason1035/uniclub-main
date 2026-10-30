import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed, Maximize2, Minus, MousePointer2, Plus } from 'lucide-react';
import type { FeatureCollection } from 'geojson';
import type { MarchEvent } from './data/types';
import 'leaflet/dist/leaflet.css';

interface Props {
  events: MarchEvent[];
  allEvents: MarchEvent[];
  selected: MarchEvent;
  onSelect: (id: string) => void;
  fitToken: number;
  exploring: boolean;
}

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fullBounds = L.latLngBounds([[23.6, 99.0], [37.5, 117.0]]);

export default function RouteMap({ events, allEvents, selected, onSelect, fitToken, exploring }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const nodes = useRef<L.LayerGroup | null>(null);
  const lines = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [base, setBase] = useState<'loading' | 'osm' | 'local'>('loading');
  const [zoom, setZoom] = useState(5);
  const priorEvent = useRef(selected.id);
  const priorFit = useRef(fitToken);

  useEffect(() => {
    if (!container.current) return;
    const compact = window.matchMedia('(max-width: 760px)').matches;
    const instance = L.map(container.current, {
      center: [29.0, 105.8], zoom: 5, minZoom: 4, maxZoom: 13,
      zoomControl: false, attributionControl: true, scrollWheelZoom: false,
      doubleClickZoom: false, dragging: !compact, touchZoom: false,
      keyboard: true, zoomAnimation: !reduced(), fadeAnimation: !reduced(),
    });
    map.current = instance;
    instance.attributionControl.setPrefix(false);
    instance.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Natural Earth</a>');
    instance.createPane('march-provinces');
    instance.getPane('march-provinces')!.style.zIndex = '180';
    instance.createPane('march-route');
    instance.getPane('march-route')!.style.zIndex = '420';
    const local = L.geoJSON(undefined, { pane: 'march-provinces', style: { color: '#77816e', weight: 1, opacity: .48, fillColor: '#303a30', fillOpacity: .8 }, interactive: false, onEachFeature: (feature, layer) => { if (feature.properties?.name_zh) layer.bindTooltip(String(feature.properties.name_zh), { permanent: true, direction: 'center', className: 'march-province-label', opacity: .65 }); } }).addTo(instance);
    const abort = new AbortController();
    fetch('/temp/media/central-china-provinces.geojson', { signal: abort.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then((data: FeatureCollection) => {
      if (abort.signal.aborted) return;
      local.addData(data);
    }).catch(() => {});
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 13, maxNativeZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
      className: 'march-osm-tiles', crossOrigin: true,
    });
    let loaded = false;
    let tileErrors = 0;
    tiles.on('tileload', () => { loaded = true; setBase('osm'); });
    tiles.on('tileerror', () => { tileErrors += 1; if (!loaded && tileErrors > 4) setBase('local'); });
    tiles.addTo(instance);
    const timeout = window.setTimeout(() => { if (!loaded) setBase('local'); }, 6500);
    nodes.current = L.layerGroup().addTo(instance);
    lines.current = L.layerGroup().addTo(instance);
    instance.on('zoomend', () => setZoom(instance.getZoom()));
    instance.fitBounds(fullBounds, { animate: false, paddingTopLeft: compact ? [15, 50] : [285, 55], paddingBottomRight: compact ? [15, 30] : [360, 55] });
    const observer = new ResizeObserver(() => instance.invalidateSize({ animate: false }));
    observer.observe(container.current);
    setReady(true);
    return () => {
      abort.abort(); clearTimeout(timeout); observer.disconnect(); instance.remove();
      map.current = null; nodes.current = null; lines.current = null; setReady(false);
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    if (interactive) { instance.scrollWheelZoom.enable(); instance.dragging.enable(); instance.touchZoom.enable(); instance.doubleClickZoom.enable(); }
    else { instance.scrollWheelZoom.disable(); instance.touchZoom.disable(); instance.doubleClickZoom.disable(); if (window.matchMedia('(max-width: 760px)').matches) instance.dragging.disable(); }
  }, [interactive, ready]);

  useLayoutEffect(() => {
    const instance = map.current;
    if (!instance || !nodes.current || !lines.current || !ready) return;
    const layer = nodes.current;
    layer.clearLayers(); lines.current.clearLayers();
    // Only the Central Red Army's sequential event anchors are connected.
    // The 1936 routes remain separate; these dashed segments are not marching tracks.
    const main = allEvents.filter(e => e.group === 'central').sort((a, b) => a.startDate.localeCompare(b.startDate));
    L.polyline(main.map(e => e.coordinates), { pane: 'march-route', color: '#d2624e', weight: 2.5, opacity: .95, dashArray: '6 7', interactive: false }).addTo(lines.current);
    const groups: MarchEvent[][] = [];
    for (const event of events.filter(e => e.id !== selected.id)) {
      const p = instance.latLngToLayerPoint(event.coordinates);
      const group = groups.find(g => p.distanceTo(instance.latLngToLayerPoint(g[0].coordinates)) < 38);
      if (group) group.push(event); else groups.push([event]);
    }
    for (const group of groups) {
      if (group.length > 1) {
        const lat = group.reduce((n, e) => n + e.coordinates[0], 0) / group.length;
        const lng = group.reduce((n, e) => n + e.coordinates[1], 0) / group.length;
        L.marker([lat, lng], { icon: L.divIcon({ className: 'march-cluster', html: `<span>${group.length}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }), title: `${group.length} 个邻近事件，点击展开：${group.map(e => e.title).join('、')}`, alt: '展开邻近事件', keyboard: true })
          .on('click', () => instance.fitBounds(L.latLngBounds(group.map(e => e.coordinates)), { maxZoom: 10, padding: [65, 65], animate: !reduced() })).addTo(layer);
      } else {
        const e = group[0];
        L.marker(e.coordinates, { icon: L.divIcon({ className: `march-marker ${e.group === 'central' ? '' : 'march-marker--other'}`, html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12] }), title: `${e.title}，${e.dateLabel}`, alt: e.title, keyboard: true })
          .bindTooltip(escape(e.title), { className: 'march-map-label', direction: 'top', offset: [0, -9] })
          .on('click', () => selectRef.current(e.id)).addTo(layer);
      }
    }
    L.marker(selected.coordinates, { icon: L.divIcon({ className: 'march-marker march-marker--selected', html: '<span></span>', iconSize: [36, 36], iconAnchor: [18, 18] }), title: `${selected.title}（当前事件）`, alt: selected.title, keyboard: true, zIndexOffset: 1000 })
      .bindTooltip(escape(selected.title), { permanent: true, direction: 'top', offset: [0, -13], className: 'march-map-label march-map-label--selected' })
      .on('click', () => selectRef.current(selected.id)).addTo(layer);
  }, [events, allEvents, selected, ready, zoom]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    if (priorFit.current !== fitToken) {
      const compact = window.matchMedia('(max-width: 760px)').matches;
      instance.fitBounds(fullBounds, { animate: !reduced(), paddingTopLeft: compact ? [15, 50] : [exploring ? 195 : 285, 55], paddingBottomRight: compact ? [15, 30] : [370, 55] });
      priorFit.current = fitToken;
    } else if (priorEvent.current !== selected.id) {
      const compact = window.matchMedia('(max-width: 760px)').matches;
      const target = instance.project(selected.coordinates, 7).add(compact ? [0, 0] : [110, 0]);
      const center = instance.unproject(target, 7);
      if (reduced()) instance.setView(center, 7); else instance.flyTo(center, 7, { duration: .8 });
    }
    priorEvent.current = selected.id;
  }, [selected, fitToken, ready, exploring]);

  return <div className="march-map-wrap">
    <div ref={container} className="march-map" aria-label="长征事件互动地图，使用加减按钮缩放，或开启地图操作后平移" />
    <div className="march-map-status"><span className="march-status-dot" />{base === 'osm' ? '地理底图' : '本地地理简图'}<span> / </span>节点为遗址或所在地代表点</div>
    <div className="march-map-controls" aria-label="地图控制">
      <button aria-label="放大地图" onClick={() => map.current?.zoomIn()}><Plus size={18}/></button>
      <button aria-label="缩小地图" onClick={() => map.current?.zoomOut()}><Minus size={18}/></button>
      <button aria-label="定位当前事件" onClick={() => { map.current?.setView(selected.coordinates, 8, { animate: !reduced() }); }}><LocateFixed size={18}/></button>
      <button aria-label="地图回到全景" onClick={() => map.current?.fitBounds(fullBounds, { animate: !reduced(), padding: [45, 45] })}><Maximize2 size={18}/></button>
    </div>
    <button className={`march-map-mode ${interactive ? 'is-active' : ''}`} aria-pressed={interactive} onClick={() => setInteractive(!interactive)}><MousePointer2 size={14}/>{interactive ? '结束地图操作' : '开启地图操作'}</button>
    <div className="march-map-legend"><span><i className="legend-route"/>中央红军事件主线</span><span><i className="legend-point"/>其他部队及会师事件</span><p>事件关联示意，非精确行军轨迹</p></div>
  </div>;
}
