import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, LoaderCircle, MessageSquareText, PencilLine, Square } from 'lucide-react';
import AiAnswer from '../AiAnswer';
import { askAssistantFeedback, assistantError, isAssistantQuotaError, submitAssistantFeedback, type AssistantMessage, type AssistantQuota, type FeedbackDraft, type FeedbackReceipt } from '../../lib/memberAssistant';
import AssistantQuotaNotice from './AssistantQuotaNotice';
import FeedbackDraftForm from './FeedbackDraftForm';

const emptyDraft = (): FeedbackDraft => ({ title: '', description: '', expected: '', page: window.location.pathname.slice(0, 300) });
const requestId = () => {
  const bytes = window.crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export default function AssistantFeedbackPanel({ active, configured, quota, blocked, onBack, onQuota, onQuotaError, onUsage }: {
  active: boolean; configured: boolean; quota: AssistantQuota | null; blocked: boolean; onBack: () => void; onQuota: (quota: AssistantQuota) => void; onQuotaError: () => void; onUsage: () => void;
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<FeedbackDraft>(emptyDraft);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<FeedbackReceipt | null>(null);
  const modelRequest = useRef<AbortController | null>(null);
  const submission = useRef<AbortController | null>(null);
  const modelBusy = useRef(false);
  const submitBusy = useRef(false);
  const submissionId = useRef<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const canAsk = configured && !blocked && !busy && !submitting && !receipt;
  useEffect(() => {
    if (!active) { modelRequest.current?.abort(); submission.current?.abort(); }
    return () => { modelRequest.current?.abort(); submission.current?.abort(); };
  }, [active]);
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [messages, reviewing, receipt]);
  const changeDraft = (value: FeedbackDraft) => { submissionId.current = null; setDraft(value); setReviewing(true); setError(''); };
  const send = async () => {
    if (!canAsk || modelBusy.current || !prompt.trim()) return;
    const question = prompt.trim(); const history = [...messages]; const id = requestId();
    const controller = new AbortController(); modelRequest.current = controller; modelBusy.current = true;
    setBusy(true); setError(''); setStatus('正在梳理你的反馈…');
    setMessages([...history, { id: `${id}-user`, role: 'user', content: question }, { id, role: 'assistant', content: '' }]);
    try {
      const result = await askAssistantFeedback(question, history, draft.page, controller.signal, delta => {
        if (!controller.signal.aborted) setMessages(value => value.map(message => message.id === id ? { ...message, content: message.content + delta } : message));
      }, value => { if (!controller.signal.aborted) setStatus(value.message); });
      if (controller.signal.aborted) return;
      setMessages(value => value.map(message => message.id === id ? { ...message, content: result.answer, usage: result.usage } : message));
      if (result.draft) { submissionId.current = null; setDraft(result.draft); setReviewing(true); }
      if (result.quota) onQuota(result.quota);
      onUsage(); setPrompt('');
    } catch (failure) {
      if (!controller.signal.aborted) { setError(assistantError(failure)); if (isAssistantQuotaError(failure)) onQuotaError(); }
      setMessages(value => value.filter(message => message.id !== id));
    } finally { modelBusy.current = false; setBusy(false); setStatus(''); }
  };
  const submit = async () => {
    if (submitBusy.current || busy || receipt || !draft.title.trim() || !draft.description.trim()) return;
    submissionId.current ||= requestId(); const controller = new AbortController(); submission.current = controller; submitBusy.current = true;
    setSubmitting(true); setError('');
    try {
      const value = await submitAssistantFeedback({ title: draft.title.trim(), description: draft.description.trim(), expected: draft.expected.trim(), page: draft.page.trim() }, submissionId.current, controller.signal);
      if (!controller.signal.aborted) setReceipt(value);
    } catch (failure) { if (!controller.signal.aborted) setError(assistantError(failure)); }
    finally { submitBusy.current = false; setSubmitting(false); }
  };
  return <section className="assistant-feedback-panel" aria-label="向开发者提供反馈或意见">
    <div className="assistant-feedback-panel__heading"><button type="button" className="assistant-action" onClick={onBack}><ArrowLeft aria-hidden="true"/>返回对话</button><span><MessageSquareText aria-hidden="true"/>反馈 / 意见</span></div>
    <div className="assistant-feedback-panel__body">
      <div className="assistant-feedback-intro"><h3>把你的想法告诉我们。</h3><p>哪个页面遇到了问题？发生了什么，你希望它怎样改进？我可以先帮你整理，确认后再提交给管理员。</p></div>
      <div role="log" aria-live="polite" aria-busy={busy} aria-label="反馈沟通记录">{messages.map(message => <article key={message.id} className={`assistant-message assistant-message--${message.role}`} aria-label={message.role === 'user' ? '我的反馈' : 'AI 反馈助手'}><div className="assistant-message__author">{message.role === 'user' ? '我' : 'ClassHub 反馈助手'}</div>{message.content ? message.role === 'assistant' ? <AiAnswer text={message.content} allowedLinks={[]}/> : <p className="assistant-message__question">{message.content}</p> : <p className="assistant-muted"><LoaderCircle className="assistant-spin" aria-hidden="true"/>{status}</p>}</article>)}</div>
      {(!configured || blocked) && <p className="assistant-feedback" role="status">{blocked ? 'AI 额度暂不可用。' : 'AI 暂不可用。'}你可以直接填写反馈，确认提交不消耗 AI 额度。</p>}
      {error && <div className="assistant-feedback" role="alert">{error}<span>可修改后重试，或直接填写摘要。</span></div>}
      {(reviewing || !configured || blocked || receipt) ? <FeedbackDraftForm draft={draft} onChange={changeDraft} onSubmit={() => void submit()} busy={submitting || busy} receipt={receipt} onNew={() => { setReceipt(null); setMessages([]); setDraft(emptyDraft()); submissionId.current = null; setReviewing(true); setError(''); }}/>
        : <button type="button" className="assistant-action assistant-feedback-manual" onClick={() => setReviewing(true)}><PencilLine aria-hidden="true"/>直接填写反馈摘要</button>}
      <div ref={end}/>
    </div>
    {!receipt && <div className="assistant-compose-area"><AssistantQuotaNotice quota={quota}/><form className="assistant-composer" onSubmit={event => { event.preventDefault(); void send(); }}><textarea aria-label="向反馈助手描述问题" value={prompt} onChange={event => setPrompt(event.target.value)} rows={2} maxLength={4000} disabled={!canAsk} placeholder="例如：手机上下载资源时，我找不到下载按钮…"/><div className="assistant-composer__toolbar"><span className="assistant-footnote">先沟通，再确认摘要；不会自动提交。</span>{busy ? <button type="button" className="assistant-send" aria-label="停止整理反馈" onClick={() => { modelRequest.current?.abort(); setError('已停止整理，你可以继续沟通或直接填写反馈。'); }}><Square aria-hidden="true"/></button> : <button type="submit" className="assistant-send" aria-label="发送给反馈助手" disabled={!canAsk || !prompt.trim()}><ArrowUp aria-hidden="true"/></button>}</div></form></div>}
  </section>;
}
