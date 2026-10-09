import Markdown from 'react-markdown';
import './ai-answer.css';

// HTML is escaped and remote images cannot make background tracking requests.
// Links are clickable only when the model supplies an HTTP(S) address.
export default function AiAnswer({ text, compact = false, allowedLinks }: { text: string; compact?: boolean; allowedLinks?: string[] }) {
  const allowed = allowedLinks && new Set(allowedLinks);
  const canLink = (href?: string): boolean => {
    if (!href || !/^https?:\/\//i.test(href)) return false;
    if (!allowed) return true;
    try {
      const url = new URL(href);
      return !url.username && !url.password && allowed.has(url.href);
    } catch { return false; }
  };
  // News callers provide only URLs from actual retrieval metadata. While
  // streaming, no sources are known yet, so generated links remain plain text.
  return <div className={`ai-answer${compact ? ' ai-answer-compact' : ''}`}><Markdown skipHtml components={{
    a: ({ href, children }) => canLink(href) ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
    img: ({ alt }) => <span>{alt || '[图片链接]'}</span>,
  }}>{text}</Markdown></div>;
}
