// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* Bot 3.0 — Gesprächszustand aus dem Verlauf (message.meta) und Terminauswahl.

   Warum meta statt Text-Regexe: Bot 2.2 hat angebotene Termine aus dem eigenen Antworttext
   zurückgelesen („Tag … hh:mm"). Das nahm immer die ERSTE Zeit, „passt nicht" galt als Zusage,
   und weil die Bestätigung selbst wieder eine Zeit enthielt, buchte ein späteres „Perfekt, danke!"
   ein zweites Mal (Audit: 3 von 9 Slot-Tests richtig). Jetzt schreibt der Bot an seine eigenen
   Nachrichten meta = { intent, triage, offeredSlots:[{label, iso}], asked, booked } und liest beim
   nächsten Zug genau das wieder. Gebucht wird nur, solange offeredSlots offen sind — danach sind
   sie leer, also genau EINMAL.

   Alte Verläufe ohne meta (Legacy-Aufrufer botConversationReply) werden hilfsweise aus dem Text
   gelesen: „morgen, 09:30 Uhr" = Angebot, „… eingetragen" = gebucht. */
import { fold, isNegator } from './normalize.js';
import { DAYS_LONG, DAYS_FOLD } from './facts.js';

const STICKY_MS = 30 * 60 * 1000;
const STICKY_TURNS = 3;
const num = (v) => typeof v === 'number' && isFinite(v);

export function normPersona(p) {
  return p === 'owner' || p === 'colleague' ? p : 'clinic';
}

/* Wer schreibt, wer antwortet? persona = wer ANTWORTET (Vertrag §5). Praxis antwortet der
   Tierhalter:in; Tierhalter:in antwortet der Praxis; Kolleg:in (Netzwerk) sitzt auf der Seite
   'owner' (= peerPracticeId) und antwortet der Praxis 'clinic'. */
function sidesFor(persona, current) {
  if (current && (current.from === 'owner' || current.from === 'clinic')) {
    return { userSide: current.from, botSide: current.from === 'owner' ? 'clinic' : 'owner' };
  }
  if (persona === 'clinic') return { userSide: 'owner', botSide: 'clinic' };
  return { userSide: 'clinic', botSide: 'owner' };
}

function textOf(m) {
  return m && typeof m.text === 'string' ? m.text : '';
}

/* „morgen, 09:30 Uhr" / „Donnerstag, 14:00 Uhr" aus einem alten Bot-Text (ohne meta). */
const SLOT_RX = /(heute|morgen|übermorgen|uebermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag),? (?:um )?(\d{1,2}:\d{2}) Uhr/gi;
export function slotsFromText(text) {
  const out = [];
  const t = String(text || '');
  SLOT_RX.lastIndex = 0;
  let m;
  while ((m = SLOT_RX.exec(t)) !== null) {
    const day = m[1].toLowerCase() === 'uebermorgen' ? 'übermorgen' : m[1];
    const d0 = DAYS_FOLD.indexOf(fold(day));
    const dayLbl = d0 >= 0 ? DAYS_LONG[d0] : day.toLowerCase();
    const hh = m[2].length === 4 ? '0' + m[2] : m[2];
    const label = dayLbl + ', ' + hh + ' Uhr';
    if (!out.some((s) => s.label === label)) out.push({ label, iso: null });
  }
  return out;
}

/* Tag und Uhrzeit aus einem Slot-Label zurückgewinnen (meta speichert nur {label, iso}). */
export function slotParts(slot) {
  const l = String((slot && slot.label) || '');
  const m = /^([^,]+), (\d{2}:\d{2}) Uhr/.exec(l);
  return m ? { day: m[1], time: m[2] } : { day: '', time: '' };
}

function cleanSlot(s) {
  if (!s || typeof s.label !== 'string') return null;
  return { label: s.label, iso: typeof s.iso === 'string' ? s.iso : null };
}

/* Liest den Zustand. messages = Verlauf; die aktuelle Nachricht darf schon enthalten sein
   (autoreply übergibt den ganzen Chat, der Hub-Endpunkt nur den Verlauf davor). */
export function readState({ messages, userText, persona, now }) {
  const list = Array.isArray(messages) ? messages.filter((m) => m && typeof m === 'object' && !m.deleted) : [];
  let current = null;
  let history = list;
  const last = list.length ? list[list.length - 1] : null;
  if (last && last.type !== 'note' && last.from !== 'system' && !last.source && textOf(last) === String(userText == null ? '' : userText)) {
    const sd = sidesFor(persona, last);
    // Nur als „aktuell" werten, wenn sie von der schreibenden (nicht der antwortenden) Seite kommt
    if (last.from === sd.userSide) { current = last; history = list.slice(0, -1); }
  }
  const { userSide, botSide } = sidesFor(persona, current);

  // Bot-Nachrichten = Nachrichten der antwortenden Seite mit meta oder source (nicht von Menschen)
  const isBot = (m) => m.from === botSide && m.type !== 'note' && (m.source || (m.meta && typeof m.meta === 'object'));
  const isUser = (m) => m.from === userSide && m.type !== 'note';

  // Letzter Bot-Zug = zusammenhängende Nachrichten der antwortenden Seite nach der letzten Nutzernachricht
  let lastTurn = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.type === 'note' || m.from === 'system') continue;
    if (m.from === botSide) { lastTurn.unshift(m); continue; }
    break;
  }
  const lastBotMeta = (() => {
    for (let i = lastTurn.length - 1; i >= 0; i--) if (lastTurn[i].meta && typeof lastTurn[i].meta === 'object') return lastTurn[i].meta;
    return null;
  })();
  const lastTurnText = lastTurn.map(textOf).join(' ');

  let offeredSlots = [];
  let asked = null;
  let booked = null;
  let legacy = false;
  if (lastBotMeta) {
    offeredSlots = Array.isArray(lastBotMeta.offeredSlots) ? lastBotMeta.offeredSlots.map(cleanSlot).filter(Boolean) : [];
    asked = typeof lastBotMeta.asked === 'string' ? lastBotMeta.asked : null;
  } else if (lastTurn.length) {
    // Legacy: ohne meta aus dem Text lesen
    legacy = true;
    if (!/eingetragen/i.test(lastTurnText)) offeredSlots = slotsFromText(lastTurnText);
    if (offeredSlots.length) asked = 'slot';
    else if (/\?\s*$/.test(lastTurnText.trim())) asked = 'details';
  }
  // Gebuchter Termin: letzter bekannter booked-Eintrag (bleibt über spätere Züge erhalten)
  for (let i = history.length - 1; i >= 0 && !booked; i--) {
    const m = history[i];
    if (m.from !== botSide) continue;
    if (m.meta && m.meta.booked && typeof m.meta.booked.label === 'string') booked = cleanSlot(m.meta.booked);
    else if (!m.meta && /eingetragen/i.test(textOf(m))) {
      const s = slotsFromText(textOf(m));
      if (s.length) booked = s[0];
    }
  }
  // Alle je angebotenen Slots (beim Verschieben neue Zeiten anbieten)
  const everOffered = [];
  for (const m of history) {
    if (m.from !== botSide) continue;
    const src = m.meta && Array.isArray(m.meta.offeredSlots) ? m.meta.offeredSlots : (!m.meta ? slotsFromText(textOf(m)) : []);
    for (const s of src) if (s && s.label && !everOffered.some((x) => x.label === s.label)) everOffered.push(cleanSlot(s));
  }

  // Sticky-Triage: letzter Notfall/Gift aus einem Bot-meta, 30 min bzw. die nächsten 3 Nachrichten
  let sticky = null;
  let usersAfter = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (isUser(m)) { usersAfter++; continue; }
    if (m.from !== botSide || !m.meta || !m.meta.triage) continue;
    const tr = m.meta.triage;
    if (tr.level !== 'emergency' && tr.level !== 'poison') continue;
    const at = num(tr.at) ? tr.at : (num(m.ts) ? m.ts : null);
    // Weitergereichte Sticky-Einträge zählen ihre bisherigen Nachrichten mit (turn), sonst würde
    // jede Antwort den Notfall-Modus ohne Zeitangabe endlos verlängern
    const turn = tr.sticky && num(tr.turn) ? tr.turn : 0;
    const fresh = num(now) && at !== null ? (now - at) <= STICKY_MS && now >= at - 60000 : usersAfter + turn < STICKY_TURNS;
    if (fresh) sticky = { level: tr.level, reason: tr.reason || '', at, heat: !!tr.heat, poison: tr.poison || null, usersAfter, turn };
    break;
  }

  // Texte für die Tier-Erkennung: nur Menschen (keine Bot-Texte mit Tierart-Hinweisen) + Notizen
  const petTexts = [];
  for (const m of history) {
    if (m.meta && m.meta.request && (m.meta.request.petName || m.meta.request.animal)) {
      const r = m.meta.request;
      const sp = { dog: 'Hund', cat: 'Katze', small: 'Kaninchen', horse: 'Pferd', bird: 'Vogel', exotic: 'Echse' }[r.animal] || '';
      if (r.petName || sp) petTexts.push(((sp || 'Tier') + ' ' + (r.petName || '')).trim() + '.');
    }
    if (m.source) continue;
    const t = textOf(m);
    if (t) petTexts.push(t);
  }

  let botTurns = 0;
  for (const m of history) if (isBot(m)) botTurns++;

  return {
    current, history, userSide, botSide, lastTurn, lastTurnTexts: lastTurn.map(textOf), lastBotMeta, legacy,
    offeredSlots, asked, booked, everOffered, sticky, petTexts, botTurns,
  };
}

/* ---------- Terminwahl aus dem Nutzertext ---------- */
const ORD = {
  erste: 0, ersten: 0, erster: 0, erstes: 0, first: 0, eins: 0, fruehere: 0, frueheren: 0,
  zweite: 1, zweiten: 1, zweiter: 1, zweites: 1, second: 1, spaetere: 1, spaeteren: 1,
  letzte: 99, letzten: 99, letzter: 99, last: 99,
};
const YES = {
  ja: 1, jo: 1, jap: 1, jawohl: 1, passt: 1, gerne: 1, gern: 1, perfekt: 1, super: 1, ok: 1, okay: 1, oki: 1, einverstanden: 1,
  nehme: 1, nehmen: 1, genau: 1, prima: 1, top: 1, eintragen: 1, buchen: 1, klar: 1, yes: 1, sure: 1, wunderbar: 1, bestens: 1,
  geht: 1, klappt: 1, fein: 1, gut: 1, bitte: 1, reservieren: 1, sicher: 1, freilich: 1,
};

/* Uhrzeiten im normalisierten Text: „14:00", „um 14", „14 uhr" → „14:00" (2-stellig). */
export function timesIn(norm) {
  const out = [];
  const add = (h, m) => {
    const hh = +h; const mm = +(m || 0);
    if (hh > 23 || mm > 59) return;
    const s = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    if (out.indexOf(s) < 0) out.push(s);
  };
  let m;
  const r1 = /(\d{1,2}):(\d{2})/g;
  while ((m = r1.exec(norm)) !== null) add(m[1], m[2]);
  const r2 = /\bum (\d{1,2})\b(?!:)/g;
  while ((m = r2.exec(norm)) !== null) add(m[1], 0);
  // „14:00 uhr" nicht als „00 uhr" lesen: Zeichen davor darf kein Doppelpunkt sein (ohne Lookbehind)
  const r3 = /(^|[^:\d])(\d{1,2}) ?uhr\b/g;
  while ((m = r3.exec(norm)) !== null) add(m[2], 0);
  const r4 = /\bat (\d{1,2}) ?(am|pm)?\b/g;
  while ((m = r4.exec(norm)) !== null) add(m[2] === 'pm' && +m[1] < 12 ? +m[1] + 12 : m[1], 0);
  return out;
}

/* Tag im Text: Wochentag-Name, „heute", „morgen", „übermorgen" → Anzeige-Wort. */
export function dayIn(norm) {
  const toks = norm.split(/[^a-z]+/);
  for (const t of toks) {
    const i = DAYS_FOLD.indexOf(t) >= 0 ? DAYS_FOLD.indexOf(t) : DAYS_FOLD.indexOf(t.replace(/s$/, ''));
    if (i >= 0) return DAYS_LONG[i];
  }
  if (toks.indexOf('uebermorgen') >= 0) return 'übermorgen';
  if (toks.indexOf('heute') >= 0) return 'heute';
  if (toks.indexOf('morgen') >= 0 && toks.indexOf('guten') < 0) return 'morgen';
  return null;
}

/* Negative Antwort auf ein Angebot: „passt nicht", „geht leider nicht", „nein", „keiner". */
export function isDecline(an) {
  const toks = an.toks;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i].t;
    if (t === 'nein' || t === 'keiner' || t === 'keinen' || t === 'no' || t === 'nope') return true;
    if (t === 'passt' || t === 'geht' || t === 'klappt' || t === 'kann' || t === 'koennen' || t === 'schaffe' || t === 'schaffen' || t === 'works') {
      for (let j = i + 1; j <= Math.min(toks.length - 1, i + 3); j++) if (isNegator(toks[j].t) && toks[j].c === toks[i].c) return true;
      for (let j = Math.max(0, i - 2); j < i; j++) if (isNegator(toks[j].t) && toks[j].c === toks[i].c) return true;
    }
    if ((t === 'beide' || t === 'beides') && toks[i + 1] && isNegator(toks[i + 1].t)) return true;
    if ((t === 'andere' || t === 'anderen' || t === 'anderer') && toks[i + 1] && /zeit|termin|tag/.test(toks[i + 1].t)) return true;
  }
  return false;
}

export function isAffirm(an) {
  if (isDecline(an)) return false;
  for (const tk of an.toks) if (YES[tk.t] === 1 && !tk.neg) return true;
  const n = an.norm;
  return /\b(klingt gut|machen wir so|sehr gerne|das nehme ich|nehmen wir)\b/.test(n);
}

/* Wochentag (Mo=0) eines Tages-Worts relativ zu now; null = unbekannt. */
function weekdayOfWord(word, now) {
  const f = fold(word || '');
  const i = DAYS_FOLD.indexOf(f);
  if (i >= 0) return i;
  if (!num(now)) return null;
  const w = (new Date(now).getDay() + 6) % 7;
  if (f === 'heute') return w;
  if (f === 'morgen') return (w + 1) % 7;
  if (f === 'uebermorgen') return (w + 2) % 7;
  return null;
}
function sameDay(a, b, now) {
  if (fold(a) === fold(b)) return true;
  const x = weekdayOfWord(a, now);
  const y = weekdayOfWord(b, now);
  return x !== null && x === y;
}

/* Welcher angebotene Slot ist gemeint?
   → { pick: index, plain? } | { propose: {day, time} } | { proposeDay } | { decline } | null */
export function chooseSlot(an, offered, now) {
  const norm = an.norm;
  const times = timesIn(norm);
  const day = dayIn(norm);
  const parts = offered.map(slotParts);
  if (isDecline(an) && !times.length) return { decline: true };
  if (times.length) {
    for (const t of times) {
      const cands = [];
      parts.forEach((p, i) => { if (p.time === t) cands.push(i); });
      if (!cands.length) continue;
      if (!day) return { pick: cands[0] };
      for (const i of cands) if (sameDay(parts[i].day, day, now)) return { pick: i };
    }
    return { propose: { day: day || (parts[0] && parts[0].day) || 'morgen', time: times[0] } };
  }
  for (const tk of an.toks) {
    const o = ORD[tk.t];
    if (o !== undefined && o >= 0 && !tk.neg) {
      const idx = o === 99 ? offered.length - 1 : o;
      if (idx < offered.length) return { pick: idx };
    }
  }
  if (/\b(vormittag|vormittags|frueh|morgens)\b/.test(norm) || /\b(nachmittag|nachmittags|abends|spaeter)\b/.test(norm)) {
    const am = /\b(vormittag|vormittags|frueh|morgens)\b/.test(norm);
    const idx = parts.findIndex((p) => (am ? +p.time.slice(0, 2) < 12 : +p.time.slice(0, 2) >= 12));
    if (idx >= 0) return { pick: idx };
  }
  if (day) {
    const idx = parts.map((p, i) => (sameDay(p.day, day, now) ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 1) return { pick: idx[0] };
    if (!idx.length && day !== 'morgen') return { proposeDay: day };
  }
  if (isAffirm(an)) return { pick: 0, plain: true };
  if (isDecline(an)) return { decline: true };
  return null;
}

/* Kurz-Antworten ohne eigenes Anliegen („seit gestern", „2 Jahre alt", „eher schlecht"). */
export function isShortInfo(an) {
  return an.toks.length > 0 && an.toks.length <= 12 && !an.question;
}
