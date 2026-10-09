import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityTypeOptions, activityTypeLabel, ACTIVITY_TYPES } from '../src/lib/activityMeta';
import { needsNewActivityUpload, safeActivityMediaSource, validateActivityUploadTarget } from '../src/lib/activityMediaPolicy';
import { validateActivityImage } from '../src/lib/activityUpload';
import { validateEventForm } from '../src/pages/admin/contentValidation';
import type { ActivityUpload } from '../src/types/activity';

const activityId = '000000000000000000000001'; const mediaId = '000000000000000000000002';
const endpoint = 'https://lianghuacailiao-2026-1306497854.cos.ap-guangzhou.myqcloud.com';
function authorization(): ActivityUpload {
  return { upload: { id: mediaId, method: 'PUT', url: `${endpoint}/activity/${activityId}/photos/${mediaId}.png?q-signature=test-signature`, expiresAt: new Date(Date.now() + 60000).toISOString(), headers: { 'Content-Type': 'image/png', 'x-cos-acl': 'private', 'x-cos-forbid-overwrite': 'true', 'x-cos-meta-classhub-upload': mediaId } } };
}
test('canonical creation types are exactly the five required values; editing keeps historical identity', () => {
  assert.deepEqual(ACTIVITY_TYPES.map(type => type.value), ['LEAGUE_ACTIVITY', 'TEAM_BUILDING', 'CLASS_MEETING', 'GROUP_DISCUSSION', 'OTHER']);
  assert.equal(activityTypeOptions().length, 5);
  assert.equal(activityTypeOptions('Workshop').find(type => type.value === 'Workshop')?.label, '保留：工作坊（历史分类）');
  assert.match(activityTypeLabel('Workshop'), /历史分类/);
  assert.equal(activityTypeOptions('A custom historical category').at(-1)?.value, 'A custom historical category');
});
test('COS upload authorization cannot write quantification, a different bucket, another object, or send app credentials', () => {
  assert.doesNotThrow(() => validateActivityUploadTarget(authorization()));
  const invalid = [
    `${endpoint}/quantification/${mediaId}.png?q-signature=signature`,
    `https://other-1306497854.cos.ap-guangzhou.myqcloud.com/activity/${activityId}/photos/${mediaId}.png?q-signature=signature`,
    `${endpoint}/activity/${activityId}/photos/000000000000000000000003.png?q-signature=signature`,
    `${endpoint}/activity/${activityId}/photos/${mediaId}.png`,
    `${endpoint}/activity/${activityId}/photos/${mediaId}.png?q-signature=`,
    `${endpoint}/activity/${activityId}/photos/%ZZ.png?q-signature=signature`,
  ];
  for (const url of invalid) { const session = authorization(); session.upload.url = url; assert.throws(() => validateActivityUploadTarget(session)); }
  const credential = authorization(); credential.upload.headers.Authorization = 'Bearer app-session'; assert.throws(() => validateActivityUploadTarget(credential));
  const publicObject = authorization(); publicObject.upload.headers['x-cos-acl'] = 'public-read'; assert.throws(() => validateActivityUploadTarget(publicObject));
  const expired = authorization(); expired.upload.expiresAt = 'invalid'; assert.throws(() => validateActivityUploadTarget(expired));
});
test('gallery accepts authorized HTTP(S) or same-origin media routes and rejects script/data/credential URLs', () => {
  assert.equal(safeActivityMediaSource(`/api/past-events/${activityId}/gallery/0`), `/api/past-events/${activityId}/gallery/0`);
  assert.equal(safeActivityMediaSource(`${endpoint}/activity/${activityId}/photos/${mediaId}.png?q-signature=safe`), `${endpoint}/activity/${activityId}/photos/${mediaId}.png?q-signature=safe`);
  for (const value of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', '//outside.example/photo.png', '/\\outside.example/photo.png', 'https://user:password@outside.example/photo.png', 'https://outside.example/\nphoto.png']) assert.equal(safeActivityMediaSource(value), '');
});
test('cover concurrency and expired authorization require a fresh upload, temporary confirm failure keeps the session', () => {
  assert.equal(needsNewActivityUpload({ response: { data: { code: 'MEDIA_VERSION_CONFLICT' } } }), true);
  assert.equal(needsNewActivityUpload({ code: 'UPLOAD_AUTH_EXPIRED' }), true);
  assert.equal(needsNewActivityUpload({ response: { data: { code: 'ACTIVITY_MEDIA_FAILED' } } }), false);
});
test('image choices reject false MIME signatures, HEIC and oversized images before upload authorization', async () => {
  const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], 'photo.png', { type: 'image/png' });
  await assert.doesNotReject(() => validateActivityImage(png));
  await assert.rejects(() => validateActivityImage(new File(['not an image'], 'photo.png', { type: 'image/png' })));
  await assert.rejects(() => validateActivityImage(new File(['heic'], 'photo.heic', { type: 'image/heic' })));
  const huge = { ...png, type: 'image/png', size: 10 * 1024 * 1024 + 1 } as File;
  await assert.rejects(() => validateActivityImage(huge));
});
test('deadline and activity end validation agree with backend rules', () => {
  const form = { title: '班会', description: '班级活动', eventType: 'CLASS_MEETING', status: 'draft', startDate: '2027-01-01T09:00', endDate: '2027-01-01T10:00', locationType: 'physical', address: '教学楼', room: '', virtualLink: '', category: '', maxCapacity: '', imageUrl: '', rsvpDeadline: '2027-01-01T11:00' };
  assert.match(validateEventForm(form).rsvpDeadline, /不能晚于/);
  assert.match(validateEventForm({ ...form, rsvpDeadline: '', endDate: form.startDate }).endDate, /晚于/);
  assert.deepEqual(validateEventForm({ ...form, rsvpDeadline: '2027-01-01T09:30' }), {});
  assert.ok(validateEventForm({ ...form, rsvpDeadline: '', eventType: 'Workshop' }).eventType);
  assert.deepEqual(validateEventForm({ ...form, rsvpDeadline: '', eventType: 'Workshop' }, 'Workshop'), {});
  assert.ok(validateEventForm({ ...form, rsvpDeadline: '', eventType: 'Social' }, 'Workshop').eventType);
});
