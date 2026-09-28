/* VetNow Hub — kleine Netzwerk-Helfer für die KI-Anbieter (Zeitlimit, Zeilen-Streams, Bilder). */

/* Ein AbortController, der nach `timeoutMs` abbricht ODER wenn das äußere Signal abbricht.
   `timedOut` verrät hinterher, WARUM abgebrochen wurde: Zeitlimit → Fehlercode 'timeout',
   Aufrufer (Chat gelöscht, Browser weg) → stiller Abbruch ohne Fehlermeldung. */
export function deadline(timeoutMs, outer) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(new Error('timeout')); }, Math.max(1, timeoutMs));
  if (timer.unref) timer.unref();
  const onAbort = () => ctrl.abort(outer.reason);
  if (outer) {
    if (outer.aborted) ctrl.abort(outer.reason);
    else outer.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    get timedOut() { return timedOut; },
    get outerAborted() { return !!(outer && outer.aborted); },
    done() { clearTimeout(timer); if (outer) outer.removeEventListener('abort', onAbort); },
  };
}

/* Antwort-Body (Web-ReadableStream aus fetch) zeilenweise lesen — für Ollama-NDJSON und
   OpenAI-SSE. Unvollständige Zeilen werden gepuffert, bis der Zeilenumbruch kommt. */
export async function* readLines(body) {
  if (!body) return;
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  for await (const chunk of body) {
    buf += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line.trim()) yield line;
    }
  }
  buf += decoder.decode();
  if (buf.trim()) yield buf.trim();
}

/* Base64-Rohdaten eines Bildes → MIME-Typ (an den ersten Bytes erkennbar).
   Wichtig für Anthropic/OpenAI: Ein PNG mit angeblichem Typ image/jpeg wird abgelehnt. */
export function sniffImageMime(b64) {
  const s = String(b64 || '').slice(0, 16);
  if (s.startsWith('/9j/')) return 'image/jpeg';
  if (s.startsWith('iVBOR')) return 'image/png';
  if (s.startsWith('R0lGOD')) return 'image/gif';
  if (s.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

/* 'data:image/png;base64,AAAA' → 'AAAA'; reines Base64 bleibt; alles andere → ''. */
export function stripDataUrl(v) {
  if (typeof v !== 'string') return '';
  if (v.startsWith('data:')) {
    const i = v.indexOf(',');
    return i > 0 ? v.slice(i + 1) : '';
  }
  return /^[A-Za-z0-9+/=\s]+$/.test(v.slice(0, 200)) ? v.replace(/\s+/g, '') : '';
}

export const trimSlash = (u) => String(u || '').trim().replace(/\/+$/, '');

/* Fehlertext aus einer HTTP-Antwort ziehen (JSON {error} oder Klartext), nie werfen. */
export async function errorText(res) {
  let txt = '';
  try { txt = await res.text(); } catch { /* egal */ }
  try {
    const j = JSON.parse(txt);
    const e = j && (j.error && (j.error.message || j.error)) || j.message;
    if (e) return `HTTP ${res.status}: ${typeof e === 'string' ? e : JSON.stringify(e)}`;
  } catch { /* kein JSON */ }
  return `HTTP ${res.status}: ${txt.slice(0, 300)}`;
}
