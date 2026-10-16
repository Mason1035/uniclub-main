const DEFAULT_RESOURCE_QUICK_LINKS = Object.freeze([
  Object.freeze({ id: 'default-sicnu', name: '四川师范大学官网', url: 'https://authserver.sicnu.edu.cn/', description: '学校平台入口', isDefault: true }),
  Object.freeze({ id: 'default-github', name: 'GitHub', url: 'https://github.com/', description: '代码托管与项目协作', isDefault: true }),
  Object.freeze({ id: 'default-educoder', name: '头歌平台', url: 'https://www.educoder.net/', description: '编程实践与课程学习', isDefault: true }),
  Object.freeze({ id: 'default-chaoxing', name: '学习通', url: 'https://passport2.chaoxing.com/', description: '课程学习与教学资源', isDefault: true }),
]);

class ResourceQuickLinkError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ResourceQuickLinkError';
    this.status = status;
  }
}

const controls = /[\u0000-\u001f\u007f-\u009f]/;

function normalizeResourceQuickLinkUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || controls.test(value)) {
    throw new ResourceQuickLinkError(400, '请输入不超过 2048 个字符的完整 HTTP 或 HTTPS 链接。');
  }
  const input = value.trim();
  if (!/^https?:\/\//i.test(input) || input.includes('\\')) {
    throw new ResourceQuickLinkError(400, '链接必须以 http:// 或 https:// 开头。');
  }
  let url;
  try { url = new URL(input); } catch {
    throw new ResourceQuickLinkError(400, '链接格式不正确。');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new ResourceQuickLinkError(400, '链接必须包含有效域名，且不能包含账号或密码。');
  }
  const normalized = url.href;
  if (normalized.length > 2048) throw new ResourceQuickLinkError(400, '链接不能超过 2048 个字符。');
  return normalized;
}

function parseResourceQuickLink(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['name', 'url', 'description'].includes(key))) {
    throw new ResourceQuickLinkError(400, '只接受链接名称、地址和简介。');
  }
  if (typeof body.name !== 'string' || controls.test(body.name) || !body.name.trim() || body.name.trim().length > 60) {
    throw new ResourceQuickLinkError(400, '链接名称需要填写，且不能超过 60 个字符。');
  }
  if (body.description !== undefined && (typeof body.description !== 'string' ||
      controls.test(body.description) || body.description.trim().length > 160)) {
    throw new ResourceQuickLinkError(400, '链接简介不能超过 160 个字符。');
  }
  return { name: body.name.trim(), url: normalizeResourceQuickLinkUrl(body.url), description: body.description?.trim() || '' };
}

module.exports = { DEFAULT_RESOURCE_QUICK_LINKS, ResourceQuickLinkError, normalizeResourceQuickLinkUrl, parseResourceQuickLink };
