/* VetNow — KI: System-Prompts, Umwandlung des Chatverlaufs und ein KI-Client.

   Portiert aus web/src/lib/ai.js + mobile/src/lib/ai.js (die waren fast gleich, aber getrennt
   gepflegt) und an v3 angepasst:
   - persona = wer ANTWORTET: 'clinic' (Praxisteam), 'owner' (Tierhalter:in) und NEU 'colleague'
     (andere Praxis im Netzwerk). In v2 bekamen Netzwerk-Chats die Tierhalter-Persona (Audit).
   - Bilder stecken in message.attachment.ref statt in m.src/m.srcB64.
   - Der Client spricht mit dem VetNow Hub (/api/v1/ai/*, inkl. Streaming) ODER im Legacy-Modus
     mit einem alten Studio ohne Hub (/api/ai/*, Ollama-Format { message: { content } }).

   Fehlerpolitik (wie in v2): Jeder Fehler hat einen `code`. 'offline' und 'timeout' heißen
   schlicht „keine KI da" → die App nimmt still den Bot (bei botMode 'ai-fallback').
   Alles andere (kein Modell, kein Bild-Modell, Absturz, Ablehnung, zu groß) ist ein echtes
   Problem und hat `visible: true` — sonst sieht man eine plausible Bot-Antwort und erfährt nie,
   dass z. B. das Foto gar nicht angekommen ist. */

export const AI_ERROR_CODES = Object.freeze(['offline', 'timeout', 'no-model', 'no-vision', 'model-crash', 'refusal', 'bad-request']);
export const AI_TIMEOUT_MS = 45000;
/* Bilder brauchen deutlich länger: ein Vision-Modell auf der CPU liegt leicht bei 20–60 s. */
export const AI_VISION_TIMEOUT_MS = 120000;
/* Feineinstellungen für konsistente, deutschsprachige Antworten (Legacy-Studio nimmt sie mit). */
export const AI_OPTIONS = Object.freeze({ temperature: 0.4, top_p: 0.9, num_ctx: 4096, repeat_penalty: 1.15 });

const SILENT = { offline: true, timeout: true };

/* KI-Fehler mit Code. visible = die Oberfläche MUSS ihn zeigen (nicht still auf den Bot wechseln). */
export function aiError(code, message, extra) {
  const c = AI_ERROR_CODES.indexOf(code) >= 0 ? code : 'model-crash';
  const e = new Error(message || defaultMessage(c));
  e.name = 'AiError';
  e.code = c;
  e.visible = !SILENT[c];
  if (extra) Object.keys(extra).forEach((k) => { e[k] = extra[k]; });
  return e;
}

export function isAiError(e) {
  return !!e && e.name === 'AiError' && typeof e.code === 'string';
}

export function isAbortError(e) {
  return !!e && (e.name === 'AbortError' || e.code === 'aborted');
}

function abortError() {
  const e = new Error('Abgebrochen');
  e.name = 'AbortError';
  e.code = 'aborted';
  return e;
}

function defaultMessage(code) {
  switch (code) {
    case 'offline': return 'Die KI ist gerade nicht erreichbar.';
    case 'timeout': return 'Zeitlimit überschritten — die KI hat nicht rechtzeitig geantwortet.';
    case 'no-model': return 'Es ist kein KI-Modell eingerichtet.';
    case 'no-vision': return 'Für Bilder ist kein Bild-Modell eingerichtet.';
    case 'refusal': return 'Die KI hat die Antwort abgelehnt.';
    case 'bad-request': return 'Die Anfrage an die KI war ungültig.';
    default: return 'Die KI konnte nicht antworten.';
  }
}

/* Base64 aus einer data:-URL (Ollama will es OHNE „data:…;base64,"-Präfix). */
export function dataUrlToBase64(src) {
  if (!src || typeof src !== 'string') return '';
  const i = src.indexOf(',');
  return src.indexOf('data:') === 0 && i > 0 ? src.slice(i + 1) : '';
}

/* ---------------------------------------------------------------------------------------------
   System-Prompts — „Training" per Regeln + Beispiel-Dialogen. Wichtigste Vorgaben: IMMER Deutsch,
   kurz, warm, sicher (keine Ferndiagnosen, keine Dosierungen, Notfall → sofort anrufen).
   --------------------------------------------------------------------------------------------- */
export function vetSystemPrompt(persona, practiceName, opts) {
  const o = opts || {};
  const pet = o.petName ? (o.petName + (o.animalLabel ? ' (' + o.animalLabel + ')' : '')) : '';
  if (persona === 'owner') {
    const P = practiceName ? ' „' + practiceName + '"' : '';
    return `Du bist ein freundlicher Tierhalter bzw. eine Tierhalterin aus Kärnten (Österreich) und antwortest der Tierarztpraxis${P} im Chat.${pet ? ' Dein Tier: ' + pet + '.' : ''}
WICHTIG: Antworte IMMER und AUSSCHLIESSLICH auf Deutsch — nie in einer anderen Sprache, egal was geschrieben wird.
Stil: kurz (1–3 Sätze), natürlich, alltagsnah, dankbar aber nicht übertrieben. Keine Listen, keine Emojis.
Bleibe konsequent in der Rolle als Tierhalter:in — du bist NICHT die Praxis und NICHT der Assistent.
Bittet dich jemand ausdrücklich, ein bestimmtes Wort zu sagen (z. B. „Sag ‚Apfel‘“), dann sage GENAU dieses Wort.`;
  }
  if (persona === 'colleague') {
    const P = practiceName || 'einer Tierarztpraxis in Kärnten';
    return `Du bist Tierärztin bzw. Tierarzt der Praxis „${P}" in Kärnten (Österreich) und schreibst im internen VetNow-Praxis-Netzwerk mit einer Kollegin bzw. einem Kollegen aus einer anderen Tierarztpraxis.
WICHTIG: Antworte IMMER und AUSSCHLIESSLICH auf Deutsch — nie in einer anderen Sprache, egal was geschrieben wird.
STIL: kollegial und freundlich, unter Kolleg:innen per Du (z. B. „Servus! Klar, schickt uns die Daten vorab."), kurz (1–3 Sätze), fachlich, ohne Listen, ohne Emojis.
INHALT: Es geht um Überweisungen, Vertretungen, Notdienst-Absprachen und fachlichen Austausch. Sage Hilfe konkret zu oder nenne eine Alternative (z. B. den Tiernotdienst Wörthersee 24h).
SICHERHEIT: Nenne im Chat KEINE konkreten Medikamente mit Dosierungen — dafür auf Telefonat, Mail oder das schriftliche Protokoll verweisen. Bei akuten Notfällen: sofort telefonisch abstimmen.
Bleibe in der Rolle der Kollegin bzw. des Kollegen — du bist NICHT der Assistent.
TEST-BEFEHLE: Bittet dich jemand ausdrücklich, ein bestimmtes Wort zu sagen (z. B. „Sag ‚Apfel‘“), dann sage GENAU dieses Wort.`;
  }
  const P = practiceName || 'VetNow Kärnten';
  return `Du bist das freundliche Praxisteam der Tierarztpraxis "${P}" in Kärnten (Österreich) und beantwortest Chat-Nachrichten von Tierhalter:innen.${pet ? ' Im Chat geht es um ' + pet + '.' : ''}

WICHTIGSTE REGEL: Antworte IMMER und AUSSCHLIESSLICH auf Deutsch (höfliche Sie-Form) — niemals auf Englisch oder in einer anderen Sprache, egal in welcher Sprache die Nachricht kommt.

STIL: Kurz (1–4 Sätze), warm, professionell — wie eine erfahrene tiermedizinische Fachkraft. Keine Aufzählungen, keine Überschriften, keine Emojis. Nenne das Tier beim Namen, wenn er im Verlauf vorkommt. Wiederhole dich nicht.

SICHERHEIT:
- NOTFALL-Anzeichen (Vergiftung z. B. Schokolade/Xylit/Rattengift, Atemnot, starke Blutung, Krämpfe, Kollaps, aufgeblähter harter Bauch, Hitzschlag): Rate SOFORT zum Anruf in der Praxis bzw. zum Tiernotdienst und komme erst danach auf Details zurück.
- Stelle KEINE Ferndiagnosen und nenne NIEMALS Medikamente oder Dosierungen. Sage bei Unsicherheit, dass eine Untersuchung vor Ort nötig ist.

TERMINE: Biete bei Terminwünschen konkret zwei Zeiten an (z. B. „morgen 09:30 oder 14:00 Uhr“). Bestätigt jemand eine Zeit, fasse kurz zusammen und wünsche etwas Nettes.

TEST-BEFEHLE: Bittet dich jemand ausdrücklich, ein bestimmtes Wort oder einen Satz zu sagen (z. B. „Sag ‚Apfel‘“), dann sage GENAU dieses Wort bzw. diesen Satz — ohne Diskussion.

BEISPIELE (so sollst du klingen):
Halter: „Mein Hund Balu humpelt seit gestern.“
Du: „Das tut mir leid — gute Besserung an Balu! Damit wir die Ursache sicher finden, sollten wir ihn kurz ansehen. Passt Ihnen morgen 09:30 oder 14:00 Uhr?“
Halter: „Was kostet die Impfung?“
Du: „Die Grundimmunisierung liegt bei uns je nach Impfstoff meist zwischen 45 und 70 Euro. Sagen Sie mir gern, um welches Tier es geht, dann nenne ich Ihnen den genauen Preis.“
Halter: „Meine Katze hat Schokolade gefressen!“
Du: „Das kann ein Notfall sein — rufen Sie uns bitte SOFORT an, damit wir die Menge einschätzen können. Kommen Sie im Zweifel direkt vorbei, warten Sie nicht ab.“`;
}

/* ---------------------------------------------------------------------------------------------
   Chatverlauf → KI-Nachrichten [{ role:'user'|'assistant', content, images? }] (OHNE System-Prompt).

   opts.maxTurns    letzte N Nachrichten (Standard 10) — mehr kostet nur Zeit.
   opts.side        Seite, die antwortet ('owner'|'clinic'). Standard: aus persona; bei 'colleague'
                    die Gegenseite der letzten Nachricht (im Netzwerk können beide Praxen schreiben).
   opts.resolveImage(ref, message) → Base64 (ohne data:-Präfix) für Refs, die hier nicht lesbar sind
                    ('idb:…' im Web, 'file://…' am Handy). Muss SYNCHRON sein — asynchrone Quellen
                    vorher auflösen (generateAutoReply macht das).
   opts.imageScope  'unanswered' (Standard): Das neueste Bild der Gegenseite wird NUR mitgeschickt,
                    solange es noch unbeantwortet ist. Sonst ging es in v2 bei JEDER weiteren
                    Textnachricht erneut ans (langsame) Bild-Modell (Mobile-Audit). 'window' = wie v2.
   'hub:<id>'-Refs bleiben als Text im images-Feld stehen: die löst der Hub selbst auf; der
   Legacy-Client entfernt sie, weil ein altes Studio sie nicht kennt.
   --------------------------------------------------------------------------------------------- */
export function toAiMessages(messages, persona, opts) {
  const o = opts || {};
  const maxTurns = o.maxTurns > 0 ? Math.floor(o.maxTurns) : 10;
  const usable = (Array.isArray(messages) ? messages : []).filter((m) => m && !m.deleted && m.source !== 'error' && m.from !== 'system');
  let answering = o.side === 'owner' || o.side === 'clinic' ? o.side : (persona === 'clinic' ? 'clinic' : persona === 'owner' ? 'owner' : null);
  if (!answering) {
    const last = usable[usable.length - 1];
    answering = last ? (last.from === 'owner' ? 'clinic' : 'owner') : 'owner';
  }
  const recent = usable.slice(-maxTurns);
  const roleOf = (m) => (m.from === answering ? 'assistant' : 'user');

  const imageOf = (m) => {
    const ref = (m.attachment && m.attachment.ref) || (typeof m.src === 'string' ? m.src : '');
    if (!ref) return '';
    const b = dataUrlToBase64(ref);
    if (b) return b;
    if (typeof o.resolveImage === 'function') {
      try {
        const r = o.resolveImage(ref, m);
        if (typeof r === 'string' && r) return dataUrlToBase64(r) || r;
      } catch { /* nicht lesbar → ohne Bild weiter */ }
    }
    if (ref.indexOf('hub:') === 0) return ref;
    return '';
  };

  let imgIdx = -1;
  let imgData = '';
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    const role = roleOf(m);
    if (role === 'assistant' && o.imageScope !== 'window') break;
    if (role === 'user' && m.type === 'image') {
      const b = imageOf(m);
      if (b) { imgIdx = i; imgData = b; break; }
    }
  }

  return recent.map((m, i) => {
    const role = roleOf(m);
    if (m.type === 'note') return { role, content: '[Abschlussnotiz] ' + (m.text || '') };
    if (m.type === 'file') {
      const name = (m.attachment && m.attachment.name) || m.fileName || 'Anhang';
      return { role, content: '[Datei gesendet: ' + name + ']' + (m.text ? ' ' + m.text : '') };
    }
    if (m.type === 'image') {
      const withImg = i === imgIdx;
      const out = { role, content: m.text || (withImg ? 'Bitte sieh dir dieses Bild an.' : '[Bild gesendet]') };
      if (withImg) out.images = [imgData];
      return out;
    }
    return { role, content: m.text || '' };
  });
}

/* ---------------------------------------------------------------------------------------------
   KI-Client
   createAiClient({ baseUrl, fetch, legacy, timeoutMs, visionTimeoutMs, clientId })
     Hub:    baseUrl = Hub-Adresse ('http://192.168.68.10:8787', '' = gleiche Herkunft);
             Endpunkte /api/v1/ai/status|models|chat|test.
     Legacy: baseUrl = altes Studio ('http://host:3000' oder direkt '…/api/ai');
             Endpunkte /api/ai/status|models|chat (Ollama-Antwortformat).
   --------------------------------------------------------------------------------------------- */
function trimSlash(s) {
  return String(s || '').trim().replace(/\/+$/, '');
}

/* Timer + AbortController, der auch auf das Signal des Aufrufers hört. Ohne AbortController
   (sehr alte Umgebungen) läuft die Anfrage ohne Abbruchmöglichkeit — besser als gar nicht. */
function makeGuard(ms, outer) {
  const AC = typeof globalThis !== 'undefined' ? globalThis.AbortController : undefined;
  const st = globalThis.setTimeout;
  const ct = globalThis.clearTimeout;
  const g = { signal: undefined, timedOut: false, aborted: false, timer: null, ms };
  let ctrl = null;
  if (typeof AC === 'function') {
    ctrl = new AC();
    g.signal = ctrl.signal;
  }
  const fire = () => { g.timedOut = true; if (ctrl) ctrl.abort(); };
  g.reset = () => {
    if (g.timer) ct(g.timer);
    g.timer = ms > 0 ? st(fire, ms) : null;
  };
  const onOuter = () => { g.aborted = true; if (ctrl) ctrl.abort(); };
  if (outer) {
    if (outer.aborted) onOuter();
    else if (typeof outer.addEventListener === 'function') outer.addEventListener('abort', onOuter);
  }
  g.done = () => {
    if (g.timer) ct(g.timer);
    g.timer = null;
    if (outer && typeof outer.removeEventListener === 'function') outer.removeEventListener('abort', onOuter);
  };
  g.reset();
  return g;
}

const CODE_MAP = {
  offline: 'offline', 'ai-offline': 'offline', timeout: 'timeout',
  'no-model': 'no-model', 'model-missing': 'no-model',
  'no-vision': 'no-vision', 'no-vision-model': 'no-vision',
  'model-crash': 'model-crash', refusal: 'refusal', 'bad-request': 'bad-request',
};

function httpError(status, body, hasImage) {
  const b = body && typeof body === 'object' ? body : {};
  const msg = typeof b.error === 'string' && b.error ? b.error : '';
  let code = CODE_MAP[b.code];
  if (!code) {
    if (status === 413) {
      return aiError('bad-request', hasImage ? 'Das Bild war zu groß für den Server. Bitte ein kleineres Foto senden.' : 'Die Anfrage war zu groß für den Server.', { httpStatus: status });
    }
    if (status === 404) code = 'offline';
    else if (status === 408 || status === 504) code = 'timeout';
    else if (status === 503) code = 'offline';
    else if (status >= 400 && status < 500) code = 'bad-request';
    else code = 'model-crash';
  }
  return aiError(code, msg || (code === 'offline' && status === 404 ? 'Unter dieser Adresse gibt es keine KI-Schnittstelle.' : defaultMessage(code)), { httpStatus: status });
}

async function readJson(res) {
  try {
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  } catch { return null; }
}

/* SSE-Text in Datenblöcke zerlegen. Gibt die fertigen Ereignisse + den unfertigen Rest zurück. */
export function parseSseChunk(buffer) {
  const events = [];
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop();
  parts.forEach((block) => {
    const data = [];
    block.split(/\r?\n/).forEach((line) => {
      if (line.indexOf('data:') === 0) data.push(line.slice(5).replace(/^ /, ''));
    });
    if (!data.length) return;
    const raw = data.join('\n');
    try { events.push(JSON.parse(raw)); } catch { events.push({ raw }); }
  });
  return { events, rest };
}

export function createAiClient(opts) {
  const o = opts || {};
  const legacy = !!o.legacy;
  const f = typeof o.fetch === 'function' ? o.fetch
    : (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
  const timeoutMs = o.timeoutMs > 0 ? o.timeoutMs : AI_TIMEOUT_MS;
  const visionTimeoutMs = o.visionTimeoutMs > 0 ? o.visionTimeoutMs : AI_VISION_TIMEOUT_MS;

  let base = trimSlash(o.baseUrl);
  if (legacy) {
    if (!/\/api\/ai$/.test(base)) base += '/api/ai';
  } else {
    base = base.replace(/\/api\/v1$/, '') + '/api/v1/ai';
  }
  const headers = { 'content-type': 'application/json' };
  if (o.clientId) headers['x-vn-client'] = String(o.clientId);

  async function call(method, path, body, { timeout, signal, hasImage, raw } = {}) {
    if (!f) throw aiError('offline', 'In dieser Umgebung gibt es kein fetch().');
    const g = makeGuard(timeout || timeoutMs, signal);
    if (g.aborted) { g.done(); throw abortError(); }
    let res;
    try {
      res = await f(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: g.signal,
      });
    } catch (e) {
      g.done();
      if (g.aborted) throw abortError();
      if (g.timedOut) throw aiError('timeout');
      throw aiError('offline', 'Die KI ist nicht erreichbar (' + ((e && e.message) || 'Netzwerkfehler') + ').');
    }
    if (raw) return { res, guard: g };
    try {
      if (!res.ok) throw httpError(res.status, await readJson(res), hasImage);
      return await readJson(res);
    } catch (e) {
      if (g.aborted) throw abortError();
      if (g.timedOut) throw aiError('timeout');
      throw e;
    } finally {
      g.done();
    }
  }

  async function status() {
    try {
      const j = await call('GET', '/status', undefined, { timeout: 5000 });
      return { ...(j || {}), ok: !!(j && j.ok) };
    } catch (e) {
      return { ok: false, code: e.code || 'offline', error: e.message };
    }
  }

  async function models(provider) {
    try {
      const q = !legacy && provider ? '?provider=' + encodeURIComponent(provider) : '';
      const j = await call('GET', '/models' + q, undefined, { timeout: 8000 });
      return Array.isArray(j) ? j : (j && Array.isArray(j.models) ? j.models : []);
    } catch {
      return [];
    }
  }

  function prepMessages(messages) {
    const list = Array.isArray(messages) ? messages : [];
    if (!legacy) return list;
    // Das alte Studio kennt keine 'hub:'-Refs → solche Bilder weglassen statt Müll zu senden.
    return list.map((m) => {
      if (!m || !Array.isArray(m.images)) return m;
      const imgs = m.images.filter((x) => typeof x === 'string' && x && x.indexOf('hub:') !== 0);
      const c = { ...m };
      if (imgs.length) c.images = imgs; else delete c.images;
      return c;
    });
  }

  /* chat({ messages, model, provider, persona, stream, format, signal, onDelta })
     → { text, provider, model, vision, ms, source? } oder wirft AiError / AbortError. */
  async function chat(args) {
    const a = args || {};
    const t0 = Date.now();
    const messages = prepMessages(a.messages);
    const hasImage = messages.some((m) => m && Array.isArray(m.images) && m.images.length);
    const timeout = hasImage ? visionTimeoutMs : timeoutMs;
    const onDelta = typeof a.onDelta === 'function' ? a.onDelta : null;

    if (legacy) {
      const body = { messages };
      if (a.model) body.model = a.model;
      if (a.format) body.format = a.format;
      const j = await call('POST', '/chat', body, { timeout, signal: a.signal, hasImage });
      const text = j && j.message && j.message.content ? String(j.message.content).trim() : '';
      if (!text) throw aiError('model-crash', 'Die KI hat eine leere Antwort geliefert.');
      if (onDelta) onDelta(text, text);
      return { text, provider: 'ollama', model: (j && j.vnModel) || a.model || '', vision: !!(j && j.vnVision), ms: Date.now() - t0 };
    }

    const body = { messages };
    ['model', 'provider', 'persona', 'format'].forEach((k) => { if (a[k]) body[k] = a[k]; });
    // Streaming nur, wenn die Umgebung Antwort-Streams lesen kann (Hermes/React Native: nein).
    const canStream = typeof globalThis.TextDecoder === 'function';
    const wantStream = !!a.stream && canStream;
    if (wantStream) body.stream = true;

    if (!wantStream) {
      const j = await call('POST', '/chat', body, { timeout, signal: a.signal, hasImage });
      return finish(j, t0, onDelta);
    }

    const { res, guard } = await call('POST', '/chat', body, { timeout, signal: a.signal, hasImage, raw: true });
    let reader = null;
    let readerDone = false;
    try {
      if (!res.ok) throw httpError(res.status, await readJson(res), hasImage);
      const ctype = String((res.headers && res.headers.get && res.headers.get('content-type')) || '');
      if (ctype.indexOf('text/event-stream') < 0) return finish(await readJson(res), t0, onDelta);
      let full = '';
      let done = null;
      const handle = (ev) => {
        if (!ev || typeof ev !== 'object') return;
        if (ev.error) throw httpError(ev.status || 500, ev, hasImage);
        if (typeof ev.delta === 'string' && ev.delta) {
          full += ev.delta;
          if (onDelta) onDelta(ev.delta, full);
        }
        if (ev.done) done = ev;
      };
      reader = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;
      if (reader) {
        const dec = new globalThis.TextDecoder();
        let buf = '';
        for (;;) {
          const r = await reader.read();
          if (r.done) { readerDone = true; break; }
          guard.reset(); // Leerlauf-Timeout: solange Text fließt, wird nicht abgebrochen
          buf += dec.decode(r.value, { stream: true });
          const p = parseSseChunk(buf);
          buf = p.rest;
          p.events.forEach(handle);
          if (done) { readerDone = true; try { await reader.cancel(); } catch { /* egal */ } break; }
        }
        if (!done && buf.trim()) parseSseChunk(buf + '\n\n').events.forEach(handle);
      } else {
        parseSseChunk((await res.text()) + '\n\n').events.forEach(handle);
      }
      const text = String((done && typeof done.text === 'string' && done.text) || full).trim();
      if (!text) throw aiError('model-crash', 'Die KI hat eine leere Antwort geliefert.');
      return {
        text,
        provider: (done && done.provider) || '',
        model: (done && done.model) || '',
        vision: !!(done && done.vision),
        ms: (done && done.ms) || Date.now() - t0,
        ...(done && done.source ? { source: done.source } : {}),
      };
    } catch (e) {
      // Fehler-Ereignis mitten im Strom (z. B. {error, code:'no-vision'}): Den Strom aktiv schließen.
      // Sonst bliebe die HTTP-Verbindung offen, bis der Server von selbst aufhört (Verbindungs-Leck).
      if (reader && !readerDone) {
        try { const pc = reader.cancel(); if (pc && typeof pc.catch === 'function') pc.catch(() => {}); } catch { /* egal */ }
      }
      if (guard.aborted) throw abortError();
      if (guard.timedOut) throw aiError('timeout');
      if (isAiError(e) || isAbortError(e)) throw e;
      throw aiError('offline', 'Verbindung zur KI abgebrochen (' + ((e && e.message) || 'Fehler') + ').');
    } finally {
      guard.done();
    }
  }

  function finish(j, t0, onDelta) {
    const text = String((j && (typeof j.text === 'string' ? j.text : (j.message && j.message.content))) || '').trim();
    if (!text) throw aiError('model-crash', 'Die KI hat eine leere Antwort geliefert.');
    if (onDelta) onDelta(text, text);
    const out = {
      text,
      provider: (j && j.provider) || '',
      model: (j && (j.model || j.vnModel)) || '',
      vision: !!(j && (j.vision || j.vnVision)),
      ms: (j && typeof j.ms === 'number' && j.ms) || Date.now() - t0,
    };
    if (j && j.source) out.source = j.source;
    return out;
  }

  /* „Sag Apfel"-Test: → { ok, text, provider, model, ms } — wirft nie. */
  async function test(args) {
    const a = args || {};
    const t0 = Date.now();
    try {
      if (!legacy) {
        const body = {};
        if (a.provider) body.provider = a.provider;
        if (a.model) body.model = a.model;
        const j = await call('POST', '/test', body, { timeout: timeoutMs, signal: a.signal });
        return { ...(j || {}), ok: !!(j && j.ok), ms: (j && j.ms) || Date.now() - t0 };
      }
      const r = await chat({
        messages: [{ role: 'user', content: 'Sag „Apfel". Antworte nur mit diesem einen Wort.' }],
        model: a.model,
        signal: a.signal,
      });
      return { ok: /apfel/i.test(r.text), text: r.text, provider: r.provider, model: r.model, ms: r.ms };
    } catch (e) {
      return { ok: false, code: e.code || 'offline', error: e.message, ms: Date.now() - t0 };
    }
  }

  return { legacy, baseUrl: base, status, models, chat, test };
}
