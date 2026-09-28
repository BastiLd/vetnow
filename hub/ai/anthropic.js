/* VetNow Hub — Anbieter `anthropic` (Claude über das offizielle SDK @anthropic-ai/sdk).

   Nur verfügbar, wenn (1) das SDK installiert ist (optionale Abhängigkeit — `npm install` im Ordner
   hub/) UND (2) ANTHROPIC_API_KEY gesetzt ist. Sonst meldet der Anbieter ehrlich, was fehlt, und
   bei 'auto' übernimmt der nächste Anbieter bzw. der Bot.

   Modell: VN_ANTHROPIC_MODEL, Standard 'claude-opus-5'. Wichtig für dieses Modell:
   - KEIN temperature/top_p (wurden entfernt → 400), KEIN thinking-Parameter (adaptiv ist Standard).
   - Keine „Prefill"-Antworten: Die letzte Nachricht muss von der Nutzerseite kommen.
   - Sicherheitsfilter können ablehnen (stop_reason 'refusal'). `fallbacks: 'default'` (Beta
     server-side-fallback-2026-07-01) lässt Anthropic dann serverseitig ein passendes Ersatzmodell
     antworten. Lehnt auch das ab, melden wir Fehlercode 'refusal'.
   - effort 'low': Chat-Antworten sind kurz; höhere Stufen kosten nur Zeit und Geld. */
import { AiError, abortToAiError } from './errors.js';
import { deadline, sniffImageMime, stripDataUrl } from './net.js';

export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5';
export const ANTHROPIC_BETAS = Object.freeze(['server-side-fallback-2026-07-01']);

const JSON_HINT = 'Antworte ausschließlich mit gültigem JSON — ohne Erklärtext und ohne Markdown-Codeblock.';

/* Ollama-artige Nachrichten → Anthropic-Format.
   - System-Prompt(s) separat (Parameter `system`).
   - Bilder als Base64-Bildblock VOR dem Textblock (so versteht das Modell „dieses Bild").
   - Aufeinanderfolgende Nachrichten derselben Rolle werden zusammengelegt.
   - Beginnt der Verlauf mit der Assistenz-Seite, kommt ein kurzer Nutzer-Platzhalter davor;
     endet er mit ihr, kommt eine Bitte um Antwort dahinter (Prefill ist bei diesem Modell verboten). */
export function toAnthropicMessages(messages = [], { format } = {}) {
  const systemParts = [];
  const out = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== 'object') continue;
    const text = String(m.content == null ? '' : m.content);
    if (m.role === 'system') { if (text.trim()) systemParts.push(text); continue; }
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const blocks = [];
    const imgs = Array.isArray(m.images) ? m.images.map(stripDataUrl).filter(Boolean) : [];
    if (role === 'user') {
      for (const data of imgs) blocks.push({ type: 'image', source: { type: 'base64', media_type: sniffImageMime(data), data } });
    }
    const t = role === 'assistant' && imgs.length && !text.trim() ? '[Bild gesendet]' : text;
    if (t.trim()) blocks.push({ type: 'text', text: t });
    if (!blocks.length) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content.push(...blocks);
    else out.push({ role, content: blocks });
  }
  if (!out.length) throw new AiError('bad-request', 'Es gibt keine Nachricht, auf die die KI antworten könnte.');
  if (out[0].role === 'assistant') out.unshift({ role: 'user', content: [{ type: 'text', text: '(Beginn der Unterhaltung)' }] });
  if (out[out.length - 1].role === 'assistant') {
    out.push({ role: 'user', content: [{ type: 'text', text: '(Bitte antworte jetzt passend auf den bisherigen Verlauf.)' }] });
  }
  if (format === 'json') systemParts.push(JSON_HINT);
  return { system: systemParts.join('\n\n'), messages: out };
}

/* SDK-Fehler → AiError mit deutscher Meldung. Reihenfolge: speziell vor allgemein
   (im TypeScript-SDK erben ALLE Klassen von APIError, auch APIConnectionError). */
export function mapAnthropicError(e, Anthropic) {
  if (e instanceof AiError) return e;
  const A = Anthropic || {};
  const is = (name) => typeof A[name] === 'function' && e instanceof A[name];
  const detail = (e && e.error && e.error.error && e.error.error.message) || (e && e.message) || '';
  const status = e && typeof e.status === 'number' ? e.status : null;
  if (is('APIConnectionTimeoutError')) return new AiError('timeout', 'Zeitlimit überschritten — Anthropic hat nicht rechtzeitig geantwortet.');
  if (is('APIConnectionError')) return new AiError('offline', 'Anthropic ist nicht erreichbar (keine Internetverbindung?).');
  if (is('AuthenticationError') || status === 401) return new AiError('offline', 'Der Anthropic-API-Schlüssel wurde abgelehnt. Bitte ANTHROPIC_API_KEY prüfen.');
  if (is('PermissionDeniedError') || status === 403) return new AiError('offline', 'Der Anthropic-Schlüssel hat keine Berechtigung für dieses Modell.');
  if (is('RateLimitError') || status === 429) return new AiError('offline', 'Anthropic: Anfragelimit erreicht — bitte kurz warten und erneut versuchen.');
  if (is('NotFoundError') || status === 404) return new AiError('no-model', 'Dieses Claude-Modell gibt es nicht oder es ist für diesen Schlüssel nicht freigeschaltet. VN_ANTHROPIC_MODEL prüfen.');
  if (is('BadRequestError') || status === 400) return new AiError('bad-request', 'Anthropic hat die Anfrage abgelehnt: ' + String(detail).slice(0, 200));
  if (status === 529 || (e && e.type === 'overloaded_error')) return new AiError('offline', 'Anthropic ist gerade überlastet — bitte gleich noch einmal versuchen.');
  if (is('InternalServerError') || (status && status >= 500)) return new AiError('model-crash', 'Bei Anthropic ist ein interner Fehler aufgetreten.');
  if (is('APIError')) return new AiError('model-crash', 'Unerwarteter Fehler von Anthropic: ' + String(detail).slice(0, 200));
  return new AiError('model-crash', 'Unerwarteter KI-Fehler: ' + String(detail).slice(0, 200));
}

/* Optionen:
   env        Umgebung (ANTHROPIC_API_KEY, VN_ANTHROPIC_MODEL)
   client     fertiger Client (Tests: Fake mit beta.messages.stream) — dann ist kein SDK/Schlüssel nötig
   loadSdk    () => import('@anthropic-ai/sdk') — austauschbar, um „nicht installiert" zu testen
   config()   → { model, timeoutMs } live aus den Einstellungen */
export function createAnthropicProvider({ env = process.env, client: injected = null, loadSdk, config } = {}) {
  let sdk = null; // { ok, Anthropic, error }
  let client = injected;
  const load = loadSdk || (() => import('@anthropic-ai/sdk'));

  async function getSdk() {
    if (!sdk) {
      try {
        const mod = await load();
        const Anthropic = (mod && (mod.default || mod.Anthropic)) || null;
        sdk = Anthropic ? { ok: true, Anthropic } : { ok: false, error: new Error('Export fehlt') };
      } catch (error) {
        sdk = { ok: false, error };
      }
    }
    return sdk;
  }

  const cfg = () => {
    const c = (config && config()) || {};
    return { model: c.model || env.VN_ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL, timeoutMs: c.timeoutMs || 90000 };
  };

  async function getClient() {
    if (client) return client;
    const s = await getSdk();
    if (!s.ok) throw new AiError('offline', 'Das Anthropic-SDK ist nicht installiert (im Ordner hub/ „npm install" ausführen).');
    if (!env.ANTHROPIC_API_KEY) throw new AiError('offline', 'ANTHROPIC_API_KEY ist nicht gesetzt.');
    // new Anthropic() liest ANTHROPIC_API_KEY selbst aus der Umgebung. Nur wenn der Hub mit einer
    // eigenen Umgebung gestartet wurde (Tests/Studio), reichen wir den Schlüssel ausdrücklich durch.
    client = env === process.env ? new s.Anthropic() : new s.Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return client;
  }

  return {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    config: cfg,
    async available() {
      const c = cfg();
      if (injected) return { ok: true, reason: '', model: c.model, models: [c.model] };
      const s = await getSdk();
      if (!s.ok) return { ok: false, code: 'offline', reason: 'nicht installiert (optionales Paket @anthropic-ai/sdk fehlt — „npm install" im Ordner hub/)', model: c.model };
      if (!env.ANTHROPIC_API_KEY) return { ok: false, code: 'offline', reason: 'ANTHROPIC_API_KEY ist nicht gesetzt', model: c.model };
      return { ok: true, reason: '', model: c.model, models: [c.model] };
    },
    async models() {
      const c = cfg();
      return [{ name: c.model, family: 'Claude', params: '—', vision: true }];
    },
    async chat({ messages = [], model, stream = true, onDelta, format, signal } = {}) {
      const c = cfg();
      const useModel = model || c.model;
      const { system, messages: converted } = toAnthropicMessages(messages, { format });
      const hasImage = converted.some((m) => m.content.some((b) => b.type === 'image'));
      const api = await getClient();
      const { Anthropic } = (await getSdk()) || {};
      const params = {
        model: useModel,
        max_tokens: 16000,
        messages: converted,
        output_config: { effort: 'low' },
        betas: [...ANTHROPIC_BETAS],
        fallbacks: 'default',
      };
      if (system) params.system = system;
      const d = deadline(c.timeoutMs, signal);
      try {
        // Immer gestreamt (auch wenn der Aufrufer kein Streaming will): verhindert HTTP-Zeitlimits
        // bei langen Antworten; die Teilstücke gehen nur bei stream:true an onDelta.
        const s = api.beta.messages.stream(params, { signal: d.signal });
        for await (const event of s) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            if (stream && typeof onDelta === 'function') onDelta(event.delta.text);
          }
        }
        const final = await s.finalMessage();
        if (final.stop_reason === 'refusal') {
          throw new AiError('refusal', 'Die KI hat diese Anfrage aus Sicherheitsgründen abgelehnt. Bitte formulieren Sie die Nachricht anders '
            + 'oder wenden Sie sich direkt telefonisch an die Praxis.', { category: (final.stop_details && final.stop_details.category) || null });
        }
        const text = (final.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
        if (!text) throw new AiError('model-crash', 'Anthropic hat eine leere Antwort geliefert.');
        return { text, model: final.model || useModel, vision: hasImage };
      } catch (e) {
        if (e instanceof AiError) throw e;
        if (d.timedOut) throw abortToAiError(signal, true, 'Anthropic');
        if (d.outerAborted) throw abortToAiError(signal, false, 'Anthropic');
        throw mapAnthropicError(e, Anthropic);
      } finally {
        d.done();
      }
    },
  };
}
