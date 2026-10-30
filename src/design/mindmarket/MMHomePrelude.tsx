import { useEffect, useRef, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CustomEase } from 'gsap/CustomEase';
import { gsap, useGSAP } from '@/lib/gsap';
import { useHomeEntryAnimation } from '@/lib/homeEntry';
import { MMRiveScene } from './MMRiveScene';
import { mountReferenceRivePlayers } from './rive-player';
import markup from './reference-home.html?raw';
import HomeNoticeBubbles from '@/components/home/HomeNoticeBubbles';
import './reference.css';
import './home.css';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, CustomEase);
CustomEase.create('mm-path', 'M0,0 C0.952,0.017 0.744,0.69 1,1');

/** The original local SVG/DOM composition; navigation and lifecycle belong to React. */
export default function MMHomePrelude() {
  const scope = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const animateEntry = useHomeEntryAnimation();
  useGSAP(() => {
    const root=scope.current;
    if(!root)return;
    const media=gsap.matchMedia();
    media.add({desktop:'(min-width: 1000px)', mobile:'(max-width: 999px)', reduce:'(prefers-reduced-motion: reduce)'}, ({conditions})=>{
      const reduce=conditions?.reduce;
      const desktop=conditions?.desktop;
      const path=root.querySelector('c-homepage-timeline');
      if(path && !reduce) {
        const main=root.querySelector(desktop ? '#main-path' : '#mobile-main-path');
        const tail=root.querySelector(desktop ? '#secondary-path' : '#mobile-overlap-end');
        const shadow=root.querySelector(desktop ? '#shadow-path' : '#mobile-shadow-path');
        const timeline=gsap.timeline({scrollTrigger:{trigger:path,start:desktop?'top 127%':'top 100%',end:'bottom 100%',scrub:true}});
        timeline.fromTo(main,{drawSVG:desktop?'0% 5%':'0% .1%'},{drawSVG:'0% 100%',duration:desktop?.9:1,ease:desktop?'mm-path':'power1.in'});
        timeline.fromTo(tail,{drawSVG:'0% 0%'},{drawSVG:'0% 100%',duration:1,ease:'none'});
        if(shadow)timeline.fromTo(shadow,{opacity:0},{opacity:1,duration:.15},desktop?.95:1.05);
      }
      root.querySelectorAll<HTMLElement>('[data-scroll-css-progress]').forEach(element=>{
        if(reduce){element.style.setProperty('--progress','0');return;}
        ScrollTrigger.create({trigger:element,start:element.classList.contains('c-hero-home')?'top top':'top bottom',end:'bottom top',onUpdate:self=>element.style.setProperty('--progress',String(self.progress))});
      });
      if(!reduce && desktop)root.querySelectorAll<HTMLElement>('[data-scroll-speed]').forEach(element=>{
        const speed=Number(element.dataset.scrollSpeed)||0;
        gsap.fromTo(element,{y:window.innerHeight*speed*.5},{y:-window.innerHeight*speed*.5,ease:'none',scrollTrigger:{trigger:element,start:'top bottom',end:'bottom top',scrub:true}});
      });
      const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
        if(entry.isIntersecting){entry.target.classList.add('is-inview');observer.unobserve(entry.target);}
      }),{rootMargin:'0px 0px -10% 0px'});
      root.querySelectorAll('.c-tile-animated').forEach(element=>observer.observe(element));
      if(reduce)root.querySelectorAll('.c-tile-animated').forEach(element=>element.classList.add('is-inview'));
      // The source's secondary title fills the mobile composition; expose only
      // the currently visible heading to assistive technology.
      const secondary=root.querySelector('.c-hero-home_inner:not(.-sticky)');
      secondary?.setAttribute('aria-hidden','true');
      return()=>observer.disconnect();
    },root);
    return()=>media.revert();
  },{scope});

  useEffect(()=>{ const root=scope.current; if(!root)return; return mountReferenceRivePlayers(root, { reveal: animateEntry }); },[animateEntry]);
  const follow=(event:MouseEvent<HTMLDivElement>)=>{
    const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if(!anchor || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)return;
    const href=anchor.getAttribute('href');if(!href?.startsWith('/')||href.startsWith('//'))return;
    event.preventDefault();navigate(href);
  };
  return <><div ref={scope} className="mm-reference is-first-loaded" data-template="index" onClick={follow} dangerouslySetInnerHTML={{__html:markup}}/><HomeNoticeBubbles hostRef={scope}/></>;
}

export function MMHomeCallout(){
  const scope=useRef<HTMLElement>(null);
  const animateEntry=useHomeEntryAnimation();
  useGSAP(()=>{
    const media=gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      if(animateEntry)gsap.from('.mm-home-callout__copy > *',{y:55,opacity:0,duration:.9,stagger:.1,ease:'power3.out',scrollTrigger:{trigger:scope.current,start:'top 80%',once:true},clearProps:'transform,opacity'});
      // Enter before the card reaches the middle; hold her throughout the visible card.
      // Only reverse once its bottom leaves the viewport, including on upward re-entry.
      gsap.fromTo('.mm-home-callout__character',{yPercent:105},{yPercent:0,duration:.6,ease:'power3.out',scrollTrigger:{trigger:scope.current,start:'top 85%',end:'bottom top',toggleActions:'play reverse play reverse',invalidateOnRefresh:true}});
    },scope);
    return()=>media.revert();
  },{scope,dependencies:[animateEntry],revertOnUpdate:true});
  return <section ref={scope} className="mm-home-callout"><div className="mm-home-callout__copy"><p className="mm-eyebrow">CLASSHUB · OUR EVERYDAY</p><h2>一起，把班级日常<br/>变成值得珍藏的故事。</h2><p>查公告、找资料、参与活动。和同学一起，记录值得记住的每一天。</p><Link className="mm-pill" to="/about">了解我们的班级空间 <span aria-hidden="true">↗</span></Link></div><MMRiveScene className="mm-home-callout__character" src="/mindmarket/rive/pop_up_girl.riv"/></section>;
}
