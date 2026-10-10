// Crawling directives do not replace authentication. Keep APIs and uploaded
// member media out of indexes without changing how existing clients fetch them.
function privateResponseHeaders(_req, res, next) {
  res.set({ 'X-Robots-Tag': 'noindex, nofollow, nosnippet', 'Cache-Control': 'private, no-store' });
  res.vary('Authorization');
  next();
}

module.exports = privateResponseHeaders;
