export function sectionFor(pathname:string):string {
  if(pathname.startsWith('/functions')||pathname.startsWith('/quantification')||pathname.startsWith('/fees'))return '/functions';
  if(pathname.startsWith('/article/')||pathname.startsWith('/news')||pathname.startsWith('/comments/news/'))return '/news';
  if(pathname.startsWith('/event')||pathname.startsWith('/past-events/')||pathname.startsWith('/comments/event/'))return '/events';
  if(pathname.startsWith('/resource')||pathname.startsWith('/comments/resource/'))return '/resources';
  if(pathname.startsWith('/social')||pathname.startsWith('/comments/social/'))return '/social';
  if(pathname.startsWith('/announcements'))return '/announcements';
  return pathname;
}
