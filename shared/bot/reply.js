/* Bot 3.0 — Antwort-Motor: setzt Triage, Anliegen, Dialog-Zustand, Tiernamen und Texte zusammen.

   Reihenfolge (Praxis-Persona), bewusst fest:
     1. Triage ZUERST — Gift/Notfall schlagen alles andere (auch „Danke, aber jetzt krampft er").
     2. Gift-/Medikamenten-FRAGE → „Nein, bitte nicht …" (nie bestätigen).
     3. Laufender Notfall (sticky 30 min bzw. 3 Nachrichten) → Handlungsaufforderung bleibt vorne.
     4. Offene Terminvorschläge → Auswahl per Uhrzeit / „der zweite" / Wochentag / „ja"; „passt nicht" → neue Zeiten.
     5. Anliegen nach Punkten; bis zu zwei inhaltliche Anliegen werden beantwortet, soziale nur ohne Inhalt.
     6. Nichts erkannt → gezielte Rückfrage. Es gibt KEINE Zustimmungs-Floskel als Rückfallebene.
   Determinismus: Varianten hängen nur an Nachrichten-ID + Text + Zahl der Bot-Züge (kein Math.random,
   kein Date.now) — gelöschte Nachrichten verschieben nichts. `now` wird hereingereicht. */
import { analyzeText } from './engine.js';
import { triageAnalysis } from './triage.js';
import { C_INTENTS, C_OWNER, C_COLLEAGUE, C_MYTHS, scoreDefs, rank, THRESHOLD } from './intents.js';
import { petContext } from './pets.js';
import { practiceFacts, makeSlots, slotFromParts, isOpenAt, DAYS_LONG } from './facts.js';
import {
  R, MYTH_TEXTS, emergencyReply, poisonReply, urgentLead, poisonQuestionReply, followupReply, clarifyReply,
  bookedReply, proposeReply, telPart, FIRST_AID, cap,
} from './responses.de.js';
import { OWNER_R, COLLEAGUE_R, ownerFallback, colleagueFallback, greetingText, imageTexts } from './personas.de.js';
import { readState, normPersona, chooseSlot, timesIn, dayIn, isAffirm, isDecline, isShortInfo, slotParts } from './dialog.js';
import { capText } from './normalize.js';

const num = (v) => typeof v === 'number' && isFinite(v);

/* FNV-1a — kleiner, stabiler Hash für den Varianten-Seed (Math.imul gibt es auch in Hermes). */
export function hashStr(s) {
  let h = 2166136261;
  const t = String(s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* Anrede des Tiers in Praxis-Texten: T steht für Nominativ UND Akkusativ („ist ${T} ansprechbar",
   „wir nehmen ${T} dran") — deshalb nur Formen, die in beiden Fällen gleich lauten. */
const T_OF = { cat_f: 'Ihre Katze', horse: 'Ihr Pferd', small: 'Ihr Tier' };
const D_OF = { dog: 'Ihrem Hund', dog_f: 'Ihrer Hündin', cat_f: 'Ihrer Katze', cat_m: 'Ihrem Kater', cat: 'Ihrer Katze', horse: 'Ihrem Pferd', small: 'Ihrem Tier', bird: 'Ihrem Vogel', exotic: 'Ihrem Tier' };

const FOLLOW_ASKED = { since: 1, details: 1, 'vacc-details': 1, 'travel-date': 1 };
/* Reihenfolge, wenn zwei Anliegen beantwortet werden: Gesundheit vor Organisatorischem */
const GROUP = {
  euthanasia: 0, microchip: 0, activity: 1, symptom: 1, eyes: 1, skin: 1, joints: 1, dental: 1, behaviour: 1, pregnancy: 1, postop: 1,
  heat: 1, fireworks: 1, recovery: 1, weight: 2, senior: 2, puppy: 2, newpet: 2, vaccination: 2, castration: 2, parasites: 2,
  grooming: 2, nutrition: 2, medication: 1, anesthesia: 2, samples: 2, recheck: 2, referral: 2, travel: 2, secondopinion: 2,
  reschedule: 3, appointment: 3, emergencyservice: 3, hours: 4, price: 1.5, payment: 4, insurance: 4, address: 4, housecall: 3,
  contact: 4, botinfo: 5, complaint: 1,
};
/* Anliegen, bei denen ein zusätzliches „ja/ok" NICHT als Terminzusage gilt (echte Frage) */
const BOOK_NEUTRAL = { appointment: 1, ack: 1, thanks: 1, greeting: 1, bye: 1, reschedule: 1 };

/* ---------- Kontext für die Textbausteine ---------- */
function makeCtx(o, persona, st, an, tri, userText, now) {
  const facts = practiceFacts(o.practice, o.practiceName, now);
  const pc = petContext(st.petTexts.concat([userText]));
  const species = pc.species || null;
  const gender = pc.gender || null;
  const sk = species ? species + (gender ? '_' + gender : '') : '';
  const name = pc.petName;
  const seedBase = num(o.seed) ? (Math.abs(o.seed) >>> 0) : hashStr(((st.current && st.current.id) || '') + '|' + userText + '|' + st.botTurns);
  const avoid = {};
  for (const t of st.lastTurnTexts) avoid[t] = 1;
  let salt = 0;
  const c = {
    persona, facts, an, tri, st, now, seed: seedBase,
    pet: pc.pet, petName: name, species, gender, pets: pc.pets,
    T: name || T_OF[sk] || T_OF[species] || 'Ihr Tier',
    D: name || D_OF[sk] || D_OF[species] || 'Ihrem Tier',
    booked: st.booked,
    _slots: null,
    pick(list) {
      const arr = (list || []).filter((x) => typeof x === 'string' && x);
      if (!arr.length) return '';
      const start = ((seedBase % 1000003) + (salt++) * 7919) % arr.length;
      // Nicht wortgleich wiederholen, was der Bot eben geschrieben hat
      for (let k = 0; k < arr.length; k++) { const v = arr[(start + k) % arr.length]; if (!avoid[v]) return v; }
      return arr[start];
    },
    slots(avoidOffered, day) {
      const s = makeSlots({ now: num(now) ? now : null, facts, seed: seedBase, avoid: avoidOffered ? st.everOffered : [], count: 2, day: day || null });
      c._slots = s;
      return s;
    },
    slotText(slots) {
      const s = slots || [];
      if (s.length >= 2) return s[0].label + ' oder ' + s[1].label;
      if (s.length === 1) return s[0].label;
      return 'zeitnah einen Termin';
    },
  };
  return c;
}

/* ---------- Anliegen bewerten ---------- */
function scoreClinic(c) {
  const { an, tri } = c;
  const sc = scoreDefs(an, C_INTENTS);
  let ranked = rank(sc.scores, C_INTENTS);
  // Entwarnung nur als Aussage ohne Verneinung und ohne akute Lage („Frisst er wieder?" ist keine)
  if (an.question || tri.level !== 'none') ranked = ranked.filter((r) => r.intent !== 'recovery');
  const present = {};
  ranked.forEach((r) => { present[r.intent] = r; });
  const drop = {};
  for (const d of C_INTENTS) if (present[d.id] && d.suppress) d.suppress.forEach((x) => { drop[x] = 1; });
  if (present.reschedule) drop.appointment = 1;
  if (present.symptom && present.recovery && present.recovery.score <= present.symptom.score) drop.recovery = 1;
  ranked = ranked.filter((r) => !drop[r.intent]);
  const my = rank(scoreDefs(an, C_MYTHS).scores, C_MYTHS);
  const content = ranked.filter((r) => r.kind === 'content' && r.score >= THRESHOLD);
  const social = ranked.filter((r) => r.kind === 'social' && r.score >= THRESHOLD);
  return { ranked, content, social, myth: my.length ? my[0].intent : null, matched: sc.matched };
}

function pickTwo(content) {
  const two = content.slice(0, 2);
  if (two.length === 2 && two[1].score < two[0].score * 0.55) two.pop();
  two.sort((a, b) => ((GROUP[a.intent] ?? 3) - (GROUP[b.intent] ?? 3)) || (b.score - a.score));
  return two;
}

function runIntent(c, id) {
  const f = R[id];
  if (!f) return null;
  const r = f(c);
  if (!r) return null;
  r.texts = (r.texts || []).filter(Boolean);
  return r;
}

/* Termin-Anliegen mit Wunschzeit/Wunschtag im selben Satz („Kann ich Freitag um 10 kommen?") */
function appointmentWithWish(c) {
  const times = timesIn(c.an.norm);
  const day = dayIn(c.an.norm);
  if (times.length) return proposeWish(c, day || 'morgen', times[0]);
  if (day) {
    const slots = c.slots(false, day);
    return { texts: [c.pick([
      `Gern! ${cap(slots[0] ? slots[0].label : day)}${slots[1] ? ' oder ' + slots[1].label : ''} wäre frei — was passt Ihnen für ${c.T}?`,
      `Da finden wir etwas: ${c.slotText(slots)}. Welcher Termin passt Ihnen?`,
    ])], asked: 'slot', offer: true };
  }
  return null;
}

function proposeWish(c, dayWord, hhmm) {
  const slot = slotFromParts({ now: num(c.now) ? c.now : null, dayWord, hhmm });
  const open = isOpenAt(c.facts, c.now, dayWord, hhmm);
  if (open && open.open === false) {
    const dn = DAYS_LONG[open.dayIdx] || dayWord;
    return proposeReply(c, slot, `${cap(slotParts(slot).day === 'heute' || slotParts(slot).day === 'morgen' ? slotParts(slot).day : 'am ' + dn)} um ${hhmm} Uhr haben wir leider geschlossen.`);
  }
  return proposeReply(c, slot, null);
}

/* ---------- Praxis antwortet Tierhalter:in ---------- */
function clinicReply(c) {
  const { an, tri, st } = c;
  const raw = an.raw;
  const out = (r, intent, extra) => Object.assign({ intent }, r, extra || {});

  // 0) Leer / nur Emojis / nur Satzzeichen
  if (!an.toks.length) {
    if (st.sticky) return out(stickyReply(c, 'empty'), 'emergency-followup', { conf: 1 });
    if (raw.indexOf('?') >= 0) return out(clarifyReply(c, 'question'), 'clarify', { conf: 0 });
    return out(clarifyReply(c, 'empty'), 'empty', { conf: 0 });
  }
  // 1) + 2) Sicherheit
  if (tri.level === 'poison') return out(poisonReply(c, tri), 'poison', { conf: 1 });
  if (tri.level === 'emergency') return out(emergencyReply(c, tri), 'emergency', { conf: 1 });
  if (tri.question && tri.poisonQuestion) {
    const r = poisonQuestionReply(c, tri);
    if (st.sticky && r.texts[0] && !/sofort/i.test(r.texts[0])) r.texts.push(stickyLead(c));
    return out(r, 'poison-question', { conf: 1 });
  }

  const sc = scoreClinic(c);
  c.scores = sc;

  // 3) Laufender Notfall
  if (st.sticky && tri.level !== 'emergency') return out(stickyReply(c, 'text', sc), 'emergency-followup', { conf: 1 });

  const texts = [];
  let asked = null;
  let offer = false;
  let slotsOverride = null;
  let booked = null;
  let keepOffer = false;
  let intent = null;
  let conf = 0;

  // 4) Offene Terminvorschläge
  const nonBookContent = sc.content.filter((r) => !BOOK_NEUTRAL[r.intent]);
  if (st.offeredSlots.length) {
    const ch = chooseSlot(an, st.offeredSlots, c.now);
    if (ch && ch.pick !== undefined && !ch.plain && an.question) {
      // „Haben Sie auch am Samstag etwas?" ist eine Frage, keine Zusage → erst rückfragen, dann buchen
      return out(proposeReply(c, st.offeredSlots[ch.pick], null), 'propose-slot', { conf: 0.9 });
    }
    if (ch && ch.pick !== undefined && !(ch.plain && (nonBookContent.length || an.question))) {
      const slot = st.offeredSlots[ch.pick];
      const other = ch.plain && st.offeredSlots.length > 1 ? st.offeredSlots[1] : null;
      const r = bookedReply(c, slot, other);
      texts.push(...r.texts);
      booked = slot;
      intent = 'booking';
      conf = 1;
    } else if (ch && ch.decline && !nonBookContent.some((r) => r.intent !== 'reschedule')) {
      const r = R.reschedule(c);
      return out(r, 'reschedule', { conf: 0.9 });
    } else if (ch && ch.propose) {
      return out(proposeWish(c, ch.propose.day, ch.propose.time), 'propose-slot', { conf: 0.9 });
    } else if (ch && ch.proposeDay) {
      const slots = c.slots(true, ch.proposeDay);
      return out({ texts: [`Gern — ${c.slotText(slots)} wäre frei. Passt eines davon?`], asked: 'slot', offer: true }, 'appointment', { conf: 0.8 });
    } else {
      keepOffer = true;
    }
  }

  // 5) Anliegen
  let urgentText = null;
  if (tri.level === 'urgent') urgentText = urgentLead(c, tri);

  const chosen = [];
  if (sc.myth && !booked) chosen.push({ intent: 'myth:' + sc.myth, score: 2 });
  for (const r of pickTwo(sc.content.filter((x) => !(booked && BOOK_NEUTRAL[x.intent])))) if (chosen.length < 2) chosen.push(r);

  if (urgentText) texts.push(urgentText);
  for (const ch of chosen) {
    let r = null;
    if (ch.intent.indexOf('myth:') === 0) r = { texts: MYTH_TEXTS[ch.intent.slice(5)] || [] };
    else if (ch.intent === 'appointment') r = appointmentWithWish(c) || runIntent(c, 'appointment');
    else r = runIntent(c, ch.intent);
    if (!r || !r.texts.length) continue;
    // Beim zweiten Anliegen und bei „dringend" knapp bleiben
    const take = texts.length ? (chosen.length > 1 || urgentText ? Math.min(2, r.texts.length) : r.texts.length) : r.texts.length;
    texts.push(...r.texts.slice(0, take));
    if (!intent) { intent = ch.intent.indexOf('myth:') === 0 ? 'myth' : ch.intent; conf = Math.min(1, ch.score / 2); }
    if (r.asked && !asked) asked = r.asked;
    if (r.offer) { offer = true; if (r.slotsOverride) slotsOverride = r.slotsOverride; }
  }
  if (booked && intent === 'booking' && chosen.length) intent = 'booking';

  if (!texts.length || (urgentText && texts.length === 1 && !chosen.length && !booked)) {
    // Kein Inhalt erkannt
    if (!chosen.length && !booked) {
      const r = socialOrFollow(c, sc);
      if (urgentText && texts.length) {
        // „dringend" ohne Thema: Hinweis + gezielte Rückfrage
        if (r.intent !== 'thanks' && r.intent !== 'bye') texts.push(...r.texts.slice(0, 1));
      } else texts.push(...r.texts);
      if (!intent) { intent = urgentText ? 'urgent' : r.intent; conf = r.conf || 0; }
      if (r.asked && !asked) asked = r.asked;
      if (r.offer) { offer = true; if (r.slotsOverride) slotsOverride = r.slotsOverride; }
    }
  }
  if (urgentText && intent && intent !== 'urgent' && tri.level === 'urgent') conf = Math.max(conf, 0.8);
  return { texts, intent: intent || 'clarify', conf, asked, offer, slotsOverride, booked, keepOffer: keepOffer && !offer && !booked };
}

/* Soziales, Rückfragen-Antworten, Rückfallebene */
function socialOrFollow(c, sc) {
  const { an, st } = c;
  if (FOLLOW_ASKED[st.asked] && isShortInfo(an) && !sc.social.some((s) => s.intent === 'thanks' || s.intent === 'bye')) {
    return Object.assign(followupReply(c), { intent: 'followup', conf: 0.6 });
  }
  if (sc.social.length) {
    const top = sc.social[0].intent;
    if ((top === 'thanks' || top === 'ack' || top === 'bye') && st.booked) {
      return { texts: [c.pick([`Sehr gern — dann bis ${st.booked.label}! 🐾`, `Gern geschehen — bis ${st.booked.label}, wir freuen uns auf ${c.T}.`])], intent: top, conf: 0.9 };
    }
    const r = runIntent(c, top);
    if (r) return Object.assign(r, { intent: top, conf: Math.min(1, sc.social[0].score / 1.5) });
  }
  if (st.asked === 'reason' && isShortInfo(an)) return Object.assign(clarifyReply(c, 'default'), { intent: 'clarify', conf: 0 });
  return Object.assign(clarifyReply(c, an.question ? 'question' : 'default'), { intent: 'clarify', conf: 0 });
}

/* ---------- Laufender Notfall ---------- */
function stickyLead(c) {
  const s = c.st.sticky;
  const tel = telPart(c);
  if (s.level === 'poison') return `Bitte zuerst sofort anrufen${tel} bzw. losfahren — bei Vergiftungen zählt jede Minute, auch wenn ${c.T} noch munter wirkt.`;
  return `Bitte nicht abwarten: sofort anrufen${tel} bzw. losfahren — wir sind vorbereitet.`;
}

function stickyReply(c, kind, sc) {
  const s = c.st.sticky;
  const tel = telPart(c);
  const an = c.an;
  const leaving = /\b(fahren|fahre|fahrn) (jetzt |gleich |sofort )?(los|hin)\b|\bunterwegs\b|\bauf dem weg\b|\bsind (gleich|bald) (da|bei)|\bmachen uns (auf den weg|los)|\bkommen (sofort|gleich|jetzt)\b|\bon (our|the) way\b/.test(an.norm);
  const socialOnly = sc && !sc.content.length && sc.social.length;
  if (leaving || (socialOnly && isAffirm(an))) {
    return { texts: [c.pick([
      `Gut — wir sind vorbereitet und warten auf Sie. Falls sich unterwegs etwas verschlechtert, rufen Sie bitte sofort an${tel}.`,
      `Danke, bis gleich! Fahren Sie bitte vorsichtig. Wenn sich unterwegs etwas ändert, rufen Sie uns sofort an${tel}.`,
    ])], asked: null };
  }
  if (socialOnly) {
    return { texts: [stickyLead(c), 'Wir sind für Sie da — bitte melden Sie sich, sobald Sie losfahren.'] };
  }
  const aid = s.heat ? FIRST_AID.heat : (s.level === 'poison' ? FIRST_AID.poison : (FIRST_AID[s.reason] || ''));
  const texts = [stickyLead(c)];
  // Beantwortet die Nachricht zusätzlich eine Frage (Adresse, Telefon …)? Dann kurz dazu.
  const extra = sc && sc.content.filter((r) => r.intent === 'address' || r.intent === 'contact' || r.intent === 'hours' || r.intent === 'emergencyservice' || r.intent === 'price' || r.intent === 'payment')[0];
  if (extra) {
    const r = runIntent(c, extra.intent);
    if (r && r.texts[0]) texts.push(r.texts[0]);
  } else if (kind !== 'empty') {
    texts.push(`Danke für die Infos, das hilft uns bei der Vorbereitung. ${aid}`.trim());
  }
  return { texts, asked: s.level === 'poison' ? 'poison-details' : 'emergency-details' };
}

/* ---------- Tierhalter:in antwortet der Praxis ---------- */
function ownerReply(c) {
  const { an } = c;
  if (!an.toks.length) return { texts: ownerFallback(c, 'empty'), intent: 'empty', conf: 0 };
  c.times = timesIn(an.norm);
  c.day = dayIn(an.norm);
  const sc = scoreDefs(an, C_OWNER);
  const ranked = rank(sc.scores, C_OWNER).filter((r) => r.score >= THRESHOLD);
  c.scores = { ranked, matched: sc.matched };
  const content = ranked.filter((r) => r.kind === 'content');
  const social = ranked.filter((r) => r.kind === 'social');
  const texts = [];
  let intent = null;
  let conf = 0;
  // Tierhalter:innen antworten kurz: EIN Anliegen
  for (const r of content.slice(0, 1)) {
    const f = OWNER_R[r.intent];
    if (!f) continue;
    const t = f(c);
    if (t && t.length) { texts.push(t[0]); if (!intent) { intent = r.intent; conf = Math.min(1, r.score / 2); } }
  }
  if (!texts.length && social.length) {
    const t = OWNER_R[social[0].intent](c);
    texts.push(...t);
    intent = social[0].intent;
    conf = Math.min(1, social[0].score / 2);
  }
  if (!texts.length) { texts.push(...ownerFallback(c, an.question ? 'question' : 'default')); intent = 'o-fallback'; }
  return { texts, intent, conf };
}

/* ---------- Kolleg:in (Netzwerk) ---------- */
function colleagueReply(c) {
  const { an, tri, st } = c;
  if (!an.toks.length) return { texts: colleagueFallback(c, 'empty'), intent: 'empty', conf: 0 };
  c.tel = telPart(c);
  c.urgent = tri.level === 'emergency' || tri.level === 'poison';
  c.dayHint = dayIn(an.norm);
  const sc = scoreDefs(an, C_COLLEAGUE);
  const ranked = rank(sc.scores, C_COLLEAGUE).filter((r) => r.score >= THRESHOLD);
  c.scores = { ranked, matched: sc.matched };
  const content = ranked.filter((r) => r.kind === 'content');
  const social = ranked.filter((r) => r.kind === 'social');
  // Offenes OP-Fenster-Angebot → Zusage
  if (st.offeredSlots.length) {
    const ch = chooseSlot(an, st.offeredSlots, c.now);
    if (ch && ch.pick !== undefined && !(ch.plain && content.length)) {
      c.bookedLabel = st.offeredSlots[ch.pick].label;
      return { texts: colleagueFallback(c, 'booked'), intent: 'c-booking', conf: 1, booked: st.offeredSlots[ch.pick] };
    }
  }
  if (c.urgent) {
    // Notfall unter Kolleg:innen: sofort übernehmen, keine Tierhalter-Floskeln
    return { texts: COLLEAGUE_R['c-transfer'](c), intent: 'c-transfer', conf: 1 };
  }
  const texts = [];
  let intent = null;
  let conf = 0;
  let offer = false;
  for (const r of content.slice(0, 2)) {
    if (texts.length && r.score < content[0].score * 0.7) break;
    const f = COLLEAGUE_R[r.intent];
    if (!f) continue;
    const res = f(c);
    const t = Array.isArray(res) ? res : res.texts;
    if (res && res.offer) offer = true;
    if (t && t.length) { texts.push(t[0]); if (!intent) { intent = r.intent; conf = Math.min(1, r.score / 2); } }
  }
  if (!texts.length && social.length) {
    texts.push(...COLLEAGUE_R[social[0].intent](c));
    intent = social[0].intent;
    conf = Math.min(1, social[0].score / 2);
  }
  if (!texts.length) { texts.push(...colleagueFallback(c, 'default')); intent = 'c-fallback'; }
  return { texts, intent, conf, offer, asked: offer ? 'slot' : null };
}

/* ---------- Öffentliche Hauptfunktion ---------- */
export function botReply(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const persona = normPersona(o.persona);
  const now = num(o.now) ? o.now : null;
  const rawText = o.userText == null ? '' : String(o.userText);
  const userText = capText(rawText);
  const st = readState({ messages: o.messages, userText: rawText, persona, now });
  const an = analyzeText(userText);
  const tri = triageAnalysis(an);
  const c = makeCtx(o, persona, st, an, tri, userText, now);

  let res;
  if (persona === 'owner') res = ownerReply(c);
  else if (persona === 'colleague') res = colleagueReply(c);
  else res = clinicReply(c);

  // Texte säubern: leer raus, doppelte raus, höchstens 4 Blasen
  const texts = [];
  for (const t of res.texts || []) {
    const s = typeof t === 'string' ? t.replace(/\s+/g, ' ').trim() : '';
    if (s && texts.indexOf(s) < 0) texts.push(s);
  }
  if (!texts.length) texts.push(persona === 'clinic' ? 'Danke für Ihre Nachricht! Worum geht es denn genau? Bei einem Notfall rufen Sie bitte sofort an.' : 'Danke für die Nachricht!');
  const finalTexts = texts.slice(0, 4);

  const slotList = res.offer ? (res.slotsOverride || c._slots || []) : (res.keepOffer ? st.offeredSlots : []);
  const offeredSlots = slotList.map((s) => ({ label: s.label, iso: s.iso || null }));
  const booked = res.booked ? { label: res.booked.label, iso: res.booked.iso || null } : (st.booked || null);

  // Triage fürs Gedächtnis: aktueller Befund, sonst der laufende (sticky) Notfall mit Ursprungszeit
  let triMeta;
  if (tri.level !== 'none') {
    triMeta = { level: tri.level, reason: tri.reason, at: now };
    if (tri.heat) triMeta.heat = true;
    if (tri.poison && tri.poison.key) triMeta.poison = tri.poison.key;
  } else if (st.sticky && persona === 'clinic') {
    triMeta = { level: st.sticky.level, reason: st.sticky.reason, at: st.sticky.at, sticky: true, turn: (st.sticky.usersAfter || 0) + (st.sticky.turn || 0) + 1 };
    if (st.sticky.heat) triMeta.heat = true;
  } else {
    triMeta = { level: 'none', reason: tri.reason || '' };
  }
  const level = tri.level;
  const intent = res.intent || 'clarify';

  const symptoms = [];
  for (const m of tri.matched) if (!m.negated && !m.past && m.r && m.r !== 'poison' && m.r !== 'emergency-word' && m.r !== 'weak' && m.r !== 'help' && symptoms.indexOf(m.r) < 0) symptoms.push(m.r);
  const scores = (c.scores && c.scores.ranked ? c.scores.ranked : []).slice(0, 6).map((r) => ({ intent: r.intent, score: r.score }));
  const matched = tri.matched.map((m) => ({ kind: 'triage', r: m.r, text: m.text, negated: !!m.negated, past: !!m.past }))
    .concat(((c.scores && c.scores.matched) || []).slice(0, 20).map((m) => ({ kind: 'intent', intent: m.intent, text: m.text, negated: !!m.negated })));

  return {
    texts: finalTexts,
    intent,
    confidence: Math.round((res.conf || 0) * 100) / 100,
    entities: {
      petName: c.petName || null,
      species: c.species || null,
      gender: c.gender || null,
      poison: tri.poison ? { key: tri.poison.key, name: tri.poison.name } : null,
      symptoms,
    },
    triage: { level, reason: tri.reason || '' },
    meta: { intent, triage: triMeta, offeredSlots, asked: res.asked || null, booked },
    explain: {
      normalized: an.norm,
      tokens: an.toks.map((t) => t.t),
      scores,
      triage: { level, reason: tri.reason || '', reasons: tri.reasons, question: !!tri.question, heat: !!tri.heat, lang: tri.lang, sticky: !!(st.sticky && persona === 'clinic') },
      matched,
      persona,
      seed: c.seed,
    },
  };
}

/* Begrüßung für einen leeren Chat (deterministisch je Praxisname). */
export function botGreeting(persona, practiceName) {
  const p = normPersona(persona);
  const h = hashStr(String(practiceName || '') + '|' + p);
  let k = 0;
  const pick = (list) => list[(h + (k++)) % list.length];
  return greetingText(p, practiceName, pick);
}

/* Bild ohne KI: die Bildunterschrift läuft durch Triage und Anliegen. Liefert EINEN Text. */
export function botImageReply(persona, caption, opts) {
  const p = normPersona(persona);
  const o = opts && typeof opts === 'object' ? opts : {};
  const cap0 = typeof caption === 'string' ? caption : '';
  const r = cap0.trim() ? botReply({ messages: o.messages, userText: cap0, persona: p, practice: o.practice, practiceName: o.practiceName, now: o.now, seed: o.seed }) : null;
  const st = readState({ messages: o.messages, userText: '', persona: p, now: null });
  const pc = petContext(st.petTexts.concat([cap0]));
  const h = hashStr(cap0 + '|' + p + '|' + (o.practiceName || ''));
  let k = 0;
  const c = { petName: pc.petName, pick: (list) => list[(h + (k++)) % list.length] };
  const ack = imageTexts(p, c)[0];
  if (!r) return ack;
  if (p === 'clinic' && (r.triage.level === 'emergency' || r.triage.level === 'poison')) {
    // Handlungsaufforderung zuerst — das Bild kann warten
    return r.texts.slice(0, 2).join(' ') + ' Das Bild sehen wir uns gleich an.';
  }
  if (p === 'clinic' && r.triage.level === 'urgent') return r.texts[0] + ' ' + ack;
  const useful = r.intent !== 'clarify' && r.intent !== 'empty' && r.intent !== 'o-fallback' && r.intent !== 'c-fallback' && r.intent !== 'greeting' && r.intent !== 'thanks';
  return useful ? ack + ' ' + r.texts[0] : ack;
}

export { slotParts, isDecline };
