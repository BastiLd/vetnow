/* Bot 3.0 — Sicherheits-Triage. Läuft bei JEDER Nachricht zuerst: vor den Anliegen des Bots und vor
   jeder KI (guardAiReply). Ergebnis-Stufen:
     'poison'    Giftaufnahme (auch Verdacht)          → sofort anrufen, KEIN Erbrechen auslösen
     'emergency' lebensbedrohliche Red Flag              → sofort anrufen / losfahren
     'urgent'    heute ansehen / schwache Dringlichkeit  → anrufen, zeitnah kommen
     'none'
   Zusätzlich: question=true bei Gift-/Medikamenten-FRAGEN („Darf ich … geben?") → der Bot antwortet
   „Nein, bitte nicht …" und bestätigt nie.

   Regeln aus dem Audit:
   - Verneinung nur im selben Teilsatz („kein Notfall, aber er atmet schwer" bleibt Notfall).
   - „nicht dringend"/„kein Notfall" heben nur die schwachen Wörter auf, keine Symptom-Phrase.
   - Vergangenes („letzte Woche", „war mal") stuft herunter; „seit letzter Woche" gilt als anhaltend.
   - Vorbeugung („wie schütze ich ihn vor Hitzschlag") ist Info, kein Notfall.
   - „Was tue ich, wenn er krampft?" → dringend-Info (Erste Hilfe + im Zweifel anrufen). */
import { analyzeText, T } from './engine.js';
import { findAll, isNegated, matchText, hasIn } from './match.js';
import { SPECIES } from './lexicon.de.js';

const RANK = { none: 0, urgent: 1, emergency: 2, poison: 3 };

const EN_WORDS = { my: 1, dog: 1, cat: 1, is: 1, the: 1, ate: 1, not: 1, help: 1, please: 1, hello: 1, eating: 1, breathing: 1, has: 1, what: 1, i: 1, he: 1, she: 1, it: 1, and: 1, can: 1, you: 1, of: 1, some: 1, just: 1 };
const DE_WORDS = { der: 1, die: 1, das: 1, und: 1, ist: 1, nicht: 1, mein: 1, meine: 1, hat: 1, ich: 1, sie: 1, er: 1, es: 1, bitte: 1, ein: 1, eine: 1, mit: 1, seit: 1, wir: 1, unser: 1, unsere: 1, hund: 1, katze: 1 };

function sentenceFlags(an, s, cache) {
  if (cache[s]) return cache[s];
  const toks = an.toks;
  let past = false;
  for (const els of T.past) {
    for (const m of findAll(els, an, 'sentence')) {
      if (toks[m.start].s !== s) continue;
      const before = toks[m.start - 1];
      if (before && before.s === s && (before.t === 'seit' || before.t === 'since')) continue;
      past = true;
    }
  }
  const f = {
    question: !!an.qBySentence[s],
    past,
    prevention: hasIn(an, T.prevention[0].alts, s) >= 0,
    hypothetical: hasIn(an, T.hypothetical[0].alts, s) >= 0,
  };
  cache[s] = f;
  return f;
}

function firstUnnegated(an, els, s) {
  for (const m of findAll(els, an, 'sentence')) {
    if (an.toks[m.start].s !== s) continue;
    if (isNegated(an, m)) continue;
    return m;
  }
  return null;
}

/* Starke Einnahme bei allgemeinen Medikamenten: „geschluckt" allein ist bei verordneten Tabletten
   normal — erst „gefressen/erwischt/geklaut …" oder „Packung/von mir" macht es zum Giftfall. */
const DRUG_STRONG = { gefressen: 1, gefresen: 1, erwischt: 1, geklaut: 1, stibitzt: 1, zerbissen: 1, verputzt: 1, gefuttert: 1, aufgefressen: 1, ate: 1, chewed: 1, gobbled: 1, verdrueckt: 1, genascht: 1 };
const DRUG_CONTEXT = { packung: 1, schachtel: 1, blister: 1, ganze: 1, mir: 1, meine: 1, meinen: 1, dose: 1, alle: 1 };

export function triageAnalysis(an) {
  const toks = an.toks;
  const flagCache = {};
  const matched = [];
  const hits = [];
  let poison = null;
  let question = false;
  let questionPoison = null;
  let heat = false;
  let negatedWeak = false;

  // ---------- 1. Gifte ----------
  const poisonHits = [];
  for (const P of T.poisons) {
    for (const m of findAll(P.els, an, 'clause')) {
      const s = toks[m.start].s;
      if (isNegated(an, m)) { matched.push({ r: 'poison', text: matchText(an, m), negated: true }); continue; }
      const f = sentenceFlags(an, s, flagCache);
      const past = firstUnnegated(an, T.ingestPast, s);
      const given = firstUnnegated(an, T.ingestGiven, s);
      const now = firstUnnegated(an, T.ingestNow, s);
      // Verneinte Einnahme im Satz („hat keine Schokolade gefressen" ist oben schon verneint;
      // „Schokolade? hat er nicht gefressen") → keine Einnahme
      const anyIng = findAll(T.ingestPast, an, 'sentence').concat(findAll(T.ingestGiven, an, 'sentence'), findAll(T.ingestNow, an, 'sentence')).filter((x) => toks[x.start].s === s);
      const ingNegated = anyIng.length > 0 && anyIng.every((x) => isNegated(an, x));
      let kind = null;
      if (f.past && !ingNegated) kind = 'past';
      else if (ingNegated) kind = 'negated';
      else if (past && (P.cls !== 'drug' || DRUG_STRONG[toks[past.start].t] === 1 || hasCtx(an, s))) kind = 'ingested';
      else if (given && P.cls !== 'drug' && !f.question) kind = 'ingested';
      else if (now && !f.question && !f.hypothetical && P.cls !== 'drug') kind = 'ingested';
      else if (P.cls !== 'drug' && (f.question || f.hypothetical || hasIn(an, T.poisonQuestion[0].alts, s) >= 0)) kind = 'question';
      else if (P.cls !== 'drug') kind = 'mention';
      poisonHits.push({ P, m, kind });
      matched.push({ r: 'poison', key: P.key, text: matchText(an, m), kind });
    }
  }
  // Spezifische Stoffe vor dem Sammelbegriff „Gift"/„Medikamente"
  const spec = (h) => (h.P.key === 'gift' || h.P.key === 'drug' ? 1 : 0);
  poisonHits.sort((a, b) => spec(a) - spec(b));
  const ing = poisonHits.find((h) => h.kind === 'ingested');
  if (ing) poison = { key: ing.P.key, name: ing.P.name, cls: ing.P.cls };
  const qh = poisonHits.find((h) => h.kind === 'question') || poisonHits.find((h) => h.kind === 'mention');
  if (qh) { questionPoison = { key: qh.P.key, name: qh.P.name, cls: qh.P.cls, mention: qh.kind === 'mention' }; question = qh.kind === 'question'; }
  // „vergiftet?" — Verdacht ohne Stoff zählt immer (Sicherheit vor Genauigkeit)
  for (const m of findAll(T.poisonStandalone, an, 'clause')) {
    const f = sentenceFlags(an, toks[m.start].s, flagCache);
    if (isNegated(an, m) || f.past || f.prevention) { matched.push({ r: 'poison', text: matchText(an, m), negated: true }); continue; }
    if (!poison) poison = { key: 'gift', name: 'Gift', cls: 'chem' };
    matched.push({ r: 'poison', text: matchText(an, m) });
  }
  // „Soll ich Erbrechen auslösen?" → klare Absage
  for (const m of findAll(T.induceVomit, an, 'sentence')) {
    if (isNegated(an, m)) continue;
    question = true;
    questionPoison = questionPoison || { key: 'vomit', name: 'Erbrechen auslösen', cls: 'advice' };
    if (questionPoison.key !== 'vomit') questionPoison.induce = true;
    matched.push({ r: 'induce-vomit', text: matchText(an, m) });
  }

  // ---------- 2. Red Flags ----------
  for (const R of T.red) {
    if (R.r === 'poison') continue;
    for (const m of findAll(R.els, an, R.scope || 'clause')) {
      const s = toks[m.start].s;
      if (R.r === 'heat') heat = true;
      if (R.neg !== 'self' && isNegated(an, m)) { matched.push({ r: R.r, text: matchText(an, m), negated: true }); continue; }
      // „unless": folgt direkt ein Eigenschaftswort („atmet nicht schwer"), verneint das „nicht" nur dieses
      if (R.unless) {
        const nx = toks[m.end + 1];
        if (nx && nx.c === toks[m.end].c && R.unless.split('|').indexOf(nx.t) >= 0) { matched.push({ r: R.r, text: matchText(an, m), negated: true }); continue; }
      }
      const f = sentenceFlags(an, s, flagCache);
      if (f.past) { matched.push({ r: R.r, text: matchText(an, m), past: true }); continue; }
      if (f.prevention) { matched.push({ r: R.r, text: matchText(an, m), prevention: true }); continue; }
      let level = R.level || 'emergency';
      let info = false;
      if (f.hypothetical && f.question && level === 'emergency') { level = 'urgent'; info = true; }
      hits.push({ r: R.r, level, info });
      matched.push({ r: R.r, level, text: matchText(an, m), info: info || undefined });
    }
  }

  // ---------- 3. Das Wort „Notfall" (schwach, verneinbar) ----------
  for (const m of findAll(T.emergencyWord, an, 'clause')) {
    const tk = toks[m.start];
    if (tk.t === 'notfaelle') continue; // „Nehmen Sie Notfälle an?" = Frage nach dem Angebot
    if (isNegated(an, m)) { negatedWeak = true; matched.push({ r: 'emergency-word', text: tk.t, negated: true }); continue; }
    const before = toks[m.start - 1];
    const before2 = toks[m.start - 2];
    const infoWord = (b) => b && b.s === tk.s && T.emergencyInfo[0].alts.indexOf(b.t) >= 0;
    if (infoWord(before) || (before && (before.t === 'den' || before.t === 'einen') && infoWord(before2))) {
      matched.push({ r: 'emergency-word', text: tk.t, info: true });
      continue;
    }
    const f = sentenceFlags(an, tk.s, flagCache);
    if (f.past) { matched.push({ r: 'emergency-word', text: tk.t, past: true }); continue; }
    const level = f.question ? 'urgent' : 'emergency';
    hits.push({ r: 'emergency-word', level, info: f.question });
    matched.push({ r: 'emergency-word', level, text: tk.t });
  }
  // „Kann ich damit bis morgen warten?" bei einem Notfall-Thema → nicht abwarten
  if (hits.length && findAll(T.waitQuestion, an, 'sentence').length) hits.push({ r: 'wait', level: 'urgent' });

  // ---------- 4. Dringend ----------
  for (const U of T.urgent) {
    for (const m of findAll(U.els, an, 'clause')) {
      const s = toks[m.start].s;
      if (U.r === 'heat') heat = true;
      if (U.neg !== 'self' && isNegated(an, m)) {
        if (U.r === 'weak') negatedWeak = true;
        matched.push({ r: U.r, text: matchText(an, m), negated: true });
        continue;
      }
      const f = sentenceFlags(an, s, flagCache);
      if (f.past || f.prevention) { matched.push({ r: U.r, text: matchText(an, m), past: f.past || undefined }); continue; }
      hits.push({ r: U.r, level: 'urgent' });
      matched.push({ r: U.r, level: 'urgent', text: matchText(an, m) });
    }
  }
  // „Hilfe!" / „Help!" als erstes Wort eines eigenen Teilsatzes
  if (toks.length && (toks[0].t === 'hilfe' || toks[0].t === 'help') && (!toks[1] || toks[1].c !== toks[0].c)) {
    hits.push({ r: 'help', level: 'urgent' });
    matched.push({ r: 'help', level: 'urgent', text: toks[0].t });
  }
  // Kleintier frisst nicht → Stunden zählen (Magen-Darm-Stillstand)
  const small = toks.some((tk) => SPECIES[tk.t] && SPECIES[tk.t][0] === 'small');
  if (small) {
    const app = findAll(T.smallAppetite, an, 'clause');
    if (app.length) { hits.push({ r: 'small-appetite', level: 'urgent' }); matched.push({ r: 'small-appetite', level: 'urgent', text: matchText(an, app[0]) }); }
  }

  // ---------- Entscheidung ----------
  let level = 'none';
  let reason = '';
  if (poison) { level = 'poison'; reason = 'poison:' + poison.key; }
  const emerg = hits.find((h) => h.level === 'emergency');
  if (!poison && emerg) { level = 'emergency'; reason = emerg.r; }
  if (level === 'none') {
    const urg = hits.find((h) => h.level === 'urgent' && h.r !== 'weak') || hits.find((h) => h.level === 'urgent');
    if (urg) { level = 'urgent'; reason = urg.info ? 'info:' + urg.r : urg.r; }
  }
  if (level === 'none') {
    if (question && questionPoison) reason = 'poison-question:' + questionPoison.key;
    else if (questionPoison && questionPoison.mention) reason = 'poison-mention:' + questionPoison.key;
    else if (matched.some((x) => x.past)) reason = 'past';
    else if (negatedWeak || matched.some((x) => x.negated)) reason = 'negated';
  }
  const reasons = [];
  for (const h of hits) if (reasons.indexOf(h.r) < 0) reasons.push(h.r);
  if (poison && reasons.indexOf('poison') < 0) reasons.unshift('poison');

  // Sprache grob schätzen (für einen englischen Zusatzsatz im Notfall)
  let en = 0; let de = 0;
  for (const tk of toks) { if (EN_WORDS[tk.t] === 1) en++; if (DE_WORDS[tk.t] === 1) de++; }

  return {
    level,
    reason,
    matched,
    reasons,
    poison: poison || (level === 'none' ? questionPoison : null),
    question: level === 'none' ? question : false,
    poisonQuestion: questionPoison && question ? questionPoison : null,
    heat: heat || reasons.indexOf('heat') >= 0,
    info: hits.length > 0 && hits.every((h) => h.info),
    lang: en >= 2 && en > de ? 'en' : 'de',
  };
}

function hasCtx(an, s) {
  for (const tk of an.toks) if (tk.s === s && DRUG_CONTEXT[tk.t] === 1) return true;
  return false;
}

export function levelRank(level) { return RANK[level] || 0; }

/* Öffentliche API: triage(text) → { level, reason, matched, … } */
export function triage(text) {
  return triageAnalysis(analyzeText(text));
}
