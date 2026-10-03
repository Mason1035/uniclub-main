import COS from 'cos-js-sdk-v5';
import { quantificationApi } from './quantificationApi';
import type { UploadSession, UploadCredentials } from '../types/quantification';

export interface UploadProgress { loaded: number; total: number; speed: number; percent: number }
export async function validateQuantificationFile(file: File): Promise<void> {
  if (!/\.zip$/i.test(file.name) || file.name.length > 200 || [...file.name].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || c === '/' || c === '\\') || file.name.includes('..')) throw new Error('请选择 ZIP 压缩包，文件名不能包含路径或特殊控制字符。');
  if (file.size < 22 || file.size > 500 * 1024 * 1024) throw new Error('文件必须是完整 ZIP，大小不能超过 500MB。');
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || !((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6))) throw new Error('文件内容不是 ZIP，请先压缩材料后再选择。');
}

// The official SDK computes COS signatures. XHR provides byte progress and real
// AbortSignal cancellation. No ClassHub JWT is sent to the storage domain.
async function putChunk(session: UploadSession, credentials: UploadCredentials, body: Blob, partNumber: number | null, signal: AbortSignal, progress: (loaded: number) => void): Promise<void> {
  const { bucket, region, key, multipartId } = session.target;
  if (!/^[a-z\d-]+-\d+$/.test(bucket) || !/^ap-[a-z\d-]+$/.test(region)) throw new Error('存储上传地址无效，请联系管理员。');
  const query: Record<string, string> = partNumber === null ? {} : { partNumber: String(partNumber), uploadId: multipartId };
  const endpoint = session.target.endpoint || `https://${bucket}.cos.${region}.myqcloud.com`;
  if (endpoint !== `https://${bucket}.cos.${region}.myqcloud.com`) throw new Error('存储上传地址无效，请联系管理员。');
  let headers: Record<string, string>;
  let url: string;
  if ('mode' in credentials && credentials.mode === 'signed') {
    const authorization = await quantificationApi.authorization(session.upload.id, partNumber, signal);
    const signed = new URL(authorization.url);
    if (signed.origin !== endpoint || decodeURIComponent(signed.pathname) !== `/${key}` || signed.username || signed.password || signed.hash || !signed.searchParams.has('q-signature') ||
      (partNumber !== null && (signed.searchParams.get('partNumber') !== String(partNumber) || signed.searchParams.get('uploadId') !== multipartId))) throw new Error('云端上传授权地址无效。');
    url = authorization.url; headers = authorization.headers;
    if (Object.keys(headers).some(name => !['content-type', 'x-cos-acl', 'x-cos-forbid-overwrite', 'x-cos-meta-classhub-upload'].includes(name.toLowerCase()))) throw new Error('云端上传授权格式无效。');
  } else {
    const legacy = credentials as Exclude<UploadCredentials, { mode: 'signed' }>;
    headers = { 'Content-Type': 'application/zip', 'x-cos-security-token': legacy.SecurityToken };
    headers.Authorization = COS.getAuthorization({ SecretId: legacy.TmpSecretId, SecretKey: legacy.TmpSecretKey, Bucket: bucket, Region: region, Key: key, Method: 'PUT', Query: query, Headers: headers, KeyTime: `${legacy.StartTime};${legacy.ExpiredTime}` });
    const suffix = new URLSearchParams(query).toString();
    url = `${endpoint}/${key.split('/').map(encodeURIComponent).join('/')}${suffix ? `?${suffix}` : ''}`;
  }
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => { signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(); };
    xhr.open('PUT', url);
    xhr.timeout = 180000;
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = e => progress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { progress(body.size); finish(); }
      else finish(new Error(xhr.status === 409 ? '目录中已有同名文件，请更换文件名；已经上传完成的文件请重新确认提交。' : xhr.status === 403 ? '云端上传授权已失效或被拒绝，请重试；若持续失败，请联系管理员检查权限。' : '对象存储未接受上传，请稍后重试。'));
    };
    xhr.onerror = () => finish(new Error('文件传输中断，请检查网络；管理员也需确认对象存储的跨域设置。'));
    xhr.ontimeout = () => finish(new Error('当前分片上传超时，请检查网络后重试。'));
    xhr.onabort = () => finish(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    xhr.send(body);
  });
}

export async function uploadQuantificationFile(file: File, session: UploadSession, signal: AbortSignal, onProgress: (p: UploadProgress) => void): Promise<void> {
  const inner = new AbortController();
  const cancel = () => inner.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) inner.abort();
  let credentials = session.credentials;
  let refreshing: Promise<UploadCredentials> | null = null;
  const getCredentials = async () => {
    if (credentials.ExpiredTime * 1000 < Date.now() + 120000) {
      refreshing ||= quantificationApi.credentials(session.upload.id);
      try { credentials = await refreshing; } finally { refreshing = null; }
    }
    return credentials;
  };
  const loaded = new Map<number, number>();
  const start = performance.now();
  let last = start, lastLoaded = 0;
  const update = () => {
    const totalLoaded = [...loaded.values()].reduce((a, b) => a + b, 0);
    const now = performance.now();
    const speed = now - last > 200 ? Math.max(0, totalLoaded - lastLoaded) / ((now - last) / 1000) : 0;
    if (now - last > 200 || totalLoaded === file.size) { last = now; lastLoaded = totalLoaded; onProgress({ loaded: totalLoaded, total: file.size, speed, percent: Math.min(100, totalLoaded / file.size * 100) }); }
  };
  try {
    if (!session.target.multipartId) {
      await putChunk(session, await getCredentials(), file, null, inner.signal, bytes => { loaded.set(1, bytes); update(); });
    } else {
      const parts = await quantificationApi.parts(session.upload.id);
      const partBytes = session.target.partBytes;
      const count = Math.ceil(file.size / partBytes);
      const completed = new Set(parts.filter(p => p.size === Math.min(partBytes, file.size - (p.partNumber - 1) * partBytes)).map(p => p.partNumber));
      for (const part of parts) if (completed.has(part.partNumber)) loaded.set(part.partNumber, part.size);
      onProgress({ loaded: [...loaded.values()].reduce((a, b) => a + b, 0), total: file.size, speed: 0, percent: [...loaded.values()].reduce((a, b) => a + b, 0) / file.size * 100 });
      let next = 1;
      const worker = async () => {
        while (next <= count) {
          const number = next++;
          if (completed.has(number)) continue;
          if (inner.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const chunk = file.slice((number - 1) * partBytes, Math.min(number * partBytes, file.size));
          await putChunk(session, await getCredentials(), chunk, number, inner.signal, bytes => { loaded.set(number, bytes); update(); });
        }
      };
      await Promise.all([worker(), worker()]);
    }
    onProgress({ loaded: file.size, total: file.size, speed: 0, percent: 100 });
  } catch (error) { inner.abort(); throw error; }
  finally { signal.removeEventListener('abort', cancel); }
}
