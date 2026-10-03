const { FeeError, prepareImage, parseRemark } = require('../utils/feeImage');

const reference = value => {
  if (!value) return null;
  if (value.name !== undefined) return { id: String(value._id), name: value.name, uniqueId: value.uniqueId || '' };
  return { id: String(value), name: '', uniqueId: '' };
};

// Explicit metadata shapes keep Binary out of every JSON endpoint, even when
// a repository returns a document containing hidden image fields.
const submissionMetadata = row => row ? {
  id: String(row._id), user: reference(row.user), remark: row.remark || '', status: row.status,
  hasProof: Boolean(row.proofImageSize), confirmedBy: reference(row.confirmedBy), confirmedAt: row.confirmedAt || null,
  createdAt: row.createdAt, updatedAt: row.updatedAt,
} : null;

const settingsMetadata = row => ({
  hasPaymentQr: Boolean(row && row.paymentQrSize && row.paymentQrMimeType),
  updatedAt: row && row.paymentQrSize ? row.updatedAt : null,
});

const validateId = id => { if (!/^[a-f\d]{24}$/i.test(id || '')) throw new FeeError(404, '缴费记录不存在。'); };

class FeeService {
  constructor(repository, { processImage = prepareImage, isAdmin = async () => false, now = () => new Date() } = {}) {
    this.repository = repository;
    this.processImage = processImage;
    this.isAdmin = isAdmin;
    this.now = now;
  }

  async settings() { return settingsMetadata(await this.repository.settings()); }
  async mine(user) { return submissionMetadata(await this.repository.mine(user)); }

  async qr() {
    const row = await this.repository.qr();
    if (!row || !row.paymentQrData) throw new FeeError(404, '管理员尚未设置付款二维码。');
    return { data: Buffer.from(row.paymentQrData), mimeType: row.paymentQrMimeType };
  }

  async saveQr(file, body) {
    if (Object.keys(body || {}).length) throw new FeeError(400, '付款码上传不接受其他配置字段。');
    return settingsMetadata(await this.repository.saveQr(await this.processImage(file)));
  }

  async submit(user, body, file, create) {
    const remark = parseRemark(body);
    const existing = await this.repository.mine(user);
    if (existing && existing.status === 'CONFIRMED') throw new FeeError(409, '班费已确认到账，缴费凭证不能再修改。');
    if (!create && !existing) throw new FeeError(404, '尚未提交缴费凭证。');
    if (create && !file) throw new FeeError(400, '请上传支付成功截图。');
    if (!file && remark === undefined) throw new FeeError(400, '请填写备注或选择新的支付截图。');
    const update = {};
    if (remark !== undefined) update.remark = remark;
    else if (create && !existing) update.remark = '';
    if (file) {
      const image = await this.processImage(file);
      update.proofImageData = image.data;
      update.proofImageMimeType = image.mimeType;
      update.proofImageSize = image.size;
    }
    const row = await this.repository.submit(user, update, create);
    if (!row) throw new FeeError(409, '班费已确认到账，缴费凭证不能再修改。');
    return submissionMetadata(row);
  }

  async proof(id, user) {
    validateId(id);
    const meta = await this.repository.submission(id);
    if (!meta || (String(meta.user) !== String(user) && !await this.isAdmin(user))) {
      throw new FeeError(404, '缴费凭证不存在或无权查看。');
    }
    const row = await this.repository.proof(id);
    if (!row || !row.proofImageData) throw new FeeError(404, '缴费凭证不存在。');
    return { data: Buffer.from(row.proofImageData), mimeType: row.proofImageMimeType };
  }

  async confirm(id, admin) {
    validateId(id);
    const row = await this.repository.confirm(id, admin, this.now());
    if (!row) throw new FeeError(404, '缴费记录不存在。');
    return submissionMetadata(row);
  }

  async list(options) {
    if (options.status && !['SUBMITTED', 'CONFIRMED'].includes(options.status)) throw new FeeError(400, '缴费状态无效。');
    const { items, total } = await this.repository.list(options);
    return { items: items.map(submissionMetadata), total };
  }
}

module.exports = FeeService;
module.exports.submissionMetadata = submissionMetadata;
module.exports.settingsMetadata = settingsMetadata;
