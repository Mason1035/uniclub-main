import Markdown from 'react-markdown';

// React Markdown escapes HTML by default. Remote images are intentionally
// disabled: generated answers should not cause background tracking requests.
export default function Answer({ text }: { text: string }) {
  return <div className="ai-answer"><Markdown skipHtml components={{
    a: ({ href, children }) => href && /^https?:\/\//i.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
    img: ({ alt }) => <span>{alt || '[图片链接]'}</span>,
  }}>{text}</Markdown></div>;
}
