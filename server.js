#!/usr/bin/env node
// Meme generator — tiny zero-dependency Node server.
// Serves the editor (random base image + Impact-style meme captions) and an
// /overview gallery that collects every meme visitors save. Saved memes are
// PNGs written to DATA_DIR (a dokploy volume mounted at /data in production).

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const BASE_DIR = path.join(PUBLIC_DIR, 'base');
// Persistent storage for saved memes. In production a volume is mounted here.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MEMES_DIR = path.join(DATA_DIR, 'memes');
// Optional moderation token: if set, deleting a meme requires ?token=...
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

// --- helpers ---------------------------------------------------------------

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req, limitBytes = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function ensureDirs() {
  try { fs.mkdirSync(MEMES_DIR, { recursive: true }); } catch (_) {}
}

function validId(id) { return /^[A-Za-z0-9_-]{6,80}$/.test(id); }
function memeMetaPath(id) { return path.join(MEMES_DIR, id + '.json'); }
function memePngPath(id) { return path.join(MEMES_DIR, id + '.png'); }

// List the bundled base images (the random pool).
function listBaseImages() {
  try {
    return fs.readdirSync(BASE_DIR)
      .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
      .sort();
  } catch (_) {
    return [];
  }
}

// List saved memes, newest first.
function listMemes() {
  ensureDirs();
  return fs.readdirSync(MEMES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(MEMES_DIR, f), 'utf8')); }
      catch (_) { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function adminOK(req) {
  if (!ADMIN_TOKEN) return true;
  const tok = req.headers['x-admin-token']
    || new URL(req.url, 'http://x').searchParams.get('token') || '';
  return tok === ADMIN_TOKEN;
}

// --- static files ----------------------------------------------------------

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath === '/overview' || urlPath === '/overview/') urlPath = '/overview.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // base images & fonts are immutable — let the browser cache them
    if (urlPath.startsWith('/base/') || urlPath.startsWith('/fonts/')) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

// --- router ----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url.split('?')[0];

    // random base image pool
    if (req.method === 'GET' && url === '/api/base-images') {
      return sendJSON(res, 200, { images: listBaseImages() });
    }

    // visitor saves a finished meme
    if (req.method === 'POST' && url === '/api/memes') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (!body.image) return sendJSON(res, 400, { ok: false, error: 'image required' });
      const png = Buffer.from(String(body.image).replace(/^data:image\/\w+;base64,/, ''), 'base64');
      if (!png.length) return sendJSON(res, 400, { ok: false, error: 'empty image' });
      // PNG magic number guard
      if (!(png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47)) {
        return sendJSON(res, 400, { ok: false, error: 'not a PNG' });
      }
      ensureDirs();
      const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      fs.writeFileSync(memePngPath(id), png);
      const meta = {
        id,
        base: String(body.base || '').slice(0, 200),
        w: Number(body.w) || null,
        h: Number(body.h) || null,
        bytes: png.length,
        createdAt: Date.now(),
      };
      fs.writeFileSync(memeMetaPath(id), JSON.stringify(meta));
      return sendJSON(res, 200, { ok: true, id });
    }

    // gallery list
    if (req.method === 'GET' && url === '/api/memes') {
      return sendJSON(res, 200, { ok: true, memes: listMemes() });
    }

    // serve one saved meme PNG
    if (req.method === 'GET' && /^\/api\/memes\/[^/]+\/png$/.test(url)) {
      const id = url.split('/')[3];
      if (!validId(id) || !fs.existsSync(memePngPath(id))) { res.writeHead(404); return res.end('not found'); }
      const data = fs.readFileSync(memePngPath(id));
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': data.length, 'Cache-Control': 'public, max-age=31536000, immutable' });
      return res.end(data);
    }

    // moderation: delete a meme (open unless ADMIN_TOKEN is set)
    if (req.method === 'POST' && /^\/api\/memes\/[^/]+\/delete$/.test(url)) {
      if (!adminOK(req)) return sendJSON(res, 401, { ok: false, error: 'unauthorized' });
      const id = url.split('/')[3];
      if (!validId(id)) return sendJSON(res, 400, { ok: false, error: 'bad id' });
      try { fs.unlinkSync(memePngPath(id)); } catch (_) {}
      try { fs.unlinkSync(memeMetaPath(id)); } catch (_) {}
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url === '/api/config') {
      return sendJSON(res, 200, { moderation: !!ADMIN_TOKEN });
    }

    if (url.startsWith('/api/')) return sendJSON(res, 404, { ok: false, error: 'unknown endpoint' });

    return serveStatic(req, res);
  } catch (e) {
    return sendJSON(res, 500, { ok: false, error: String((e && e.message) || e) });
  }
});

ensureDirs();
server.listen(PORT, HOST, () => {
  console.log(`\n  Meme generator running → http://localhost:${PORT}  (bind ${HOST}:${PORT})`);
  console.log(`  base images: ${listBaseImages().length}   data dir: ${DATA_DIR}\n`);
});
