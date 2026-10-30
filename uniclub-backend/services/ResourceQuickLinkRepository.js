const ResourceQuickLink = require('../models/ResourceQuickLink');
const META = '_id name url description';

class ResourceQuickLinkRepository {
  list() { return ResourceQuickLink.find({}).select(META).sort({ createdAt: 1, _id: 1 }).lean(); }
  findByUrl(url) { return ResourceQuickLink.findOne({ url }).select('_id').lean(); }
  async create(fields) {
    // The unique index also protects simultaneous requests after validation.
    await ResourceQuickLink.init();
    return ResourceQuickLink.create(fields);
  }
  delete(id) { return ResourceQuickLink.findByIdAndDelete(id).select(META).lean(); }
}

module.exports = ResourceQuickLinkRepository;
