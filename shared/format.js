/* VetNow — Anzeige-Formatierung.
   Gespeichert werden NUR Zeitstempel (ms). Früher standen Texte wie 'jetzt' oder 'Gestern 16:20'
   in den Nachrichten — die blieben ewig 'jetzt' und ließen sich weder sortieren noch zwischen
   Geräten zusammenführen (Web-/Extension-Audit). Jetzt wird erst beim Anzeigen formatiert.

   Bewusst ohne Intl/toLocaleString: Hermes (React Native) und ältere Browser liefern dort
   unterschiedliche Ergebnisse. Mit festen deutschen Namen sieht es überall gleich aus. */
import { now as clockNow, isoFromTs, parseISO, dayDiff, weekdayMon0, hhmmOf, MINUTE } from './clock.js';

export const MONTHS_DE = Object.freeze(['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']);
export const DOW_DE = Object.freeze(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
export const DOW_LONG_DE = Object.freeze(['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']);

const pad2 = (n) => (n < 10 ? '0' : '') + n;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/* '08:30' */
export function fmtTime(ts) {
  return isNum(ts) ? hhmmOf(ts) : '';
}

/* '04.06.' bzw. mit Jahr '04.06.2026' */
export function fmtDateShort(iso, withYear) {
  const p = parseISO(iso);
  if (!p) return '';
  return pad2(p.d) + '.' + pad2(p.m) + '.' + (withYear ? String(p.y) : '');
}

/* Für die Chat-Liste: 'jetzt', 'vor 5 Min.', '14:05', 'gestern', 'Mo', '02.06.', '02.06.2025'. */
export function fmtRelative(ts, nowTs) {
  if (!isNum(ts)) return '';
  const n = isNum(nowTs) ? nowTs : clockNow();
  const diff = n - ts;
  if (diff >= 0 && diff < MINUTE) return 'jetzt';
  if (diff >= 0 && diff < 60 * MINUTE) return 'vor ' + Math.floor(diff / MINUTE) + ' Min.';
  const iso = isoFromTs(ts);
  const days = dayDiff(iso, isoFromTs(n));
  if (days === 0) return hhmmOf(ts);
  if (days === 1) return 'gestern';
  if (days > 1 && days < 7) return DOW_DE[weekdayMon0(iso)];
  const sameYear = parseISO(iso).y === parseISO(isoFromTs(n)).y;
  return fmtDateShort(iso, !sameYear);
}

/* Für Nachrichten-Blasen: '14:05', 'gestern, 14:05', 'Mo, 14:05', '02.06., 14:05'. */
export function fmtMessageTime(ts, nowTs) {
  if (!isNum(ts)) return '';
  const n = isNum(nowTs) ? nowTs : clockNow();
  const iso = isoFromTs(ts);
  const days = dayDiff(iso, isoFromTs(n));
  const t = hhmmOf(ts);
  if (days === 0) return t;
  if (days === 1) return 'gestern, ' + t;
  if (days > 1 && days < 7) return DOW_DE[weekdayMon0(iso)] + ', ' + t;
  return fmtDateShort(iso, parseISO(iso).y !== parseISO(isoFromTs(n)).y) + ', ' + t;
}

/* 'Donnerstag, 04. Juni 2026' */
export function fmtDateLong(iso) {
  const p = parseISO(iso);
  if (!p) return '';
  return DOW_LONG_DE[weekdayMon0(iso)] + ', ' + pad2(p.d) + '. ' + MONTHS_DE[p.m - 1] + ' ' + p.y;
}

/* Kalender-Kopf: 'Heute', 'Morgen', 'Gestern', sonst 'Do, 04.06.' */
export function fmtDayLabel(iso, nowTs) {
  // Ungültiges Datum → leer. Früher kam 'Heute' heraus (dayDiff liefert bei Unsinn 0).
  if (!parseISO(iso)) return '';
  const n = isNum(nowTs) ? nowTs : clockNow();
  const d = dayDiff(isoFromTs(n), iso);
  if (d === 0) return 'Heute';
  if (d === 1) return 'Morgen';
  if (d === -1) return 'Gestern';
  return DOW_DE[weekdayMon0(iso)] + ', ' + fmtDateShort(iso);
}

/* Trenner im Chatverlauf: 'Heute', 'Gestern', 'Donnerstag, 04. Juni 2026'. */
export function fmtDaySeparator(ts, nowTs) {
  if (!isNum(ts)) return '';
  const iso = isoFromTs(ts);
  const d = dayDiff(iso, isoFromTs(isNum(nowTs) ? nowTs : clockNow()));
  if (d === 0) return 'Heute';
  if (d === 1) return 'Gestern';
  return fmtDateLong(iso);
}

/* Ablaufzeit im Dashboard: 'Fr, 26.09., 08:30' */
export function fmtDateTime(ts) {
  if (!isNum(ts)) return '';
  const iso = isoFromTs(ts);
  return DOW_DE[weekdayMon0(iso)] + ', ' + fmtDateShort(iso) + ', ' + hhmmOf(ts);
}

/* Countdown 'HH:MM:SS' (wie im alten Dashboard); negativ → '00:00:00'. Stunden ≥ 100 bleiben vollständig. */
export function fmtCountdown(ms) {
  const v = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const s = v % 60;
  return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
}

/* Kurz und menschlich: 'noch 3 Std. 12 Min.', 'noch 8 Min.', 'abgelaufen'. */
export function fmtRemaining(ms) {
  const v = Number(ms) || 0;
  if (v <= 0) return 'abgelaufen';
  const totalMin = Math.ceil(v / MINUTE);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return 'noch ' + m + ' Min.';
  return 'noch ' + h + ' Std.' + (m ? ' ' + m + ' Min.' : '');
}

/* Dateigrößen mit deutschem Komma: '512 B', '1,2 KB', '3,4 MB'. */
export function fmtBytes(n) {
  const v = Math.max(0, Number(n) || 0);
  if (v < 1024) return Math.round(v) + ' B';
  const units = ['KB', 'MB', 'GB'];
  let x = v / 1024;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  // 1023,95 KB würde auf „1024 KB" gerundet → dann eine Einheit höher („1 MB").
  if (Math.round(x) >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  const s =x >= 100 ? String(Math.round(x)) : x.toFixed(1).replace('.', ',').replace(/,0$/, '');
  return s + ' ' + units[i];
}
