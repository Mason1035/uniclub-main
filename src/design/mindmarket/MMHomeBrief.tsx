import { useSyncExternalStore } from 'react';
import MMCloudSurface from './MMCloudSurface';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import { feesApi } from '../../lib/feesApi';
import { quantificationApi, collectionAvailability } from '../../lib/quantificationApi';
import { usePet } from '../../features/pet/PetContext';
import type { PetSnapshot } from '../../features/pet/types';
import { NOTIFICATION_DEFAULTS, PET_DEFAULTS } from '../../features/pet/pet-config';

const empty:PetSnapshot={config:{...PET_DEFAULTS},account:null,error:null,available:false,status:'loading',notifications:{...NOTIFICATION_DEFAULTS}};
const noSubscribe=()=>()=>{};
const emptyGet=()=>empty;

/** Mounted only after member verification. Uses the same per-account caches as the desks. */
export default function MMHomeBrief({ account }: { account:string }) {
  const {store}=usePet();
  const preferences=useSyncExternalStore(store?.subscribe||noSubscribe,store?.getSnapshot||emptyGet);
  const preferenceKey=JSON.stringify(preferences.notifications);
  const collections=useQuery({queryKey:['quantification','collections',account],queryFn:()=>quantificationApi.collections(),enabled:!!account,staleTime:15000});
  const collection=collections.data?.collections.filter(item=>collectionAvailability(item)==='open').sort((a,b)=>(Date.parse(a.deadline||'')||Infinity)-(Date.parse(b.deadline||'')||Infinity))[0];
  const mine=useQuery({queryKey:['quantification','mine',account,collection?.id||''],queryFn:()=>quantificationApi.mine(collection!.id),enabled:!!account&&!!collection,staleTime:10000});
  const fees=useQuery({queryKey:['fees-me',account],queryFn:feesApi.mine,enabled:!!account,staleTime:30000});
  const unread=useQuery({queryKey:['notification-unread',store?.userId,preferenceKey],queryFn:async()=>(await api.get('/api/notifications/unread-count')).data.count as number,enabled:preferences.available&&preferences.status!=='saving',staleTime:30000});
  const materialError=collections.isError||!!collection&&mine.isError;
  const materialText=materialError?'暂未获取':collections.isPending||!!collection&&mine.isPending?'正在获取…':!collection?'暂无开放收集期':mine.data?.pendingUpload?.state==='confirming'?'材料待确认，请查看':mine.data?.submission?'已提交材料':'收集期开放中';
  const feeText=fees.isError?'暂未获取':fees.isPending?'正在获取…':fees.data?.status==='CONFIRMED'?'已确认到账':fees.data?'凭证已提交，待确认':'未提交缴费凭证';
  const unreadText=unread.isError?'暂未获取':unread.data===undefined?'正在获取…':unread.data?`${unread.data} 条未读`:'暂无未读消息';
  return <section className="mm-home-brief mm-cloud-card mm-cloud-card--brief" aria-labelledby="mm-home-brief-title"><MMCloudSurface variant="brief" wide/><div className="mm-home-brief__heading"><h2 id="mm-home-brief-title">近期事务</h2><Link to="/functions">全部功能 ↗</Link></div><div className="mm-home-brief__items">
    <div><Link to="/quantification"><span>量化材料</span><strong>{materialText}</strong><small>{collection?.title||'查看收集安排与提交结果'}</small></Link>{materialError&&<button className="text-link" onClick={()=>void (collections.isError?collections.refetch():mine.refetch())}>重新获取材料状态</button>}</div>
    <div><Link to="/fees"><span>班费凭证</span><strong>{feeText}</strong><small>缴费说明与本人凭证</small></Link>{fees.isError&&<button className="text-link" onClick={()=>void fees.refetch()}>重新获取班费状态</button>}</div>
    <div><Link to="/notifications"><span>我的通知</span><strong>{unreadText}</strong><small>查看与你有关的消息</small></Link>{unread.isError&&<button className="text-link" onClick={()=>void unread.refetch()}>重新获取通知状态</button>}</div>
  </div></section>;
}
