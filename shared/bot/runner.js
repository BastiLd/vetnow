/* Bot 3.0 — Suite-Runner (runBotSuite). Läuft im Admin-Panel (Browser/Handy), im Hub
   (GET /api/v1/bot/suite, Selbsttest) und in node:test. Deshalb: keine Node-APIs, schnell (< 1,5 s).

   Jeder Fall läuft mit mehreren Varianten-Seeds; er besteht nur, wenn ALLE Seeds bestehen.
   Zusätzlich zu den Erwartungen des Falls prüft der Runner bei jeder Antwort die globalen Regeln:
     - nie eine Dosierung
     - nie eine Zustimmung bei Gift-/Medikamenten-/Futter-Sicherheitsfragen
     - Notfall/Gift (Praxis-Persona) → erste Blase enthält die Handlungsaufforderung
     - kein „warm halten", wenn Hitze im Spiel ist
     - keine Platzhalter-Lecks (undefined, NaN, ${…})
     - Determinismus: gleicher Seed → gleiche Antwort
   und misst p95 der Antwortzeit bei 2000 Zeichen (Budget 5 ms). */
import { botReply, botImageReply } from './reply.js';
import { triage } from './triage.js';
import { hasDosage } from './guard.js';

/* Feste Uhrzeit für reproduzierbare Terminvorschläge: Donnerstag, 24.09.2026, 12:00 (lokal) */
export const SUITE_NOW = new Date(2026, 8, 24, 12, 0).getTime();

const H = (v) => [v, v, v, v, v, v, v];
export const SUITE_PRACTICES = {
  drautal: {
    id: 'drautal', name: 'Tierarztpraxis Drautal', phone: '+43 4242 12345', address: 'Drauweg 12, 9500 Villach',
    hoursShort: 'Mo–Fr 8–18, Sa 9–12', hoursWeek: ['8–18', '8–18', '8–18', '8–18', '8–18', '9–12', 'geschlossen'],
    status: { value: 'green', setAt: SUITE_NOW - 3600000, expiresAt: SUITE_NOW + 20 * 3600000 }, absence: null,
    fallbackEmergency: { name: 'Tiernotdienst Wörthersee 24h', phone: '+43 463 99999' },
  },
  woerthersee24: {
    id: 'woerthersee', name: 'Tiernotdienst Wörthersee 24h', phone: '+43 463 99999', address: 'Seeweg 1, 9020 Klagenfurt',
    hoursShort: '24 Stunden', hoursWeek: H('24 h'), status: { value: 'green', setAt: SUITE_NOW - 3600000, expiresAt: SUITE_NOW + 20 * 3600000 }, absence: null,
  },
  lavanttalRed: {
    id: 'lavanttal', name: 'Tierarzt Lavanttal', phone: '+43 4352 11111', address: 'Hauptplatz 3, 9400 Wolfsberg',
    hoursShort: 'Mo–Fr 8–16', hoursWeek: ['8–16', '8–16', '8–16', '8–16', '8–16', 'geschlossen', 'geschlossen'],
    status: { value: 'red', setAt: SUITE_NOW - 3600000, expiresAt: SUITE_NOW + 20 * 3600000 }, absence: null,
    fallbackEmergency: { name: 'Tiernotdienst Wörthersee 24h', phone: '+43 463 99999' },
  },
  lieserYellow: {
    id: 'lieser', name: 'Kleintierpraxis Lieser', phone: '+43 4762 22222',
    hoursShort: 'Mo–Fr 9–17', hoursWeek: ['9–17', '9–17', '9–17', '9–17', '9–17', 'geschlossen', 'geschlossen'],
    status: { value: 'yellow', setAt: SUITE_NOW - 3600000, expiresAt: SUITE_NOW + 20 * 3600000 }, absence: null,
    fallbackEmergency: { name: 'Tiernotdienst Wörthersee 24h', phone: '+43 463 99999' },
  },
  viktring: {
    id: 'viktring', name: 'Pferdeklinik Viktring', phone: '+43 463 33333',
    hoursShort: 'Mo–Sa 7–19', hoursWeek: ['7–19', '7–19', '7–19', '7–19', '7–19', '7–15', 'Notdienst'],
    status: { value: 'green', setAt: SUITE_NOW - 3600000, expiresAt: SUITE_NOW + 20 * 3600000 }, absence: null,
  },
};

export const RX = {
  CTA: /(sofort|anrufen|notdienst|losfahren|fahren sie)/i,
  AFFIRM: /(grundsätzlich möglich|^ja\b|ja, (das )?(dürfen|können|darf|kann|geht)|unbedenklich|bedenkenlos|ist erlaubt|das ist ok|schadet nicht|kein problem)/i,
  WARM: /warm\s*(zu\s*)?halten|warmhalten|zudecken|decke\s+(ein)?wickeln/i,
  LEAK: /undefined|NaN|\[object|\$\{|\bnull\b/,
};
const SAFETY_INTENTS = { medication: 1, nutrition: 1, 'poison-question': 1 };

function clock() {
  // Nur für die Laufzeitmessung — nicht für Antworten
  return typeof performance !== 'undefined' && performance && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function rx(s) {
  try { return new RegExp(s, 'i'); } catch (e) { return { test: () => false, bad: s }; }
}

function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function subst(s, offered) {
  const parts = (offered || []).map((o) => {
    const m = /(\d{2}:\d{2})/.exec(o.label || '');
    return m ? m[1] : '??:??';
  });
  return String(s).replace(/\{time(\d)\}/g, (_, i) => parts[+i] || '??:??');
}

/* Nachrichten-IDs je Fall stabil (Fall-ID + laufende Nummer) — sonst wäre der Varianten-Seed zufällig */
function msg(caseId, n, from, text, extra) {
  return Object.assign({ id: 'suite-' + caseId + '-' + n, ts: SUITE_NOW, from, type: 'text', text }, extra || {});
}

/* Einen Fall mit einem Seed ausführen → { r, problems, prevOffered } */
function runCase(c, seed) {
  const persona = c.persona || 'clinic';
  const userSide = persona === 'clinic' ? 'owner' : 'clinic';
  const botSide = userSide === 'owner' ? 'clinic' : 'owner';
  const now = c.noNow ? undefined : SUITE_NOW;
  const pkey = c.practice || 'drautal';
  const practice = pkey === 'none' ? undefined : SUITE_PRACTICES[pkey];
  const practiceName = practice ? practice.name : 'Tierarztpraxis Drautal';
  const messages = (c.history || []).map((m) => {
    const copy = Object.assign({}, m);
    if (c.relAt && copy.meta && copy.meta.triage && typeof copy.meta.triage.at === 'number') {
      copy.meta = Object.assign({}, copy.meta, { triage: Object.assign({}, copy.meta.triage, { at: SUITE_NOW + copy.meta.triage.at }) });
    }
    return copy;
  });
  const problems = [];
  let prevOffered = [];
  const call = (text) => botReply({ messages, userText: text, persona, practice, practiceName, now, seed });
  for (const t0 of c.turns || []) {
    const t = subst(t0, prevOffered);
    messages.push(msg(c.id, messages.length, userSide, t));
    const r = call(t);
    checkInvariants(r, persona, t, problems, 'Zug „' + t.slice(0, 30) + '"');
    for (const tx of r.texts) messages.push(msg(c.id, messages.length, botSide, tx, { source: 'bot', meta: r.meta }));
    prevOffered = r.meta.offeredSlots || [];
  }
  const lastBotMeta = (() => { for (let i = messages.length - 1; i >= 0; i--) if (messages[i].from === botSide && messages[i].meta) return messages[i].meta; return null; })();
  if (!c.turns && lastBotMeta) prevOffered = lastBotMeta.offeredSlots || [];
  const text = subst(c.text, prevOffered);
  let r;
  if (c.image) {
    const s = botImageReply(persona, text, { messages, practice, practiceName, now, seed });
    const tr = triage(text);
    r = { texts: [s], intent: 'image', triage: { level: tr.level, reason: tr.reason }, meta: { offeredSlots: [], booked: null }, explain: { triage: { heat: tr.heat, question: tr.question } }, entities: {} };
  } else {
    messages.push(msg(c.id, messages.length, userSide, text));
    r = call(text);
  }
  return { r, problems, prevOffered, messages, text };
}

function checkInvariants(r, persona, input, problems, where) {
  const joined = r.texts.join(' || ');
  const w = where ? where + ': ' : '';
  if (!r.texts.length || r.texts.some((t) => typeof t !== 'string' || !t.trim())) problems.push(w + 'leere Antwort');
  if (hasDosage(joined)) problems.push(w + 'DOSIERUNG in der Antwort');
  if (RX.LEAK.test(joined)) problems.push(w + 'Platzhalter-Leck');
  const tr = r.explain && r.explain.triage ? r.explain.triage : {};
  const lvl = r.triage ? r.triage.level : 'none';
  const safetyQ = tr.question || SAFETY_INTENTS[r.intent] === 1;
  if (persona === 'clinic' && safetyQ && r.texts.some((t) => RX.AFFIRM.test(t))) problems.push(w + 'ZUSTIMMUNG bei Sicherheitsfrage');
  if (persona === 'clinic' && (lvl === 'emergency' || lvl === 'poison') && !RX.CTA.test(r.texts[0] || '')) problems.push(w + 'Notfall ohne Handlungsaufforderung in der ersten Blase');
  if (persona === 'colleague' && (lvl === 'emergency' || lvl === 'poison') && !/sofort/i.test(r.texts[0] || '')) problems.push(w + 'Notfall unter Kolleg:innen ohne „sofort"');
  if ((tr.heat || /hitzschlag|sonnenstich|überhitzt|ueberhitzt/i.test(input)) && RX.WARM.test(joined)) problems.push(w + '„warm halten" bei Hitze');
}

function checkCase(c, run) {
  const { r, problems, prevOffered } = run;
  const joined = r.texts.join(' || ');
  const persona = c.persona || 'clinic';
  checkInvariants(r, persona, run.text, problems, '');
  const lvl = r.triage ? r.triage.level : 'none';
  if (c.expectTriage && c.expectTriage.indexOf(lvl) < 0) problems.push('Triage ' + lvl + ' statt ' + c.expectTriage.join('|'));
  if (c.expectIntent && c.expectIntent.indexOf(r.intent) < 0) problems.push('Anliegen ' + r.intent + ' statt ' + c.expectIntent.join('|'));
  for (const s of c.must || []) { const re = rx(subst(s, prevOffered)); if (re.bad || !re.test(joined)) problems.push('fehlt /' + subst(s, prevOffered) + '/'); }
  for (const s of c.mustNot || []) { const re = rx(subst(s, prevOffered)); if (re.bad || re.test(joined)) problems.push('verboten /' + s + '/'); }
  if (c.expectBooked !== undefined) {
    const booked = r.intent === 'booking' || r.intent === 'c-booking';
    if (c.expectBooked === false) {
      if (booked) problems.push('bucht, obwohl keine Buchung erwartet');
    } else {
      const want = prevOffered[c.expectBooked];
      if (!want) problems.push('kein Angebot Nr. ' + (c.expectBooked + 1) + ' im Zug davor');
      else if (!booked || !r.meta.booked || r.meta.booked.label !== want.label) problems.push('gebucht ' + (r.meta.booked ? r.meta.booked.label : '—') + ' statt ' + want.label);
      else if (!new RegExp(esc(want.label.split(', ')[1] || want.label)).test(joined)) problems.push('Bestätigung nennt die Zeit nicht');
    }
  }
  if (c.expectOffer) {
    const n = (r.meta.offeredSlots || []).length;
    if (n < c.expectOffer) problems.push('nur ' + n + ' Termin(e) angeboten');
  }
  if (c.expectPet !== undefined) {
    const got = r.entities ? r.entities.petName : null;
    if ((got || null) !== c.expectPet) problems.push('Tiername ' + got + ' statt ' + c.expectPet);
  }
  return problems;
}

function p95(list) {
  if (!list.length) return 0;
  const s = list.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
}

/* Performance-Probe: 2000-Zeichen-Texte (verschiedene Muster, jeweils einmalig → kein Cache-Treffer) */
function perfProbe(n) {
  const gens = [
    (i) => ('Mein Hund ist seit Tagen irgendwie komisch und ich weiß nicht genau was los ist ' + i + '. ').repeat(30) + 'Jetzt atmet er schwer.',
    (i) => ('nase warm trocken krank fieber ' + i + ' ').repeat(70),
    (i) => ('wohnungskatze impfung keine ' + i + ' ').repeat(80),
    (i) => ('schokolade gefressen nicht ' + i + ' ').repeat(80),
    (i) => ('a' + i).repeat(1000),
  ];
  const times = [];
  for (let i = 0; i < n; i++) {
    const g = gens[i % gens.length];
    const t = g(i).slice(0, 2000);
    const t0 = clock();
    botReply({ messages: [], userText: t, persona: 'clinic', practice: SUITE_PRACTICES.drautal, now: SUITE_NOW, seed: i });
    times.push(clock() - t0);
  }
  return { n, p95: Math.round(p95(times) * 100) / 100, max: Math.round(Math.max.apply(null, times) * 100) / 100 };
}

export function runSuite(cases, opts) {
  const o = opts || {};
  const seeds = Array.isArray(o.seeds) && o.seeds.length ? o.seeds : [undefined, 7, 13];
  const filter = typeof o.filter === 'function' ? o.filter : null;
  const t0 = clock();
  const results = [];
  const bySev = {};
  let passed = 0;
  let failed = 0;
  for (const c of cases) {
    if (filter && !filter(c)) continue;
    let problems = [];
    let first = null;
    let crashed = false;
    for (let k = 0; k < seeds.length; k++) {
      try {
        const run = runCase(c, seeds[k]);
        const p = checkCase(c, run);
        if (k === 0) {
          first = run;
          // Determinismus: gleicher Seed → gleiche Antwort
          const again = runCase(c, seeds[k]);
          if (JSON.stringify([again.r.texts, again.r.meta, again.r.intent]) !== JSON.stringify([run.r.texts, run.r.meta, run.r.intent])) p.push('nicht deterministisch');
        }
        for (const x of p) if (problems.indexOf(x) < 0) problems.push(x);
      } catch (e) {
        crashed = true;
        problems.push('ABSTURZ: ' + (e && e.message ? e.message : String(e)));
        break;
      }
    }
    const ok = problems.length === 0;
    if (ok) passed++; else failed++;
    const sev = c.sev || 'wrong';
    bySev[sev] = bySev[sev] || { total: 0, failed: 0 };
    bySev[sev].total++;
    if (!ok) bySev[sev].failed++;
    results.push({
      id: c.id, ok, sev, cat: c.cat || '', persona: c.persona || 'clinic',
      intent: first && !crashed ? first.r.intent : null,
      triage: first && !crashed ? first.r.triage.level : null,
      text: String(c.text).length > 160 ? String(c.text).slice(0, 157) + '…' : String(c.text),
      reply: first && !crashed ? first.r.texts.join(' || ') : '',
      problems,
    });
  }
  const perf = o.perf === false ? null : perfProbe(o.perfRuns || 60);
  if (perf) {
    const ok = perf.p95 < (o.perfBudgetMs || 5);
    if (ok) passed++; else failed++;
    bySev.wrong = bySev.wrong || { total: 0, failed: 0 };
    bySev.wrong.total++;
    if (!ok) bySev.wrong.failed++;
    results.push({ id: 'INV-PERF', ok, sev: 'wrong', cat: 'performance', persona: 'clinic', intent: null, triage: null, text: '2000 Zeichen × ' + perf.n, reply: 'p95 ' + perf.p95 + ' ms, max ' + perf.max + ' ms', problems: ok ? [] : ['p95 ' + perf.p95 + ' ms ≥ Budget'] });
  }
  return {
    passed, failed, total: passed + failed, results, bySev, perf, seeds: seeds.length,
    ms: Math.round((clock() - t0) * 10) / 10,
  };
}
