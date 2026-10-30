import { useEffect, useState } from 'react';
import { ChevronDown, RefreshCw, Search, Sparkles } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/roles';
import { getAssistantUsage, type AssistantUsageReport } from './usageApi';

const number = (value: number) => value.toLocaleString('zh-CN');
const timestamp = (value: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—';
const control = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground disabled:cursor-wait disabled:opacity-50';

export default function AssistantUsage() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState({ page: 1, search: '', refresh: 0 });
  const [search, setSearch] = useState('');
  const [report, setReport] = useState<AssistantUsageReport | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    setBusy(true); setError('');
    getAssistantUsage({ page: query.page, limit: 20, search: query.search }, controller.signal)
      .then(result => { if (active) setReport(result); })
      .catch(() => { if (active && !controller.signal.aborted) setError('暂时无法读取成员 AI 用量，请稍后重试。'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [open, query]);
  return <section className="mb-6 rounded-3xl border border-border bg-card/60 p-4 sm:p-5" aria-label="成员 AI 用量">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-base font-medium"><Sparkles className="h-4 w-4" aria-hidden="true" />成员 AI 用量</h2><p className="mt-1 text-xs text-muted-foreground">按用户统计输入、输出 token 及联网请求。</p></div>
      <button className={control} type="button" aria-expanded={open} aria-controls="assistant-usage-detail" onClick={() => setOpen(value => !value)}>{open ? '收起用量' : '查看用量'}<ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" /></button>
    </div>
    {open && <div id="assistant-usage-detail" className="mt-5" aria-busy={busy}>
      <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); setReport(null); setQuery(value => ({ page: 1, search: search.trim(), refresh: value.refresh + 1 })); }}>
        <label className="min-w-0 flex-1"><span className="mb-1 block text-xs text-muted-foreground">查找成员</span><input className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="输入姓名或邮箱" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} /></label>
        <button type="submit" className={control} disabled={busy}><Search className="h-4 w-4" aria-hidden="true" />查询</button>
        <button type="button" className={control} disabled={busy} aria-label="刷新成员 AI 用量" onClick={() => setQuery(value => ({ ...value, refresh: value.refresh + 1 }))}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />刷新</button>
      </form>
      {error && <p className="mb-3 text-sm text-destructive" role="alert">{error}{report ? ' 当前保留上次读取的统计。' : ''}</p>}
      {!report && busy && <p className="py-8 text-center text-sm text-muted-foreground" role="status">正在读取用量…</p>}
      {report && <>
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[['已上报 token', report.totals.totalTokens], ['请求次数', report.totals.requests], ['联网请求', report.totals.webSearchRequests], ['用量待确认', report.totals.unreportedRequests]].map(([label, value]) => <div className="rounded-2xl border border-border bg-background/60 p-3" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-medium tabular-nums">{number(Number(value))}</p></div>)}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border" tabIndex={0} role="region" aria-label="成员 token 用量表">
          <table className="w-full min-w-[850px] text-left text-xs"><caption className="sr-only">当前筛选内成员的 AI 模式用量，输入与输出均来自 DeepSeek 实际回传。</caption>
            <thead><tr>{['成员', '输入 token', '输出 token', '总 token', '24 小时已用 / 剩余', '请求 / 待确认', '联网请求', '最后使用'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{report.users.map(user => <tr className="border-t border-border" key={user.userId}>
              <th scope="row" className="px-3 py-3 font-normal"><span className="block font-medium">{user.name || '未命名成员'} <small className="text-muted-foreground">{ROLE_LABELS[user.role] || user.role}</small></span><span className="mt-1 block text-muted-foreground">{user.email}</span></th>
              <td className="px-3 py-3 tabular-nums">{number(user.promptTokens)}</td><td className="px-3 py-3 tabular-nums">{number(user.completionTokens)}</td><td className="px-3 py-3 font-medium tabular-nums">{number(user.totalTokens)}</td><td className="px-3 py-3 tabular-nums">{user.quota ? <span>{number(user.quota.usedTokens)} / {number(user.quota.remainingTokens)}{user.quota.reservedTokens > 0 && <small className="mt-1 block text-muted-foreground">预留 {number(user.quota.reservedTokens)}</small>}</span> : '—'}</td><td className="px-3 py-3 tabular-nums">{number(user.requests)} / {number(user.unreportedRequests)}</td><td className="px-3 py-3 tabular-nums">{number(user.webSearchRequests)}</td><td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{timestamp(user.lastUsedAt)}</td>
            </tr>)}{report.users.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">{query.search ? '没有匹配的成员使用记录。' : '还没有成员 AI 模式使用记录。'}</td></tr>}</tbody>
          </table>
        </div>
        <nav className="mt-3 flex flex-wrap items-center justify-between gap-2" aria-label="AI 用量分页"><p className="text-xs text-muted-foreground">共 {number(report.pagination.total)} 位使用成员 · 第 {report.pagination.page} / {Math.max(1, report.pagination.totalPages)} 页</p><div className="flex gap-2"><button className={control} type="button" disabled={busy || report.pagination.page <= 1} onClick={() => setQuery(value => ({ ...value, page: Math.max(1, report.pagination.page - 1) }))}>上一页</button><button className={control} type="button" disabled={busy || report.pagination.page >= report.pagination.totalPages} onClick={() => setQuery(value => ({ ...value, page: report.pagination.page + 1 }))}>下一页</button></div></nav>
      </>}
      <p className="mt-4 text-xs leading-6 text-muted-foreground">统计包含成员 AI、新闻问答、反馈整理与管理员手动模型调用；额度按滚动 24 小时每人 100,000 token 校验。未完整上报用量的请求单独标记，不能据此认定消耗为 0。联网按请求次数单列；数字并非费用或剩余余额。</p>
    </div>}
  </section>;
}
