// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* Bot 3.0 — Wächter für KI-Antworten (guardAiReply).

   Warum: Kleine lokale Modelle (3B/7B) halten sich nicht zuverlässig an den System-Prompt. Das Audit
   fand keinen deterministischen Schutz vor oder nach der KI. Deshalb:
     VORHER  Triage der Nutzernachricht (nur Praxis-Persona). Ab „dringend" liefert der Wächter
             ok:false + die festen Sicherheitstexte des Bots, damit der Aufrufer sie ZUERST sendet.
     NACHHER Die KI-Antwort wird geprüft und bei Verstößen durch die Bot-Antwort ersetzt:
             - Dosierungen (Zahl + mg/ml/Tabletten/kg/Tropfen …) — nie im Chat
             - Hitzschlag-Fall + „warm halten"/„zudecken" — gefährlich falscher Rat
             - erkennbar nicht Deutsch
             Harmlose Mängel werden repariert statt ersetzt: Markdown entfernen, > 900 Zeichen am
             Satzende kürzen (ok:true, texts = bereinigter Text).
   Rückgabe: { ok, texts, replaced, reason, safety?, aiText? }
     ok:true  → texts[0] ist die (ggf. bereinigte) KI-Antwort
     ok:false → texts = Bot-Antwort; bei reason 'triage:*' zusätzlich safety:true und aiText = die
                bereinigte KI-Antwort, falls sie selbst sauber war (darf NACH den Sicherheitstexten folgen). */
import { triage } from './triage.js';
import { botReply } from './reply.js';

export const MAX_AI_CHARS = 900;

/* Dosierung: Zahl (auch 0,5 / ½ / 1/2 / „eine halbe") + Einheit. Uhrzeiten, Preise, Tage bleiben erlaubt. */
const UNIT = '(?:mg|milligramm|µg|mcg|mikrogramm|g\\b|gramm|ml|milliliter|l\\b|liter|kg|kilogramm|tabletten?|tbl|kapseln?|tropfen|hub|hübe|spritzen|einheiten|i\\.?\\s?e\\.?|ie\\b|iu\\b|tablets?|pills?|drops?)';
const DOSE_RX = new RegExp('(?:\\d+(?:[.,]\\d+)?|½|¼|¾|\\d+\\s?/\\s?\\d+)\\s?(?:-|–|bis)?\\s?(?:\\d+(?:[.,]\\d+)?)?\\s?' + UNIT, 'i');
const DOSE_WORD_RX = /\b(eine?n?|zwei|drei|vier|halbe?n?|viertel|ganze?n?)\s+(halbe?\s+|viertel\s+)?(tabletten?|kapseln?|tropfen|spritzen|ml|milliliter)\b/i;
const PER_KG_RX = /(pro|je|\/)\s?(kg|kilogramm|kilo)\b/i;
export function hasDosage(text) {
  const t = String(text || '');
  return DOSE_RX.test(t) || DOSE_WORD_RX.test(t) || PER_KG_RX.test(t);
}

const WARM_RX = /warm\s*(zu\s*)?halten|warmhalten|warm\s+einpacken|zudecken|in\s+(eine\s+)?decke\s+(ein)?wickeln|einwickeln|wärmflasche|waermflasche|keep\s+(him|her|it|them)?\s*warm/i;
const HEAT_RX = /hitzschlag|hitzeschlag|sonnenstich|überhitz|ueberhitz|heatstroke|heat stroke|hitzekollaps/i;

/* Sprache grob schätzen: Anteil deutscher vs. englischer Funktionswörter, fremde Schriften. */
const DE = ('der die das und ist nicht ein eine einen mit sie ich wir bitte ihr ihre ihren ihrem es zu auf für bei den dem des von wie was '
  + 'kann können sollte sollten gern gerne uns sich auch noch oder aber wenn dann so sehr heute morgen tier hund katze praxis termin danke').split(' ');
const EN = ('the and is are not a an with you we please your it to on for at of how what can could should would be this that '
  + 'there here have has will if then so very today tomorrow pet dog cat clinic appointment thanks my our they').split(' ');
const DE_SET = {}; DE.forEach((w) => { DE_SET[w] = 1; });
const EN_SET = {}; EN.forEach((w) => { EN_SET[w] = 1; });
export function looksNonGerman(text) {
  const t = String(text || '');
  const letters = t.replace(/[^A-Za-zÀ-ÿĀ-ɏͰ-ϿЀ-ӿ֐-ۿऀ-ॿ぀-ヿ一-鿿가-힯]/g, '');
  if (letters.length >= 12) {
    const latin = letters.replace(/[^A-Za-zÀ-ÿĀ-ɏ]/g, '').length;
    if (latin / letters.length < 0.6) return true;
  }
  const words = t.toLowerCase().replace(/[^a-zäöüß\s']/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  let de = 0; let en = 0;
  for (const w of words) { if (DE_SET[w] === 1) de++; if (EN_SET[w] === 1) en++; }
  if (/[äöüß]/.test(t)) de += 2;
  return en >= 3 && en > de * 2;
}

/* Markdown entfernen (Chat-Blasen zeigen es roh an). */
export function stripMarkdown(text) {
  let t = String(text || '');
  t = t.replace(/```[a-z]*\n?/gi, '').replace(/`([^`]*)`/g, '$1');
  t = t.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  t = t.replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,!?]|$)/g, '$1$2').replace(/(^|\s)_([^_\n]+)_(?=\s|[.,!?]|$)/g, '$1$2');
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  t = t.replace(/^\s*>\s?/gm, '');
  t = t.replace(/^\s*(?:[-*•+]|\d+[.)])\s+/gm, '');
  t = t.replace(/^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*$/gm, '').replace(/\|/g, ' ');
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

/* Am Satzende kürzen; notfalls an der Wortgrenze mit „…". */
export function trimToSentence(text, max) {
  const t = String(text || '');
  const lim = max || MAX_AI_CHARS;
  if (t.length <= lim) return t;
  const head = t.slice(0, lim);
  let cut = -1;
  const re = /[.!?](?=\s|$)/g;
  let m;
  while ((m = re.exec(head)) !== null) cut = m.index + 1;
  if (cut >= lim * 0.4) return head.slice(0, cut).trim();
  const sp = head.lastIndexOf(' ');
  return (sp > 0 ? head.slice(0, sp) : head).trim() + ' …';
}

function botTexts(args, persona) {
  const r = botReply({
    messages: args.messages, userText: args.userText, persona, practice: args.practice,
    practiceName: args.practiceName || (args.practice && args.practice.name) || '', now: args.now,
  });
  return r.texts;
}

export function guardAiReply(args) {
  const a = args && typeof args === 'object' ? args : {};
  const persona = a.persona === 'owner' || a.persona === 'colleague' ? a.persona : 'clinic';
  const userText = String(a.userText == null ? '' : a.userText);
  const raw = String(a.aiText == null ? '' : a.aiText);
  const tri = persona === 'clinic' ? triage(userText) : null;
  const heat = !!(tri && tri.heat) || HEAT_RX.test(userText);

  // Nachfilter zuerst berechnen (auch für den Sicherheitsfall: darf die KI danach ergänzen?)
  let problem = '';
  const cleaned0 = stripMarkdown(raw);
  if (!cleaned0.trim()) problem = 'empty';
  else if (hasDosage(cleaned0)) problem = 'dosage';
  else if (heat && WARM_RX.test(cleaned0)) problem = 'heat-warm';
  else if (looksNonGerman(cleaned0)) problem = 'language';
  const cleaned = problem ? '' : trimToSentence(cleaned0, MAX_AI_CHARS);

  // Vorab-Triage: ab „dringend" kommen die festen Sicherheitstexte zuerst
  if (tri && (tri.level === 'urgent' || tri.level === 'emergency' || tri.level === 'poison')) {
    return { ok: false, texts: botTexts(a, persona), replaced: true, reason: 'triage:' + tri.level, safety: true, aiText: cleaned || '', level: tri.level };
  }
  if (problem) return { ok: false, texts: botTexts(a, persona), replaced: true, reason: problem };
  const changed = cleaned !== raw.trim();
  return { ok: true, texts: [cleaned], replaced: false, reason: changed ? (cleaned.length < cleaned0.length ? 'trimmed' : 'markdown') : '' };
}
