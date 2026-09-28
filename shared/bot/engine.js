/* Bot 3.0 — gemeinsamer Treffer-Index für Triage, Anliegen, Personas und Tiernamen.

   Ein einziger Index über alle Begriffe, damit jedes Wort einer Nachricht genau EINMAL nachgeschlagen
   wird (schnell auch bei 2000 Zeichen). Wird beim ersten Gebrauch gebaut, nicht beim Import —
   so kostet ein reiner Import (z. B. in der Extension) nichts. */
import { createIndex, compilePattern, analyze } from './match.js';
import {
  POISONS, INGEST_PAST, INGEST_GIVEN, INGEST_NOW, POISON_STANDALONE, POISON_QUESTION, RED, URGENT,
  EMERGENCY_WORD, EMERGENCY_WORD_INFO, PAST, PREVENTION, HYPOTHETICAL, SPECIES, BREEDS, FUZZY_BLOCK,
} from './lexicon.de.js';
import { intentKeys } from './intents.js';

const cmp = (list) => list.map((e) => ({ ...e, els: compilePattern(e.p) }));

export const T = {
  poisons: POISONS.map((e) => ({ ...e, els: compilePattern(e.p) })),
  ingestPast: compilePattern(INGEST_PAST),
  ingestGiven: compilePattern(INGEST_GIVEN),
  ingestNow: compilePattern(INGEST_NOW),
  poisonStandalone: compilePattern(POISON_STANDALONE),
  poisonQuestion: compilePattern(POISON_QUESTION),
  red: cmp(RED),
  urgent: cmp(URGENT),
  emergencyWord: compilePattern(EMERGENCY_WORD),
  emergencyInfo: compilePattern(EMERGENCY_WORD_INFO),
  past: PAST.map((p) => compilePattern(p)),
  prevention: compilePattern(PREVENTION),
  hypothetical: compilePattern(HYPOTHETICAL),
  induceVomit: compilePattern('erbrechen|kotzen|brechen ~3 ausloesen|herbeifuehren|provozieren|ausloese'),
  waitQuestion: compilePattern('warten|abwarten|aushalten ~3 morgen|montag|wochenende|spaeter'),
  smallAppetite: compilePattern('frisst|fressen|isst|frass ~2 nicht|nichts|kaum|nimmer'),
};

let INDEX = null;
export function getIndex() {
  if (INDEX) return INDEX;
  const keys = [];
  const addEls = (els) => { for (const el of els) for (const a of el.alts) keys.push(a); };
  T.poisons.forEach((e) => addEls(e.els));
  [T.ingestPast, T.ingestGiven, T.ingestNow, T.poisonStandalone, T.poisonQuestion, T.emergencyWord, T.emergencyInfo,
    T.prevention, T.hypothetical, T.induceVomit, T.waitQuestion, T.smallAppetite].forEach(addEls);
  T.red.forEach((e) => addEls(e.els));
  T.urgent.forEach((e) => addEls(e.els));
  T.past.forEach(addEls);
  for (const k of Object.keys(SPECIES)) keys.push(k);
  for (const k of Object.keys(BREEDS)) keys.push(k);
  for (const k of intentKeys()) keys.push(k);
  INDEX = createIndex(keys, FUZZY_BLOCK);
  return INDEX;
}

/* Kleiner Ergebnis-Cache: dieselbe Nachricht wird pro Antwort mehrfach gebraucht (Triage, Anliegen,
   Namen, Wächter). Begrenzte Größe, rein deterministisch. */
const AN_CACHE = new Map();
export function analyzeText(text) {
  const key = String(text == null ? '' : text);
  const hit = AN_CACHE.get(key);
  if (hit) return hit;
  const an = analyze(key, getIndex());
  if (AN_CACHE.size > 300) AN_CACHE.clear();
  AN_CACHE.set(key, an);
  return an;
}
