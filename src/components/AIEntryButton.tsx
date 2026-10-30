import type { ButtonHTMLAttributes } from 'react';
import './assistant/ai-entry.css';

export default function AIEntryButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`ai-entry ${className}`} aria-label="打开 AI 模式与站内搜索，快捷键 Ctrl 或 Command K" aria-keyshortcuts="Control+K Meta+K" aria-haspopup="dialog" {...props}>
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11.5" cy="12" r="7.2"/><path d="m17 17.5 6 6M21 2.5l1.1 3.4L25.5 7l-3.4 1.1L21 11.5l-1.1-3.4L16.5 7l3.4-1.1L21 2.5Z"/></svg><span>AI 模式</span>
  </button>;
}
