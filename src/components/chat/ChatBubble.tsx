import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import ChatWindow from './ChatWindow';
export default function ChatBubble({articleId,articleTitle='新闻讨论'}: {articleId?:string;articleTitle?:string}) {
  return articleId ? <ArticleChat key={articleId} articleId={articleId} articleTitle={articleTitle}/> : null;
}
function ArticleChat({articleId,articleTitle}: {articleId:string;articleTitle:string}) {
  const [open,setOpen]=useState(false),[activated,setActivated]=useState(false);
  // Keep this article's conversation mounted on temporary close. The article
  // key resets it and cancels in-flight requests when navigating to other news.
  return <><button className="ed-button secondary mt-5" onClick={()=>{setActivated(true);setOpen(true);}}><MessageCircle size={17}/>就这篇新闻问一问</button>{activated&&<ChatWindow open={open} articleId={articleId} articleTitle={articleTitle} onClose={()=>setOpen(false)}/>}</>;
}
