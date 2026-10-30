import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { assistantError, exportMemory, getAssistantMemory, removeMemory, saveMemory, setMemoryEnabled, type AssistantMemory } from '../../lib/memberAssistant';

export default function AssistantMemoryPanel() {
  const [memory, setMemory] = useState<AssistantMemory | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const downloadUrls = useRef<string[]>([]);
  const run = useCallback(async (operation: (signal: AbortSignal) => Promise<void>) => {
    if (inFlight.current && !request.current?.signal.aborted) return;
    inFlight.current = true;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setNotice('');
    try { await operation(controller.signal); }
    catch (failure) { if (!controller.signal.aborted) setError(assistantError(failure)); }
    finally { if (request.current === controller) { inFlight.current = false; if (!controller.signal.aborted) setBusy(false); } }
  }, []);
  const reload = useCallback((signal: AbortSignal) => getAssistantMemory(signal).then(value => { if (!signal.aborted) setMemory(value); }), []);
  useEffect(() => {
    const urls = downloadUrls.current;
    void run(reload);
    return () => { request.current?.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [run, reload]);

  return <section className="assistant-memory" aria-label="个人长期记忆" aria-busy={busy}>
    <div className="assistant-memory__heading"><div><h3>只记住你想留下的事</h3><p>学习偏好、正在做的项目，或希望 AI 了解的背景。</p></div>
      <button type="button" className="assistant-action" disabled={busy || !memory} onClick={() => void run(async signal => {
        const blob = await exportMemory(signal); if (signal.aborted) return;
        const url = URL.createObjectURL(blob); downloadUrls.current.push(url);
        const link = document.createElement('a'); link.href = url; link.download = 'ClassHub-个人记忆.md'; link.click(); setNotice('记忆文件已导出。');
      })}><Download aria-hidden="true"/>导出</button></div>
    {memory && <label className="assistant-memory__switch"><span><strong>在回答中使用我的记忆</strong><small>仅属于当前账号，可随时关闭。</small></span><input type="checkbox" role="switch" checked={memory.enabled} disabled={busy} onChange={event => {
      const enabled = event.target.checked;
      void run(async signal => { await setMemoryEnabled(enabled, signal); await reload(signal); });
    }}/></label>}
    {error && <div className="assistant-feedback" role="alert">{error}{!memory && <button type="button" onClick={() => void run(reload)}>重试</button>}</div>}
    {notice && <p className="assistant-feedback" role="status">{notice}</p>}
    {!memory && busy && <p className="assistant-muted" role="status"><LoaderCircle className="assistant-spin" aria-hidden="true"/>正在读取个人记忆…</p>}
    {memory && <>
      <ul className="assistant-memory__list">
        {memory.entries.map(entry => <li key={entry.id}><p>{entry.text}</p><div><button type="button" aria-label={`编辑记忆：${entry.text.slice(0, 30)}`} disabled={busy} onClick={() => { setEditing(entry.id); setText(entry.text); editor.current?.focus(); }}><Pencil aria-hidden="true"/></button><button type="button" aria-label={`删除记忆：${entry.text.slice(0, 30)}`} disabled={busy} onClick={() => void run(async signal => { await removeMemory(entry.id, signal); await reload(signal); if (editing === entry.id) { setEditing(null); setText(''); } setNotice('这条记忆已删除。'); })}><Trash2 aria-hidden="true"/></button></div></li>)}
      </ul>
      {!memory.entries.length && <div className="assistant-memory__empty"><span aria-hidden="true">✦</span><p>这里还是一片空白。</p><small>你保存的偏好会在下次对话中继续陪伴你。</small></div>}
      <form className="assistant-memory__form" onSubmit={event => { event.preventDefault(); if (!text.trim() || busy) return; void run(async signal => { await saveMemory(text.trim(), editing, signal); await reload(signal); setText(''); setEditing(null); setNotice('记忆已保存。'); }); }}>
        <label htmlFor="assistant-memory-text">{editing ? '编辑这条记忆' : '新增个人记忆'}</label>
        <textarea id="assistant-memory-text" ref={editor} value={text} onChange={event => setText(event.target.value)} maxLength={500} rows={3} placeholder="例如：我正在学习 React，希望代码解释附带简短示例。" disabled={busy || (!editing && memory.entries.length >= 30)}/>
        <div><small>{text.length} / 500 · 最多 30 条</small><span>{editing && <button className="assistant-action" type="button" disabled={busy} onClick={() => { setEditing(null); setText(''); }}>取消编辑</button>}<button type="submit" className="assistant-primary" disabled={busy || !text.trim() || (!editing && memory.entries.length >= 30)}><Plus aria-hidden="true"/>{editing ? '保存修改' : '保存记忆'}</button></span></div>
      </form>
      <p className="assistant-footnote">只有明确保存的内容才会写入长期记忆。也可以在对话中输入「请记住：……」。关闭记忆不会删除已保存内容。</p>
    </>}
  </section>;
}
