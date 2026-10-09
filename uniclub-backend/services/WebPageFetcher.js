const dns = require('node:dns').promises;
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const { JSDOM, VirtualConsole } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { AiError } = require('../utils/aiSecret');
const { clip, plainText } = require('../utils/newsAiContext');
const { safeWebUrl, publicAddress } = require('../utils/webSafety');

const unavailable = () => new AiError('SOURCE_FETCH_UNAVAILABLE', '暂时无法读取来源正文。', 502);
const blocked = () => new AiError('SOURCE_URL_BLOCKED', '来源网站解析到非公开网络，已停止读取。', 502);
const htmlTypes = ['text/html', 'application/xhtml+xml'];
const fakeAddress = address => net.isIP(address) === 4 && /^198\.(18|19)\./.test(address);
const bounded = (value, fallback, limit) => Number.isFinite(value) && value > 0 ? Math.min(limit, value) : fallback;

class WebPageFetcher {
  constructor({ lookup = dns.lookup.bind(dns), publicLookup, request } = {}) {
    this.lookup = lookup;
    this.request = request || ((url, options, response) => (url.protocol === 'https:' ? https : http).request(url, options, response));
    this.publicLookup = publicLookup || ((host, { signal }) => this.lookupPublic(host, signal));
  }

  async fetchPage(value, { signal, timeoutMs = 10000, maxBytes = 768 * 1024, textBytes = 24576 } = {}) {
    const page = await this.fetchDocument(value, { signal, timeoutMs, maxBytes });
    // External CSS is irrelevant to extracted article text. An isolated console
    // also prevents jsdom CSS diagnostics from dumping remote page data in logs.
    const dom = new JSDOM(page.text, { url: page.url, virtualConsole: new VirtualConsole() });
    try {
      // jsdom's default options never run scripts or fetch subresources.
      const metadata = dom.window.document.querySelector('meta[property="article:published_time"], meta[name="date"], meta[name="pubdate"]')?.getAttribute('content');
      const article = new Readability(dom.window.document, { charThreshold: 120 }).parse();
      if (!article?.textContent?.trim()) throw unavailable();
      const date = metadata && new Date(metadata);
      return {
        url: page.url, title: clip(plainText(article.title), 600),
        text: clip(plainText(article.textContent), bounded(textBytes, 24576, 32768)),
        publishedAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
      };
    } catch (error) {
      if (error instanceof AiError) throw error;
      throw unavailable();
    } finally { dom.window.close(); }
  }

  // Feeds and article pages share exactly the same URL, DNS, redirect and byte
  // protections. Callers supply a narrow MIME allowlist for their document type.
  async fetchDocument(value, { signal, timeoutMs = 10000, maxBytes = 768 * 1024,
    accept = 'text/html,application/xhtml+xml', mimeTypes = htmlTypes } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, bounded(timeoutMs, 10000, 15000)); timer.unref?.();
    // Every redirect is validated/resolved afresh; the socket lookup is pinned
    // to an already validated address so DNS rebinding cannot reach private IPs.
    try {
      let url = safeWebUrl(value);
      for (let hop = 0; hop <= 3; hop++) {
        if (controller.signal.aborted) throw unavailable();
        const host = url.hostname.replace(/^\[|\]$/g, '');
        const addresses = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] :
          await this.resolve(host, controller.signal);
        if (!Array.isArray(addresses) || !addresses.length || addresses.some(item => !publicAddress(item?.address))) throw blocked();
        const selected = addresses[0];
        const page = await this.read(url, selected, controller.signal, bounded(maxBytes, 768 * 1024, 1024 * 1024), { accept, mimeTypes });
        if (page.redirect) { url = safeWebUrl(new URL(page.redirect, url).href); continue; }
        return { url: url.href, text: page.text, contentType: page.contentType };
      }
      throw unavailable();
    } catch (error) {
      if (signal?.aborted) throw new AiError('CANCELLED', '请求已取消。', 499);
      if (error instanceof AiError) throw error;
      // Request errors contain URLs/socket internals; never expose/log them.
      throw unavailable();
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }

  async resolve(host, signal) {
    let rejectAbort;
    const aborted = new Promise((_resolve, reject) => { rejectAbort = reject; });
    const cancel = () => rejectAbort(unavailable());
    signal.addEventListener('abort', cancel, { once: true });
    try {
      if (signal.aborted) throw unavailable();
      const addresses = await Promise.race([this.lookup(host, { all: true, verbatim: true }), aborted]);
      // Some local proxies return fake-IP benchmark addresses for every public
      // domain. Never permit those sockets. Only that specific all-fake answer
      // permits re-resolution through a trusted public resolver; ordinary
      // private/mixed answers keep the existing fail-closed behavior.
      if (Array.isArray(addresses) && addresses.length && addresses.every(item => fakeAddress(item?.address))) {
        return await Promise.race([this.publicLookup(host, { signal }), aborted]);
      }
      return addresses;
    } finally { signal.removeEventListener('abort', cancel); }
  }

  async lookupPublic(host, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) controller.abort();
    const timer = setTimeout(abort, 3000); timer.unref?.();
    try {
      // Fixed HTTPS resolver + public bootstrap socket; TLS still verifies
      // cloudflare-dns.com. Do not recursively trust system fake-IP DNS here.
      const url = new URL('https://cloudflare-dns.com/dns-query');
      url.searchParams.set('name', host); url.searchParams.set('type', 'A');
      const response = await this.read(url, { address: '1.1.1.1', family: 4 }, controller.signal, 16 * 1024,
        { accept: 'application/dns-json', mimeTypes: ['application/dns-json', 'application/json'] });
      if (response.redirect) throw unavailable();
      const data = JSON.parse(response.text);
      if (data.Status !== 0 || !Array.isArray(data.Answer) || data.Answer.length > 64) throw unavailable();
      const addresses = data.Answer.filter(answer => answer.type === 1).map(answer => ({ address: answer.data, family: 4 }));
      if (!addresses.length || addresses.some(item => net.isIP(item.address) !== 4 || !publicAddress(item.address))) throw blocked();
      return addresses;
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  }

  read(url, address, signal, maxBytes, { accept, mimeTypes }) {
    return new Promise((resolve, reject) => {
      let req, response, settled = false;
      const finish = (error, value) => {
        if (settled) return; settled = true;
        signal.removeEventListener('abort', cancel);
        if (error) { response?.destroy(); req?.destroy(); reject(error); }
        else resolve(value);
      };
      const cancel = () => finish(unavailable());
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) return cancel();
      req = this.request(url, {
        method: 'GET', agent: false,
        headers: { 'User-Agent': 'ClassHub-Source-Reader/1.0', Accept: accept, 'Accept-Encoding': 'identity' },
        lookup(_hostname, options, callback) {
          // Node may request all:true (autoSelectFamily). Preserve that contract.
          if (options?.all) callback(null, [{ address: address.address, family: address.family }]);
          else callback(null, address.address, address.family);
        },
      }, res => {
        response = res;
        if (settled) { res.destroy(); return; }
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const location = res.headers.location;
          res.destroy(); finish(location ? null : unavailable(), { redirect: location }); return;
        }
        const type = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const encoding = String(res.headers['content-encoding'] || 'identity').toLowerCase();
        if (res.statusCode !== 200 || !mimeTypes.includes(type) ||
            encoding !== 'identity' || Number(res.headers['content-length'] || 0) > maxBytes) {
          finish(unavailable()); return;
        }
        let bytes = 0; const chunks = [];
        res.on('data', chunk => {
          bytes += chunk.byteLength;
          if (bytes > maxBytes) return finish(unavailable());
          chunks.push(chunk);
        });
        res.on('end', () => finish(null, { text: Buffer.concat(chunks).toString('utf8'), contentType: type }));
        res.on('aborted', () => finish(unavailable()));
        res.on('error', () => finish(unavailable()));
      });
      req.on('error', () => finish(unavailable()));
      req.end();
    });
  }
}

module.exports = WebPageFetcher;
