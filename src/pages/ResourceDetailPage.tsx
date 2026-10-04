import PageShell from '../components/PageShell';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams,useLocation,useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { hasConsent } from '../lib/privacy/consent';
import type { ApiResource } from '../types/content';
import { resourceTypeLabel } from '../lib/resourceMeta';
import { formatDate,formatBytes } from '../lib/contentFormat';
import ContentState from '../components/ContentState';
import PageHeading from '../components/PageHeading';
import BackNavigation from '../components/BackNavigation';
import InteractionButtons from '../components/InteractionButtons';
export default function ResourceDetailPage() {
  const {id}=useParams();const location=useLocation();const navigate=useNavigate();const [preview,setPreview]=useState(false);
  const query=useQuery({queryKey:['resource',id],enabled:!!id,queryFn:async()=>{const {data}=await api.get(`/api/resources/${id}`);return (data.resource||data) as ApiResource;}});
  const resource=query.data;const raw=resource?.file?.url||resource?.fileUrl||resource?.linkUrl;let url:string|undefined;
  try {if(raw){const parsed=new URL(raw,window.location.origin);if(['https:','http:'].includes(parsed.protocol))url=parsed.href;}}catch{url=undefined;}
  const isUpload=resource?.file?.type==='upload'||!!resource?.fileUrl;const mime=resource?.file?.mimeType||'';const isImage=/^image\/(png|jpeg|webp|gif|avif)$/.test(mime);const isPdf=mime==='application/pdf';
  const track=(action:'view'|'download')=>{if(!hasConsent('statistics'))return;void api.post(`/api/resources/${id}/${action}`).then(()=>query.refetch()).catch(()=>{ /* File access remains available if the counter cannot be updated. */ });};
  return <PageShell className="reading-page editorial-titles"><BackNavigation referrer={location.state?.referrer} contentType="resource" fallbackReferrer="/resources"/><ContentState illustration="resource" loading={query.isLoading} error={query.error} empty={!resource} emptyTitle="找不到这个资源" onRetry={()=>void query.refetch()}>{resource&&<><PageHeading tone="editorial" title={resource.title}/><div className="detail-meta"><span>{resourceTypeLabel(resource.type)}</span>{resource.category&&<span>{resource.category}</span>}{formatBytes(resource.file?.size||resource.fileSize)&&<span>{formatBytes(resource.file?.size||resource.fileSize)}</span>}<time>更新于 {formatDate(resource.updatedAt||resource.createdAt)}</time>{resource.uploadedBy?.name&&<span>分享者：{resource.uploadedBy.name}</span>}</div>{resource.thumbnailUrl&&<img src={resource.thumbnailUrl} className="detail-image" alt=""/>}<div data-pet-avoid className="reading-body whitespace-pre-wrap">{resource.description||'分享者暂未填写资源说明。'}</div>{resource.file?.originalName&&<p className="entry-meta mt-6 break-all">文件名：{resource.file.originalName}</p>}<div className="detail-actions">{url?<><a className="ed-button" href={url} target="_blank" rel="noopener noreferrer" download={isUpload?(resource.file?.originalName||''):undefined} onClick={()=>track(isUpload?'download':'view')}>{isUpload?'下载文件':'打开资源链接'} ↗</a>{isUpload&&(isImage||isPdf)&&<button className="ed-button secondary" aria-expanded={preview} onClick={()=>{setPreview(v=>!v);if(!preview)track('view');}}>{preview?'收起预览':'预览文件'}</button>}</>:<p className="text-muted-foreground">资源地址尚未提供，请联系分享者。</p>}</div>{preview&&url&&(isImage?<img src={url} className="w-full h-auto mt-6" alt={resource.file?.originalName||resource.title}/>:<><iframe className="w-full h-[60vh] mt-6 border border-border" src={url} title={`${resource.title} PDF 预览`}/><p className="form-note">若浏览器无法预览 PDF，可使用上方下载入口。</p></>)}<p className="entry-meta mt-5">下载 {resource.downloadCount??0} 次 · 浏览 {resource.views??0} 次</p><InteractionButtons contentType="Resource" contentId={id||''} likeCount={resource.likes} shareTitle={resource.title} shareType="resource" onCommentClick={()=>navigate(`/comments/resource/${id}`,{state:{referrer:location.pathname}})}/></>}</ContentState></PageShell>;
}
