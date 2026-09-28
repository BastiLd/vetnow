/* VetNow Hub — „Test-KI" (Anbieter `mock`).

   Wozu? Damit man KI-Wege (Streaming, Stempel '· Test-KI', Bild-Erkennung, KI-Agent mit JSON-Plan,
   Fehlerfälle) OHNE echten KI-Server testen und vorführen kann — deterministisch, sofort, offline.
   Die Antworten kommen aus dem Bot (gleiche Logik wie ohne KI), gestreamt Wort für Wort.

   Besonderheiten:
   - „Sag Apfel" / „Sag bitte ‚Hallo Welt'" → antwortet GENAU das (Test-Befehl wie bei echten Modellen).
   - Bild in der letzten Nachricht → „Bild erhalten (Test-KI) …" + Bild-Antwort des Bots.
   - format:'json' → kleiner gültiger Plan {"steps":[{say, act}]} für den Web-KI-Agenten,
     aus Stichworten der Aufgabe gebaut. */
import { sleep } from '../lib/util.js';
import { sniffImageMime } from './net.js';

export const MOCK_MODEL = 'test-ki';

/* Wer antwortet? Steht im System-Prompt (vetSystemPrompt) — z. B. „Du bist ein freundlicher Tierhalter …".
   Absichtlich eng formuliert: Der Praxis-Prompt enthält auch das Wort „Tierhalter:innen". */
export function inferPersona(system) {
  const s = String(system || '');
  if (/Du bist\s+(?:ein|eine)\s+(?:\S+\s+){0,2}Tierhalter/i.test(s)) return 'owner';
  if (/Du bist\s+(?:ein|eine)\s+(?:\S+\s+){0,2}Kolleg/i.test(s) || /Praxis-Netzwerk/i.test(s)) return 'colleague';
  return 'clinic';
}

export function inferPracticeName(system) {
  const m = /Tierarztpraxis\s+["„“»]([^"“”«]+)["“”«]/.exec(String(system || ''));
  return m ? m[1].trim() : '';
}

const QUOTES = '"\'„“”‚‘’»«';

/* Test-Befehl „Sag X" erkennen. Nur am Nachrichtenanfang (optional „Bitte"/„Test:" davor) und
   nur kurz oder in Anführungszeichen — sonst würde „Sag mal, wann habt ihr offen?" nachgeplappert. */
export function sayCommand(text) {
  const t = String(text || '').trim();
  const m = /^(?:(?:bitte|test|ok|okay|hallo|hi)\s*[:,!.]?\s+)?(?:sag|sage|say)\s+(?:(?:bitte|mal|genau|nur|einfach|jetzt)\s+)*(?:(?:das|dieses|folgendes)\s+wort\s*:?\s*)?(.+)$/is.exec(t);
  if (!m) return null;
  let rest = m[1].trim();
  if (/^(?:mal|bitte)\s*,/i.test(rest) || rest.startsWith(',')) return null;
  if (QUOTES.includes(rest[0])) {
    const body = rest.slice(1);
    let end = -1;
    for (let i = 0; i < body.length; i++) if (QUOTES.includes(body[i])) { end = i; break; }
    rest = end >= 0 ? body.slice(0, end) : body;
    rest = rest.trim();
    return rest ? rest.slice(0, 200) : null;
  }
  rest = rest.replace(/[.!?…]+$/, '').trim();
  if (!rest || rest.split(/\s+/).length > 6 || rest.includes(',')) return null;
  return rest.slice(0, 200);
}

/* ---- JSON-Plan für den KI-Agenten ---- */
const DEFAULT_ACTS = {
  home: 'Startseite öffnen',
  search: 'Such-Screen öffnen',
  results: 'Ergebnisliste öffnen',
  dashboard: 'Praxis-Dashboard öffnen',
  tab_status: 'Dashboard-Tab „Status" öffnen',
  tab_appts: 'Dashboard-Tab „Termine" öffnen',
  tab_messages: 'Dashboard-Tab „Posteingang" öffnen',
  tab_profile: 'Dashboard-Tab „Profil" öffnen',
  filters_emergency: 'Suchfilter für einen Notfall setzen',
  filters_clear: 'Alle Suchfilter entfernen',
  detail_best: 'Beste erreichbare Praxis im Detail öffnen',
  detail_grey: 'Eine nicht bestätigte Praxis im Detail öffnen',
};

const PLANS = [
  [/notfall|dringend|emergency|vergift|blut/i, ['search', 'filters_emergency', 'results', 'detail_best', 'home']],
  [/check|prüf|vergleich|suche|übersicht/i, ['filters_clear', 'results', 'detail_best', 'detail_grey', 'home']],
  [/termin|kalender|appointment/i, ['dashboard', 'tab_appts', 'tab_messages', 'home']],
  [/posteingang|nachricht|anfrage|chat/i, ['dashboard', 'tab_messages', 'tab_status', 'home']],
  [/profil|team|öffnungszeit/i, ['dashboard', 'tab_profile', 'home']],
];
const DAY_PLAN = ['dashboard', 'tab_status', 'tab_appts', 'tab_messages', 'tab_profile', 'search', 'results', 'home'];

export function buildJsonPlan(system, userText) {
  // Aktionskatalog aus dem System-Prompt lesen: Zeilen wie  - "tab_status": Dashboard-Tab … öffnen
  const acts = {};
  const rx = /^\s*-\s*"([A-Za-z0-9_]+)"\s*:\s*(.+)$/gm;
  let m;
  while ((m = rx.exec(String(system || '')))) acts[m[1]] = m[2].trim();
  const catalog = Object.keys(acts).length ? acts : DEFAULT_ACTS;
  const taskLine = /AUFGABE:\s*(.+)/i.exec(String(userText || ''));
  const task = taskLine ? taskLine[1] : String(userText || '');
  let plan = DAY_PLAN;
  for (const [re, p] of PLANS) if (re.test(task)) { plan = p; break; }
  let steps = plan.filter((a) => catalog[a]).map((act) => ({ say: `Test-KI: ${catalog[act].replace(/\s+/g, ' ').slice(0, 140)}.`, act }));
  if (!steps.length) {
    const first = Object.keys(catalog)[0];
    steps = [{ say: 'Test-KI: Ich sehe mir die Aufgabe an.', act: first }];
  }
  return JSON.stringify({ steps });
}

/* KI-Nachrichten (role/content) → App-Nachrichten (from/text), damit der Bot den Verlauf kennt. */
function toBotHistory(messages, persona) {
  const me = persona === 'clinic' ? 'clinic' : 'owner';
  const other = me === 'clinic' ? 'owner' : 'clinic';
  return messages.filter((m) => m.role !== 'system').map((m) => ({
    from: m.role === 'assistant' ? me : other, type: 'text', text: String(m.content || ''),
  }));
}

export function createMockProvider({ botReply, botImageReply, wordDelayMs = 25 } = {}) {
  async function emit(text, { stream, onDelta, signal }) {
    if (!stream || typeof onDelta !== 'function') return;
    // Wörter samt folgendem Leerraum senden — zusammengesetzt ergibt das exakt den Gesamttext.
    const parts = text.match(/\S+\s*|\s+/g) || [];
    for (let i = 0; i < parts.length; i++) {
      if (i > 0 && wordDelayMs > 0) await sleep(wordDelayMs, signal);
      else if (signal && signal.aborted) await sleep(0, signal);
      onDelta(parts[i]);
    }
  }

  return {
    id: 'mock',
    label: 'Test-KI',
    async available() { return { ok: true, reason: '', models: [MOCK_MODEL] }; },
    async models() { return [{ name: MOCK_MODEL, family: 'VetNow-Bot', params: '—', vision: true }]; },
    async chat({ messages = [], stream = false, onDelta, format, signal, persona, practiceName } = {}) {
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
      const who = persona || inferPersona(system);
      const practice = practiceName || inferPracticeName(system);
      const convo = messages.filter((m) => m.role !== 'system');
      let lastUserIdx = -1;
      for (let i = convo.length - 1; i >= 0; i--) if (convo[i].role === 'user') { lastUserIdx = i; break; }
      const last = lastUserIdx >= 0 ? convo[lastUserIdx] : null;
      const userText = last ? String(last.content || '') : '';
      const images = last && Array.isArray(last.images) ? last.images.filter(Boolean) : [];

      let text;
      let vision = false;
      if (format === 'json') {
        text = buildJsonPlan(system, userText);
      } else if (images.length) {
        vision = true;
        const b64 = images[images.length - 1];
        const kb = Math.max(1, Math.round((b64.length * 3) / 4 / 1024));
        const kind = sniffImageMime(b64).split('/')[1].toUpperCase();
        const said = sayCommand(userText);
        const botText = typeof botImageReply === 'function' ? botImageReply(who) : 'Danke für das Bild.';
        text = said || `Bild erhalten (Test-KI): ${kind}, ca. ${kb} KB. ${botText}`;
      } else {
        const said = sayCommand(userText);
        if (said) {
          text = said;
        } else {
          const history = toBotHistory(convo.slice(0, lastUserIdx >= 0 ? lastUserIdx : convo.length), who);
          const r = typeof botReply === 'function' ? botReply({ messages: history, userText, persona: who, practiceName: practice }) : null;
          const texts = r && Array.isArray(r.texts) ? r.texts.filter(Boolean) : [];
          text = texts.length ? texts.join('\n\n') : 'Danke für Ihre Nachricht. Bei akuten Notfällen rufen Sie bitte sofort an.';
        }
      }
      await emit(text, { stream, onDelta, signal });
      return { text, model: MOCK_MODEL, vision };
    },
  };
}
