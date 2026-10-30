import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gsap } from '@/lib/gsap';
import { useMindMarketDesign } from './DesignContext';
import { Lenis } from './lenis-runtime.js';
import './scroll.css';

gsap.registerPlugin(ScrollTrigger);
type ScrollEngine = {raf(time:number):void;destroy():void;stop():void;start():void;resize():void;scrollTo(target: number | HTMLElement, options?:Record<string,unknown>):void;on(event:string,callback:()=>void):()=>void};
let currentEngine: ScrollEngine | undefined;

/** A single scroll owner for presentation pages. Business views remain native. */
export function MMScrollCoordinator() {
  const enabled=useMindMarketDesign();
  const {pathname}=useLocation();
  const path=pathname.replace(/\/+$/,'').toLowerCase()||'/';
  useEffect(()=>{
    if(!enabled || !['/','/about'].includes(path))return;
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    let engine:ScrollEngine|undefined;
    let frame=0;
    let refreshFrame=0;
    let stopped=false;
    const root=document.documentElement;
    const locked=()=>document.hidden || root.hasAttribute('data-classhub-preloader') || document.body.hasAttribute('data-scroll-locked') || document.body.style.overflow==='hidden' || !!document.querySelector('[role="dialog"][data-state="open"]');
    const syncLock=()=>{
      const next=locked();
      if(next===stopped)return;
      stopped=next;
      if(stopped)engine?.stop();else engine?.start();
    };
    const destroy=()=>{
      cancelAnimationFrame(frame);cancelAnimationFrame(refreshFrame);
      if(currentEngine===engine)currentEngine=undefined;
      engine?.destroy();engine=undefined;
      delete root.dataset.mmSmooth;
    };
    const initialize=()=>{
      destroy();
      if(preference.matches)return;
      engine=new Lenis({
        // The original site uses Lenis 1.3.17 defaults through Locomotive.
        lerp:.1,smoothWheel:true,syncTouch:false,autoRaf:false,anchors:false,
        prevent:(element:HTMLElement)=>!!element.closest('[role="dialog"],[role="listbox"],[role="menu"],textarea,input,[contenteditable="true"],[data-lenis-prevent],.mm-mobile-panel,.pet-layer,.dialog-panel,.rbc-calendar'),
      }) as ScrollEngine;
      currentEngine=engine;root.dataset.mmSmooth='true';stopped=false;syncLock();
      engine.on('scroll',ScrollTrigger.update);
      const render=(time:number)=>{engine?.raf(time);frame=requestAnimationFrame(render);};
      frame=requestAnimationFrame(render);
      refreshFrame=requestAnimationFrame(()=>{engine?.resize();ScrollTrigger.refresh();});
    };
    const observer=new MutationObserver(syncLock);
    observer.observe(root,{attributes:true,attributeFilter:['data-classhub-preloader']});
    observer.observe(document.body,{attributes:true,attributeFilter:['style','data-scroll-locked']});
    document.addEventListener('visibilitychange',syncLock);
    preference.addEventListener('change',initialize);
    initialize();
    return()=>{observer.disconnect();preference.removeEventListener('change',initialize);document.removeEventListener('visibilitychange',syncLock);destroy();};
  },[enabled,path]);
  return null;
}

/** Anchor motion shares the active owner and does not wrap/transform the page. */
export function scrollMindMarketTo(element:HTMLElement, reduced=false) {
  if(currentEngine)currentEngine.scrollTo(element,{offset:-150,immediate:reduced});
  else element.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
}
