import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ImagePlus, RotateCcw, Send, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { AdminButton, Field, Modal, PageHeader, Panel, TextArea, TextInput } from './components';
import KeySettings from './ai/KeySettings';
import DailyNewsSettings from './ai/DailyNewsSettings';
import PublishEditor from './ai/PublishEditor';
import Answer from './ai/Answer';
import StreamingPreview from './ai/StreamingPreview';
import { aiErrorMessage, generateAi, getAiStatus } from './ai/api';
import { draftText, publicationErrors, publishDraft, toPublishDraft } from './ai/publication';
import { PUBLICATION_LABELS, type AiGeneration, type AiScenario, type AiStatus, type HistoryMessage, type InputImage, type PublishDraft, type PublishedRecord, type PublishType, type Scenario } from './ai/types';
import './ai/ai.css';

const FALLBACK_SCENARIOS: AiScenario[] = [
  { key: 'activity', label: '活动文案', description: '整理活动介绍与报名信息', publishType: 'activity' },
  { key: 'announcement', label: '公告草稿', description: '生成正式班级公告', publishType: 'announcement' },
  { key: 'news', label: '新闻稿', description: '根据事实与照片撰写新闻', publishType: 'news' },
  { key: 'news_summary', label: '新闻摘要', description: '提炼摘要与要点' },
  { key: 'resource', label: '资源介绍', description: '整理资源说明与真实链接', publishType: 'resource' },
  { key: 'notice', label: '通知文案', description: '写一则简短通知' },
  { key: 'activity_summary', label: '活动总结', description: '总结活动过程与收获' },
  { key: 'polish', label: '内容润色', description: '保留事实，改善表达' },
  { key: 'expand', label: '内容扩写', description: '根据材料扩展说明' },
  { key: 'shorten', label: '内容精简', description: '保留重点，缩短篇幅' },
  { key: 'free', label: '自由提问', description: '直接提问或讨论问题' },
  { key: 'vision', label: '图片理解', description: '识别海报、照片或截图' },
];
const PUBLISH_PRIORITY: Record<PublishType, number> = { resource: 0, announcement: 1, news: 2, activity: 3 };
const GLOW_SCENARIOS = new Set<Scenario>(['resource', 'announcement', 'news', 'activity']);
const scenarioPriority = (item: AiScenario) => item.publishType ? PUBLISH_PRIORITY[item.publishType] ?? 4 : 5;
const capHistory = (messages: HistoryMessage[]): HistoryMessage[] => {
  const recent = messages.slice(-10).map(m => ({ ...m, content: m.content.slice(0, 16000) }));
  while (recent.reduce((n, m) => n + m.content.length, 0) > 32000) recent.splice(0, 2);
  return recent;
};

export default function AdminAi() {
  const [status, setStatus] = useState<AiStatus | null>(null), [statusError, setStatusError] = useState(''), [tested, setTested] = useState(false);
  const [scenario, setScenario] = useState<Scenario>('activity'), [prompt, setPrompt] = useState(''), [followup, setFollowup] = useState('');
  const [images, setImages] = useState<InputImage[]>([]), [history, setHistory] = useState<HistoryMessage[]>([]);
  const [result, setResult] = useState<AiGeneration | null>(null), [draft, setDraft] = useState<PublishDraft | null>(null), [live, setLive] = useState('');
  const [running, setRunning] = useState(false), [error, setError] = useState(''), [publishError, setPublishError] = useState('');
  const [version, setVersion] = useState(0), [published, setPublished] = useState<(PublishedRecord & { version: number }) | null>(null);
  const [confirm, setConfirm] = useState<{ draft: PublishDraft; version: number } | null>(null), [publishing, setPublishing] = useState(false);
  const [lastRequest, setLastRequest] = useState<{ prompt: string; history: HistoryMessage[] } | null>(null);
  const requestRef = useRef<AbortController | null>(null), requestBusy = useRef(false), publishBusy = useRef(false), alive = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null), previewUrls = useRef(new Map<string, string>());
  // Order both server-provided and fallback scenes without mutating either list.
  const scenarios = useMemo(() => [...(status?.scenarios || FALLBACK_SCENARIOS)]
    .sort((a, b) => scenarioPriority(a) - scenarioPriority(b)), [status?.scenarios]);
  const active = scenarios.find(s => s.key === scenario);
  const unavailable = !status?.configured;
  const limit = status?.limits.prompt || 8000;
  const errors = draft ? publicationErrors(draft) : {};
  const currentPublished = published?.version === version ? published : null;

  useEffect(() => {
    alive.current = true;
    getAiStatus().then(v => { if (alive.current) setStatus(v); }).catch(e => { if (alive.current) setStatusError(aiErrorMessage(e)); });
    const urls = previewUrls.current;
    return () => { alive.current = false; requestRef.current?.abort(); urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  const clearResults = () => { setResult(null); setDraft(null); setLive(''); setHistory([]); setLastRequest(null); setPublished(null); setConfirm(null); setFollowup(''); setError(''); setPublishError(''); setVersion(v => v + 1); };
  const newConversation = () => {
    if (running || publishing) return;
    clearResults(); setPrompt(''); setImages([]);
    previewUrls.current.forEach(url => URL.revokeObjectURL(url)); previewUrls.current.clear();
  };
  const addImages = (files: FileList | null) => {
    if (!files) return;
    setError('');
    if (images.length + files.length > 4) { setError('最多上传 4 张图片。'); return; }
    const added: InputImage[] = [];
    for (const file of Array.from(files)) {
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) { setError('图片仅支持 JPEG、PNG、GIF 和 WebP。'); return; }
      if (file.size > 2 * 1024 * 1024) { setError('单张图片不能超过 2 MiB。'); return; }
    }
    for (const file of Array.from(files)) {
      const id = `${Date.now()}-${Math.random()}`, preview = URL.createObjectURL(file);
      previewUrls.current.set(id, preview); added.push({ id, file, preview });
    }
    setImages(current => [...current, ...added]);
  };
  const removeImage = (id: string) => {
    const url = previewUrls.current.get(id); if (url) URL.revokeObjectURL(url);
    previewUrls.current.delete(id); setImages(current => current.filter(image => image.id !== id));
  };
  const run = async (text = prompt, context = history) => {
    if (requestBusy.current || publishBusy.current || unavailable) return;
    const input = text.trim() || (images.length ? '请根据这些图片完成当前场景的内容，无法确认的信息留空。' : '');
    if (!input) { setError('请输入内容或上传图片。'); return; }
    if (input.length > limit) { setError(`输入过长，上限 ${limit} 字。`); return; }
    const baseHistory = capHistory(context);
    const controller = new AbortController(); requestRef.current = controller; requestBusy.current = true;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 250000);
    setRunning(true); setError(''); setPublishError(''); setLive(''); setConfirm(null);
    setLastRequest({ prompt: input, history: baseHistory });
    try {
      const generated = await generateAi({ scenario, prompt: input, history: baseHistory, images: images.map(image => image.file) }, controller.signal, text => { if (alive.current) setLive(value => value + text); });
      if (!alive.current) return;
      setResult(generated); setDraft(toPublishDraft(generated)); setPublished(null); setVersion(v => v + 1);
      setHistory(capHistory([...baseHistory, { role: 'user', content: input }, { role: 'assistant', content: generated.answer }]));
      setFollowup(''); setLive('');
    } catch (e) {
      if (!alive.current) return;
      setLive('');
      setError(controller.signal.aborted ? timedOut ? 'AI 请求超时，请稍后重试。' : '已停止生成，保留上一版结果。' : aiErrorMessage(e));
    } finally {
      clearTimeout(timer); requestBusy.current = false; requestRef.current = null;
      if (alive.current) setRunning(false);
    }
  };
  const revise = () => {
    if (!followup.trim()) return;
    const context = history.map((m, i) => i === history.length - 1 && draft ? { ...m, content: `管理员检查并修改后的当前内容：\n${JSON.stringify(draft.values)}` } : m);
    void run(followup, context);
  };
  const changeDraft = (value: PublishDraft) => { setDraft(value); setVersion(v => v + 1); setPublished(null); setPublishError(''); setConfirm(null); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(draft ? draftText(draft) : result?.answer || ''); toast.success('内容已复制。'); }
    catch { setError('复制失败，请手动选择文本。'); }
  };
  const askPublish = () => {
    if (!draft || running || publishing || currentPublished) return;
    if (Object.keys(errors).length) { setPublishError('发布字段不完整，请补充预览中标出的内容。'); return; }
    setPublishError(''); setConfirm({ draft: structuredClone(draft), version });
  };
  const publish = async () => {
    if (!confirm || publishBusy.current || confirm.version !== version) return;
    publishBusy.current = true; setPublishing(true); setPublishError('');
    try {
      const record = await publishDraft(confirm.draft);
      if (!alive.current) return;
      setPublished({ ...record, version: confirm.version }); setConfirm(null);
      toast.success(`${PUBLICATION_LABELS[record.kind]}发布成功。`);
    } catch (e) { if (alive.current) setPublishError(`发布未成功：${aiErrorMessage(e)}`); }
    finally { publishBusy.current = false; if (alive.current) setPublishing(false); }
  };

  return <>
    <Toaster />
    <PageHeader title="AI 助手" subtitle="使用 DeepSeek 生成班级内容、分析图片，并快速发布到 ClassHub。" actions={<AdminButton variant="secondary" disabled={running || publishing} onClick={newConversation}>新对话</AdminButton>} />
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><span className="font-semibold">DeepSeek V4.1 Flash</span><code className="text-xs text-muted-foreground">deepseek-flash</code><span className="text-xs text-muted-foreground" role="status">{status ? status.configured ? tested ? '● 服务可用' : '● 已配置 · 待测试' : '○ 未配置 API Key' : '正在检查配置…'}</span></div>
    {statusError && <div className="mb-4 flex flex-wrap items-center gap-3" role="alert"><p className="text-sm text-destructive">{statusError}</p><AdminButton variant="secondary" onClick={() => { setStatusError(''); void getAiStatus().then(setStatus).catch(e => setStatusError(aiErrorMessage(e))); }}>重新检查</AdminButton></div>}
    <KeySettings settings={status} disabled={running || publishing} onChange={settings => setStatus(current => current ? { ...current, ...settings } : null)} onTested={setTested} />
    <DailyNewsSettings />
    <div className="ai-workspace">
      <Panel title="AI 输入工作区" description={active?.description}>
        <fieldset disabled={running || publishing} className="min-w-0 space-y-5">
          <div><p className="mb-2 text-xs font-medium">选择场景</p><div className="ai-scenarios" role="group" aria-label="AI 场景">{scenarios.map(item => <button key={item.key} type="button" className={GLOW_SCENARIOS.has(item.key) ? 'ai-scenario-publish' : undefined} aria-pressed={scenario === item.key} onClick={() => { if (scenario !== item.key) { setScenario(item.key); clearResults(); } }}>{GLOW_SCENARIOS.has(item.key) && <span className="ai-scenario-edge" aria-hidden="true" />}<span className="ai-scenario-label">{item.label}</span></button>)}</div></div>
          <Field label="输入内容" hint="写明真实的时间、地点、来源和链接；未提供的信息会留空。"><TextArea value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={limit} rows={8} placeholder={scenario === 'activity' ? '主题：班级技术分享会\n时间：请填写明确的开始与结束时间\n地点：请填写实际地点\n要点：实习经历分享、现场答疑' : '输入问题、已知事实或需要处理的内容…'} /><span className="mt-1 block text-right text-xs text-muted-foreground">{prompt.length} / {limit} 字</span></Field>
          <div><p className="mb-2 text-xs font-medium">图片（可选）</p><input ref={fileInput} className="sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={e => { addImages(e.target.files); e.target.value = ''; }} /><AdminButton type="button" variant="secondary" disabled={images.length >= 4} onClick={() => fileInput.current?.click()}><ImagePlus className="h-4 w-4" />上传图片</AdminButton><p className="mt-2 text-xs text-muted-foreground">JPEG / PNG / GIF / WebP · 最多 4 张 · 每张 2 MiB。图片仅用于本次对话，不保存为封面。</p></div>
          {images.length > 0 && <div className="ai-images">{images.map(image => <figure key={image.id}><img src={image.preview} alt={image.file.name} /><figcaption>{image.file.name}</figcaption><AdminButton type="button" variant="danger-outline" aria-label={`移除图片 ${image.file.name}`} onClick={() => removeImage(image.id)}><X className="h-3.5 w-3.5" />移除</AdminButton></figure>)}</div>}
        </fieldset>
        {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-2"><AdminButton loading={running} disabled={unavailable || publishing || (!prompt.trim() && !images.length)} onClick={() => void run()}><Send className="h-4 w-4" />{running ? '正在生成' : '生成'}</AdminButton>{running && <AdminButton variant="secondary" onClick={() => requestRef.current?.abort()}>停止生成</AdminButton>}</div>
        <p className="mt-4 text-xs text-muted-foreground">对话保留在当前页面中，刷新或“新对话”会清空。</p>
      </Panel>
      <Panel title={running ? active?.publishType ? '发布预览' : 'AI 回答' : draft ? '发布预览' : 'AI 回答'} description={running ? '正在接收 DeepSeek 内容…' : result ? `耗时 ${(result.elapsedMs / 1000).toFixed(1)} 秒 · 可继续修改` : '生成后在这里检查结果'} actions={result && !running ? <><AdminButton variant="secondary" disabled={publishing} onClick={() => void copy()}><Copy className="h-4 w-4" />复制全文</AdminButton><AdminButton variant="secondary" disabled={unavailable || publishing} onClick={() => void run(lastRequest?.prompt || prompt, lastRequest?.history || [])}><RotateCcw className="h-4 w-4" />重新生成</AdminButton></> : undefined}>
        {running ? <div aria-live="polite" aria-busy="true" className="max-h-[600px] overflow-auto"><p className="mb-4 text-xs text-muted-foreground">{active?.publishType ? '内容正在逐步生成，完成后可检查、修改并确认发布。' : '回答正在逐步显示。'}</p>{live ? active?.publishType ? <StreamingPreview scenario={scenario} text={live} /> : <Answer text={live} /> : <p className="py-8 text-sm text-muted-foreground">正在生成…</p>}</div> : result ? <>
          {result.warning && <p className="mb-4 border-l-2 border-destructive pl-3 text-sm text-destructive" role="alert">{result.warning}</p>}
          {draft ? <>
            <p className="mb-5 text-xs text-muted-foreground">检查并修改以下字段，确认后发布到{PUBLICATION_LABELS[draft.kind]}。缺失的事实需要手动补充。</p>
            <PublishEditor draft={draft} errors={errors} disabled={publishing} onChange={changeDraft} />
            <div className="mt-5 border-t border-border pt-4">
              {currentPublished ? <div role="status"><p className="mb-3 flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4" />已发布到{PUBLICATION_LABELS[currentPublished.kind]}</p><div className="flex flex-wrap gap-4 text-sm"><Link className="text-primary underline" to={currentPublished.viewUrl}>查看{PUBLICATION_LABELS[currentPublished.kind]}</Link><Link className="text-primary underline" to={currentPublished.manageUrl}>进入栏目管理</Link></div><p className="mt-3 text-xs text-muted-foreground">修改预览或重新生成后，可以发布新的内容版本。</p></div> : <AdminButton loading={publishing} onClick={askPublish}>一键发布到{PUBLICATION_LABELS[draft.kind]}</AdminButton>}
              {publishError && <p className="mt-3 text-sm text-destructive" role="alert">{publishError}</p>}
            </div>
          </> : <Answer text={result.answer} />}
          <div className="mt-6 space-y-3 border-t border-border pt-4"><Field label="继续修改" hint="会参考当前结果与管理员的手动修改"><TextInput value={followup} onChange={e => setFollowup(e.target.value)} maxLength={limit} disabled={publishing} placeholder="例如：再正式一点，缩短到 300 字" onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); revise(); } }} /></Field><AdminButton variant="secondary" disabled={unavailable || publishing || !followup.trim()} onClick={revise}>继续修改</AdminButton></div>
        </> : <div className="py-12 text-sm leading-7 text-muted-foreground"><p>选择场景，输入要点或上传图片。</p><p>活动、公告、新闻和资源会生成可编辑预览；其他场景显示 AI 回答。</p><p className="mt-4">发布前需要由管理员检查并确认。</p></div>}
      </Panel>
    </div>
    <Modal open={Boolean(confirm)} onClose={() => { if (!publishing) setConfirm(null); }} title={confirm ? `发布到${PUBLICATION_LABELS[confirm.draft.kind]}` : '确认发布'} description="确认后将通过 ClassHub 现有发布流程创建一条记录，并对班级成员可见。" width="max-w-lg" footer={<><AdminButton variant="secondary" disabled={publishing} onClick={() => setConfirm(null)}>取消</AdminButton><AdminButton loading={publishing} onClick={() => void publish()}>确认发布</AdminButton></>}>
      {confirm && <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">标题</dt><dd className="mt-1 break-words font-medium">{confirm.draft.values.title}</dd></div><div><dt className="text-muted-foreground">栏目</dt><dd className="mt-1">{PUBLICATION_LABELS[confirm.draft.kind]}</dd></div></dl>}{publishError && <p className="mt-4 text-sm text-destructive" role="alert">{publishError}</p>}
    </Modal>
  </>;
}
