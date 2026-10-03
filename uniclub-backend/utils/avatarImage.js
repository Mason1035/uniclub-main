const sharp = require('sharp');
const { prepareImage } = require('./feeImage');

// Reuse ClassHub's existing decoded-image validation; COS uploads are unrelated.
async function prepareAvatar(file) {
  const image = await prepareImage(file);
  const data = await sharp(image.data).resize(256, 256, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
  return { data: `data:image/webp;base64,${data.toString('base64')}`, contentType: 'image/webp', size: data.length, uploadedAt: new Date() };
}
module.exports = { prepareAvatar };
