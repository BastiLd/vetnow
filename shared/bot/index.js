/* VetNow Bot 3.0 — öffentliche Schnittstelle (Vertrag: docs/V3-ARCHITEKTUR.md §5).

   Ersetzt den vorläufigen Adapter auf Bot 2.2 (legacy-bot.js bleibt nur als Referenz im Ordner).
   Reines ESM ohne Abhängigkeiten, ohne Node-/DOM-/RN-APIs, ohne Lookbehind und Unicode-Property-Escapes — läuft in
   Hermes (Handy), Browsern, der MV3-Extension und im Hub (Node).

   persona = wer ANTWORTET: 'clinic' (Praxis), 'owner' (Tierhalter:in), 'colleague' (andere Praxis im Netzwerk).

   Exporte laut Vertrag:
     botReply({ messages, userText, persona, practiceName, practice?, now?, seed? })
       → { texts, intent, confidence, entities, triage:{level, reason}, meta, explain }
     botGreeting(persona, practiceName) → string
     botImageReply(persona, caption?, opts?) → string
     botConversationReply({ messages, userText, fromRole, practiceName }) → { texts }   (Legacy Bot 2.x)
     triage(text) → { level, reason, matched, … }
     guardAiReply({ persona, userText, aiText, practice }) → { ok, texts, replaced, reason }
     BOT_SUITE, runBotSuite() → { passed, failed, total, results[] } */
import { botReply as reply, botGreeting as greeting, botImageReply as imageReply } from './reply.js';
import { triage as triageText } from './triage.js';
import { guardAiReply as guard } from './guard.js';
import { SUITE } from './suite.de.js';
import { runSuite } from './runner.js';

export function botReply(opts) {
  return reply(opts);
}

export function botGreeting(persona, practiceName) {
  return greeting(persona, practiceName);
}

export function botImageReply(persona, caption, opts) {
  return imageReply(persona, caption, opts);
}

/* Legacy-Einstieg (Bot 2.x): fromRole = Persona der Antwort. Alte Nachrichten ohne meta werden
   hilfsweise aus dem Text gelesen (angebotene Zeiten, „eingetragen"). */
export function botConversationReply({ messages = [], userText = '', fromRole = 'clinic', practiceName = '' } = {}) {
  const r = reply({ messages, userText, persona: fromRole, practiceName });
  return { texts: r.texts };
}

export function triage(text) {
  const t = triageText(text);
  return {
    level: t.level, reason: t.reason, matched: t.matched, reasons: t.reasons, heat: t.heat, question: t.question,
    poison: t.poison ? { key: t.poison.key, name: t.poison.name } : null, lang: t.lang,
  };
}

export function guardAiReply(args) {
  return guard(args);
}

export const BOT_SUITE = SUITE;

export function runBotSuite(opts) {
  return runSuite(SUITE, opts);
}
