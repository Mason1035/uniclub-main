import type { ActivityUpload } from '../types/activity';
import { validateActivityUploadTarget } from './activityMediaPolicy';

export const ACTIVITY_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export async function validateActivityImage(file: File): Promise<void> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPEG、PNG 或 WebP 图片。');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('每张图片不能超过 10MB。');
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!({ 'image/jpeg': jpeg, 'image/png': png, 'image/webp': webp }[file.type])) throw new Error('文件内容与图片类型不符，请重新选择图片。');
}

/** Only the exact backend-authorized COS object receives the image, never the app JWT. */
export async function putActivityImage(file: File, session: ActivityUpload, signal: AbortSignal, onProgress: (percent: number) => void): Promise<void> {
  validateActivityUploadTarget(session);
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const xhr = new XMLHttpRequest();
    const cancel = () => xhr.abort();
    const finish = (error?: Error) => { signal.removeEventListener('abort', cancel); if (error) reject(error); else resolve(); };
    xhr.open('PUT', session.upload.url);
    xhr.timeout = 120000;
    for (const [name, value] of Object.entries(session.upload.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = event => onProgress(Math.round(event.loaded / file.size * 100));
    // A previous PUT may have reached COS while its response was lost. The
    // completion API verifies that exact object's size, signature and upload ID.
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) || xhr.status === 409 ? finish() : finish(Object.assign(new Error(xhr.status === 403 ? '上传授权已失效，请重新上传图片。' : '图片上传失败，请重试。'), { code: xhr.status === 403 ? 'UPLOAD_AUTH_EXPIRED' : 'UPLOAD_FAILED' }));
    xhr.onerror = () => finish(new Error('图片传输中断，请检查网络后重试。'));
    xhr.ontimeout = () => finish(new Error('图片上传超时，请重试。'));
    xhr.onabort = () => finish(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', cancel, { once: true });
    xhr.send(file);
  });
  onProgress(100);
}
