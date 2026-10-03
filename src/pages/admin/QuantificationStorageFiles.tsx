import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { AdminButton, Badge, DataTable, EmptyState, ErrorState, Field, LoadingState, Panel, SelectInput, Td, TextInput, Th } from './components';
import QuantificationDownloads from '../../components/QuantificationDownloads';
import { quantificationApi, quantificationBytes, quantificationDate, quantificationError } from '../../lib/quantificationApi';
import type { DownloadLinks } from '../../types/quantification';

export default function QuantificationStorageFiles({ identity, enabled }: { identity: string; enabled: boolean }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('lastModified');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [downloads, setDownloads] = useState<DownloadLinks | null>(null);
  const lock = useRef(false);
  const listing = useQuery({ queryKey: ['quantification', 'storage-files', identity], queryFn: quantificationApi.storageFiles, enabled, staleTime: 5000, retry: false, refetchOnWindowFocus: true });
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    const rows = (listing.data?.files || []).filter(file => `${file.name} ${file.key}`.toLocaleLowerCase().includes(keyword));
    rows.sort((a, b) => {
      const difference = sort === 'size' ? a.size - b.size : sort === 'lastModified' ? (Date.parse(a.lastModified) || 0) - (Date.parse(b.lastModified) || 0) : a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
      return (direction === 'asc' ? 1 : -1) * difference || a.key.localeCompare(b.key);
    });
    return rows;
  }, [listing.data, search, sort, direction]);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * 20, currentPage * 20);
  useEffect(() => { setPage(1); }, [search, sort, direction]);
  useEffect(() => {
    const keys = new Set(listing.data?.files.map(file => file.key));
    setSelected(current => current.filter(key => keys.has(key)));
  }, [listing.data]);
  const toggle = (key: string) => setSelected(current => current.includes(key) ? current.filter(value => value !== key) : current.length < 50 ? [...current, key] : current);
  const refresh = () => { setError(''); void listing.refetch(); };
  const download = async (keys: string[]) => {
    if (!keys.length || lock.current) return;
    lock.current = true; setDownloading(true); setError('');
    try { setDownloads(await quantificationApi.storageDownloads(keys)); }
    catch (err) { setError(quantificationError(err)); }
    finally { lock.current = false; setDownloading(false); }
  };
  return <>
    <div className="mb-6"><Panel title={`存储桶材料${listing.data ? `（${listing.data.count} 份）` : ''}`} description={listing.data ? `当前目录 ${listing.data.prefix} · 无需导入名单即可查看和下载。` : '直接读取上传目录中的 ZIP 材料。'} actions={<AdminButton variant="secondary" disabled={!enabled} loading={listing.isFetching} onClick={refresh}><RefreshCw size={16} aria-hidden="true"/>刷新材料</AdminButton>}>
      {!enabled ? <p className="text-sm text-muted-foreground">请先在“存储配置”保存 COS 与云函数地址。</p> : listing.isPending ? <LoadingState label="正在读取存储桶材料…"/> : listing.isError ? <ErrorState message={quantificationError(listing.error)} onRetry={refresh}/> : <>
        <div className="quant-admin-toolbar">
          <Field label="搜索存储桶文件"><TextInput value={search} maxLength={100} onChange={e => setSearch(e.target.value)} placeholder="文件名 / 学号 / 路径"/></Field>
          <Field label="材料排序"><SelectInput value={sort} onChange={e => setSort(e.target.value)} options={[{ value: 'name', label: '文件名' }, { value: 'lastModified', label: '最后修改时间' }, { value: 'size', label: '文件大小' }]}/></Field>
          <AdminButton variant="secondary" onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')}>{direction === 'asc' ? '材料升序' : '材料降序'}</AdminButton>
          <AdminButton variant="ghost" onClick={() => { setSearch(''); setSort('lastModified'); setDirection('desc'); }}>清空材料筛选</AdminButton>
        </div>
        <div className="quant-selection"><span className="text-sm mr-2">已选 {selected.length} 份 · 筛选 {filtered.length} 份</span><AdminButton variant="secondary" disabled={!filtered.length} onClick={() => setSelected(filtered.slice(0, 50).map(file => file.key))}>{filtered.length > 50 ? '全选前 50 份' : '全选筛选结果'}</AdminButton><AdminButton variant="ghost" disabled={!selected.length} onClick={() => setSelected([])}>取消材料全选</AdminButton><AdminButton variant="ghost" disabled={!rows.length} onClick={() => setSelected(rows.filter(file => !selected.includes(file.key)).map(file => file.key))}>反选材料本页</AdminButton><AdminButton disabled={!selected.length} loading={downloading} onClick={() => void download(selected)}><Download size={16} aria-hidden="true"/>下载选中存储桶材料</AdminButton></div>
        {error && <p role="alert" className="form-error mb-4">{error}</p>}
        {!!listing.data?.retainedCopies && <p className="text-xs text-muted-foreground mb-4">已确认材料的 {listing.data.retainedCopies} 个旧临时副本仍保留在 COS，列表不重复显示。</p>}
        {!rows.length ? <EmptyState title={listing.data?.count ? '没有符合筛选的材料' : '上传目录暂无 ZIP 材料'} description="可以刷新材料或调整搜索条件；材料列表不依赖班级名单。"/> : <DataTable head={<><Th>选择</Th><Th>文件名 / 路径</Th><Th>大小</Th><Th>最后修改</Th><Th>文件状态</Th><Th>操作</Th></>}>
          {rows.map(file => <tr key={file.key} className="quant-admin-row border-b border-border"><Td><label className="quant-check-label"><input type="checkbox" className="quant-check" aria-label={`选择存储桶材料 ${file.name}`} checked={selected.includes(file.key)} onChange={() => toggle(file.key)}/></label></Td><Td><strong className="quant-admin-filename block">{file.name}</strong><span className="text-xs text-muted-foreground break-all">{file.key}</span></Td><Td>{quantificationBytes(file.size)}</Td><Td>{quantificationDate(file.lastModified || null)}</Td><Td><Badge tone={file.pending ? 'neutral' : 'success'}>{file.pending ? '待确认' : '已在存储桶'}</Badge>{file.legacyPath && <span className="block text-xs text-muted-foreground">旧临时路径</span>}</Td><Td><AdminButton variant="secondary" disabled={downloading} onClick={() => void download([file.key])}>下载材料</AdminButton></Td></tr>)}
        </DataTable>}
        {pages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm"><span>材料第 {currentPage} / {pages} 页，共 {filtered.length} 份</span><div className="flex gap-2"><AdminButton variant="secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>材料上一页</AdminButton><AdminButton variant="secondary" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>材料下一页</AdminButton></div></div>}
        {listing.data?.refreshedAt && <p className="mt-3 text-xs text-muted-foreground">最近刷新：{quantificationDate(listing.data.refreshedAt)}</p>}
      </>}
    </Panel></div>
    <QuantificationDownloads result={downloads} onClose={() => setDownloads(null)}/>
  </>;
}
