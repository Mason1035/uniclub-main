import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, BookOpen, FileText, Globe2, ImagePlus, LoaderCircle, MessageSquareText, RefreshCw, Sparkles, Square, X } from 'lucide-react';
import { useUser } from '../../context/userContextState';
import AiAnswer from '../AiAnswer';
import { askAssistant, assistantError, getAssistantStatus, getAssistantQuota, isAssistantQuotaError, validateAssistantImages, type AssistantMessage, type AssistantQuota, type AssistantStatus } from '../../lib/memberAssistant';
import type { AiStreamStatus } from '../../lib/aiStream';
import AssistantQuotaNotice from './AssistantQuotaNotice';
import AssistantFeedbackPanel from './AssistantFeedbackPanel';

const suggestions = [
  { icon: BookOpen, label: '查找学习资料', prompt: '帮我查找本站的学习资料，并推荐适合入门的资源。' },
  { icon: FileText, label: '总结班级文件', prompt: '帮我找到班级最近的重要公告和资料，总结需要关注的事项。' },
  { icon: Sparkles, label: '帮我写文档', prompt: '我想写一份学习计划，请先询问我的目标和可用时间。' },
];
let messageSequence = 0;
const messageId = () => `assistant-${Date.now()}-${++messageSequence}`;

export default function AssistantChatPanel({ active }: { active: boolean }) {
  const { user } = useUser();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [quota, setQuota] = useState<AssistantQuota | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const quotaRequest = useRef<AbortController | null>(null);
  const refreshQuota = useCallback(async () => {
    quotaRequest.current?.abort();
    const controller = new AbortController(); quotaRequest.current = controller;
    try { const value = await getAssistantQuota(controller.signal); if (!controller.signal.aborted) { setQuota(value); setQuotaExceeded(value.blocked); } } catch { /* Keep the last verified quota; the server still enforces every request. */ }
  }, []);
  const updateQuota = (value: AssistantQuota) => { setQuota(value); setQuotaExceeded(value.blocked); };
  const onQuotaError = () => { setQuotaExceeded(true); void refreshQuota(); };
  const blocked = quotaExceeded || quota?.blocked === true;
  const [configuration, setConfiguration] = useState<AssistantStatus | null>(null);
  const [configurationError, setConfigurationError] = useState('');
  const [configurationRetry, setConfigurationRetry] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const request = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const lastAttempt = useRef<{ prompt: string; files: File[]; webSearch: boolean; history: AssistantMessage[] } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAssistantStatus(controller.signal).then(value => { if (!controller.signal.aborted) { setConfiguration(value); setConfigurationError(''); if (value.quota) { setQuota(value.quota); setQuotaExceeded(value.quota.blocked); } } }).catch(failure => { if (!controller.signal.aborted) setConfigurationError(assistantError(failure)); });
    return () => controller.abort();
  }, [configurationRetry]);
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file)); setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  useEffect(() => { if (!active) request.current?.abort(); else void refreshQuota(); }, [active, refreshQuota]);
  useEffect(() => () => { request.current?.abort(); quotaRequest.current?.abort(); }, []);
  useEffect(() => {
    if (!active || !quota?.resetAt) return;
    const delay = new Date(quota.resetAt).getTime() - Date.now();
    if (!Number.isFinite(delay)) return;
    const timer = window.setTimeout(() => void refreshQuota(), Math.min(24 * 60 * 60 * 1000, Math.max(1000, delay + 100)));
    return () => window.clearTimeout(timer);
  }, [active, quota?.resetAt, refreshQuota]);
  useEffect(() => { if (messages.length) end.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' as ScrollBehavior }); }, [messages, status]);

  const send = async (retry = false) => {
    if (busyRef.current || !configuration?.configured || blocked) return;
    const attempt = retry ? lastAttempt.current : { prompt: prompt.trim(), files: [...files], webSearch, history: messages };
    if (!attempt || !attempt.prompt) return;
    const validation = validateAssistantImages(attempt.files); if (validation) { setError(validation); return; }
    const controller = new AbortController(); request.current = controller; busyRef.current = true;
    const userMessage: AssistantMessage = { id: messageId(), role: 'user', content: attempt.prompt, imageCount: attempt.files.length };
    const answerId = messageId();
    lastAttempt.current = attempt; setError(''); setStatus('正在查找本站内容…'); setBusy(true);
    setMessages([...attempt.history, userMessage, { id: answerId, role: 'assistant', content: '' }]);
    const onStatus = (value: AiStreamStatus) => { if (!controller.signal.aborted) setStatus(value.message); };
    try {
      const result = await askAssistant(attempt.prompt, attempt.history, attempt.files, attempt.webSearch, controller.signal, text => {
        if (!controller.signal.aborted) setMessages(value => value.map(item => item.id === answerId ? { ...item, content: item.content + text } : item));
      }, onStatus);
      if (controller.signal.aborted) return;
      setMessages(value => value.map(item => item.id === answerId ? { ...item, content: result.answer, sources: result.sources, warning: result.warning, usage: result.localAction ? undefined : result.usage } : item));
      if (result.quota) updateQuota(result.quota);
      void refreshQuota();
      setPrompt(''); setFiles([]); lastAttempt.current = null;
    } catch (failure) {
      if (!controller.signal.aborted) { setError(assistantError(failure)); if (isAssistantQuotaError(failure)) onQuotaError(); }
      setMessages(value => value.filter(item => item.id !== answerId));
    } finally {
      busyRef.current = false; setBusy(false); setStatus('');
    }
  };
  const cancel = () => { request.current?.abort(); setStatus(''); setError('回答已停止，可以重新回答或修改问题。'); };
  const selectFiles = (list: FileList | null) => {
    const next = [...files, ...Array.from(list || [])]; const validation = validateAssistantImages(next);
    if (validation) setError(validation); else { setFiles(next); setError(''); }
    if (fileInput.current) fileInput.current.value = '';
  };
  if (feedbackOpen) return <AssistantFeedbackPanel active={active} configured={configuration?.configured === true} quota={quota} blocked={blocked} onBack={() => setFeedbackOpen(false)} onQuota={updateQuota} onQuotaError={onQuotaError} onUsage={() => void refreshQuota()}/>;
  const openFeedback = () => { request.current?.abort(); setFeedbackOpen(true); };
  const name = user.displayName || user.name || '同学';

  return <section className="assistant-chat" aria-label="ClassHub AI 对话">
    <div className="assistant-conversation" role="log" aria-label="对话记录" aria-busy={busy} aria-live="polite" aria-relevant="additions text">
      {!messages.length && <div className="assistant-welcome"><p>你好，{name}</p><h3>班级里的事，<br/>一起找答案。</h3><p className="assistant-muted">查资料、理清安排，或者把一个想法写下来。</p><div className="assistant-suggestions">{suggestions.map(({ icon: Icon, label, prompt: question }) => <button type="button" key={label} onClick={() => { setPrompt(question); editor.current?.focus(); }}><Icon aria-hidden="true"/><span>{label}</span><ArrowUpRight aria-hidden="true"/></button>)}<button type="button" className="assistant-suggestion--feedback" onClick={openFeedback}><MessageSquareText aria-hidden="true"/><span>向开发者提供反馈 / 意见</span><ArrowUpRight aria-hidden="true"/></button></div></div>}
      {messages.map(message => <article className={`assistant-message assistant-message--${message.role}`} key={message.id} aria-label={message.role === 'user' ? '我的问题' : 'AI 回答'}><div className="assistant-message__author">{message.role === 'user' ? name : <><Sparkles aria-hidden="true"/>ClassHub AI</>}</div>{message.imageCount ? <small className="assistant-message__attachments"><ImagePlus aria-hidden="true"/>{message.imageCount} 张照片</small> : null}{message.content ? message.role === 'assistant' ? <AiAnswer text={message.content} allowedLinks={message.sources?.filter(source => source.type === 'web').map(source => source.url) || []}/> : <p className="assistant-message__question">{message.content}</p> : <p className="assistant-muted"><LoaderCircle aria-hidden="true" className="assistant-spin"/>{status || '正在准备回答…'}</p>}{!!message.sources?.length && <div className="assistant-sources" aria-label="回答参考来源">{message.sources.map(source => <a key={source.id} href={source.url} {...(source.type === 'web' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}><span>{source.type === 'site' ? '本站' : '网页'}</span>{source.title}<ArrowUpRight aria-hidden="true"/></a>)}</div>}{message.warning && <p className="assistant-feedback">{message.warning}</p>}{message.usage && <small className="assistant-message__usage">{message.usage.reported ? `本次 ${message.usage.totalTokens.toLocaleString()} tokens` : '本次用量暂未由服务商返回'}</small>}</article>)}
      <div ref={end}/>
    </div>
    <div className="assistant-compose-area">
      {configurationError && <div className="assistant-feedback" role="alert">{configurationError}<button type="button" onClick={() => { setConfigurationError(''); setConfigurationRetry(value => value + 1); }}>重试连接</button></div>}
      {configuration && !configuration.configured && <p className="assistant-feedback" role="status">AI 还在准备中，请联系管理员配置服务。你可以先使用「站内搜索」。</p>}
      {error && <div className="assistant-feedback" role="alert">{error}{lastAttempt.current && <button type="button" disabled={busy || blocked} onClick={() => void send(true)}><RefreshCw aria-hidden="true"/>重新回答</button>}</div>}
      <div className="assistant-quota-row"><AssistantQuotaNotice quota={quota}/>{messages.length > 0 && <button type="button" className="assistant-action" onClick={openFeedback}>反馈 / 意见</button>}</div>
      <form className="assistant-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
        {!!files.length && <ul className="assistant-photos" aria-label="待发送的照片">{files.map((file, index) => <li key={`${file.name}-${index}`}><img src={previews[index]} alt={file.name}/><button type="button" disabled={busy} aria-label={`移除照片 ${file.name}`} onClick={() => setFiles(value => value.filter((_, i) => i !== index))}><X aria-hidden="true"/></button></li>)}</ul>}
        <textarea ref={editor} aria-label="向 ClassHub AI 提问" value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { event.preventDefault(); void send(); } }} maxLength={configuration?.limits.prompt || 4000} rows={2} placeholder="试试问我任何问题…" disabled={busy}/>
        <div className="assistant-composer__toolbar"><div><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple className="sr-only" aria-label="上传照片" onChange={event => selectFiles(event.target.files)} tabIndex={-1}/><button type="button" className="assistant-attach" aria-label="上传照片，每张不超过 2 MB，最多 4 张" title="上传照片 · 最多 4 张，每张 2 MB" disabled={busy || files.length >= 4 || !configuration?.configured || blocked} onClick={() => fileInput.current?.click()}><ImagePlus aria-hidden="true"/></button><button type="button" className="assistant-web" aria-pressed={webSearch} disabled={busy || blocked} onClick={() => setWebSearch(value => !value)} title="按需检索公开网页，结果会附上来源"><Globe2 aria-hidden="true"/>联网检索</button></div>{busy ? <button type="button" className="assistant-send" aria-label="停止回答" onClick={cancel}><Square aria-hidden="true"/></button> : <button className="assistant-send" type="submit" aria-label="发送问题" disabled={!prompt.trim() || !configuration?.configured || blocked}><ArrowUp aria-hidden="true"/></button>}</div>
      </form>
    </div>
  </section>;
}
