/* VetNow Hub — Anhänge (Bilder, PDFs …) als Dateien statt als riesige data:-URLs im JSON.

   Ablage: <dataDir>/files/<id> (Inhalt) + <id>.json (Metadaten: Name, MIME, Größe, SHA-256).
   Die ID wird vom Hub erzeugt und streng geprüft (nur [A-Za-z0-9_-]) — ein Client kann also
   niemals einen Pfad wie '../state.json' unterschieben. */
import { createReadStream, promises as fsp } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { atomicWrite } from './store.js';
import { HttpError, FILE_LIMIT } from './http.js';

export const FILE_ID_RX = /^f-[a-z0-9]{6,40}$/;

/* MIME-Typen, die der Browser gefahrlos direkt anzeigen darf. Alles andere (HTML, SVG, JS …)
   wird als Download mit Sandbox-CSP ausgeliefert — sonst könnte ein hochgeladenes HTML auf
   derselben Herkunft wie die Web-App Skripte ausführen (Stored XSS). */
const INLINE_SAFE = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|application\/pdf|text\/plain|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+)$/i;

const cleanMime = (m) => {
  const v = String(m || '').split(';')[0].trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(v) ? v : 'application/octet-stream';
};

const cleanName = (n) => {
  let s = String(n || '');
  try { s = decodeURIComponent(s); } catch { /* Name war nicht kodiert */ }
  // Keine Pfadanteile, keine Steuerzeichen — der Name ist nur Anzeige und Download-Vorschlag.
  s = s.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (s || 'anhang').slice(0, 160);
};

export function createFileStore({ dataDir, now = () => Date.now(), limit = FILE_LIMIT }) {
  const dir = path.join(dataDir, 'files');
  let ready = null;
  const ensure = () => (ready ||= fsp.mkdir(dir, { recursive: true }));

  const paths = (id) => {
    if (!FILE_ID_RX.test(id)) throw new HttpError(400, 'Ungültige Datei-ID.', 'bad-id');
    const bin = path.join(dir, id);
    // Doppelte Absicherung: Pfad muss im files-Ordner liegen.
    if (path.dirname(bin) !== dir) throw new HttpError(400, 'Ungültige Datei-ID.', 'bad-id');
    return { bin, meta: bin + '.json' };
  };

  async function save(buf, { mime, name } = {}) {
    if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf || '');
    if (buf.length > limit) throw new HttpError(413, `Datei zu groß (max. ${Math.round(limit / 1024 / 1024)} MB).`, 'too-large');
    await ensure();
    const id = 'f-' + Date.now().toString(36) + randomBytes(6).toString('hex');
    const p = paths(id);
    const meta = {
      id, name: cleanName(name), mime: cleanMime(mime), size: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'), createdAt: now(),
    };
    await atomicWrite(p.bin, buf);
    await atomicWrite(p.meta, JSON.stringify(meta));
    return meta;
  }

  async function stat(id) {
    const p = paths(id);
    try {
      return JSON.parse(await fsp.readFile(p.meta, 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  async function read(id) {
    const meta = await stat(id);
    if (!meta) return null;
    return { meta, data: await fsp.readFile(paths(id).bin) };
  }

  /* Datei an eine HTTP-Antwort streamen (spart RAM bei großen Anhängen). */
  async function stream(id, req, res) {
    const meta = await stat(id);
    if (!meta) throw new HttpError(404, 'Datei nicht gefunden.', 'not-found');
    const safe = INLINE_SAFE.test(meta.mime);
    const fname = encodeURIComponent(meta.name);
    const headers = {
      'Content-Type': meta.mime,
      'Content-Length': meta.size,
      'Cache-Control': 'public, max-age=31536000, immutable', // Inhalt zu einer ID ändert sich nie
      ETag: '"' + meta.sha256.slice(0, 32) + '"',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `${safe ? 'inline' : 'attachment'}; filename*=UTF-8''${fname}`,
    };
    if (!safe) headers['Content-Security-Policy'] = "sandbox; default-src 'none'";
    if (req.headers['if-none-match'] === headers.ETag) {
      res.writeHead(304, { ETag: headers.ETag, 'Cache-Control': headers['Cache-Control'] });
      res.end();
      return meta;
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return meta; }
    await new Promise((resolve, reject) => {
      const s = createReadStream(paths(id).bin);
      s.on('error', (e) => { res.destroy(e); reject(e); });
      s.on('end', resolve);
      s.pipe(res);
    });
    return meta;
  }

  async function remove(id) {
    const p = paths(id);
    await fsp.rm(p.bin, { force: true });
    await fsp.rm(p.meta, { force: true });
  }

  async function list() {
    await ensure();
    const names = await fsp.readdir(dir);
    return names.filter((n) => FILE_ID_RX.test(n));
  }

  /* Dateien löschen, auf die keine Nachricht mehr zeigt (nach Reset/Import). */
  async function prune(referenced) {
    const keep = new Set(referenced);
    let removed = 0;
    for (const id of await list()) {
      if (!keep.has(id)) { await remove(id); removed++; }
    }
    return removed;
  }

  return { dir, save, stat, read, stream, remove, list, prune, limit, paths };
}

/* Alle 'hub:<id>'-Verweise im Zustand einsammeln. */
export function referencedFileIds(state) {
  const ids = [];
  for (const c of state.chats || []) {
    for (const m of c.messages || []) {
      const ref = m && m.attachment && m.attachment.ref;
      if (typeof ref === 'string' && ref.startsWith('hub:')) ids.push(ref.slice(4));
    }
  }
  return ids;
}
