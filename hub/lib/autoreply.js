/* VetNow Hub — Auto-Antworten (Bot/KI) SERVERSEITIG.

   Warum im Hub und nicht in den Apps? Wären drei Geräte verbunden und jedes würde selbst
   antworten, käme jede Bot-Antwort dreimal. Im Hub-Modus antwortet deshalb NUR der Hub.

   Ablauf je eingehender Nachricht (wenn der Chat `autoReply` hat und die Einstellungen es erlauben):
     Tipp-Anzeige an → Antwort erzeugen (shared/autoreply.js: KI über das Anbieter-Register,
     sonst Bot) → restliche Tipp-Zeit abwarten → Antwort(en) posten → Tipp-Anzeige aus.

   - EINE Warteschlange pro Chat: Antworten eines Chats kommen nie durcheinander.
   - Zusammenfassen: Schreibt jemand drei Nachrichten schnell hintereinander, antwortet der Hub
     einmal auf die letzte (mit dem ganzen Verlauf) statt dreimal.
   - Wird der Chat gelöscht (oder der Hub zurückgesetzt), wird die laufende Antwort abgebrochen. */
import { clone, sleep, isAbort } from './util.js';
import { generateAutoReply, shouldAutoReply } from './shared.js';

export function createAutoReplier({
  store, ops, ai, getSettings = () => store.state.settings, log = null, logger = console,
  generate = generateAutoReply, shouldReply = shouldAutoReply,
} = {}) {
  const queues = new Map(); // chatId → { tail, ctrl, pending }
  let closed = false;
  let answered = 0;
  let failed = 0;

  const lastLive = (chat) => {
    for (let i = chat.messages.length - 1; i >= 0; i--) if (!chat.messages[i].deleted) return chat.messages[i];
    return null;
  };

  /* Von ops.addMessage/createChat aufgerufen. → true, wenn eine Antwort eingeplant wurde. */
  function onMessage(chat, msg) {
    if (closed || !chat || !msg) return false;
    const settings = getSettings() || {};
    if (settings.botMode === 'off') return false;
    let ok = false;
    try { ok = !!shouldReply(chat, msg, settings); } catch (e) { logger.warn('[autoreply] shouldAutoReply: ' + e.message); }
    if (!ok) return false;
    enqueue(chat.id, msg.id);
    return true;
  }

  function enqueue(chatId, messageId) {
    let q = queues.get(chatId);
    if (!q) { q = { tail: Promise.resolve(), ctrl: new AbortController(), pending: 0 }; queues.set(chatId, q); }
    q.pending += 1;
    const signal = q.ctrl.signal;
    q.tail = q.tail
      .then(() => run(chatId, messageId, signal))
      .catch((e) => {
        if (isAbort(e)) return;
        failed += 1;
        const msg = `Auto-Antwort in Chat ${chatId} fehlgeschlagen: ${e && e.message}`;
        if (log) log.error(msg); else logger.error('[autoreply] ' + msg);
      })
      .finally(() => {
        q.pending -= 1;
        if (q.pending <= 0 && queues.get(chatId) === q) queues.delete(chatId);
      });
  }

  async function run(chatId, messageId, signal) {
    if (signal.aborted || closed) return;
    const chat = store.chat(chatId);
    if (!chat) return;
    const last = lastLive(chat);
    // Inzwischen kam eine neuere Nachricht → deren Auftrag antwortet (mit vollem Verlauf).
    if (!last || last.id !== messageId) return;
    const settings = getSettings() || {};
    if (settings.botMode === 'off' || !shouldReply(chat, last, settings)) return;

    const replySide = last.from === 'clinic' ? 'owner' : 'clinic';
    const withTyping = settings.typing !== false;
    const client = ai ? ai.client() : null;
    let typingOn = false;
    try {
      if (withTyping) { ops.typing(chatId, replySide, true); typingOn = true; }
      const t0 = Date.now();
      const result = await generate({
        chat: clone(chat), practices: store.state.practices, settings: clone(settings),
        ai: client, now: store.now(), signal,
      });
      const replies = (result && Array.isArray(result.messages) ? result.messages : []).filter((m) => m && typeof m.text === 'string' && m.text.trim());
      const typingMs = (result && Array.isArray(result.typingMs)) ? result.typingMs : [];
      for (let i = 0; i < replies.length; i++) {
        if (signal.aborted) return;
        // Die erste Tipp-Pause läuft schon während der (evtl. langsamen) KI-Anfrage.
        const want = withTyping ? Math.max(0, Number(typingMs[i]) || 0) : 0;
        const wait = i === 0 ? Math.max(0, want - (Date.now() - t0)) : want;
        if (wait) await sleep(Math.min(wait, 15000), signal);
        if (!store.chat(chatId)) return;
        const r = replies[i];
        let source = r.source;
        // Hat die Test-KI geantwortet, soll der Stempel das ehrlich sagen ('· Test-KI' statt '· KI').
        if (client && client.lastProvider === 'mock' && (source === 'ai' || source === 'ai-vision')) source = 'mock-ai';
        const data = { from: replySide, type: 'text', text: r.text };
        if (source) data.source = source;
        if (r.meta !== undefined) data.meta = r.meta;
        ops.addMessage(chatId, data, { schedule: false });
        answered += 1;
      }
    } finally {
      if (typingOn && store.chat(chatId) && !closed) {
        try { ops.typing(chatId, replySide, false); } catch { /* Chat inzwischen weg */ }
      }
    }
  }

  function cancel(chatId) {
    const q = queues.get(chatId);
    if (q) { q.ctrl.abort(); queues.delete(chatId); }
  }

  function cancelAll() { for (const id of [...queues.keys()]) cancel(id); }

  /* Wartet, bis alle Warteschlangen leer sind (Tests, Selbsttest, sauberes Beenden). */
  async function idle(timeoutMs = 30000) {
    const until = Date.now() + timeoutMs;
    while (queues.size && Date.now() < until) {
      await Promise.race([Promise.all([...queues.values()].map((q) => q.tail)), sleep(50)]);
    }
    return queues.size === 0;
  }

  return {
    onMessage,
    cancel,
    cancelAll,
    idle,
    stats: () => ({ queues: queues.size, pending: [...queues.values()].reduce((n, q) => n + q.pending, 0), answered, failed }),
    close() { closed = true; cancelAll(); },
  };
}
