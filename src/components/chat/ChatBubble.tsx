import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import ChatWindow from './ChatWindow';
export default function ChatBubble({articleId,articleTitle='新闻讨论'}: {articleId?:string;articleTitle?:string}) {
  const [open,setOpen]=useState(false);if(!articleId)return null;
  return <><button className="ed-button secondary mt-5" onClick={()=>setOpen(true)}><MessageCircle size={17}/>就这篇新闻问一问</button>{open&&<ChatWindow articleId={articleId} articleTitle={articleTitle} onClose={()=>setOpen(false)}/>}</>;
}
