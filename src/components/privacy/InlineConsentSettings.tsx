import { useEffect,useState,useSyncExternalStore } from 'react';
import { getConsent,saveConsent,subscribeConsent } from '../../lib/privacy/consent';

export default function InlineConsentSettings(){
  const consent=useSyncExternalStore(subscribeConsent,getConsent,()=>null);
  const [preferences,setPreferences]=useState(consent?.preferences||false);
  const [statistics,setStatistics]=useState(consent?.statistics||false);
  const [message,setMessage]=useState('');
  useEffect(()=>{setPreferences(consent?.preferences||false);setStatistics(consent?.statistics||false);},[consent]);
  const save=(onlyNecessary=false)=>{
    const persisted=saveConsent({preferences:onlyNecessary?false:preferences,statistics:onlyNecessary?false:statistics});
    setMessage(persisted?'选择已保存。':'选择已用于本次访问，浏览器未能记住它。');
  };
  return <form className="inline-consent" aria-labelledby="inline-consent-title" onSubmit={event=>{event.preventDefault();save();}}><h3 id="inline-consent-title">调整存储偏好</h3><p>必要功能始终开启。其他用途由你决定，可随时撤销。</p><label><input type="checkbox" checked={preferences} onChange={event=>{setPreferences(event.target.checked);setMessage('');}}/><span><strong>记住界面偏好</strong><small>保存列表筛选、返回位置和桌宠位置等浏览器偏好。</small></span></label><label><input type="checkbox" checked={statistics} onChange={event=>{setStatistics(event.target.checked);setMessage('');}}/><span><strong>资源使用统计</strong><small>允许记录资源打开、预览与下载次数；关闭后仍可访问资源。</small></span></label><div className="inline-consent__actions"><button className="ed-button" type="submit">保存我的选择</button><button className="ed-button secondary" type="button" onClick={()=>save(true)}>仅必要</button></div><p role="status" aria-live="polite">{message}</p></form>;
}
