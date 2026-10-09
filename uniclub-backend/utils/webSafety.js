const net = require('node:net');
const { AiError } = require('./aiSecret');

// Only ordinary public HTTP(S) pages may become a citation or fetched source.
// URL parses/normalizes unusual IPv4 spellings before these checks run.
function publicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (family === 6) {
    const text = address.toLowerCase();
    // Require native global unicast. Reject mapped IPv4, link local, ULA,
    // multicast, documentation, Teredo and 6to4 transition networks.
    const parts = text.split(':');
    const first = parseInt(parts[0], 16), second = parseInt(parts[1] || '0', 16);
    return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && first !== 0x3fff &&
      !(first === 0x2001 && (second === 0 || second === 2 || second === 0xdb8 || (second >= 0x10 && second <= 0x2f)));
  }
  return false;
}

function safeWebUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new AiError('SOURCE_URL_BLOCKED', '来源地址无效。', 502); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80')) ||
      !host.includes('.') && net.isIP(host) === 0 ||
      /(?:^|\.)(?:localhost|local|internal|home|lan|invalid|test)$/.test(host) ||
      (net.isIP(host) && !publicAddress(host))) {
    throw new AiError('SOURCE_URL_BLOCKED', '来源地址不属于可访问的公开网站。', 502);
  }
  url.hash = '';
  return url;
}

module.exports = { publicAddress, safeWebUrl };
