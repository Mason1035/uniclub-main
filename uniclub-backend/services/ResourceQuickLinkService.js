const { DEFAULT_RESOURCE_QUICK_LINKS, ResourceQuickLinkError, parseResourceQuickLink } = require('../utils/resourceQuickLinks');

const metadata = row => ({ id: String(row._id), name: row.name, url: row.url, description: row.description || '', isDefault: false });

class ResourceQuickLinkService {
  constructor(repository) { this.repository = repository; }

  async list() {
    return [...DEFAULT_RESOURCE_QUICK_LINKS.map(link => ({ ...link })), ...(await this.repository.list()).map(metadata)];
  }

  async create(body, admin) {
    const fields = parseResourceQuickLink(body);
    if (DEFAULT_RESOURCE_QUICK_LINKS.some(link => link.url === fields.url) || await this.repository.findByUrl(fields.url)) {
      throw new ResourceQuickLinkError(409, '这个链接已经存在。');
    }
    try { return metadata(await this.repository.create({ ...fields, createdBy: admin })); } catch (error) {
      if (error.code === 11000) throw new ResourceQuickLinkError(409, '这个链接已经存在。');
      throw error;
    }
  }

  async delete(id) {
    if (DEFAULT_RESOURCE_QUICK_LINKS.some(link => link.id === id)) {
      throw new ResourceQuickLinkError(403, '默认链接不能删除。');
    }
    if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
      throw new ResourceQuickLinkError(400, '链接编号无效。');
    }
    if (!await this.repository.delete(id)) throw new ResourceQuickLinkError(404, '链接不存在。');
  }
}

module.exports = ResourceQuickLinkService;
