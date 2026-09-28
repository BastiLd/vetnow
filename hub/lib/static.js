/* VetNow Hub — liefert die gebaute Web-App (web/dist) unter /vetnow/ aus.

   - SPA-Fallback: Unbekannte Pfade OHNE Dateiendung (z. B. /vetnow/praxis/drautal aus alten Links)
     bekommen index.html, damit der Router der App übernimmt. Fehlende Dateien MIT Endung
     (z. B. /vetnow/assets/alt-123.js) bekommen ehrlich 404 — sonst lädt der Browser HTML als
     JavaScript und meldet einen kryptischen MIME-Fehler.
   - Caching: index.html und sw.js immer frisch prüfen (no-cache), sonst hängt das Handy nach einem
     Update an der alten Version. Gehashte Dateien in assets/ ändern nie ihren Inhalt → 1 Jahr.
   - Sicherheit: Jeder Pfad wird normalisiert und muss im dist-Ordner bleiben (kein '../'). */
import { createReadStream, promises as fsp } from 'node:fs';
import path from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.zip': 'application/zip',
};

const NO_CACHE = new Set(['index.html', 'sw.js', 'service-worker.js', 'registerSW.js', 'manifest.webmanifest', 'version.json']);
const HASHED = /[.-][A-Za-z0-9_-]{8,}\.(js|mjs|css|woff2?|ttf|png|jpe?g|svg|webp|avif|gif|ico|wasm)$/;

export function createStatic({ root, prefix = '/vetnow' }) {
  const base = path.resolve(root);

  function cacheControl(rel) {
    const name = path.basename(rel);
    if (NO_CACHE.has(name) || name.endsWith('.html')) return 'no-cache';
    if (rel.split(/[\\/]/)[0] === 'assets' || HASHED.test(name)) return 'public, max-age=31536000, immutable';
    return 'public, max-age=3600';
  }

  async function sendFile(req, res, abs, rel) {
    const st = await fsp.stat(abs);
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': cacheControl(rel),
      ETag: etag,
      'Last-Modified': st.mtime.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': headers['Cache-Control'] });
      res.end();
      return;
    }
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    await new Promise((resolve) => {
      const s = createReadStream(abs);
      s.on('error', () => { res.destroy(); resolve(); });
      s.on('end', resolve);
      s.pipe(res);
    });
  }

  const plain = (res, status, text) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(text);
  };

  async function isFile(abs) {
    try { return (await fsp.stat(abs)).isFile(); } catch { return false; }
  }

  /* true = Anfrage wurde beantwortet. */
  async function handle(req, res, pathname) {
    if (pathname === prefix) { res.writeHead(302, { Location: prefix + '/' }); res.end(); return true; }
    if (!pathname.startsWith(prefix + '/')) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') { plain(res, 405, 'Methode nicht erlaubt.'); return true; }

    let rel;
    try { rel = decodeURIComponent(pathname.slice(prefix.length + 1)); } catch { plain(res, 400, 'Ungültiger Pfad.'); return true; }
    if (rel.includes('\0')) { plain(res, 400, 'Ungültiger Pfad.'); return true; }
    const abs = path.resolve(base, '.' + path.sep + rel);
    if (abs !== base && !abs.startsWith(base + path.sep)) { plain(res, 403, 'Zugriff verweigert.'); return true; }

    if (rel === '' || rel.endsWith('/')) {
      const idx = path.join(abs, 'index.html');
      if (await isFile(idx)) { await sendFile(req, res, idx, path.relative(base, idx)); return true; }
    } else if (await isFile(abs)) {
      await sendFile(req, res, abs, path.relative(base, abs));
      return true;
    }

    // SPA-Fallback nur für „Seiten", nicht für fehlende Dateien mit Endung.
    const wantsHtml = !path.extname(rel) || String(req.headers.accept || '').includes('text/html');
    const index = path.join(base, 'index.html');
    if (wantsHtml && await isFile(index)) { await sendFile(req, res, index, 'index.html'); return true; }
    plain(res, 404, 'Datei nicht gefunden.');
    return true;
  }

  return { handle, root: base };
}
