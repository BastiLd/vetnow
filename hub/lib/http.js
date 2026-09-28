/* VetNow Hub — HTTP-Grundbausteine: Fehler, JSON-Antworten, CORS, Body lesen, Router.
   Absichtlich ohne Express: Der Hub soll mit reinem Node laufen UND als Handler ins Studio
   (Express) einhängbar sein. Deshalb funktioniert alles hier mit nackten req/res-Objekten. */

export const JSON_LIMIT = 12 * 1024 * 1024; // 12 MB: Bilder können als data:-URL im JSON stecken
export const FILE_LIMIT = 10 * 1024 * 1024; // 10 MB: Anhänge laut Vertrag

/* Fehler mit HTTP-Status + maschinenlesbarem Code. Die Meldung ist deutsch und für Menschen. */
export class HttpError extends Error {
  constructor(status, message, code = 'error', extra = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (msg, code = 'bad-request', extra) => new HttpError(400, msg, code, extra);
export const notFound = (msg = 'Nicht gefunden.', code = 'not-found') => new HttpError(404, msg, code);

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-vn-client, x-vn-admin, x-filename, last-event-id, authorization',
  // Chrome blockiert Anfragen von öffentlichen Seiten (z. B. GitHub Pages) an private Adressen
  // (192.168.x.x), wenn der Server das nicht ausdrücklich erlaubt (Private Network Access).
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Max-Age': '600',
};

export function applyCors(res) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
}

export function sendJson(res, status, body, headers = {}) {
  if (res.headersSent || res.writableEnded) return;
  const data = Buffer.from(JSON.stringify(body === undefined ? null : body), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(data);
}

export function sendError(res, err) {
  const status = err && err.status ? err.status : 500;
  const body = {
    error: (err && err.status && err.message) || 'Interner Fehler im Hub.',
    code: (err && err.code) || 'internal',
    ...(err && err.extra ? err.extra : {}),
  };
  sendJson(res, status, body, err && err.closeConnection ? { Connection: 'close' } : {});
}

/* Hat ein vorgeschaltetes Framework (Express + body-parser) den Body schon gelesen?
   body-parser setzt `req._body = true`. Ohne diese Prüfung würden wir auf einen bereits
   leeren Stream warten und die Anfrage hinge für immer. */
function bodyAlreadyRead(req) {
  return req.body !== undefined && (req._body === true || req.readableEnded === true);
}

/* Rohen Body als Buffer lesen, mit Größenlimit.
   Ist der angekündigte Body viel zu groß, brechen wir sofort ab (Connection: close).
   Knapp zu große Bodies lesen wir noch zu Ende und verwerfen sie, damit der Client die
   413-Antwort sauber lesen kann statt eines Verbindungsabbruchs. */
export function readRaw(req, limit) {
  if (bodyAlreadyRead(req)) {
    const b = req.body;
    let buf;
    if (Buffer.isBuffer(b)) buf = b;
    else if (typeof b === 'string') buf = Buffer.from(b, 'utf8');
    else if (b == null) buf = Buffer.alloc(0);
    else buf = Buffer.from(JSON.stringify(b), 'utf8');
    if (buf.length > limit) return Promise.reject(tooLarge(limit));
    return Promise.resolve(buf);
  }
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit * 4) {
      const e = tooLarge(limit);
      e.closeConnection = true;
      req.resume();
      reject(e);
      return;
    }
    const chunks = [];
    let size = 0;
    let over = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { over = true; chunks.length = 0; return; }
      if (!over) chunks.push(c);
    });
    req.on('end', () => (over ? reject(tooLarge(limit)) : resolve(Buffer.concat(chunks))));
    req.on('error', (e) => reject(new HttpError(400, 'Anfrage konnte nicht gelesen werden: ' + e.message, 'bad-body')));
    req.on('aborted', () => reject(new HttpError(400, 'Anfrage wurde abgebrochen.', 'aborted')));
  });
}

function tooLarge(limit) {
  return new HttpError(413, `Die Anfrage ist zu groß (max. ${Math.round(limit / 1024 / 1024)} MB).`, 'too-large');
}

/* JSON-Body lesen. Leerer Body → {}. Kaputtes JSON → 400 (nie 500). */
export async function readJson(req, limit = JSON_LIMIT) {
  if (bodyAlreadyRead(req) && !Buffer.isBuffer(req.body) && typeof req.body !== 'string') {
    // Express hat schon geparst. Bei nicht-JSON-Content-Type setzt body-parser {} — dann ist
    // der Stream noch ungelesen und `_body` fehlt; diesen Fall fängt bodyAlreadyRead ab.
    return req.body == null ? {} : req.body;
  }
  const buf = await readRaw(req, limit);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Ungültiges JSON im Anfrage-Body.', 'bad-json');
  }
}

/* Mini-Router: '/chats/:id/messages/:mid' → RegExp mit benannten Parametern. */
export function createRouter() {
  const routes = [];
  function add(method, pattern, handler, opts = {}) {
    const keys = [];
    const rx = new RegExp('^' + pattern.replace(/\/:([A-Za-z]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    routes.push({ method, rx, keys, handler, opts, pattern });
  }
  function match(method, path) {
    let pathMatched = false;
    for (const r of routes) {
      const m = r.rx.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) continue;
      const params = {};
      r.keys.forEach((k, i) => {
        try { params[k] = decodeURIComponent(m[i + 1]); } catch { params[k] = '\u0000'; }
      });
      return { route: r, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
  const api = { add, match, routes };
  for (const m of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) api[m.toLowerCase()] = (p, h, o) => add(m, p, h, o);
  return api;
}

/* Echte Absender-Adresse. Absichtlich OHNE X-Forwarded-For: Der Header ist fälschbar und
   würde sonst die Admin-Freigabe für localhost aushebeln. */
export function socketAddress(req) {
  return (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || '';
}

export const isLoopback = (addr) => addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
  || /^127\.\d+\.\d+\.\d+$/.test(addr) || /^::ffff:127\.\d+\.\d+\.\d+$/.test(addr);
