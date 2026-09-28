/* VetNow Hub — Anbieter `openai`: OpenAI-KOMPATIBLER lokaler Server (LM Studio, llama.cpp-Server,
   vLLM, LocalAI …) unter VN_OPENAI_URL, z. B. http://127.0.0.1:1234/v1.

   Kein Cloud-Dienst von OpenAI gemeint — viele lokale Programme sprechen einfach dasselbe
   Protokoll (POST /chat/completions, Streaming als SSE „data: {…}" bis „data: [DONE]").
   Verfügbar nur, wenn die Adresse gesetzt UND erreichbar ist (GET /models). */
import { AiError, toAiError, abortToAiError } from './errors.js';
import { deadline, readLines, trimSlash, errorText, stripDataUrl, sniffImageMime } from './net.js';

/* config() → { baseUrl, model, apiKey, timeoutMs, visionTimeoutMs } */
export function createOpenAiProvider({ config, fetchImpl = globalThis.fetch, statusTimeoutMs = 2500 } = {}) {
  let knownModels = [];
  const cfg = () => {
    const c = (config && config()) || {};
    return {
      baseUrl: trimSlash(c.baseUrl || ''),
      model: c.model || '',
      apiKey: c.apiKey || '',
      timeoutMs: c.timeoutMs || 45000,
      visionTimeoutMs: c.visionTimeoutMs || 120000,
    };
  };
  const headers = (c, json) => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(c.apiKey ? { Authorization: 'Bearer ' + c.apiKey } : {}),
  });

  async function listModels(signal) {
    const c = cfg();
    if (!c.baseUrl) throw new AiError('offline', 'VN_OPENAI_URL ist nicht gesetzt.');
    const d = deadline(statusTimeoutMs, signal);
    try {
      const res = await fetchImpl(c.baseUrl + '/models', { headers: headers(c, false), signal: d.signal });
      if (!res.ok) throw toAiError(await errorText(res), 'offline');
      const j = await res.json();
      knownModels = (Array.isArray(j.data) ? j.data : []).map((m) => m && m.id).filter(Boolean);
      return knownModels;
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (d.timedOut) throw new AiError('offline', `Der OpenAI-kompatible Server antwortet nicht (${c.baseUrl}).`);
      if (d.outerAborted) throw abortToAiError(signal, false, 'OpenAI-Server');
      throw toAiError(e, 'offline');
    } finally {
      d.done();
    }
  }

  return {
    id: 'openai',
    label: 'OpenAI-kompatibel (lokal)',
    config: cfg,
    async available({ signal } = {}) {
      const c = cfg();
      if (!c.baseUrl) return { ok: false, code: 'offline', reason: 'VN_OPENAI_URL ist nicht gesetzt', url: '' };
      try {
        const list = await listModels(signal);
        return { ok: true, reason: '', url: c.baseUrl, model: c.model || list[0] || '', models: list };
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        return { ok: false, code: e.code || 'offline', reason: e.message, url: c.baseUrl };
      }
    },
    async models({ signal } = {}) {
      return (await listModels(signal)).map((name) => ({ name }));
    },
    async chat({ messages = [], model, stream = false, onDelta, format, signal } = {}) {
      const c = cfg();
      if (!c.baseUrl) throw new AiError('offline', 'VN_OPENAI_URL ist nicht gesetzt.');
      const converted = messages.map((m) => {
        const text = String(m.content || '');
        const imgs = Array.isArray(m.images) ? m.images.map(stripDataUrl).filter(Boolean) : [];
        if (!imgs.length || m.role !== 'user') return { role: m.role, content: text };
        return {
          role: m.role,
          content: [
            ...imgs.map((b64) => ({ type: 'image_url', image_url: { url: `data:${sniffImageMime(b64)};base64,${b64}` } })),
            ...(text ? [{ type: 'text', text }] : []),
          ],
        };
      });
      const hasImage = converted.some((m) => Array.isArray(m.content));
      const useModel = model || c.model || knownModels[0] || 'local-model';
      const body = { model: useModel, messages: converted, stream: !!stream, temperature: 0.4, top_p: 0.9 };
      if (format === 'json') body.response_format = { type: 'json_object' };
      const d = deadline(hasImage ? c.visionTimeoutMs : c.timeoutMs, signal);
      try {
        const res = await fetchImpl(c.baseUrl + '/chat/completions', {
          method: 'POST', headers: headers(c, true), body: JSON.stringify(body), signal: d.signal,
        });
        if (!res.ok) throw toAiError(await errorText(res), res.status >= 500 ? 'model-crash' : 'bad-request');
        let text = '';
        let usedModel = useModel;
        if (stream) {
          for await (const line of readLines(res.body)) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') break;
            let j;
            try { j = JSON.parse(data); } catch { continue; }
            if (j.error) throw toAiError(String(j.error.message || j.error));
            if (j.model) usedModel = j.model;
            const piece = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if (piece) { text += piece; if (typeof onDelta === 'function') onDelta(piece); }
          }
        } else {
          const j = await res.json();
          if (j.model) usedModel = j.model;
          text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
        }
        text = String(text).trim();
        if (!text) throw new AiError('model-crash', 'Der OpenAI-kompatible Server hat eine leere Antwort geliefert.');
        return { text, model: usedModel, vision: hasImage };
      } catch (e) {
        if (e instanceof AiError) throw e;
        if (d.timedOut) throw abortToAiError(signal, true, 'Der OpenAI-kompatible Server');
        if (d.outerAborted) throw abortToAiError(signal, false, 'OpenAI-Server');
        throw toAiError(e, 'offline');
      } finally {
        d.done();
      }
    },
  };
}
