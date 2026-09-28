/* VetNow Hub — kleine Hilfsfunktionen ohne Abhängigkeiten. */

/* Erlaubte IDs: Buchstaben, Ziffern, '_' und '-' (z. B. 'drautal', 'ch-o1', 'm-lx3…').
   Warum so streng? IDs landen in Pfaden (Dateien!) und in Logs. Punkte, Schrägstriche oder
   Prozentzeichen würden Pfad-Tricks wie '../' ermöglichen. */
export const ID_RX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
export const isId = (v) => typeof v === 'string' && ID_RX.test(v);

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/* Tiefe Zusammenführung für Einstellungen: Objekte werden gemischt, alles andere ersetzt.
   '__proto__'/'constructor' werden ignoriert (Schutz vor Prototype-Pollution über JSON). */
export function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return clone(base);
  const out = isPlainObject(base) ? clone(base) : {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : clone(v);
  }
  return out;
}

/* Warten, das sich abbrechen lässt (z. B. wenn ein Chat während der Tipp-Anzeige gelöscht wird). */
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) { reject(abortError()); return; }
    const t = setTimeout(() => { if (signal) signal.removeEventListener('abort', onAbort); resolve(); }, Math.max(0, ms || 0));
    function onAbort() { clearTimeout(t); reject(abortError()); }
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function abortError(msg = 'Abgebrochen') {
  const e = new Error(msg);
  e.name = 'AbortError';
  return e;
}

export const isAbort = (e) => !!e && (e.name === 'AbortError' || e.code === 'ABORT_ERR' || e.code === 'aborted');

/* Heutiges Datum als 'YYYY-MM-DD' in LOKALER Zeit (Termine sind Kalendertage, keine UTC-Tage). */
export function isoDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const ISO_DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RX = /^([01]\d|2[0-3]):[0-5]\d$/;

/* Enthält ein Text HTML/Script? Wird NICHT gefiltert (Text bleibt wortgetreu), nur geloggt —
   Escapen ist Aufgabe der Clients (React escaped automatisch). */
export const looksLikeMarkup = (s) => typeof s === 'string' && /<\s*(script|img|iframe|svg|a|style)\b|on\w+\s*=|javascript:/i.test(s);
