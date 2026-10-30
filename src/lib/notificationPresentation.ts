export type ContentReference = string | {_id?:string;id?:string;title?:string} | null;
export interface MemberNotification {
  _id:string; type:string; actor?:{name?:string;displayName?:string};
  comment?:{content?:string;text?:string}; article?:ContentReference; event?:ContentReference;
  resource?:ContentReference; post?:ContentReference; read:boolean; createdAt:string;
}
export interface NotificationPage { notifications:MemberNotification[]; pagination?:{currentPage?:number;totalPages?:number;hasMore?:boolean} }
const referenceId=(ref:ContentReference)=>typeof ref==='string'?ref:ref?._id||ref?.id;
export function notificationTarget(item:MemberNotification):string|null {
  for(const [type,ref] of [['news',item.article],['event',item.event],['resource',item.resource],['social',item.post]] as const){
    const id=referenceId(ref);
    if(id&&/^[a-f0-9]{24}$/i.test(id))return `/comments/${type}/${id}`;
  }
  return null;
}
export function uniqueNotifications(pages:NotificationPage[]):MemberNotification[]{
  const seen=new Set<string>();
  return pages.flatMap(page=>page.notifications||[]).filter(item=>{if(!item?._id||seen.has(item._id))return false;seen.add(item._id);return true;});
}
export function nextNotificationPage(last:NotificationPage,loaded:number):number|undefined {
  if(!last.pagination?.hasMore)return undefined;
  const current=last.pagination.currentPage;
  return typeof current==='number'&&Number.isInteger(current)&&current===loaded ? current+1 : undefined;
}
