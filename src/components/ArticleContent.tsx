interface ArticleContentProps { content:string;summary?:{raw?:string;whyItMatters?:string};originalUrl?:string; }
export default function ArticleContent({content,summary,originalUrl}:ArticleContentProps) {
  const text=summary?.raw||content;
  return <div className="reading-body">{text?text.split(/\n\s*\n/).map((paragraph,index)=><p key={index} className="whitespace-pre-wrap break-words">{paragraph}</p>):<p className="text-muted-foreground">暂未提供新闻正文。</p>}{summary?.whyItMatters&&<section className="mt-8 border-t border-border pt-6"><h2 className="font-display text-xl font-bold">为什么值得关注</h2><p className="whitespace-pre-wrap">{summary.whyItMatters}</p></section>}{originalUrl&&/^https?:\/\//i.test(originalUrl)&&<div className="mt-8 font-body"><a className="ed-button secondary" href={originalUrl} target="_blank" rel="noopener noreferrer">阅读来源原文 ↗</a></div>}</div>;
}
