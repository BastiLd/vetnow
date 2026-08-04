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
/* Bilder brauchen deutlich länger: ein Vision-Modell auf der CPU liegt leicht
   bei 20-60 s. Mit 45 s bricht die App ab, bevor überhaupt etwas zurückkommt. */
const VISION_TIMEOUT = 120000;

/* Ein Fehler, den die App dem Nutzer ZEIGEN soll (z. B. „Bild zu groß"),
   statt still auf den Bot zurückzufallen. */
export class AiVisibleError extends Error {
  constructor(msg) { super(msg); this.name = 'AiVisibleError'; this.visible = true; }
}

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
    if (!res.ok) {
      /* Der Studio-Proxy liefert bei bekannten Problemen eine verständliche
         deutsche Meldung mit — die wollen wir nicht wegwerfen. */
      let detail = ''; let code = '';
      try { const j = await res.json(); detail = j.error || ''; code = j.code || ''; } catch { /* kein JSON */ }
      const err = new Error(detail || 'HTTP ' + res.status);
      err.httpStatus = res.status;
      err.code = code; // 'offline' | 'no-vision' | 'model-crash' | …
      throw err;
    }
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
  const hasImage = (messages || []).some((m) => Array.isArray(m.images) && m.images.length);
  let d;
  try {
    d = await fetchJson(base + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages }),
    }, hasImage ? VISION_TIMEOUT : DEFAULT_TIMEOUT);
  } catch (e) {
    /* Bei einer Bildanfrage darf ein Fehler NICHT still zum Bot führen — sonst
       sieht man eine plausible Antwort und erfährt nie, dass das Foto nie
       angekommen ist. Genau diese Falle hat diese Runde ausgelöst.
       ABER: Der Code 'offline' heißt schlicht „keine KI da". Dann übernimmt
       weiterhin STILL der Bot, damit eine Vorführung ohne Netz sauber bleibt. */
    const s = e && e.httpStatus;
    if (s === 413) throw new AiVisibleError('Das Bild war zu groß für den Server. Bitte ein kleineres Foto senden.');
    if (hasImage && s === 400) throw new AiVisibleError(e.message || 'Für Bilder ist kein Bild-Modell hinterlegt (Studio → KI → Hintergrund-Modell).');
    if (hasImage && s === 502 && e.code && e.code !== 'offline') throw new AiVisibleError(e.message || 'Das Bild-Modell konnte nicht antworten.');
    throw e;
  }
  const text = d && d.message && d.message.content ? String(d.message.content).trim() : '';
  if (!text) throw new Error('leere Antwort');
  // vnModel/vnVision setzt der Studio-Proxy — damit weiß die App, WER geantwortet hat.
  return { text, model: d.vnModel || model || '', vision: !!d.vnVision };
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
  /* Nur das LETZTE Bild wirklich mitschicken. Alle Bilder der letzten zehn
     Nachrichten anzuhängen sprengt den Request und treibt die Antwortzeit
     ins Absurde. Ältere Bilder bleiben als Textmarke im Verlauf.
     `srcB64` füllt der Bild-Picker (siehe ChatThreadScreen) — `src` ist auf
     dem Handy nur ein Dateipfad und enthält KEINE Bilddaten. */
  let lastImageIdx = -1;
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (!m.deleted && m.type === 'image' && m.srcB64) { lastImageIdx = i; break; }
  }

  recent.forEach((m, i) => {
    if (m.deleted) return; // gelöschte Nachrichten nie an die KI schicken
    const role = m.from === fromRole ? 'assistant' : 'user';
    if (m.type === 'file') { out.push({ role, content: '[Datei gesendet: ' + (m.fileName || 'Anhang') + ']' + (m.text ? ' ' + m.text : '') }); return; }
    if (m.type === 'note') { out.push({ role: 'assistant', content: '[Abschlussnotiz] ' + (m.text || '') }); return; }
    if (m.type === 'image') {
      const b64 = i === lastImageIdx ? m.srcB64 : '';
      const msg = { role, content: m.text || (b64 ? 'Bitte sieh dir dieses Bild an.' : '[Bild gesendet]') };
      if (b64) msg.images = [b64];
      out.push(msg);
      return;
    }
    out.push({ role, content: m.text || '' });
  });
  if (userText != null) out.push({ role: 'user', content: userText });
  return out;
}
