import { useEffect, useRef, useState } from 'react';
import { askNews, getNewsChat, newsChatError, NEWS_QUESTION_LIMIT, type NewsChatMessage } from '../../lib/newsChat';
import AiAnswer from '../AiAnswer';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';

type ChatState = 'idle' | 'loading' | 'streaming' | 'success' | 'error';
export default function ChatWindow({ open, onClose, articleId, articleTitle }: { open: boolean; onClose: () => void; articleId: string; articleTitle: string }) {
  const [messages, setMessages] = useState<NewsChatMessage[]>([]), [input, setInput] = useState('');
  const [state, setState] = useState<ChatState>('idle'), [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState(''), [historyError, setHistoryError] = useState(false), [retry, setRetry] = useState(0);
  const [submitted, setSubmitted] = useState(''), [live, setLive] = useState(''), [progress, setProgress] = useState('AI 正在思考…');
  const lock = useRef(false), alive = useRef(true), request = useRef<AbortController | null>(null), list = useRef<HTMLDivElement>(null);
  const pending = state === 'loading' || state === 'streaming';

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; request.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoadingHistory(true);
    getNewsChat(articleId, controller.signal).then(history => {
      if (controller.signal.aborted) return;
      setMessages(history); setError(''); setHistoryError(false);
    }).catch(cause => {
      if (!controller.signal.aborted) { setError(newsChatError(cause)); setHistoryError(true); }
    }).finally(() => { if (!controller.signal.aborted) setLoadingHistory(false); });
    return () => controller.abort();
  }, [articleId, retry]);
  useEffect(() => { if (open && list.current) list.current.scrollTop = list.current.scrollHeight; }, [messages, submitted, live, progress, open]);

  const send = async () => {
    const question = input.trim();
    if (lock.current || loadingHistory || !question) return;
    if (question.length > NEWS_QUESTION_LIMIT) { setError(`问题最多 ${NEWS_QUESTION_LIMIT} 字，请缩短后再发送。`); return; }
    lock.current = true;
    const controller = new AbortController(); request.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 250000);
    setState('loading'); setError(''); setHistoryError(false); setSubmitted(question); setInput(''); setLive(''); setProgress('AI 正在思考…');
    try {
      const result = await askNews(articleId, question, controller.signal, text => {
        if (alive.current) { setState('streaming'); setLive(value => value + text); }
      }, status => { if (alive.current) setProgress(status.message); });
      if (!alive.current) return;
      setMessages(result.messages); setState('success'); setSubmitted(''); setLive('');
    } catch (cause) {
      if (!alive.current) return;
      setState('error'); setInput(question); setSubmitted(''); setLive('');
      setError(controller.signal.aborted ? timedOut ? 'AI 请求超时，你的问题已保留，请稍后重试。' : '回答已停止，你的问题已保留。' : `${newsChatError(cause)} 你的问题已保留。`);
    } finally {
      clearTimeout(timer); lock.current = false;
      if (request.current === controller) request.current = null;
    }
  };

  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent>
    <DialogTitle>新闻问答</DialogTitle><DialogDescription>{articleTitle}</DialogDescription>
    <div ref={list} className="overflow-y-auto max-h-[45dvh] min-h-32 space-y-4 py-5" role="log" aria-label="新闻问答对话" aria-live="polite" aria-busy={pending || loadingHistory}>
      {loadingHistory && <p role="status">正在加载对话…</p>}
      {!loadingHistory && !messages.length && !submitted && <p className="text-sm text-muted-foreground">可以围绕这篇新闻提问。</p>}
      {messages.map((message, index) => <div key={`${message.timestamp || index}-${message.role}`} className="border-b border-border pb-4">
        <p className="entry-meta mb-2">{message.role === 'user' ? '你' : 'ClassHub AI'}</p>
        {message.role === 'assistant' ? <AiAnswer text={message.content} allowedLinks={message.sources?.map(source => source.url) || []} compact/> : <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>}
        {message.role === 'assistant' && message.warning && <p className="mt-3 text-xs text-muted-foreground">{message.warning}</p>}
        {message.role === 'assistant' && !!message.sources?.length && <div className="mt-4 text-sm"><p className="entry-meta mb-2">参考来源</p><ol className="list-decimal pl-5 space-y-1">{message.sources.map((source, sourceIndex) => <li key={`${source.url}-${sourceIndex}`}><a href={source.url} className="text-link break-words" target="_blank" rel="noopener noreferrer">{source.title || source.url}</a></li>)}</ol></div>}
      </div>)}
      {submitted && <div className="border-b border-border pb-4"><p className="entry-meta mb-2">你</p><p className="text-sm whitespace-pre-wrap break-words">{submitted}</p></div>}
      {pending && <div className="border-b border-border pb-4"><p className="entry-meta mb-2">ClassHub AI</p>{live ? <AiAnswer text={live} allowedLinks={[]} compact/> : <p className="text-sm" role="status" aria-live="polite">{progress}</p>}</div>}
    </div>
    {error && <div role="alert"><p className="form-error">{error}</p>{!pending && historyError && <button className="text-link text-sm min-h-11" onClick={() => setRetry(value => value + 1)}>重新加载对话</button>}</div>}
    <form onSubmit={event => { event.preventDefault(); void send(); }}>
      <div className="form-field"><label htmlFor="article-question">{messages.length ? '继续提问' : '你的问题'}</label>
        <textarea id="article-question" rows={2} value={input} maxLength={NEWS_QUESTION_LIMIT} onChange={event => setInput(event.target.value)} disabled={pending || loadingHistory} placeholder={messages.length ? '继续问这篇新闻…' : '关于这篇新闻，我想了解…'} onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
        }}/>
        <span className="block text-right text-xs text-muted-foreground">{input.length} / {NEWS_QUESTION_LIMIT} 字 · Enter 发送，Shift + Enter 换行</span>
      </div>
      <div className="flex flex-wrap gap-3 items-center"><button className="ed-button" type="submit" disabled={pending || loadingHistory || !input.trim()}>{pending ? '正在回答…' : messages.length ? '发送' : '发送问题'}</button>{pending && <button className="text-link text-sm min-h-11" type="button" onClick={() => request.current?.abort()}>停止回答</button>}</div>
    </form>
  </DialogContent></Dialog>;
}
