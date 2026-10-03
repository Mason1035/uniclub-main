import { Play } from 'lucide-react';
export default function YouTubeEmbed({url,title='查看活动视频'}: {url:string;title?:string}) {
  let videoId:string|null=null;
  try {const parsed=new URL(url);if(parsed.hostname==='youtu.be')videoId=parsed.pathname.slice(1);else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(parsed.hostname))videoId=parsed.searchParams.get('v')||parsed.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/)?.[1]||null;}catch{return null;}
  if(!videoId||!/^[-\w]{11}$/.test(videoId))return <a className="ed-button secondary" href={/^https?:\/\//i.test(url)?url:undefined} target="_blank" rel="noopener noreferrer">{title} ↗</a>;
  return <a className="block border-y border-border py-5" href={url} target="_blank" rel="noopener noreferrer"><img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} className="w-full aspect-video object-cover" alt="活动视频封面" loading="lazy"/><span className="mt-4 inline-flex items-center gap-2 text-primary"><Play size={18}/>{title} ↗</span><span className="block text-sm text-muted-foreground mt-2">在 YouTube 查看完整视频</span></a>;
}
