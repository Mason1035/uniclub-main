const express = require('express');
const authenticateToken = require('../middleware/auth');
const { searchContent, MAX_QUERY_LENGTH } = require('../services/GlobalSearchService');
const router = express.Router();

// Search is a member feature, just like its Header entry point. Reuse JWT
// verification (including tokenVersion); never expose private snippets to guests.
router.get('/', authenticateToken, async (req, res) => {
  const q = req.query.q ?? '';
  if (typeof q !== 'string' || q.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ success: false, error: '请输入不超过 200 个字符的关键词。' });
  }
  res.set('Cache-Control', 'private, no-store');
  try {
    const result = await searchContent(q, { userId: req.user.userId, limit: req.query.limit });
    return res.json({ success: true, query: q.trim(), ...result });
  } catch (error) {
    // No document bodies, credentials or database error details.
    console.error('Global search failed:', error.name);
    return res.status(500).json({ success: false, error: '搜索暂时不可用，请稍后重试。' });
  }
});

module.exports = router;
