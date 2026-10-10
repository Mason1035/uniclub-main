const express = require('express');
const COS = require('cos-nodejs-sdk-v5');
const { timingSafeEqual } = require('node:crypto');

function createApp({ env = process.env, Cos = COS } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const secret = env.CLASSHUB_SCF_AUTH_SECRET || '';
  const secured = secret.length >= 32;
  app.use((req, res, next) => {
    if (!secret) return next(); // Legacy quantification rollout compatibility.
    const supplied = Buffer.from(req.get('X-ClassHub-Service-Auth') || '');
    const expected = Buffer.from(secret);
    if (!secured || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(403).json({ success: false, message: 'Forbidden' });
    next();
  });
  const target = req => {
    const { bucket, region, prefix } = req.query;
    if (typeof bucket !== 'string' || !/^[a-z\d][a-z\d-]{1,61}-\d{5,20}$/.test(bucket) || typeof region !== 'string' || !/^ap-[a-z\d-]{2,30}$/.test(region) || typeof prefix !== 'string' || prefix.length > 128 || !/^(?:[a-zA-Z\d_-]{1,63}\/){1,4}$/.test(prefix)) {
      const error = new Error(); error.status = 400; throw error;
    }
    const business = req.query.business || 'quantification';
    const bad = status => { const error = new Error(); error.status = status; throw error; };
    if (!['quantification', 'activity'].includes(business)) bad(400);
    if (business === 'activity' && (!secured || !env.COS_BUCKET || prefix !== 'activity/')) bad(403);
    if (business === 'quantification' && prefix.startsWith('activity/')) bad(400);
    if (secret) {
      const allowed = (env.COS_QUANTIFICATION_PREFIXES || 'quantification/').split(',').map(value => value.trim()).filter(Boolean);
      if (bucket !== env.COS_BUCKET || region !== (env.COS_REGION || 'ap-guangzhou') || business === 'quantification' && !allowed.includes(prefix)) bad(403);
    }
    return { Bucket: bucket, Region: region, Prefix: prefix, business };
  };
  const client = () => {
    if (!env.TENCENTCLOUD_SECRETID || !env.TENCENTCLOUD_SECRETKEY || !env.TENCENTCLOUD_SESSIONTOKEN) throw new Error();
    return new Cos({ SecretId: env.TENCENTCLOUD_SECRETID, SecretKey: env.TENCENTCLOUD_SECRETKEY, SecurityToken: env.TENCENTCLOUD_SESSIONTOKEN, Timeout: 12000, Protocol: 'https:' });
  };
  const call = (cos, method, params) => new Promise((resolve, reject) => cos[method](params, (error, data) => error ? reject(error) : resolve(data)));
  const wrap = action => async (req, res) => {
    try { await action(req, res); }
    catch (error) {
      const status = [400, 403].includes(error.status) ? error.status : error.statusCode === 404 ? 404 : 502;
      // No cloud errors/credentials/URLs are logged or echoed to the caller.
      res.status(status).json({ success: false, message: status === 400 ? 'Invalid parameters' : status === 403 ? 'Forbidden' : status === 404 ? 'File not found' : 'Storage unavailable' });
    }
  };
  app.get('/', (req, res) => res.json({ success: true, integrationVersion: 2, secured, service: 'classhub-quantification-download' }));
  app.get('/list', wrap(async (req, res) => {
    const params = target(req);
    if (params.business !== 'quantification') { const error = new Error(); error.status = 400; throw error; }
    const limit = Number(req.query.limit || 500);
    const marker = req.query.marker || '';
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || typeof marker !== 'string' || marker.length > 1024 || marker && !marker.startsWith(params.Prefix)) { const error = new Error(); error.status = 400; throw error; }
    const { business, ...storageTarget } = params;
    const data = await call(client(), 'getBucket', { ...storageTarget, MaxKeys: limit, ...(marker ? { Marker: marker } : {}) });
    const files = (data.Contents || []).filter(object => typeof object.Key === 'string' && object.Key.startsWith(params.Prefix) && object.Key.toLowerCase().endsWith('.zip')).map(object => ({ key: object.Key, name: object.Key.slice(params.Prefix.length), size: Number(object.Size || 0), lastModified: object.LastModified || '' }));
    res.json({ success: true, integrationVersion: 2, secured, prefix: params.Prefix, count: files.length, files, nextMarker: data.IsTruncated === true || data.IsTruncated === 'true' ? data.NextMarker || '' : '' });
  }));
  app.get('/download', wrap(async (req, res) => {
    const params = target(req);
    const key = req.query.key, filename = req.query.filename;
    const activityKey = /^activity\/[a-f\d]{24}\/(?:cover|photos)\/[a-f\d]{24}(?:-thumb)?\.(?:jpg|png|webp)$/;
    const allowedKey = params.business === 'activity' ? activityKey.test(key) : /\.zip$/i.test(key);
    if (typeof key !== 'string' || key.length > 1024 || !key.startsWith(params.Prefix) || /[\x00-\x1f\x7f\\]/.test(key) || key.includes('..') || key.includes('//') || !allowedKey || filename !== undefined && (typeof filename !== 'string' || filename.length > 200 || /[\x00-\x1f\x7f/\\]/.test(filename))) { const error = new Error(); error.status = 400; throw error; }
    const cos = client();
    const object = { Bucket: params.Bucket, Region: params.Region, Key: key };
    await call(cos, 'headObject', object);
    const name = filename || key.split('/').at(-1);
    const disposition = params.business === 'activity' ? 'inline' : `attachment; filename="quantification.zip"; filename*=UTF-8''${encodeURIComponent(name).replace(/'/g, '%27')}`;
    const data = await call(cos, 'getObjectUrl', { ...object, Sign: true, Expires: 300, Query: { 'response-content-disposition': disposition } });
    res.json({ success: true, integrationVersion: 2, secured, business: params.business, name, url: data.Url });
  }));
  return app;
}
if (require.main === module) createApp().listen(Number(process.env.PORT) || 9000, '0.0.0.0');
module.exports = { createApp };
