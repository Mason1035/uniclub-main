import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AdminButton, Badge, ErrorState, Field, LoadingState, Modal, Panel, SelectInput, TextInput } from '../components';
import {
  DAILY_NEWS_CATEGORIES, DAILY_NEWS_PHASES, dailyNewsError, dailyNewsJobError, dailyNewsTime,
  getDailyNews, runDailyNews, saveDailyNews, todayHasDailyNews,
  type DailyNewsConfig, type DailyNewsJob,
} from './dailyNews';

const jobTone = (job: DailyNewsJob) => job.status === 'failed' ? 'danger' as const : job.status === 'success' ? 'success' as const : 'neutral' as const;

export default function DailyNewsSettings() {
  const query = useQuery({
    queryKey: ['admin', 'ai', 'daily-news'],
    queryFn: ({ signal }) => getDailyNews(signal),
    retry: 1,
    refetchInterval: current => current.state.data?.running ? 4000 : 30000,
  });
  const [draft, setDraft] = useState<DailyNewsConfig | null>(null);
  const [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [starting, setStarting] = useState(false);
  const [confirm, setConfirm] = useState(false), [error, setError] = useState('');
  const actionLock = useRef(false), alive = useRef(true);
  const state = query.data;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Polling updates job status without replacing an administrator's unsaved edit.
  useEffect(() => { if (state && !dirty) setDraft(state.settings); }, [state, dirty]);
  const update = <K extends keyof DailyNewsConfig>(key: K, value: DailyNewsConfig[K]) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: value }); setDirty(true); setError('');
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || actionLock.current) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) { setError('请填写有效的北京时间，例如 19:00。'); return; }
    if (!Number.isInteger(draft.articleCount) || draft.articleCount < 1 || draft.articleCount > 5) { setError('每天生成数量应为 1–5 篇。'); return; }
    if (!draft.categories.length) { setError('请至少选择一种新闻偏好。'); return; }
    actionLock.current = true; setSaving(true); setError('');
    try {
      await saveDailyNews(draft);
      const refreshed = await query.refetch();
      if (!alive.current) return;
      if (refreshed.data) setDraft(refreshed.data.settings);
      setDirty(false); toast.success('AI 每日新闻设置已保存。');
    } catch (failure) { if (alive.current) setError(dailyNewsError(failure)); }
    finally { actionLock.current = false; if (alive.current) setSaving(false); }
  };
  const run = async () => {
    if (!state || actionLock.current) return;
    actionLock.current = true; setStarting(true); setError('');
    try {
      const result = await runDailyNews(todayHasDailyNews(state));
      if (!alive.current) return;
      setConfirm(false);
      if (result.started) toast.success('任务已开始，完成后会自动更新状态。');
      else if (result.alreadySucceeded) toast.info('今天已经生成过每日新闻。请再次确认后重新生成。');
      await query.refetch();
    } catch (failure) { if (alive.current) setError(dailyNewsError(failure)); }
    finally { actionLock.current = false; if (alive.current) setStarting(false); }
  };
  const busy = saving || starting || Boolean(state?.running);
  const runUnavailable = busy || dirty || !state?.ai.configured || !state?.search.configured || !state?.settings.webSearch;
  const last = state?.lastRun;
  const searchError = state?.search.errorCode || state?.search.errorMessage;

  return <div id="daily-news" className="mb-6 scroll-mt-24">
    <Panel title="AI 每日新闻" description="每天联网获取最新信息，使用系统 AI Assistant 整理每日精选。" actions={<AdminButton variant="ghost" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={15} aria-hidden="true"/>刷新状态</AdminButton>}>
      {query.isPending || (state && !draft) ? <LoadingState label="正在读取每日新闻设置…"/> : !state || !draft ? <ErrorState message={dailyNewsError(query.error)} onRetry={() => void query.refetch()}/> : <>
        {query.isError && <p className="mb-4 text-sm text-destructive" role="alert">状态暂时无法更新：{dailyNewsError(query.error)}</p>}
        <form onSubmit={event => void save(event)} className="space-y-5" aria-busy={saving}>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.enabled} disabled={busy} onChange={event => update('enabled', event.target.checked)} className="h-4 w-4 accent-primary"/>启用 AI 每日新闻</label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="生成时间" hint="固定使用北京时间 Asia/Shanghai"><TextInput type="time" value={draft.time} onChange={event => update('time', event.target.value)} disabled={busy} required/></Field>
            <Field label="每天生成" hint="默认 2 篇"><TextInput type="number" min={1} max={5} step={1} value={draft.articleCount} onChange={event => update('articleCount', Number(event.target.value))} disabled={busy} required/></Field>
            <Field label="思考模式"><SelectInput value={draft.reasoning} onChange={event => update('reasoning', event.target.value as DailyNewsConfig['reasoning'])} disabled={busy} options={[{ value: 'auto', label: 'Auto · 自动' }, { value: 'high', label: 'High · 深度思考' }]}/></Field>
          </div>
          <fieldset disabled={busy}><legend className="mb-2 text-xs font-medium">新闻偏好</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{DAILY_NEWS_CATEGORIES.map(category => <label key={category.value} className="flex min-h-8 items-center gap-2 text-sm"><input type="checkbox" checked={draft.categories.includes(category.value)} onChange={event => update('categories', event.target.checked ? [...draft.categories, category.value] : draft.categories.filter(value => value !== category.value))} className="h-4 w-4 accent-primary"/>{category.label}</label>)}</div></fieldset>
          <div className="grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-2">
            <div><p className="mb-1 text-xs text-muted-foreground">联网搜索</p><p>{state.settings.webSearch ? '已启用' : '未启用'} · {state.search.provider || '搜索服务'} · {state.search.configured ? '已配置' : '未配置'}</p>{searchError && <p className="mt-2 text-xs text-destructive" role="alert">{dailyNewsJobError(state.search)}</p>}{state.search.checkedAt && <p className="mt-1 text-xs text-muted-foreground">最近检索检查：{dailyNewsTime(state.search.checkedAt)}{typeof state.search.resultCount === 'number' && ` · ${state.search.resultCount} 条结果`}</p>}{typeof state.search.checkedFeeds === 'number' && <p className="mt-1 text-xs text-muted-foreground">实时订阅：{state.search.checkedFeeds} 个读取成功 · {state.search.failedFeeds || 0} 个暂不可用</p>}{typeof state.search.publisherCount === 'number' && <p className="mt-1 text-xs text-muted-foreground">独立发布者 {state.search.publisherCount} 个 · 一手来源 {state.search.primaryCount || 0} 条</p>}</div>
            <div><p className="mb-1 text-xs text-muted-foreground">AI Provider</p><p>使用系统 AI Assistant 配置</p><p className="mt-1 text-xs text-muted-foreground">{state.ai.provider} / {state.ai.model} · {state.ai.configured ? '已配置' : '尚未配置'}</p></div>
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <AdminButton type="submit" disabled={!dirty || starting || state.running} loading={saving}>保存设置</AdminButton>
        </form>

        <div className="mt-6 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold">任务状态</h3><AdminButton variant="secondary" disabled={runUnavailable} loading={starting} onClick={() => { setError(''); setConfirm(true); }}>立即运行一次</AdminButton></div>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">上次运行 · 北京时间</dt><dd className="mt-1">{dailyNewsTime(last?.startedAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">状态</dt><dd className="mt-1" aria-live="polite">{last ? <Badge tone={jobTone(last)}>{DAILY_NEWS_PHASES[last.status] || last.status}</Badge> : '尚未运行'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">最近生成</dt><dd className="mt-1">{last?.status === 'success' ? `${last.articleCount} 篇` : '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">下次运行 · 北京时间</dt><dd className="mt-1">{state.settings.enabled ? dailyNewsTime(state.nextRun) : '已停用自动运行'}</dd></div>
          </dl>
          {dirty && <p className="mt-3 text-xs text-muted-foreground">请先保存设置，再立即运行。</p>}
          {last?.status === 'failed' && <p className="mt-3 text-sm text-destructive" role="alert">{dailyNewsJobError(last)} 最近成功发布的新闻仍保留。</p>}
          {state.running && <p className="mt-3 text-xs text-muted-foreground" role="status">任务正在后台运行，状态会自动更新。</p>}
        </div>

        <details className="mt-5 border-t border-border pt-4"><summary className="cursor-pointer text-sm font-medium">最近任务记录{state.history.length ? ` · ${Math.min(state.history.length, 10)}` : ''}</summary>{state.history.length ? <ol className="mt-3 divide-y divide-border">{state.history.slice(0, 10).map(job => <li key={job._id} className="py-3 text-xs"><div className="flex flex-wrap items-center gap-x-3 gap-y-2"><span>{job.automationDate || job.date || '—'}</span><Badge tone={jobTone(job)}>{DAILY_NEWS_PHASES[job.status] || job.status}</Badge><span>{job.articleCount || 0} 篇 · {job.searchPerformed ? `联网检索 ${job.searchResultCount || 0} 条` : '尚未完成联网检索'} · 使用 {job.sourcesUsed || 0} 个来源</span></div><p className="mt-1 text-muted-foreground">开始：{dailyNewsTime(job.startedAt)}{job.finishedAt && ` · 完成：${dailyNewsTime(job.finishedAt)}`}</p>{job.status === 'failed' && <p className="mt-2 text-destructive">{dailyNewsJobError(job)}{job.errorCode && <span className="ml-2 font-mono">{job.errorCode}</span>}</p>}</li>)}</ol> : <p className="mt-3 text-xs text-muted-foreground">暂无任务记录。</p>}</details>
      </>}
    </Panel>
    <Modal open={confirm} onClose={() => { if (!starting) setConfirm(false); }} title={state && todayHasDailyNews(state) ? '重新生成今天的每日新闻？' : '立即运行每日新闻？'} description={state && todayHasDailyNews(state) ? '今天已经成功生成过每日新闻。新的整批新闻通过核验后，才会替换现有 AI 每日新闻。' : '将真实联网检索，并使用系统 AI Assistant 生成新闻。全部通过核验后才会发布。'} width="max-w-lg" footer={<><AdminButton variant="secondary" disabled={starting} onClick={() => setConfirm(false)}>取消</AdminButton><AdminButton loading={starting} disabled={Boolean(state?.running)} onClick={() => void run()}>确认运行</AdminButton></>}>
      <p className="text-sm text-muted-foreground">使用已保存的设置，本次计划生成 {state?.settings.articleCount || 2} 篇。人工新闻保留。</p>{error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
    </Modal>
  </div>;
}
