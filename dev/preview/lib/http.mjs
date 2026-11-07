// HTTP helpers for the preview server: cookies, body parsing (urlencoded, JSON,
// multipart), nested-key decoding (Rails/Shopify style), static files with ranges.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------- opt-in compression (PERF-07; `server.mjs --compress`) ----------
// Off by default so byte-level tests keep seeing raw bodies. On: text responses are brotli/gzip
// encoded like the Shopify CDN, and /cdn/ assets get the CDN's immutable cache header.
const COMPRESSION = { on: false };
export function setCompression(on) { COMPRESSION.on = !!on; }
export const compressionEnabled = () => COMPRESSION.on;
const COMPRESSIBLE = /^(text\/|application\/(json|javascript)|image\/svg\+xml)/;
const fileCache = new Map(); // `${enc}:${file}:${mtime}` -> Buffer
function pickEncoding(res) {
  const ae = String(res.req?.headers?.['accept-encoding'] || '');
  if (/\bbr\b/.test(ae)) return 'br';
  if (/\bgzip\b/.test(ae)) return 'gzip';
  return null;
}
function encode(buf, enc, quality) {
  return enc === 'br'
    ? zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: quality, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } })
    : zlib.gzipSync(buf, { level: quality >= 9 ? 9 : 6 });
}

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
  '.glb': 'model/gltf-binary', '.vtt': 'text/vtt',
};

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}

export function cookieHeader(name, value, { maxAge, clear = false } = {}) {
  if (clear) return `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${maxAge ? `; Max-Age=${maxAge}` : ''}`;
}

/** Decode `a[b][]=1` style pairs into nested objects/arrays. */
export function nestPairs(pairs) {
  const root = {};
  for (const [rawKey, value] of pairs) {
    const m = rawKey.match(/^([^[\]]+)((?:\[[^\]]*\])*)$/);
    if (!m) { root[rawKey] = value; continue; }
    const keys = [m[1], ...[...m[2].matchAll(/\[([^\]]*)\]/g)].map((x) => x[1])];
    let node = root;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const last = i === keys.length - 1;
      const nextKey = keys[i + 1];
      if (last) {
        if (k === '') node.push(value);
        else if (Array.isArray(node) && /^\d+$/.test(k)) node[+k] = value;
        else node[k] = value;
      } else {
        const wantArray = nextKey === ''; // `a[0][id]` stays an object keyed '0' (callers use Object.values)
        let child;
        if (k === '') {
          // `a[][b]` — push a new object unless the last one lacks this key
          const lastEl = node[node.length - 1];
          if (lastEl && typeof lastEl === 'object' && !(nextKey in lastEl)) child = lastEl;
          else { child = wantArray ? [] : {}; node.push(child); }
        } else {
          child = node[k];
          if (child == null || typeof child !== 'object') { child = wantArray ? [] : {}; node[k] = child; }
        }
        node = child;
      }
    }
  }
  return root;
}

export function parseQueryPairs(str) {
  const pairs = [];
  for (const [k, v] of new URLSearchParams(str)) pairs.push([k, v]);
  return pairs;
}

export async function readBody(req, limit = 5 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('body too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(buf, boundary) {
  const pairs = [];
  const delim = Buffer.from(`--${boundary}`);
  let start = buf.indexOf(delim);
  while (start >= 0) {
    start += delim.length;
    if (buf[start] === 45 && buf[start + 1] === 45) break; // closing --
    if (buf[start] === 13) start += 2;
    const headEnd = buf.indexOf('\r\n\r\n', start);
    if (headEnd < 0) break;
    const head = buf.slice(start, headEnd).toString('utf8');
    const next = buf.indexOf(delim, headEnd + 4);
    if (next < 0) break;
    const body = buf.slice(headEnd + 4, next - 2); // strip trailing \r\n
    const name = /name="([^"]*)"/i.exec(head)?.[1];
    const isFile = /filename="/i.test(head);
    if (name != null && !isFile) pairs.push([name, body.toString('utf8')]);
    start = next;
  }
  return pairs;
}

/** Returns { pairs, data, json } where data is the nested form/JSON object. */
export async function parseBody(req) {
  const buf = await readBody(req);
  const type = (req.headers['content-type'] || '').toLowerCase();
  if (!buf.length) return { pairs: [], data: {}, json: false };
  if (type.includes('application/json')) {
    try { return { pairs: [], data: JSON.parse(buf.toString('utf8')) || {}, json: true }; }
    catch { return { pairs: [], data: {}, json: true, invalid: true }; }
  }
  if (type.includes('multipart/form-data')) {
    const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(req.headers['content-type']);
    const pairs = boundary ? parseMultipart(buf, boundary[1] || boundary[2]) : [];
    return { pairs, data: nestPairs(pairs), json: false };
  }
  const pairs = parseQueryPairs(buf.toString('utf8'));
  return { pairs, data: nestPairs(pairs), json: false };
}

export function send(res, status, body, headers = {}) {
  if (res.headersSent) return;
  if (COMPRESSION.on && status === 200 && body != null) {
    const type = String(headers['Content-Type'] || headers['content-type'] || '');
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    const enc = COMPRESSIBLE.test(type) && buf.length > 512 ? pickEncoding(res) : null;
    if (enc) {
      const out = encode(buf, enc, 5); // dynamic HTML/JSON: fast quality, as an edge would use
      res.writeHead(status, { ...headers, 'Content-Encoding': enc, Vary: 'Accept-Encoding', 'Content-Length': out.length });
      res.end(out);
      return;
    }
  }
  res.writeHead(status, headers);
  res.end(body);
}

export function sendJSON(res, status, obj, extra = {}) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
}

export function redirect(res, location, extra = {}) {
  send(res, 302, '', { Location: location, 'Cache-Control': 'no-store', ...extra });
}

/** Serve a file with correct MIME, ETag-less caching and byte ranges (needed by <video>). */
export function serveFile(req, res, file, { log } = {}) {
  let stat;
  try { stat = fs.statSync(file); } catch { stat = null; }
  if (!stat || !stat.isFile()) {
    log?.(`404 static ${req.url}`);
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=60', 'Last-Modified': stat.mtime.toUTCString() };
  if (COMPRESSION.on) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  const range = req.headers.range;
  const enc = COMPRESSION.on && !range && COMPRESSIBLE.test(type) && stat.size > 512 ? pickEncoding(res) : null;
  if (enc) {
    const key = `${enc}:${file}:${stat.mtimeMs}`;
    let out = fileCache.get(key);
    if (!out) { out = encode(fs.readFileSync(file), enc, 11); fileCache.set(key, out); }
    res.writeHead(200, { ...headers, 'Content-Encoding': enc, Vary: 'Accept-Encoding', 'Content-Length': out.length });
    return res.end(req.method === 'HEAD' ? undefined : out);
  }
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let startB = m && m[1] !== '' ? parseInt(m[1], 10) : null;
    let endB = m && m[2] !== '' ? parseInt(m[2], 10) : null;
    if (startB == null && endB != null) { startB = Math.max(0, stat.size - endB); endB = stat.size - 1; }
    if (startB == null) startB = 0;
    if (endB == null || endB >= stat.size) endB = stat.size - 1;
    if (!m || startB > endB || startB >= stat.size) {
      send(res, 416, '', { 'Content-Range': `bytes */${stat.size}` });
      return;
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${startB}-${endB}/${stat.size}`, 'Content-Length': endB - startB + 1 });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file, { start: startB, end: endB }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

export function escapeHTML(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
