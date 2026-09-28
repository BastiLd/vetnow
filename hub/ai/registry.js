/* VetNow Hub — KI-Register: kennt alle Anbieter und entscheidet, wer antwortet.

   Einheitliche Schnittstelle je Anbieter:
     { id, label, available() → { ok, reason, models? }, chat({ messages, model, stream, onDelta, format, signal }) → { text, model, vision } }

   Auswahl über settings.ai.provider:
     'mock' | 'ollama' | 'anthropic' | 'openai' → genau dieser Anbieter (ist er nicht bereit → Fehler)
     'auto' → ollama, dann anthropic, sonst KEINER → Fehlercode 'offline', damit die Clients bzw. die
              Auto-Antwort still auf den Bot zurückfallen (Vorführung ohne Netz bleibt sauber).
   Die Test-KI (mock) wird bei 'auto' absichtlich NICHT genommen: Sie soll nie unbemerkt eine echte
   KI „vortäuschen".

   Fehler-Injektion 'ai-offline' (Admin-Center): alle Anbieter melden offline. */
import { AiError, toAiError } from './errors.js';
import { stripDataUrl } from './net.js';
import { createMockProvider } from './mock.js';
import { createOllamaProvider, OLLAMA_DEFAULT_URL, OLLAMA_DEFAULT_MODEL } from './ollama.js';
import { createAnthropicProvider, ANTHROPIC_DEFAULT_MODEL } from './anthropic.js';
import { createOpenAiProvider } from './openai.js';
import { botReply, botImageReply, vetSystemPrompt } from '../lib/shared.js';

export const PROVIDER_IDS = ['mock', 'ollama', 'anthropic', 'openai'];
export const AUTO_ORDER = ['ollama', 'anthropic'];
const ROLES = new Set(['system', 'user', 'assistant']);
const MAX_MESSAGES = 60;
const MAX_CONTENT = 20000;

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);

/* Optionen (alle außer getSettings optional):
   env, getSettings(), faults, fetchImpl, anthropicClient, loadAnthropicSdk,
   resolveImage(fileId) → Base64 | null   ('hub:<id>'-Bilder aus dem Datei-Speicher),
   mockWordDelayMs, statusTtlMs, logger */
export function createAiRegistry({
  env = process.env, getSettings = () => ({}), faults = null, fetchImpl = globalThis.fetch,
  anthropicClient = null, loadAnthropicSdk, resolveImage = null, mockWordDelayMs = 25,
  statusTtlMs = 15000, logger = console,
} = {}) {
  const ai = () => (getSettings() && getSettings().ai) || {};
  const timeouts = () => ({
    timeoutMs: num(env.VN_AI_TIMEOUT_MS) || 45000,
    visionTimeoutMs: num(env.VN_AI_VISION_TIMEOUT_MS) || 120000,
  });

  /* Welches Modell gilt für Anbieter `id`? Die Einstellung settings.ai.model gehört dem gewählten
     Anbieter (bei 'auto' Ollama) — sonst bekäme z. B. Claude den Ollama-Namen 'qwen2.5:7b'. */
  function settingModel(id) {
    const a = ai();
    if (!a.model) return '';
    if (a.provider === id || (a.provider === 'auto' && id === 'ollama') || (!a.provider && id === 'ollama')) return a.model;
    return '';
  }

  const providers = {
    mock: createMockProvider({ botReply, botImageReply, wordDelayMs: mockWordDelayMs }),
    ollama: createOllamaProvider({
      fetchImpl,
      config: () => ({
        baseUrl: ai().ollamaUrl || env.OLLAMA_URL || OLLAMA_DEFAULT_URL,
        model: settingModel('ollama') || env.VN_AI_MODEL || OLLAMA_DEFAULT_MODEL,
        visionModel: (ai().provider === 'ollama' || ai().provider === 'auto' || !ai().provider ? ai().visionModel : '') || env.VN_VISION_MODEL || '',
        ...timeouts(),
      }),
    }),
    anthropic: createAnthropicProvider({
      env,
      client: anthropicClient,
      loadSdk: loadAnthropicSdk,
      config: () => {
        const m = settingModel('anthropic');
        return { model: (/^claude/i.test(m) ? m : '') || env.VN_ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL, timeoutMs: 90000 };
      },
    }),
    openai: createOpenAiProvider({
      fetchImpl,
      config: () => ({
        baseUrl: ai().openaiUrl || env.VN_OPENAI_URL || '',
        model: settingModel('openai') || env.VN_OPENAI_MODEL || '',
        apiKey: env.VN_OPENAI_KEY || '',
        ...timeouts(),
      }),
    }),
  };

  const aiOffline = () => !!(faults && faults.active('ai-offline'));
  const OFFLINE_FAULT = { ok: false, code: 'offline', reason: 'Fehler-Injektion aktiv: KI ist (simuliert) offline.' };

  /* Verfügbarkeit je Anbieter, kurz zwischengespeichert: /health wird oft abgefragt und darf
     nicht jedes Mal Ollama anpingen. */
  const cache = new Map(); // id → { at, value }
  const inflight = new Map();
  async function availability(id, { fresh = false } = {}) {
    if (aiOffline()) return { ...OFFLINE_FAULT };
    const p = providers[id];
    if (!p) return { ok: false, code: 'bad-request', reason: 'Unbekannter KI-Anbieter.' };
    const hit = cache.get(id);
    if (!fresh && hit && Date.now() - hit.at < statusTtlMs) return hit.value;
    if (inflight.has(id)) return inflight.get(id);
    const job = (async () => {
      let value;
      try { value = await p.available(); } catch (e) { value = { ok: false, code: e.code || 'offline', reason: e.message }; }
      cache.set(id, { at: Date.now(), value });
      return value;
    })().finally(() => inflight.delete(id));
    inflight.set(id, job);
    return job;
  }

  const preference = (explicit) => {
    const p = explicit || ai().provider || 'auto';
    return p === 'auto' || providers[p] ? p : 'auto';
  };

  /* → { provider, status } oder wirft AiError (offline bzw. Code des Anbieters). */
  async function resolve(explicit) {
    if (aiOffline()) throw new AiError('offline', OFFLINE_FAULT.reason);
    const pref = preference(explicit);
    if (pref !== 'auto') {
      const st = await availability(pref);
      if (!st.ok) {
        throw new AiError(st.code === 'no-model' ? 'no-model' : 'offline', `${providers[pref].label}: ${st.reason || 'nicht verfügbar'}`);
      }
      return { provider: providers[pref], status: st };
    }
    const reasons = [];
    for (const id of AUTO_ORDER) {
      const st = await availability(id);
      if (st.ok) return { provider: providers[id], status: st };
      reasons.push(`${providers[id].label}: ${st.reason || 'nicht verfügbar'}`);
    }
    throw new AiError('offline', 'Keine KI verfügbar — der eingebaute Bot übernimmt. (' + reasons.join(' · ') + ')');
  }

  /* Eingehende Nachrichten prüfen und vereinheitlichen: Rollen, Länge, Bilder
     ('data:'-URL → Base64, 'hub:<id>' → Datei aus dem Hub-Speicher). */
  async function normalize(messages, persona, practiceName) {
    if (!Array.isArray(messages)) throw new AiError('bad-request', '„messages" muss eine Liste sein.');
    const list = messages.slice(-MAX_MESSAGES);
    const out = [];
    for (const m of list) {
      if (!m || typeof m !== 'object' || !ROLES.has(m.role)) continue;
      const msg = { role: m.role, content: String(m.content == null ? '' : m.content).slice(0, MAX_CONTENT) };
      if (Array.isArray(m.images) && m.images.length) {
        const imgs = [];
        for (const ref of m.images.slice(0, 4)) {
          if (typeof ref === 'string' && ref.startsWith('hub:') && resolveImage) {
            const b64 = await resolveImage(ref.slice(4));
            if (b64) imgs.push(b64);
          } else {
            const b64 = stripDataUrl(ref);
            if (b64) imgs.push(b64);
          }
        }
        if (imgs.length) msg.images = imgs;
      }
      out.push(msg);
    }
    if (persona && !out.some((m) => m.role === 'system') && typeof vetSystemPrompt === 'function') {
      out.unshift({ role: 'system', content: vetSystemPrompt(persona, practiceName || '') });
    }
    if (!out.some((m) => m.role !== 'system')) throw new AiError('bad-request', 'Es gibt keine Nachricht, auf die die KI antworten könnte.');
    return out;
  }

  /* Hauptweg: → { text, provider, model, vision, ms } oder AiError. */
  async function chat({ messages, persona, practiceName, model, provider, stream = false, onDelta, format, signal } = {}) {
    const t0 = Date.now();
    const msgs = await normalize(messages, persona, practiceName);
    const { provider: p } = await resolve(provider);
    let useModel = typeof model === 'string' && model.trim() ? model.trim() : undefined;
    if (p.id === 'mock') useModel = undefined;
    if (p.id === 'anthropic' && useModel && !/^claude/i.test(useModel)) useModel = undefined; // z. B. Ollama-Name aus alter App
    try {
      const res = await p.chat({ messages: msgs, model: useModel, stream, onDelta, format, signal, persona, practiceName });
      return { text: res.text, provider: p.id, model: res.model || useModel || '', vision: !!res.vision, ms: Date.now() - t0 };
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      const err = toAiError(e);
      err.provider = p.id;
      // Anbieter gerade ausgefallen → Status-Zwischenspeicher verwerfen, damit 'auto' beim nächsten
      // Mal neu prüft (und ggf. den nächsten Anbieter nimmt).
      if (err.code === 'offline') cache.set(p.id, { at: Date.now(), value: { ok: false, code: 'offline', reason: err.message } });
      throw err;
    }
  }

  /* Übersicht für /ai/status, /health und das Admin-Center. */
  let last = null;
  async function status({ fresh = false } = {}) {
    const pref = preference();
    const list = [];
    for (const id of PROVIDER_IDS) {
      const st = await availability(id, { fresh });
      list.push({
        id, label: providers[id].label, ok: !!st.ok, reason: st.reason || '',
        ...(st.code ? { code: st.code } : {}),
        model: st.model || (providers[id].config ? providers[id].config().model : '') || '',
        ...(st.models ? { models: st.models } : {}),
        ...(st.url !== undefined ? { url: st.url } : {}),
        ...(st.version ? { version: st.version } : {}),
        ...(st.visionModel !== undefined ? { visionModel: st.visionModel } : {}),
      });
    }
    let active = null;
    if (!aiOffline()) {
      const order = pref === 'auto' ? AUTO_ORDER : [pref];
      for (const id of order) {
        const e = list.find((x) => x.id === id);
        if (e && e.ok) { active = e; break; }
      }
    }
    last = {
      provider: pref,
      ok: !!active,
      active: active ? { id: active.id, label: active.label, model: active.model } : null,
      model: active ? active.model : '',
      reason: active ? '' : (aiOffline() ? OFFLINE_FAULT.reason : (pref === 'auto'
        ? 'Keine KI erreichbar (Ollama/Anthropic) — Auto-Antworten kommen vom Bot.'
        : (list.find((x) => x.id === pref) || {}).reason || 'nicht verfügbar')),
      aiOffline: aiOffline(),
      providers: list,
      checkedAt: Date.now(),
    };
    return last;
  }

  /* Letzter bekannter Stand ohne Warten (für /health). Ist er alt, wird im Hintergrund aufgefrischt. */
  let refreshing = null;
  function cachedStatus() {
    const stale = !last || Date.now() - last.checkedAt > statusTtlMs || last.aiOffline !== aiOffline();
    if (stale && !refreshing) {
      refreshing = status().catch((e) => { logger.warn('[ai] Status-Prüfung fehlgeschlagen: ' + e.message); }).finally(() => { refreshing = null; });
    }
    if (!last) return { provider: preference(), ok: false, model: '', checking: true };
    return { provider: last.active ? last.active.id : last.provider, ok: last.ok && !aiOffline(), model: last.model, reason: last.reason };
  }

  async function models(id) {
    const pid = id && providers[id] ? id : null;
    const target = pid || (await resolve().then((r) => r.provider.id).catch(() => 'ollama'));
    const p = providers[target];
    if (aiOffline()) throw new AiError('offline', OFFLINE_FAULT.reason);
    const list = p.models ? await p.models() : [];
    const c = p.config ? p.config() : {};
    return { provider: target, models: list, defaultModel: c.model || '', visionModel: c.visionModel || '' };
  }

  /* „Sag Apfel"-Test: Antwortet die KI überhaupt, und hält sie sich an eine klare Anweisung? */
  async function test({ provider, model, signal } = {}) {
    const t0 = Date.now();
    try {
      const r = await chat({
        provider, model, signal,
        messages: [
          { role: 'system', content: vetSystemPrompt('clinic', 'VetNow Test') },
          { role: 'user', content: 'Sag Apfel' },
        ],
      });
      return { ok: /apfel/i.test(r.text), text: r.text, provider: r.provider, model: r.model, vision: r.vision, ms: Date.now() - t0 };
    } catch (e) {
      const err = e && e.name === 'AbortError' ? new AiError('timeout', 'Test abgebrochen.') : toAiError(e);
      return { ok: false, text: '', error: err.message, code: err.code, provider: err.provider || preference(provider), model: model || '', ms: Date.now() - t0 };
    }
  }

  /* Client-Objekt für shared/autoreply.js (generateAutoReply) — gleiche Form wie createAiClient()
     aus shared/ai.js: status(), models(), chat(), test(). `lastProvider` merkt sich, wer zuletzt
     geantwortet hat (für den Stempel '· Test-KI'). */
  function client() {
    const c = {
      lastProvider: null,
      status: () => status(),
      models: (id) => models(id),
      test: (opts) => test(opts),
      async chat(opts = {}) {
        const r = await chat(opts);
        c.lastProvider = r.provider;
        return r;
      },
    };
    return c;
  }

  // Erste Prüfung sofort anstoßen, damit /health nicht mit „checking" antwortet.
  cachedStatus();

  return {
    providers,
    availability,
    resolve,
    chat,
    status,
    cachedStatus,
    models,
    test,
    client,
    invalidate() { cache.clear(); last = null; },
  };
}
