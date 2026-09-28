/* VetNow Hub — KI-Fehler: EIN Fehlertyp mit maschinenlesbarem Code für alle Anbieter.

   Warum Codes statt nur Text? Die Apps müssen unterscheiden können:
     offline     = KI schlicht nicht da → im Modus 'ai-fallback' antwortet STILL der Bot
                   (eine Vorführung ohne Netz bleibt sauber).
     alles andere = echtes Problem (Modell fehlt, Bild nicht möglich, Absturz, Ablehnung …)
                   → sichtbarer Hinweis, damit niemand eine Bot-Antwort für eine KI-Antwort hält.
   Vertrag §6: offline, no-model, no-vision, model-crash, refusal, timeout, bad-request. */

export const AI_CODES = ['offline', 'no-model', 'no-vision', 'model-crash', 'refusal', 'timeout', 'bad-request'];

/* HTTP-Status je Code (für /api/v1/ai/chat). 503 = „Dienst nicht verfügbar" passt zu offline,
   504 zu einer Zeitüberschreitung; Konfigurationsprobleme sind 400er. */
export const AI_HTTP_STATUS = {
  offline: 503,
  timeout: 504,
  'no-model': 400,
  'no-vision': 400,
  'bad-request': 400,
  refusal: 422,
  'model-crash': 502,
};

export class AiError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'AiError';
    this.code = AI_CODES.includes(code) ? code : 'model-crash';
    Object.assign(this, extra);
  }
  get status() { return AI_HTTP_STATUS[this.code] || 502; }
}

/* Deutsche Meldungen für bekannte Rohfehler (aus studio/server.js übernommen und um Codes ergänzt).
   Ohne das stünde in der App z. B. wörtlich „llama runner process has terminated with exit code -1". */
const ERROR_MAP = [
  [/exit code -1|runner process has terminated|llm server not responding/i, 'model-crash',
    'Das Modell konnte nicht geladen werden. Häufigste Ursache: Es passt nicht auf die Grafikkarte. '
    + 'Tipp: Ollama auf reinen CPU-Betrieb stellen (OLLAMA_NUM_GPU=0) und Ollama neu starten.'],
  [/out of memory|cuda error|insufficient memory|failed to allocate/i, 'model-crash',
    'Zu wenig Speicher für dieses Modell. Bitte ein kleineres Modell wählen oder Ollama auf CPU-Betrieb stellen (OLLAMA_NUM_GPU=0).'],
  [/does not support (images|vision)|image input is not supported|unable to process image/i, 'no-vision',
    'Dieses Modell kann keine Bilder verarbeiten. Bitte ein Bild-Modell (Vision) installieren und im Admin-Center als Bild-Modell setzen.'],
  [/model .* not found|no such model|pull the model|model not found/i, 'no-model',
    'Dieses Modell ist auf dem KI-Server nicht installiert. Bitte zuerst herunterladen (z. B. „ollama pull qwen2.5:7b").'],
  [/context length|too many tokens|exceeds context/i, 'bad-request',
    'Die Anfrage ist zu lang für das Kontextfenster des Modells. Bitte weniger Verlauf mitschicken.'],
  [/timeout|timed out/i, 'timeout',
    'Zeitlimit überschritten — das Modell hat nicht rechtzeitig geantwortet. Bei Bildern auf der CPU ist das normal: ein kleineres Modell wählen.'],
  [/ECONNREFUSED|fetch failed|ENOTFOUND|EHOSTUNREACH|ECONNRESET|not reachable|socket hang up/i, 'offline',
    'Der KI-Server ist nicht erreichbar. Läuft der Dienst (Ollama: Standard-Port 11434)? Adresse prüfen.'],
  [/413|too large|payload/i, 'bad-request',
    'Die Anfrage war zu groß (meist ein zu großes Bild). Bitte ein kleineres Foto senden.'],
];

/* Rohfehler (Error-Objekt oder Text) → AiError. Bereits eingeordnete Fehler bleiben unverändert. */
export function toAiError(err, fallbackCode = 'model-crash') {
  if (err instanceof AiError) return err;
  const raw = typeof err === 'string' ? err : [err && err.message, err && err.cause && err.cause.message, err && err.cause && err.cause.code]
    .filter(Boolean).join(' | ');
  for (const [rx, code, msg] of ERROR_MAP) {
    if (rx.test(raw)) return new AiError(code, msg, { raw: raw.slice(0, 300) });
  }
  return new AiError(fallbackCode, raw ? 'Unerwarteter KI-Fehler: ' + raw.slice(0, 200) : 'Unbekannter KI-Fehler.', { raw: raw.slice(0, 300) });
}

/* Zeitlimit-Abbruch vs. Abbruch durch den Aufrufer (Chat gelöscht, Client weg) unterscheiden. */
export function abortToAiError(signal, timedOut, label) {
  if (timedOut) return new AiError('timeout', `Zeitlimit überschritten — ${label} hat nicht rechtzeitig geantwortet.`);
  const e = new Error('Abgebrochen');
  e.name = 'AbortError';
  if (signal && signal.reason) e.cause = signal.reason;
  return e;
}
