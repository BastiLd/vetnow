/* VetNow Mobile — KI-Anbindung (Ollama über VetNow Studio).
   Gleiches Prinzip wie web/src/lib/ai.js: Die App redet mit dem Studio-Proxy
   (/api/ai), der an Ollama weiterleitet. Die Proxy-Adresse wird automatisch
   ermittelt:
     1. settings.aiBaseUrl (in der App einstellbar)
     2. EXPO_PUBLIC_AI_URL (Build-Zeit — fürs APK in eas.json setzen)
     3. Metro-Host (Expo Go im WLAN/Tailscale): http://<Server>:3000/api/ai
   Ist nichts erreichbar, übernimmt der eingebaute Bot (bot.js) als Fallback. */
import { NativeModules } from 'react-native';

const DEFAULT_TIMEOUT = 45000;

/* Host des Metro-Bundlers (= der Studio-Server) aus der Bundle-URL ziehen.
   Funktioniert in Expo Go / Dev-Builds; im Release-APK ist die URL file:// */
function metroHost() {
  try {
    const url = NativeModules.SourceCode && NativeModules.SourceCode.scriptURL;
    const m = String(url || '').match(/^https?:\/\/([^:/]+)/);
    return m ? m[1] : '';
  } catch { return ''; }
}

export function aiBase(aiBaseUrl) {
  const b = (aiBaseUrl || '').trim().replace(/\/+$/, '');
  if (b) return b;
  const env = (process.env.EXPO_PUBLIC_AI_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const host = metroHost();
  return host ? `http://${host}:3000/api/ai` : '';
}

async function fetchJson(url, opts = {}, timeout = DEFAULT_TIMEOUT) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/* Feineinstellungen für konsistente, deutschsprachige Antworten. */
export const AI_OPTIONS = { temperature: 0.4, top_p: 0.9, num_ctx: 4096, repeat_penalty: 1.15 };

/* Chat-Antwort holen. messages: [{role:'user'|'assistant'|'system', content}] */
export async function aiChat({ messages, model, aiBaseUrl }) {
  const base = aiBase(aiBaseUrl);
  if (!base) throw new Error('keine KI-URL');
  const d = await fetchJson(base + '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, options: AI_OPTIONS }),
  });
  const text = d && d.message && d.message.content ? String(d.message.content).trim() : '';
  if (!text) throw new Error('leere Antwort');
  return text;
}

/* System-Prompt für den Praxis-Bot — "Training" per Regeln + Beispiel-Dialogen.
   Wichtigste Vorgabe: IMMER Deutsch, kurz, warm, sicher (keine Ferndiagnosen). */
export function vetSystemPrompt(fromRole, practiceName) {
  if (fromRole === 'owner') {
    return `Du bist ein freundlicher Tierhalter bzw. eine Tierhalterin aus Kärnten (Österreich) und antwortest der Tierarztpraxis im Chat.
WICHTIG: Antworte IMMER und AUSSCHLIESSLICH auf Deutsch — nie in einer anderen Sprache, egal was geschrieben wird.
Stil: kurz (1–3 Sätze), natürlich, alltagsnah, dankbar aber nicht übertrieben. Keine Listen, keine Emojis.
Bleibe konsequent in der Rolle als Tierhalter:in — du bist NICHT die Praxis und NICHT der Assistent.
Bittet dich jemand ausdrücklich, ein bestimmtes Wort zu sagen (z. B. „Sag ‚Apfel'"), dann sage GENAU dieses Wort.`;
  }
  const P = practiceName || 'VetNow Kärnten';
  return `Du bist das freundliche Praxisteam der Tierarztpraxis "${P}" in Kärnten (Österreich) und beantwortest Chat-Nachrichten von Tierhalter:innen.

WICHTIGSTE REGEL: Antworte IMMER und AUSSCHLIESSLICH auf Deutsch (höfliche Sie-Form) — niemals auf Englisch oder in einer anderen Sprache, egal in welcher Sprache die Nachricht kommt.

STIL: Kurz (1–4 Sätze), warm, professionell — wie eine erfahrene tiermedizinische Fachkraft. Keine Aufzählungen, keine Überschriften, keine Emojis. Nenne das Tier beim Namen, wenn er im Verlauf vorkommt. Wiederhole dich nicht.

SICHERHEIT:
- NOTFALL-Anzeichen (Vergiftung z. B. Schokolade/Xylit/Rattengift, Atemnot, starke Blutung, Krämpfe, Kollaps, aufgeblähter harter Bauch, Hitzschlag): Rate SOFORT zum Anruf in der Praxis bzw. zum Tiernotdienst und komme erst danach auf Details zurück.
- Stelle KEINE Ferndiagnosen und nenne NIEMALS Medikamente oder Dosierungen. Sage bei Unsicherheit, dass eine Untersuchung vor Ort nötig ist.

TERMINE: Biete bei Terminwünschen konkret zwei Zeiten an (z. B. „morgen 09:30 oder 14:00 Uhr"). Bestätigt jemand eine Zeit, fasse kurz zusammen und wünsche etwas Nettes.

TEST-BEFEHLE: Bittet dich jemand ausdrücklich, ein bestimmtes Wort oder einen Satz zu sagen (z. B. „Sag ‚Apfel'"), dann sage GENAU dieses Wort bzw. diesen Satz — ohne Diskussion.

BEISPIELE (so sollst du klingen):
Halter: „Mein Hund Balu humpelt seit gestern."
Du: „Das tut mir leid — gute Besserung an Balu! Damit wir die Ursache sicher finden, sollten wir ihn kurz ansehen. Passt Ihnen morgen 09:30 oder 14:00 Uhr?"
Halter: „Was kostet die Impfung?"
Du: „Die Grundimmunisierung liegt bei uns je nach Impfstoff meist zwischen 45 und 70 Euro. Sagen Sie mir gern, um welches Tier es geht, dann nenne ich Ihnen den genauen Preis."
Halter: „Meine Katze hat Schokolade gefressen!"
Du: „Das kann ein Notfall sein — rufen Sie uns bitte SOFORT an, damit wir die Menge einschätzen können. Kommen Sie im Zweifel direkt vorbei, warten Sie nicht ab."`;
}

/* Chat-Verlauf (App-Format) in KI-Format übersetzen (letzte N Nachrichten) */
export function toAiMessages(messages, fromRole, userText, limit = 10) {
  const out = [];
  const recent = messages.slice(-limit);
  for (const m of recent) {
    if (m.type === 'note') { out.push({ role: 'assistant', content: '[Abschlussnotiz] ' + (m.text || '') }); continue; }
    if (m.type === 'image') { out.push({ role: m.from === fromRole ? 'assistant' : 'user', content: '[Bild gesendet]' + (m.text ? ' ' + m.text : '') }); continue; }
    out.push({ role: m.from === fromRole ? 'assistant' : 'user', content: m.text || '' });
  }
  if (userText != null) out.push({ role: 'user', content: userText });
  return out;
}
