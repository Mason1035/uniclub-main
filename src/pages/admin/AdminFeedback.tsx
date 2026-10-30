import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCheck, Inbox, MailOpen, RefreshCw, Search } from 'lucide-react';
import { getFeedbackInbox, updateFeedbackStatus, type FeedbackInbox, type FeedbackStatus } from './ai/feedbackInboxApi';

const labels: Record<FeedbackStatus, string> = { new: '未读', read: '已读', resolved: '已处理' };
const control = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50';
const time = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—';
const safePage = (value: string) => /^\/(?!\/)/.test(value) && !/[\\\s]/u.test(value) && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

export default function AdminFeedback() {
  const [query, setQuery] = useState({ page: 1, search: '', status: 'all', refresh: 0 });
  const [search, setSearch] = useState('');
  const [report, setReport] = useState<FeedbackInbox | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const mutation = useRef<AbortController | null>(null), mutationBusy = useRef(false);
  const selected = report?.items.find(item => item.id === selectedId);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setBusy(true); setError('');
    getFeedbackInbox({ page: query.page, limit: 20, status: query.status, search: query.search }, controller.signal)
      .then(value => { if (active) setReport(value); })
      .catch(() => { if (active && !controller.signal.aborted) setError('暂时无法读取反馈收件箱，请稍后重试。'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [query]);
  useEffect(() => () => mutation.current?.abort(), []);
  const update = async (status: FeedbackStatus) => {
    if (!selected || mutationBusy.current) return;
    const controller = new AbortController(); mutation.current = controller; mutationBusy.current = true;
    setSaving(true); setError('');
    try {
      const value = await updateFeedbackStatus(selected.id, status, controller.signal);
      if (controller.signal.aborted) return;
      setReport(previous => previous && { ...previous, items: previous.items.map(item => item.id === value.id ? value : item) });
      setQuery(previous => ({ ...previous, refresh: previous.refresh + 1 }));
    } catch { if (!controller.signal.aborted) setError('处理状态暂时无法更新，请重试。'); }
    finally { mutationBusy.current = false; if (!controller.signal.aborted) setSaving(false); }
  };
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1>反馈收件箱</h1><p className="mt-2 text-sm text-muted-foreground">接收成员确认提交的问题与改进建议。</p></div><button className={control} type="button" disabled={busy || saving} onClick={() => setQuery(value => ({ ...value, refresh: value.refresh + 1 }))}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />刷新</button></header>
    {report && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([['total', '全部反馈'], ['new', '未读反馈'], ['read', '已读反馈'], ['resolved', '已处理']] as const).map(([key, label]) => <div key={key} className="rounded-3xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-3xl tabular-nums">{report.summary[key]}</p></div>)}</div>}
    <form className="flex flex-wrap gap-3 rounded-3xl border border-border bg-card p-4" onSubmit={event => { event.preventDefault(); setSelectedId(''); setQuery(value => ({ ...value, page: 1, search: search.trim() })); }}>
      <label className="min-w-0 flex-1"><span className="mb-1 block text-xs text-muted-foreground">搜索反馈</span><input className="w-full rounded-xl border border-border px-3 py-2 text-sm" maxLength={100} value={search} placeholder="标题或反馈内容" onChange={event => setSearch(event.target.value)} disabled={saving} /></label>
      <label><span className="mb-1 block text-xs text-muted-foreground">处理状态</span><select className="rounded-xl border border-border px-3 py-2 text-sm" value={query.status} disabled={saving} onChange={event => { setSelectedId(''); setQuery(value => ({ ...value, page: 1, status: event.target.value })); }}><option value="all">全部状态</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="submit" className={`${control} self-end`} disabled={busy || saving}><Search className="h-4 w-4" aria-hidden="true" />查询</button>
    </form>
    {error && <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</p>}
    {!report && busy && <p role="status" className="py-12 text-center text-muted-foreground">正在读取成员反馈…</p>}
    {report && <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.2fr)]">
      <section className="min-w-0 overflow-hidden rounded-3xl border border-border bg-card" aria-label="反馈列表" aria-busy={busy}>
        <ul className="divide-y divide-border">{report.items.map(item => <li key={item.id}><button type="button" data-feedback-id={item.id} aria-pressed={selectedId === item.id} disabled={saving} onClick={() => setSelectedId(item.id)} className={`block w-full p-5 text-left transition-colors hover:bg-primary/5 ${selectedId === item.id ? 'bg-primary/10' : ''}`}><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className={item.status === 'new' ? 'font-medium text-primary' : ''}>{labels[item.status]}</span><time dateTime={item.createdAt}>{time(item.createdAt)}</time></div><h2 className="break-words text-base font-medium">{item.title}</h2><p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-muted-foreground">{item.description}</p><p className="mt-3 text-xs text-muted-foreground">{item.member.name || '未命名成员'}</p></button></li>)}</ul>
        {!report.items.length && <div className="grid justify-items-center gap-3 px-5 py-16 text-center text-muted-foreground"><Inbox className="h-8 w-8" aria-hidden="true" /><p>当前没有符合条件的反馈。</p></div>}
        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4" aria-label="反馈分页"><p className="text-xs text-muted-foreground">共 {report.pagination.total} 条 · {report.pagination.page} / {Math.max(1, report.pagination.pages)} 页</p><div className="flex gap-2"><button className={control} type="button" disabled={busy || saving || report.pagination.page <= 1} onClick={() => { setSelectedId(''); setQuery(value => ({ ...value, page: report.pagination.page - 1 })); }}>上一页</button><button className={control} type="button" disabled={busy || saving || report.pagination.page >= report.pagination.pages} onClick={() => { setSelectedId(''); setQuery(value => ({ ...value, page: report.pagination.page + 1 })); }}>下一页</button></div></nav>
      </section>
      <section className="min-w-0 rounded-3xl border border-border bg-card p-5 sm:p-6" aria-label="反馈详情">
        {selected ? <><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words text-xl font-medium">{selected.title}</h2><span className="rounded-full bg-primary/10 px-3 py-1 text-xs">{labels[selected.status]}</span></div><p className="mt-3 break-words text-sm text-muted-foreground">{selected.member.name || '未命名成员'}{selected.member.email && ` · ${selected.member.email}`}</p><p className="mt-1 text-xs text-muted-foreground">提交于 {time(selected.createdAt)}</p>
          <dl className="my-6 space-y-5 text-sm"><div><dt className="mb-2 font-medium">遇到的问题或改进建议</dt><dd className="whitespace-pre-wrap break-words leading-7 text-muted-foreground">{selected.description}</dd></div>{selected.expected && <div><dt className="mb-2 font-medium">期待的效果</dt><dd className="whitespace-pre-wrap break-words leading-7 text-muted-foreground">{selected.expected}</dd></div>}{selected.page && <div><dt className="mb-2 font-medium">相关页面</dt><dd className="break-words text-muted-foreground">{safePage(selected.page) ? <a className="inline-flex items-center gap-1 underline underline-offset-4" href={selected.page} target="_blank" rel="noopener noreferrer">{selected.page}<ArrowUpRight className="h-3 w-3" aria-hidden="true" /></a> : selected.page}</dd></div>}</dl>
          <div className="flex flex-wrap gap-2 border-t border-border pt-5">{selected.status !== 'read' && <button type="button" className={control} disabled={saving} onClick={() => void update('read')}><MailOpen className="h-4 w-4" aria-hidden="true" />标为已读</button>}{selected.status !== 'resolved' && <button type="button" className={`${control} bg-primary/10`} disabled={saving} onClick={() => void update('resolved')}><CheckCheck className="h-4 w-4" aria-hidden="true" />标为已处理</button>}{selected.status !== 'new' && <button type="button" className={control} disabled={saving} onClick={() => void update('new')}>标为未读</button>}</div>
        </> : <div className="grid justify-items-center gap-3 py-16 text-center text-muted-foreground"><MailOpen className="h-9 w-9" aria-hidden="true" /><p>选择一条反馈查看完整内容。</p></div>}
      </section>
    </div>}
  </div>;
}
