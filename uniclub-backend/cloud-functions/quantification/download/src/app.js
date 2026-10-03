const express = require('express');
const COS = require('cos-nodejs-sdk-v5');

function createApp({ env = process.env, Cos = COS } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const target = req => {
    const { bucket, region, prefix } = req.query;
    if (typeof bucket !== 'string' || !/^[a-z\d][a-z\d-]{1,61}-\d{5,20}$/.test(bucket) || typeof region !== 'string' || !/^ap-[a-z\d-]{2,30}$/.test(region) || typeof prefix !== 'string' || prefix.length > 128 || !/^(?:[a-zA-Z\d_-]{1,63}\/){1,4}$/.test(prefix)) {
      const error = new Error(); error.status = 400; throw error;
    }
    return { Bucket: bucket, Region: region, Prefix: prefix };
  };
  const client = () => {
    if (!env.TENCENTCLOUD_SECRETID || !env.TENCENTCLOUD_SECRETKEY || !env.TENCENTCLOUD_SESSIONTOKEN) throw new Error();
    return new Cos({ SecretId: env.TENCENTCLOUD_SECRETID, SecretKey: env.TENCENTCLOUD_SECRETKEY, SecurityToken: env.TENCENTCLOUD_SESSIONTOKEN, Timeout: 12000, Protocol: 'https:' });
  };
  const call = (cos, method, params) => new Promise((resolve, reject) => cos[method](params, (error, data) => error ? reject(error) : resolve(data)));
  const wrap = action => async (req, res) => {
    try { await action(req, res); }
    catch (error) {
      const status = error.status === 400 ? 400 : error.statusCode === 404 ? 404 : 502;
      // No cloud errors/credentials/URLs are logged or echoed to the caller.
      res.status(status).json({ success: false, message: status === 400 ? 'Invalid parameters' : status === 404 ? 'File not found' : 'Storage unavailable' });
    }
  };
  app.get('/', (req, res) => res.json({ success: true, integrationVersion: 1, service: 'classhub-quantification-download' }));
  app.get('/list', wrap(async (req, res) => {
    const params = target(req);
    const limit = Number(req.query.limit || 500);
    const marker = req.query.marker || '';
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || typeof marker !== 'string' || marker.length > 1024 || marker && !marker.startsWith(params.Prefix)) { const error = new Error(); error.status = 400; throw error; }
    const data = await call(client(), 'getBucket', { ...params, MaxKeys: limit, ...(marker ? { Marker: marker } : {}) });
    const files = (data.Contents || []).filter(object => typeof object.Key === 'string' && object.Key.startsWith(params.Prefix) && object.Key.toLowerCase().endsWith('.zip')).map(object => ({ key: object.Key, name: object.Key.slice(params.Prefix.length), size: Number(object.Size || 0), lastModified: object.LastModified || '' }));
    res.json({ success: true, integrationVersion: 1, prefix: params.Prefix, count: files.length, files, nextMarker: data.IsTruncated === true || data.IsTruncated === 'true' ? data.NextMarker || '' : '' });
  }));
  app.get('/download', wrap(async (req, res) => {
    const params = target(req);
    const key = req.query.key, filename = req.query.filename;
    if (typeof key !== 'string' || key.length > 1024 || !key.startsWith(params.Prefix) || /[\x00-\x1f\x7f\\]/.test(key) || key.includes('..') || key.includes('//') || !/\.zip$/i.test(key) || filename !== undefined && (typeof filename !== 'string' || filename.length > 200 || /[\x00-\x1f\x7f/\\]/.test(filename))) { const error = new Error(); error.status = 400; throw error; }
    const cos = client();
    const object = { Bucket: params.Bucket, Region: params.Region, Key: key };
    await call(cos, 'headObject', object);
    const name = filename || key.split('/').at(-1);
    const disposition = `attachment; filename="quantification.zip"; filename*=UTF-8''${encodeURIComponent(name).replace(/'/g, '%27')}`;
    const data = await call(cos, 'getObjectUrl', { ...object, Sign: true, Expires: 300, Query: { 'response-content-disposition': disposition } });
    res.json({ success: true, integrationVersion: 1, name, url: data.Url });
  }));
  return app;
}
if (require.main === module) createApp().listen(Number(process.env.PORT) || 9000, '0.0.0.0');
module.exports = { createApp };
