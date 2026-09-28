/* Bot 3.0 — Praxis-Fakten (Öffnungszeiten, Telefon, 24h, Status), Preistabelle, Terminvorschläge.

   Bot 2.2 sagte JEDER Praxis „Mo–Fr 8–18, Sonntag geschlossen" — auch dem 24h-Notdienst (Audit, M15).
   Jetzt kommt alles aus dem übergebenen practice-Objekt (Datenmodell §4: hoursShort, hoursWeek[7],
   phone, status, absence). Fehlt eine Angabe, sagt der Bot ehrlich „siehe Praxisseite" statt zu raten.

   Zeit: `now` (ms) wird hereingereicht, nie Date.now() — sonst wären Antworten nicht reproduzierbar. */

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const DAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const DAYS_FOLD = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'];

const num = (v) => typeof v === 'number' && isFinite(v);

/* Effektiver Status wie shared/status.js (hier nachgebaut, damit der Bot ohne weitere Module läuft):
   Abwesenheit → red; abgelaufen/unbestätigt → grey; sonst status.value. null = unbekannt. */
export function practiceStatus(p, now) {
  if (!p) return null;
  if (typeof p.effectiveStatus === 'string') return p.effectiveStatus;
  if (typeof p.liveStatus === 'string') return p.liveStatus;
  const a = p.absence;
  if (a && num(now) && (num(a.from) || num(a.to))) {
    const from = num(a.from) ? a.from : -Infinity;
    const to = num(a.to) ? a.to : Infinity;
    if (now >= from && now <= to) return 'red';
  }
  const s = p.status;
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object') {
    if (s.value !== 'green' && s.value !== 'yellow' && s.value !== 'red') return 'grey';
    if (num(now) && num(s.expiresAt) && now > s.expiresAt) return 'grey';
    if (!num(s.expiresAt) && !num(s.setAt)) return 'grey';
    return s.value;
  }
  return null;
}

function fallbackOf(fb) {
  if (!fb) return null;
  if (typeof fb === 'string') return { name: fb, phone: '' };
  if (typeof fb === 'object' && fb.name) return { name: String(fb.name), phone: fb.phone ? String(fb.phone) : '' };
  return null;
}

export function practiceFacts(practice, practiceName, now) {
  const p = practice && typeof practice === 'object' ? practice : {};
  const name = String(p.name || practiceName || '').trim();
  const hoursWeek = Array.isArray(p.hoursWeek) && p.hoursWeek.length === 7 ? p.hoursWeek.map((h) => String(h || '')) : null;
  const hoursShort = p.hoursShort ? String(p.hoursShort) : '';
  const is24h = p.is24h === true
    || /24\s*(h|std|stunden)/i.test(hoursShort)
    || !!(hoursWeek && hoursWeek.every((h) => /24/.test(h)))
    || /24\s*h|24-stunden|rund um die uhr/i.test(name);
  return {
    name,
    display: name || 'unsere Praxis',
    phone: p.phone ? String(p.phone) : '',
    address: p.address ? String(p.address) : '',
    hoursWeek,
    hoursShort,
    is24h,
    status: practiceStatus(p, now),
    fallback: fallbackOf(p.fallbackEmergency),
    hasHours: !!(hoursWeek || hoursShort || is24h),
  };
}

/* „8–18" → „8–18 Uhr", „geschlossen" bleibt, „24 h" → „rund um die Uhr" */
function fmtDay(h) {
  const t = String(h || '').trim();
  if (!t) return 'keine Angabe';
  if (/geschlossen|zu$/i.test(t)) return 'geschlossen';
  if (/24/.test(t)) return 'rund um die Uhr';
  // Ohne Ziffern („Notdienst", „nach Vereinbarung") unverändert lassen — sonst „Notdienst Uhr"
  if (!/\d/.test(t)) return t;
  return /uhr/i.test(t) ? t : t + ' Uhr';
}

/* Mo–Fr zusammenfassen: „Mo–Fr 8–18 Uhr, Sa 9–12 Uhr, So geschlossen" */
export function hoursSummary(f) {
  if (f.is24h) return 'rund um die Uhr — 24 Stunden, auch an Wochenenden und Feiertagen';
  if (!f.hoursWeek) return f.hoursShort || '';
  const parts = [];
  let i = 0;
  while (i < 7) {
    let j = i;
    while (j + 1 < 7 && f.hoursWeek[j + 1] === f.hoursWeek[i]) j++;
    parts.push((j > i ? DAYS[i] + '–' + DAYS[j] : DAYS[i]) + ' ' + fmtDay(f.hoursWeek[i]));
    i = j + 1;
  }
  return parts.join(', ');
}

export function dayHours(f, dayIdx) {
  if (f.is24h) return 'rund um die Uhr';
  if (!f.hoursWeek) return null;
  return fmtDay(f.hoursWeek[dayIdx]);
}

/* Montag = 0 */
export function weekdayOf(now) {
  if (!num(now)) return null;
  return (new Date(now).getDay() + 6) % 7;
}

/* Zeitspannen aus „8–18", „8:30–12, 14–18" in Minuten */
export function parseRanges(h) {
  const out = [];
  if (!h || /geschlossen/i.test(h)) return out;
  if (/24/.test(h)) return [[0, 24 * 60]];
  const re = /(\d{1,2})(?:[:.](\d{2}))?\s*[–-]\s*(\d{1,2})(?:[:.](\d{2}))?/g;
  let m;
  while ((m = re.exec(h)) !== null) out.push([+m[1] * 60 + (+m[2] || 0), +m[3] * 60 + (+m[4] || 0)]);
  return out;
}

/* ---------- Preise: EINE Tabelle für Bot, KI-Prompt und Doku ---------- */
export const PRICES = {
  exam: { label: 'Allgemeine Untersuchung', range: 'ca. 45–70 €' },
  vacc: { label: 'Impfung inkl. Untersuchung', range: 'ca. 50–90 €' },
  castration: { label: 'Kastration inkl. Narkose', range: 'Kater ca. 120–180 €, Katze ca. 180–280 €, Hund je nach Größe ca. 250–450 €' },
  dental: { label: 'Zahnsanierung in Narkose', range: 'ab ca. 180 €, je nach Aufwand' },
  xray: { label: 'Röntgen', range: 'ca. 60–120 €' },
  blood: { label: 'Blutbild', range: 'ca. 50–100 €' },
  chip: { label: 'Mikrochip inkl. Registrierung', range: 'ca. 40–60 €' },
  passport: { label: 'EU-Heimtierausweis', range: 'ca. 20–30 €' },
  housecall: { label: 'Hausbesuch (Anfahrt)', range: 'ab ca. 30 € zuzüglich Behandlung' },
  samples: { label: 'Kotprobe', range: 'ca. 25–40 €' },
  claws: { label: 'Krallen schneiden', range: 'ca. 10–20 €' },
  recheck: { label: 'Nachkontrolle', range: 'ca. 25–40 €' },
  night: { label: 'Notdienst-Zuschlag', range: 'je nach Uhrzeit ca. 30–80 € zusätzlich' },
};
export const PRICE_NOTE = 'Die genauen Kosten besprechen wir immer vor der Behandlung mit Ihnen — keine Überraschungen.';

/* Welche Leistung ist gemeint? (Begriffe gefaltet) */
const PRICE_SUBJECTS = [
  ['vacc', /impf|tollwut|booster/], ['castration', /kastr|sterilis/], ['dental', /zahn|zaehne/], ['xray', /roentgen/],
  ['blood', /blutbild|blutuntersuchung|labor/], ['chip', /chip/], ['passport', /heimtierausweis|tierpass|heimtierpass/],
  ['housecall', /hausbesuch/], ['samples', /kotprobe|stuhlprobe|urinprobe|probe/], ['claws', /krall/], ['recheck', /nachkontroll|kontroll|faeden/],
  ['night', /notdienst|nachts|wochenende|feiertag/], ['exam', /untersuchung|termin|behandlung|anschauen|ansehen|beratung/],
];
export function priceSubjects(norm) {
  const out = [];
  for (const [k, re] of PRICE_SUBJECTS) if (re.test(norm) && out.indexOf(k) < 0) out.push(k);
  return out;
}

/* ---------- Terminvorschläge ---------- */
const MORNING = ['08:30', '09:30', '10:15', '11:00'];
const AFTERNOON = ['14:00', '15:30', '16:30', '13:30'];
const toMin = (hhmm) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);

function pad(n) { return (n < 10 ? '0' : '') + n; }
function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

function openAt(f, dayIdx, hhmm) {
  if (f.is24h) return true;
  if (!f.hoursWeek) return dayIdx <= 4; // unbekannt: Mo–Fr annehmen
  const ranges = parseRanges(f.hoursWeek[dayIdx]);
  const m = toMin(hhmm);
  return ranges.some(([a, b]) => m >= a && m + 30 <= b);
}

export function dayLabel(dayOffset, dayIdx) {
  if (dayOffset === 0) return 'heute';
  if (dayOffset === 1) return 'morgen';
  return DAYS_LONG[dayIdx];
}

/* Zwei freie Zeiten ab morgen (deterministisch aus seed). `avoid` = schon angebotene Slots
   (beim Verschieben sollen neue Zeiten kommen). Ohne `now` gibt es nur relative Angaben
   („morgen, 09:30 Uhr") und iso = null. */
function rotate(list, s) { const out = []; for (let k = 0; k < list.length; k++) out.push(list[(s + k) % list.length]); return out; }
function dayOpen(f, di) {
  if (f.is24h) return true;
  if (!f.hoursWeek) return di <= 4;
  return parseRanges(f.hoursWeek[di]).length > 0;
}
export function makeSlots({ now, facts, seed = 0, avoid = [], count = 2, day = null }) {
  const s = Math.abs(seed | 0);
  const avoidSet = {};
  for (const a of avoid) if (a && a.label) avoidSet[a.label] = 1;
  const out = [];
  const add = (lbl, hhmm, iso) => {
    const label = lbl + ', ' + hhmm + ' Uhr';
    if (avoidSet[label] || out.some((x) => x.label === label)) return false;
    out.push({ label, iso, day: lbl, time: hhmm });
    return true;
  };
  const first = rotate(MORNING, s).concat(rotate(AFTERNOON, s));
  const second = rotate(AFTERNOON, s).concat(rotate(MORNING, s));
  if (!num(now)) {
    const days = s % 2 ? ['morgen', 'übermorgen'] : ['morgen', 'morgen'];
    for (const h of first) if (add(days[0], h, null)) break;
    for (const d of [days[1], 'übermorgen']) { let done = false; for (const h of second) if (add(d, h, null)) { done = true; break; } if (done) break; }
    return out.slice(0, count);
  }
  const base = new Date(now);
  const today = (base.getDay() + 6) % 7;
  let openDays = [];
  for (let off = 1; off <= 14 && openDays.length < 6; off++) { const di = (today + off) % 7; if (dayOpen(facts, di)) openDays.push({ off, di }); }
  // Wunschtag („morgen", „Freitag"): nur dieser Tag, sofern geöffnet — sonst normale Vorschläge
  const want = day === 'morgen' ? (today + 1) % 7 : day === 'übermorgen' ? (today + 2) % 7 : DAYS_LONG.indexOf(day);
  if (want >= 0) {
    const only = openDays.filter((d) => d.di === want).slice(0, 1);
    if (only.length) openDays = only;
  }
  // „heute": nur Zeiten frühestens eine Stunde ab jetzt, und nur wenn heute noch etwas frei ist
  const nowMin = base.getHours() * 60 + base.getMinutes();
  const lateEnough = (d, h) => d.off !== 0 || toMin(h) >= nowMin + 60;
  if (day === 'heute' && dayOpen(facts, today)) {
    const t = { off: 0, di: today };
    if (MORNING.concat(AFTERNOON).some((h) => openAt(facts, today, h) && lateEnough(t, h))) openDays = [t].concat(openDays.slice(0, 2));
  }
  const iso = (off, hhmm) => isoDate(new Date(base.getFullYear(), base.getMonth(), base.getDate() + off)) + 'T' + hhmm;
  const pickOn = (days, list) => {
    for (const d of days) for (const h of list) if (openAt(facts, d.di, h) && lateEnough(d, h) && add(dayLabel(d.off, d.di), h, iso(d.off, h))) return true;
    return false;
  };
  pickOn(openDays, first);
  const second2 = s % 2 && openDays.length > 1 ? openDays.slice(1) : openDays;
  // Zweiter Vorschlag: möglichst Nachmittag und eine ANDERE Uhrzeit — sonst ist „um 09:30" mehrdeutig
  const used = out.map((o) => o.time);
  const fresh = (list) => list.filter((h) => used.indexOf(h) < 0);
  if (!pickOn(second2, fresh(rotate(AFTERNOON, s))) && !pickOn(openDays, fresh(rotate(AFTERNOON, s))) && !pickOn(second2, fresh(rotate(MORNING, s)))) pickOn(second2, second);
  return out.slice(0, count);
}

/* Eine vom Menschen genannte Zeit in einen Slot umwandeln („Freitag um 17 Uhr"). */
export function slotFromParts({ now, dayWord, hhmm }) {
  let label = (dayWord || 'morgen') + ', ' + hhmm + ' Uhr';
  let iso = null;
  if (num(now)) {
    const base = new Date(now);
    const today = (base.getDay() + 6) % 7;
    let off = 1;
    if (dayWord === 'heute') off = 0;
    else if (dayWord === 'morgen') off = 1;
    else if (dayWord === 'übermorgen') off = 2;
    else {
      const di = DAYS_LONG.indexOf(dayWord);
      if (di >= 0) off = ((di - today + 7) % 7) || 7;
    }
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + off);
    iso = isoDate(d) + 'T' + hhmm;
    const lbl = dayWord && DAYS_LONG.indexOf(dayWord) >= 0 ? (off === 1 ? 'morgen' : off === 0 ? 'heute' : dayWord) : (dayWord || 'morgen');
    label = lbl + ', ' + hhmm + ' Uhr';
  }
  return { label, iso, day: dayWord || 'morgen', time: hhmm };
}

/* Hat die Praxis zu dieser Zeit offen? null = unbekannt */
export function isOpenAt(f, now, dayWord, hhmm) {
  if (f.is24h) return true;
  if (!f.hoursWeek) return null;
  let di = DAYS_LONG.indexOf(dayWord);
  if (di < 0) {
    const w = weekdayOf(now);
    if (w === null) return null;
    di = dayWord === 'heute' ? w : dayWord === 'übermorgen' ? (w + 2) % 7 : (w + 1) % 7;
  }
  const ranges = parseRanges(f.hoursWeek[di]);
  const m = toMin(hhmm);
  return { open: ranges.some(([a, b]) => m >= a && m < b), dayIdx: di };
}
