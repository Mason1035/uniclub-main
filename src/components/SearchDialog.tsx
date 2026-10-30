import { useEffect, useRef, useState, type RefObject } from 'react';
import { Brain, Search, Sparkles } from 'lucide-react';
import { useUser } from '../context/userContextState';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import AssistantChatPanel from './assistant/AssistantChatPanel';
import AssistantMemoryPanel from './assistant/AssistantMemoryPanel';
import SiteSearchContent from './assistant/SiteSearchContent';
import './SearchDialog.css';
import './assistant/assistant.css';

type Mode = 'ai' | 'search' | 'memory';
const modes: { id: Mode; label: string; icon: typeof Search }[] = [
  { id: 'ai', label: 'AI 模式', icon: Sparkles },
  { id: 'search', label: '站内搜索', icon: Search },
  { id: 'memory', label: '个人记忆', icon: Brain },
];

export default function SearchDialog({ isOpen, onClose, restoreFocusRef }: { isOpen: boolean; onClose: () => void; restoreFocusRef?: RefObject<HTMLElement> }) {
  const { user } = useUser();
  const identity = user.id || user.uniqueId || user.email;
  const [mode, setMode] = useState<Mode>('ai');
  const panel = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => { if (!isOpen) setMode('ai'); }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const viewport = window.visualViewport;
    const measure = () => {
      panel.current?.style.setProperty('--assistant-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      panel.current?.style.setProperty('--assistant-viewport-top', `${viewport?.offsetTop ?? 0}px`);
    };
    measure(); viewport?.addEventListener('resize', measure); viewport?.addEventListener('scroll', measure); window.addEventListener('resize', measure);
    return () => { viewport?.removeEventListener('resize', measure); viewport?.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, [isOpen]);
  return <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent ref={panel} className="search-panel assistant-panel" onCloseAutoFocus={event => {
      const opener = restoreFocusRef?.current;
      if (!opener?.isConnected) return; event.preventDefault(); opener.focus({ preventScroll: true });
    }} onOpenAutoFocus={event => { event.preventDefault(); panel.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true }); }}>
      <div className="assistant-heading"><div className="assistant-heading__brand"><Sparkles aria-hidden="true"/><DialogTitle>ClassHub <span>AI</span></DialogTitle></div><DialogDescription>你的班级知识伙伴</DialogDescription></div>
      <div className="assistant-tabs" role="tablist" aria-label="搜索与 AI 功能">{modes.map(({ id, label, icon: Icon }, index) => <button key={id} ref={node => { tabs.current[index] = node; }} id={`assistant-tab-${id}`} type="button" role="tab" aria-selected={mode === id} aria-controls={`assistant-panel-${id}`} tabIndex={mode === id ? 0 : -1} onClick={() => setMode(id)} onKeyDown={event => {
        let next: number | undefined;
        if (event.key === 'ArrowRight') next = (index + 1) % modes.length;
        if (event.key === 'ArrowLeft') next = (index + modes.length - 1) % modes.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = modes.length - 1;
        if (next !== undefined) { event.preventDefault(); setMode(modes[next].id); tabs.current[next]?.focus(); }
      }}><Icon aria-hidden="true"/>{label}</button>)}</div>
      <div key={identity} className="assistant-panels">
        <div id="assistant-panel-ai" role="tabpanel" aria-labelledby="assistant-tab-ai" hidden={mode !== 'ai'}><AssistantChatPanel active={mode === 'ai' && isOpen}/></div>
        <div id="assistant-panel-search" role="tabpanel" aria-labelledby="assistant-tab-search" hidden={mode !== 'search'}><SiteSearchContent active={mode === 'search' && isOpen} onClose={onClose}/></div>
        <div id="assistant-panel-memory" role="tabpanel" aria-labelledby="assistant-tab-memory" hidden={mode !== 'memory'}>{mode === 'memory' && <AssistantMemoryPanel/>}</div>
      </div>
    </DialogContent>
  </Dialog>;
}
