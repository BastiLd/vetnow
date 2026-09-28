/* VetNow Hub — Anbieter `ollama` (lokaler KI-Server, Standard http://127.0.0.1:11434).

   Portiert aus studio/server.js (/api/ai/chat) und dabei die Audit-Fehler behoben:
   - Bild dabei + Bild-Modell hinterlegt → das Bild-Modell antwortet (automatische Umschaltung).
   - Bild dabei, aber KEIN Bild-Modell → ehrlicher Fehler 'no-vision' statt stillem Ignorieren des Bildes.
   - Vom Client gewähltes Modell: `vision` wird nur gemeldet, wenn wirklich ein Bild mitging
     (früher meldete der Proxy vnVision:true, obwohl das Textmodell antwortete).
   - Zeitlimit (45 s Text / 120 s Bild) ergibt Code 'timeout' — nicht mehr 'offline'.
   - Bricht der Aufrufer ab (Chat gelöscht, Browser zu), wird auch die Anfrage an Ollama abgebrochen. */
import { AiError, toAiError, abortToAiError } from './errors.js';
import { deadline, readLines, trimSlash, errorText, stripDataUrl } from './net.js';

export const OLLAMA_DEFAULT_URL = 'http://127.0.0.1:11434';
export const OLLAMA_DEFAULT_MODEL = 'qwen2.5:7b';
/* Feineinstellungen wie bisher in der Web-App (AI_OPTIONS): niedrige Temperatur = weniger
   Ausreißer und Sprachwechsel, genug Kontext für den Chat-Verlauf. */
export const OLLAMA_OPTIONS = Object.freeze({ temperature: 0.4, top_p: 0.9, num_ctx: 4096, repeat_penalty: 1.15 });

/* config() → { baseUrl, model, visionModel, timeoutMs, visionTimeoutMs } (live aus Einstellungen + Umgebung) */
export function createOllamaProvider({ config, fetchImpl = globalThis.fetch, statusTimeoutMs = 2500 } = {}) {
  const cfg = () => {
    const c = (config && config()) || {};
    return {
      baseUrl: trimSlash(c.baseUrl || OLLAMA_DEFAULT_URL),
      model: c.model || OLLAMA_DEFAULT_MODEL,
      visionModel: c.visionModel || '',
      timeoutMs: c.timeoutMs || 45000,
      visionTimeoutMs: c.visionTimeoutMs || 120000,
    };
  };

  async function getJson(path, timeoutMs, signal) {
    const { baseUrl } = cfg();
    const d = deadline(timeoutMs, signal);
    try {
      const res = await fetchImpl(baseUrl + path, { signal: d.signal });
      if (!res.ok) throw toAiError(await errorText(res));
      return await res.json();
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (d.timedOut) throw new AiError('offline', `Ollama antwortet nicht (${baseUrl}).`);
      if (d.outerAborted) throw abortToAiError(signal, false, 'Ollama');
      throw toAiError(e, 'offline');
    } finally {
      d.done();
    }
  }

  async function models({ signal } = {}) {
    const d = await getJson('/api/tags', 8000, signal);
    return (d.models || []).map((m) => ({
      name: m.name,
      sizeGb: m.size ? +(m.size / 1e9).toFixed(1) : null,
      family: m.details && m.details.family,
      params: m.details && m.details.parameter_size,
      quant: m.details && m.details.quantization_level,
      families: (m.details && m.details.families) || [],
      modifiedAt: m.modified_at || null,
    }));
  }

  return {
    id: 'ollama',
    label: 'Ollama',
    config: cfg,
    models,
    async available({ signal } = {}) {
      const c = cfg();
      try {
        const v = await getJson('/api/version', statusTimeoutMs, signal);
        let list = [];
        try { list = (await models({ signal })).map((m) => m.name); } catch { /* Version reicht als Lebenszeichen */ }
        // Läuft Ollama, fehlt aber das Modell, gilt der Anbieter als „nicht bereit": Bei 'auto' kommt
        // dann der nächste Anbieter bzw. der Bot dran, statt dass jede Antwort mit 'no-model' scheitert.
        const installed = !list.length || list.some((n) => n === c.model || n === c.model + ':latest');
        return {
          ok: installed,
          ...(installed ? {} : { code: 'no-model' }),
          reason: installed ? '' : `Modell „${c.model}" ist nicht installiert (ollama pull ${c.model}).`,
          version: v && v.version, url: c.baseUrl, model: c.model, visionModel: c.visionModel, models: list,
        };
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        return { ok: false, reason: e.message, code: e.code || 'offline', url: c.baseUrl, model: c.model, visionModel: c.visionModel };
      }
    },

    async chat({ messages = [], model, stream = false, onDelta, format, signal } = {}) {
      const c = cfg();
      const clean = messages.map((m) => {
        const out = { role: m.role, content: String(m.content || '') };
        const imgs = Array.isArray(m.images) ? m.images.map(stripDataUrl).filter(Boolean) : [];
        if (imgs.length) out.images = imgs; // Ollama will reines Base64 ohne „data:…"-Präfix
        return out;
      });
      const hasImage = clean.some((m) => m.images && m.images.length);
      let useModel = model;
      if (!useModel) {
        if (hasImage) {
          if (!c.visionModel) {
            throw new AiError('no-vision', 'Es wurde ein Bild mitgeschickt, aber es ist kein Bild-Modell hinterlegt. '
              + 'Admin-Center → KI → Bild-Modell setzen (z. B. „llava" oder „qwen2.5vl") oder VN_VISION_MODEL.');
          }
          useModel = c.visionModel;
        } else {
          useModel = c.model;
        }
      }
      if (!useModel) throw new AiError('no-model', 'Kein KI-Modell konfiguriert (Admin-Center → KI).');

      const body = { model: useModel, messages: clean, stream: !!stream, options: { ...OLLAMA_OPTIONS } };
      if (format) body.format = format; // 'json' = Ollama antwortet als reines JSON (KI-Agent)
      const d = deadline(hasImage ? c.visionTimeoutMs : c.timeoutMs, signal);
      try {
        const res = await fetchImpl(c.baseUrl + '/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: d.signal,
        });
        if (!res.ok) throw toAiError(await errorText(res), res.status >= 500 ? 'model-crash' : 'bad-request');
        let text = '';
        if (stream) {
          for await (const line of readLines(res.body)) {
            let j;
            try { j = JSON.parse(line); } catch { continue; }
            if (j.error) throw toAiError(String(j.error));
            const piece = j.message && j.message.content ? String(j.message.content) : '';
            if (piece) { text += piece; if (typeof onDelta === 'function') onDelta(piece); }
            if (j.done) break;
          }
        } else {
          const j = await res.json();
          if (j.error) throw toAiError(String(j.error));
          text = j.message && j.message.content ? String(j.message.content) : '';
        }
        text = text.trim();
        if (!text) throw new AiError('model-crash', 'Das Modell hat eine leere Antwort geliefert.');
        return { text, model: useModel, vision: hasImage };
      } catch (e) {
        if (e instanceof AiError) throw e;
        if (d.timedOut) throw abortToAiError(signal, true, `Das Modell „${useModel}"`);
        if (d.outerAborted) throw abortToAiError(signal, false, 'Ollama');
        throw toAiError(e, 'offline');
      } finally {
        d.done();
      }
    },
  };
}
