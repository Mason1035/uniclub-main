import { useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { X } from 'lucide-react';
interface EmojiPickerProps {isOpen:boolean;onClose:()=>void;onEmojiSelect:(emoji:string)=>void;triggerRef?:React.RefObject<HTMLElement>;}
const emojis = [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚',
    '😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️',
    '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋',
    '🔥','✨','⭐','🌟','💫','⚡','💥','💢','💨','💦','💤','🎉','🎊','🎈','🎁','🎀','🎂','🍰','🧁','🍭',
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔',
    '🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦'
  ];
export default function EmojiPicker({isOpen,onClose,onEmojiSelect,triggerRef}:EmojiPickerProps) {
  const anchor=useRef({getBoundingClientRect:()=>triggerRef?.current?.getBoundingClientRect()||new DOMRect()});
  anchor.current.getBoundingClientRect=()=>triggerRef?.current?.getBoundingClientRect()||new DOMRect();
  return <Popover.Root open={isOpen} onOpenChange={open=>{if(!open)onClose();}}><Popover.Anchor virtualRef={anchor}/><Popover.Portal><Popover.Content side="bottom" align="center" sideOffset={8} collisionPadding={12} className="emoji-picker z-[60] w-72 sm:w-80 max-w-[calc(100vw-24px)] border border-border bg-popover p-2" aria-label="选择表情" onCloseAutoFocus={event=>{event.preventDefault();triggerRef?.current?.focus({preventScroll:true});}}><div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold">选择表情</p><button className="icon-control" onClick={onClose} type="button" aria-label="关闭表情选择"><X size={18}/></button></div><div className="max-h-44 overflow-y-auto grid grid-cols-5 sm:grid-cols-6 gap-1">{emojis.map(emoji=><button key={emoji} type="button" className="w-11 h-11 flex items-center justify-center text-lg hover:bg-secondary" aria-label={`插入表情 ${emoji}`} onClick={()=>onEmojiSelect(emoji)}>{emoji}</button>)}</div></Popover.Content></Popover.Portal></Popover.Root>;
}
