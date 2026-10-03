const crypto = require('node:crypto');

class AiError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const aad = Buffer.from('classhub:admin-ai:deepseek:v1');
function masterKey() {
  const value = process.env.AI_SECRET_ENCRYPTION_KEY || '';
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) {
    throw new AiError('MASTER_KEY_UNAVAILABLE', '服务器尚未正确配置 AI_SECRET_ENCRYPTION_KEY，请联系网站负责人。', 503);
  }
  return key;
}

function encrypt(apiKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}

function decrypt(secret) {
  const key = masterKey();
  try {
    if (!secret || secret.version !== 1) throw new Error('Unsupported secret version');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(secret.iv, 'base64'));
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(secret.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new AiError('SECRET_UNREADABLE', 'AI 密钥无法解密，请检查服务器主密钥或重新配置 API Key。', 503);
  }
}

module.exports = { AiError, encrypt, decrypt };
