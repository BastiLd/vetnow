/* VetNow — KI-Anbindung (Ollama über VetNow Studio).
   Läuft die App über das Studio (http://SERVER:3000/vetnow.../), ist der
   Studio-Proxy same-origin unter /api/ai erreichbar und leitet an Ollama
   weiter. Auf GitHub Pages ist kein Server da — dann greift automatisch
   der eingebaute Bot (bot.js) als Fallback. */

const DEFAULT_TIMEOUT = 45000;

function base(aiBaseUrl) {
  const b = (aiBaseUrl || '').trim().replace(/\/+$/, '');
  return b || '/api/ai';
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

/* Chat-Antwort holen. messages: [{role:'user'|'assistant'|'system', content}] */
export async function aiChat({ messages, model, aiBaseUrl }) {
  const d = await fetchJson(base(aiBaseUrl) + '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages }),
  });
  const text = d && d.message && d.message.content ? String(d.message.content).trim() : '';
  if (!text) throw new Error('leere Antwort');
  return text;
}

/* System-Prompt für den Praxis-Bot */
export function vetSystemPrompt(fromRole, practiceName) {
  if (fromRole === 'owner') {
    return 'Du bist ein freundlicher Tierhalter aus Kärnten und antwortest der Tierarztpraxis im Chat. Antworte kurz (1-3 Sätze), natürlich und auf Deutsch.';
  }
  const P = practiceName || 'VetNow Kärnten';
  return `Du bist das freundliche Praxisteam von "${P}", einer Tierarztpraxis in Kärnten (Österreich). Antworte im Chat kurz (1-4 Sätze), hilfsbereit, professionell und auf Deutsch. Bei möglichen Notfällen (Vergiftung, Atemnot, starke Blutung, Krämpfe) rate SOFORT zum Anruf/Besuch. Gib keine Medikamenten-Dosierungen. Biete bei Terminwünschen konkrete Beispiel-Zeiten an (z.B. morgen 09:30 oder 14:00 Uhr). Erwähne bei Unsicherheit, dass eine Untersuchung vor Ort nötig ist.`;
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
