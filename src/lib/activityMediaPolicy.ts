import type { ActivityUpload } from '../types/activity';

export function safeActivityMediaSource(value?: string): string {
  if (typeof value !== 'string' || !value || value.includes('\\') || [...value].some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return '';
  if (/^\/(?!\/)/.test(value)) return value;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}

export function validateActivityUploadTarget(session: ActivityUpload, now = Date.now()): void {
  let target: URL;
  try { target = new URL(session.upload.url); } catch { throw new Error('图片上传授权无效，请重新选择图片。'); }
  const expires = Date.parse(session.upload.expiresAt);
  let path = ''; try { path = decodeURIComponent(target.pathname); } catch { throw new Error('图片上传路径无效。'); }
  if (session.upload.method !== 'PUT' || target.protocol !== 'https:' || target.username || target.password || target.hash || target.hostname !== 'lianghuacailiao-2026-1306497854.cos.ap-guangzhou.myqcloud.com' || target.port || !/^\/activity\/[a-f\d]{24}\/(cover|photos)\/[a-f\d]{24}\.(jpg|png|webp)$/i.test(path) || !target.searchParams.get('q-signature')) throw new Error('图片上传授权无效，请重新选择图片。');
  if (!Number.isFinite(expires) || expires <= now) throw Object.assign(new Error('图片上传授权已过期，请重新上传。'), { code: 'UPLOAD_AUTH_EXPIRED' });
  const allowed = new Set(['content-type', 'x-cos-acl', 'x-cos-forbid-overwrite', 'x-cos-meta-classhub-upload']);
  const headers = Object.fromEntries(Object.entries(session.upload.headers).map(([name, value]) => [name.toLowerCase(), value]));
  if (Object.keys(headers).some(header => !allowed.has(header)) || !['image/jpeg', 'image/png', 'image/webp'].includes(headers['content-type']) || headers['x-cos-acl'] !== 'private' || headers['x-cos-forbid-overwrite'] !== 'true' || headers['x-cos-meta-classhub-upload'] !== session.upload.id || !/^[a-f\d]{24}$/i.test(session.upload.id) || !path.includes(`/${session.upload.id}.`)) throw new Error('图片上传授权格式无效。');
}

export function needsNewActivityUpload(error: unknown): boolean {
  const shaped = error as { code?: string; response?: { data?: { code?: string } } };
  return ['MEDIA_VERSION_CONFLICT', 'MEDIA_UPLOAD_EXPIRED', 'UPLOAD_EXPIRED', 'UPLOAD_AUTH_EXPIRED'].includes(shaped?.response?.data?.code || shaped?.code || '');
}
