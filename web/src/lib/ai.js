/* VetNow — KI-Anbindung (Ollama über VetNow Studio).
   Läuft die App über das Studio (http://SERVER:3000/vetnow.../), ist der
   Studio-Proxy same-origin unter /api/ai erreichbar und leitet an Ollama
   weiter. Auf GitHub Pages ist kein Server da — dann greift automatisch
   der eingebaute Bot (bot.js) als Fallback. */

const DEFAULT_TIMEOUT = 45000;
/* Bilder brauchen deutlich länger: ein Vision-Modell auf der CPU liegt leicht
   bei 20-60 s. Mit 45 s bricht die App ab, bevor überhaupt etwas zurückkommt. */
const VISION_TIMEOUT = 120000;

/* Ein Fehler, den die App dem Nutzer ZEIGEN soll (z. B. „Bild zu groß"),
   statt still auf den Bot zurückzufallen. */
export class AiVisibleError extends Error {
  constructor(msg) { super(msg); this.name = 'AiVisibleError'; this.visible = true; }
}

function base(aiBaseUrl) {
  const b = (aiBaseUrl || '').trim().replace(/\/+$/, '');
  return b || '/api/ai';
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

/* Bild im Browser auf `maxPx` Kantenlänge herunterrechnen und als JPEG neu
   kodieren. Ein 4-MB-Foto würde als Base64 ~5,3 MB groß und am Server-Limit
   scheitern; verkleinert sind es typisch 150-400 KB.
   Rückgabe: { dataUrl, base64 } — dataUrl für die Anzeige, base64 für die KI. */
export function shrinkImage(file, maxPx = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = cv.toDataURL('image/jpeg', quality);
      resolve({ dataUrl, base64: dataUrl.split(',')[1] || '', w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kein gültiges Bild')); };
    img.src = url;
  });
}

/* Base64 aus einer Data-URL ziehen (Ollama will es OHNE „data:…;base64,"-Präfix) */
export function dataUrlToBase64(src) {
  if (!src || typeof src !== 'string') return '';
  const i = src.indexOf(',');
  return src.startsWith('data:') && i > 0 ? src.slice(i + 1) : '';
}

/* Ist der KI-Proxy erreichbar und Ollama verbunden? */
export async function aiStatus(aiBaseUrl) {
  try {
    return await fetchJson(base(aiBaseUrl) + '/status', {}, 5000);
  } catch {
    return { ok: false };
  }
}

/* Installierte Modelle abfragen */
export async function aiModels(aiBaseUrl) {
  try {
    const d = await fetchJson(base(aiBaseUrl) + '/models', {}, 8000);
    return d.models || [];
  } catch {
    return [];
  }
}

/* Feineinstellungen für konsistente, deutschsprachige Antworten:
   niedrige Temperatur = weniger Ausreißer/Sprachwechsel, genug Kontext für Verlauf. */
export const AI_OPTIONS = { temperature: 0.4, top_p: 0.9, num_ctx: 4096, repeat_penalty: 1.15 };

/* Chat-Antwort holen. messages: [{role:'user'|'assistant'|'system', content}]
   format: 'json' zwingt Ollama zu reinem JSON (für den Planungs-Agenten). */
export async function aiChat({ messages, model, aiBaseUrl, format }) {
  const hasImage = (messages || []).some((m) => Array.isArray(m.images) && m.images.length);
  let d;
  try {
    d = await fetchJson(base(aiBaseUrl) + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, ...(format ? { format } : {}) }),
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
Bittet dich jemand ausdrücklich, ein bestimmtes Wort zu sagen (z. B. „Sag ‚Apfel‘“), dann sage GENAU dieses Wort.`;
  }
  const P = practiceName || 'VetNow Kärnten';
  return `Du bist das freundliche Praxisteam der Tierarztpraxis "${P}" in Kärnten (Österreich) und beantwortest Chat-Nachrichten von Tierhalter:innen.

WICHTIGSTE REGEL: Antworte IMMER und AUSSCHLIESSLICH auf Deutsch (höfliche Sie-Form) — niemals auf Englisch oder in einer anderen Sprache, egal in welcher Sprache die Nachricht kommt.

STIL: Kurz (1–4 Sätze), warm, professionell — wie eine erfahrene tiermedizinische Fachkraft. Keine Aufzählungen, keine Überschriften, keine Emojis. Nenne das Tier beim Namen, wenn er im Verlauf vorkommt. Wiederhole dich nicht.

SICHERHEIT:
- NOTFALL-Anzeichen (Vergiftung z. B. Schokolade/Xylit/Rattengift, Atemnot, starke Blutung, Krämpfe, Kollaps, aufgeblähter harter Bauch, Hitzschlag): Rate SOFORT zum Anruf in der Praxis bzw. zum Tiernotdienst und komme erst danach auf Details zurück.
- Stelle KEINE Ferndiagnosen und nenne NIEMALS Medikamente oder Dosierungen. Sage bei Unsicherheit, dass eine Untersuchung vor Ort nötig ist.

TERMINE: Biete bei Terminwünschen konkret zwei Zeiten an (z. B. „morgen 09:30 oder 14:00 Uhr“). Bestätigt jemand eine Zeit, fasse kurz zusammen und wünsche etwas Nettes.

TEST-BEFEHLE: Bittet dich jemand ausdrücklich, ein bestimmtes Wort oder einen Satz zu sagen (z. B. „Sag ‚Apfel‘“), dann sage GENAU dieses Wort bzw. diesen Satz — ohne Diskussion.

BEISPIELE (so sollst du klingen):
Halter: „Mein Hund Balu humpelt seit gestern.“
Du: „Das tut mir leid — gute Besserung an Balu! Damit wir die Ursache sicher finden, sollten wir ihn kurz ansehen. Passt Ihnen morgen 09:30 oder 14:00 Uhr?“
Halter: „Was kostet die Impfung?“
Du: „Die Grundimmunisierung liegt bei uns je nach Impfstoff meist zwischen 45 und 70 Euro. Sagen Sie mir gern, um welches Tier es geht, dann nenne ich Ihnen den genauen Preis.“
Halter: „Meine Katze hat Schokolade gefressen!“
Du: „Das kann ein Notfall sein — rufen Sie uns bitte SOFORT an, damit wir die Menge einschätzen können. Kommen Sie im Zweifel direkt vorbei, warten Sie nicht ab.“`;
}

/* Chat-Verlauf (App-Format) in KI-Format übersetzen (letzte N Nachrichten) */
export function toAiMessages(messages, fromRole, userText, limit = 10) {
  const out = [];
  const recent = messages.slice(-limit);
  /* Nur das LETZTE Bild wirklich mitschicken. Alle Bilder der letzten zehn
     Nachrichten anzuhängen sprengt den Request und treibt die Antwortzeit
     ins Absurde. Ältere Bilder bleiben als Textmarke im Verlauf. */
  let lastImageIdx = -1;
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (!m.deleted && m.type === 'image' && dataUrlToBase64(m.src)) { lastImageIdx = i; break; }
  }

  recent.forEach((m, i) => {
    if (m.deleted) return; // gelöschte Nachrichten nie an die KI schicken
    const role = m.from === fromRole ? 'assistant' : 'user';
    if (m.type === 'file') { out.push({ role, content: '[Datei gesendet: ' + (m.fileName || 'Anhang') + ']' + (m.text ? ' ' + m.text : '') }); return; }
    if (m.type === 'note') { out.push({ role: 'assistant', content: '[Abschlussnotiz] ' + (m.text || '') }); return; }
    if (m.type === 'image') {
      const b64 = i === lastImageIdx ? dataUrlToBase64(m.src) : '';
      const msg = { role, content: m.text || (b64 ? 'Bitte sieh dir dieses Bild an.' : '[Bild gesendet]') };
      // DAS ist der eigentliche Fix: Bisher wurde m.src verworfen und nur der
      // Text „[Bild gesendet]" geschickt — kein Modell konnte dabei etwas sehen.
      if (b64) msg.images = [b64];
      out.push(msg);
      return;
    }
    out.push({ role, content: m.text || '' });
  });
  if (userText != null) out.push({ role: 'user', content: userText });
  return out;
}
