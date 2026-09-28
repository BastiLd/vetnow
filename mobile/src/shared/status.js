// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* VetNow — Status-Engine (Ampel).
   Das Kernversprechen der App: Praxen bestätigen ihren Status für 24 Stunden, danach wird er
   automatisch GRAU („Nicht aktuell bestätigt"). In v2 war das nur ein Werbetext — der Status war
   ein fester String in data.js (Projekt-Audit, Bug „core promise not implemented").

   Gespeichert wird: practice.status = { value, setAt, expiresAt, note? } und practice.absence.
   Angezeigt wird der EFFEKTIVE Status, der sich aus der aktuellen Zeit ergibt (Vertrag §4):
     1. Abwesenheit deckt „jetzt" ab            → 'red'
     2. kein/ungültiger Wert oder jetzt > expiresAt → 'grey'
     3. sonst                                     → status.value
   Zusätzlich (Randfall, im Vertrag nicht geregelt): Ein Wert OHNE setAt und OHNE expiresAt
   wurde nie bestätigt → ebenfalls 'grey'. Sonst bliebe so ein Status ewig grün. */
import { STATUS } from './constants.js';
import { now as clockNow, isoFromTs, dayDiff, hhmmOf } from './clock.js';
import { fmtDateShort } from './format.js';

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const SETTABLE = { green: true, yellow: true, red: true };
/* Nur EIGENE Schlüssel zählen: Mit einfachem Objekt-Zugriff galten auch 'toString', 'constructor'
   oder '__proto__' als gültiger Status (kommen z. B. aus kaputten Importen) — so eine Praxis
   wurde dann sogar VOR allen grünen einsortiert (rank undefined → NaN beim Sortieren). */
const own = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);
const isSettable = (v) => own(SETTABLE, v);
const isPractice = (p) => p !== null && typeof p === 'object' && !Array.isArray(p);

/* Rohes Status-Objekt einer Praxis — auch für bereits „live" aufbereitete Kopien
   (withLiveStatus legt das Original unter statusRaw ab). */
function rawStatus(p) {
  if (!p) return null;
  if (p.statusRaw && typeof p.statusRaw === 'object') return p.statusRaw;
  if (p.status && typeof p.status === 'object') return p.status;
  return null;
}

/* Deckt die Abwesenheit den Zeitpunkt ab? Fehlt `to`, gilt sie offen bis auf Weiteres;
   fehlt `from`, gilt sie ab sofort. */
export function isAbsentNow(p, nowTs) {
  const a = p && p.absence;
  if (!a || typeof a !== 'object') return false;
  const n = num(nowTs) ? nowTs : clockNow();
  const from = num(a.from) ? a.from : -Infinity;
  const to = num(a.to) ? a.to : Infinity;
  if (!num(a.from) && !num(a.to)) return false; // leeres Objekt = keine Abwesenheit
  return n >= from && n <= to;
}

export function effectiveStatus(p, nowTs) {
  if (!p) return 'grey';
  const n = num(nowTs) ? nowTs : clockNow();
  if (isAbsentNow(p, n)) return 'red';
  const s = rawStatus(p);
  if (!s) {
    // Altes Format (v2): status war direkt der Schlüssel als String.
    return own(STATUS, p.status) ? p.status : 'grey';
  }
  if (!isSettable(s.value)) return 'grey';
  if (num(s.expiresAt)) return n > s.expiresAt ? 'grey' : s.value;
  if (!num(s.setAt)) return 'grey';
  return s.value;
}

export function statusInfo(key) {
  return own(STATUS, key) ? STATUS[key] : STATUS.grey;
}

/* „Zuletzt bestätigt: heute, 08:30 | gestern, 17:10 | vor 2 Tagen". */
export function confirmedLabel(p, nowTs) {
  const n = num(nowTs) ? nowTs : clockNow();
  const s = rawStatus(p);
  if (!s) return p && typeof p.confirmedAt === 'string' ? p.confirmedAt : 'noch nie';
  if (!num(s.setAt)) return 'noch nie';
  const days = dayDiff(isoFromTs(s.setAt), isoFromTs(n));
  const t = hhmmOf(s.setAt);
  if (days === 0) return 'heute, ' + t;
  if (days === 1) return 'gestern, ' + t;
  if (days > 1) return 'vor ' + days + ' Tagen';
  // setAt liegt in der Zukunft (Zeit-Simulation zurückgedreht) — ehrlich das Datum zeigen.
  return fmtDateShort(isoFromTs(s.setAt)) + ', ' + t;
}

/* Restlaufzeit in ms bis zum Ablauf (0 = abgelaufen), null wenn es kein Ablaufdatum gibt. */
export function expiresIn(p, nowTs) {
  const n = num(nowTs) ? nowTs : clockNow();
  const s = rawStatus(p);
  if (!s || !isSettable(s.value) || !num(s.expiresAt)) return null;
  return Math.max(0, s.expiresAt - n);
}

function absenceRange(a) {
  if (!a) return '';
  const f = num(a.from) ? fmtDateShort(isoFromTs(a.from)) : '';
  const t = num(a.to) ? fmtDateShort(isoFromTs(a.to)) : '';
  if (f && t) return f + ' – ' + t;
  if (f) return 'ab ' + f;
  if (t) return 'bis ' + t;
  return '';
}

/* Liefert KOPIEN der Praxen, auf denen alter UI-Code unverändert läuft:
   p.status      = effektiver Schlüssel ('green' …) statt des Objekts
   p.statusInfo  = STATUS-Eintrag (Farben, Labels)
   p.statusRaw   = das gespeicherte Objekt { value, setAt, expiresAt, note }
   p.confirmedAt = 'heute, 08:30' | 'gestern, 17:10' | 'vor 2 Tagen'
   p.expiresInMs = Restlaufzeit (null = kein Ablauf), p.isExpired
   p.absent / p.vertretung / p.absenceRange — so wie die alten Screens sie lesen.
   Notfalltexte: Ist der Status grau (oder rot NUR wegen Abwesenheit), würde der gespeicherte
   Text („Nimmt heute Notfälle an") lügen — dann wird er durch den passenden Hinweis ersetzt.
   Die Originale bleiben unter emergencyBase/emergencyLongBase erhalten.
   Idempotent: eine bereits aufbereitete Kopie kann erneut übergeben werden. */
export function withLiveStatus(practices, nowTs) {
  const n = num(nowTs) ? nowTs : clockNow();
  // Nur Objekte: Aus einer Zahl/einem Text im Array machte „...p" sonst eine Schein-Praxis.
  return (Array.isArray(practices) ? practices : []).filter(isPractice).map((p) => {
    const raw = rawStatus(p);
    const key = effectiveStatus(p, n);
    const absent = isAbsentNow(p, n);
    const baseShort = p.emergencyBase != null ? p.emergencyBase : (p.emergency || '');
    const baseLong = p.emergencyLongBase != null ? p.emergencyLongBase : (p.emergencyLong || '');
    const a = p.absence || null;
    const vertretung = (a && a.vertretung) || '';
    let emergency = baseShort;
    let emergencyLong = baseLong;
    if (key === 'grey') {
      emergency = STATUS.grey.notice;
      emergencyLong = STATUS.grey.noticeLong;
    } else if (absent && !(raw && raw.value === 'red')) {
      const range = absenceRange(a);
      emergency = 'Derzeit abwesend' + (vertretung ? ' – Vertretung: ' + vertretung : '');
      emergencyLong = 'Diese Praxis ist derzeit abwesend' + (range ? ' (' + range + ')' : '') + '. '
        + (vertretung ? 'Bitte wenden Sie sich an die Vertretung: ' + vertretung + '.' : 'Bitte wenden Sie sich im Notfall an eine andere Praxis oder den Tiernotdienst.');
    }
    const exp = expiresIn(p, n);
    return {
      ...p,
      status: key,
      statusInfo: STATUS[key],
      statusRaw: raw,
      confirmedAt: confirmedLabel(p, n),
      expiresInMs: exp,
      isExpired: !!(raw && isSettable(raw.value) && num(raw.expiresAt) && n > raw.expiresAt),
      absent,
      vertretung,
      absenceRange: absenceRange(a),
      emergency,
      emergencyLong,
      emergencyBase: baseShort,
      emergencyLongBase: baseLong,
    };
  });
}

/* Deutsche Sortierung ohne Intl (Hermes/alte Browser liefern bei localeCompare mit Locale
   unterschiedliche Ergebnisse): Umlaute wie Grundbuchstaben, ß wie ss, ohne Groß/Klein. */
export function germanKey(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
}

/* Grün zuerst, dann gelb, grau, rot; innerhalb gleicher Farbe alphabetisch.
   Gibt ein NEUES Array mit denselben Objekten zurück (keine Kopien). */
export function sortPractices(list, nowTs) {
  const n = num(nowTs) ? nowTs : clockNow();
  return (Array.isArray(list) ? list : []).filter(isPractice)
    .map((p) => ({ p, r: STATUS[effectiveStatus(p, n)].rank, k: germanKey(p.name) }))
    .sort((a, b) => (a.r - b.r) || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((x) => x.p);
}
