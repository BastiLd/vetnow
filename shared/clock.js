/* VetNow — Uhr mit Zeit-Simulation.
   Warum eine eigene Uhr? Der Admin kann im Test-Center „Datum simulieren" (z. B. morgen 23:50),
   um Status-Ablauf, Kalender und „heute/gestern"-Texte zu prüfen. Das geht über einen
   VERSATZ (offset) zur echten Zeit statt über eine feste Zeit — so läuft die Uhr normal weiter.
   Im Hub-Modus kommt der Versatz vom Hub (Event `clock`), damit alle Geräte dieselbe Zeit sehen.

   Datums-Strings ('YYYY-MM-DD') sind immer das LOKALE Kalenderdatum des Geräts (in Kärnten
   Europe/Vienna). Bewusst NICHT toISOString(): das rechnet in UTC und liefert zwischen
   00:00 und 02:00 Uhr (Sommerzeit) noch das Datum von gestern. */

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

let offsetMs = 0;

/* Aktuelle (ggf. simulierte) Zeit in ms. */
export function now() {
  return Date.now() + offsetMs;
}
export function setClockOffset(ms) {
  const n = Number(ms);
  offsetMs = Number.isFinite(n) ? Math.round(n) : 0;
  return offsetMs;
}
export function getClockOffset() {
  return offsetMs;
}

const pad2 = (n) => (n < 10 ? '0' : '') + n;

/* isoOf(2026, 5, 4) → '2026-06-04'. Monat 0-basiert — so wie im alten data.js/Kalender,
   damit portierter Kalender-Code unverändert weiterläuft. */
export function isoOf(y, m, d) {
  return y + '-' + pad2(m + 1) + '-' + pad2(d);
}

/* Lokales Kalenderdatum eines Zeitstempels. Ungültiger Zeitstempel → '' (statt 'NaN-NaN-NaN',
   das sonst als „Datum" in Anzeigen und Vergleichen weiterwandert). */
export function isoFromTs(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
}

/* Number.isFinite statt typeof: NaN ist auch eine „number" und ergab früher 'NaN-NaN-NaN'. */
export function todayISO(nowTs) {
  return isoFromTs(Number.isFinite(nowTs) ? nowTs : now());
}

/* Tage im Monat (m 1-basiert). Über UTC, damit die Zeitzone keine Rolle spielt. */
function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/* '2026-06-04' → { y: 2026, m: 6, d: 4 } (m 1-basiert). null bei ungültiger Eingabe.
   Auch '2026-02-31' oder Monat 13 sind ungültig: Date würde sie still in den Folgemonat
   „weiterrollen" (31.02. → 03.03.), und die Anzeige zeigte dann z. B. „45. undefined 2026". */
export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

/* Wochentag mit Montag = 0 … Sonntag = 6 (so sind hoursWeek[] und Blockzeiten indiziert). */
export function weekdayMon0(iso) {
  const p = parseISO(iso);
  if (!p) return 0;
  const d = new Date(p.y, p.m - 1, p.d);
  return (d.getDay() + 6) % 7;
}

/* Kalendertage addieren. Über den Date-Konstruktor mit Einzelteilen statt „+ 24 h", sonst
   verrutscht das Datum an den beiden Zeitumstellungs-Tagen um eine Stunde. */
export function addDays(iso, n) {
  const p = parseISO(iso);
  if (!p) return iso;
  const d = new Date(p.y, p.m - 1, p.d + Math.round(Number(n) || 0));
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
}

/* Differenz in Kalendertagen (b − a). Rechnet mit UTC-Tagen der Datumsteile, damit
   Zeitumstellungen das Ergebnis nicht um ±1 verfälschen. */
export function dayDiff(isoA, isoB) {
  const a = parseISO(isoA);
  const b = parseISO(isoB);
  if (!a || !b) return 0;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY);
}

/* Lokaler Zeitstempel für Datum + 'HH:MM'. */
export function tsAt(iso, hhmm) {
  const p = parseISO(iso);
  if (!p) return NaN;
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '00:00')) || [0, '0', '0'];
  return new Date(p.y, p.m - 1, p.d, +t[1], +t[2], 0, 0).getTime();
}

export function startOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}
export function endOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

/* 'HH:MM' eines Zeitstempels (lokal). */
export function hhmmOf(ts) {
  const d = new Date(ts);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
