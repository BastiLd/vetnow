/* VetNow — Auto-Antwort: Bot/KI spielt in der Demo die GEGENSEITE eines Chats.

   Warum eine eigene, reine Funktion statt Code im Chat-Bildschirm (wie in v2)?
   - Web, Handy, Extension UND Hub brauchen exakt dieselbe Logik. Im Hub-Modus antwortet der Hub
     serverseitig (sonst antworten drei offene Geräte dreimal), lokal der Store — beide rufen das hier.
   - In v2 hing die Antwort an einem React-Effect mit Ref-Sperre; unter StrictMode blieb sie dadurch
     manchmal ganz aus (Web-Audit). Der Store ruft generateAutoReply jetzt aus einer Warteschlange.

   botMode (Einstellungen):
     'ai-fallback'  KI; ist sie schlicht nicht da (offline/timeout) → STILL der eingebaute Bot.
                    Andere KI-Fehler (kein Bild-Modell, Absturz …) → sichtbarer Hinweis + Bot-Antwort.
     'ai'           nur KI; jeder Fehler wird als Hinweis-Nachricht (source 'error') sichtbar.
     'bot'          nur der eingebaute Regel-Bot (offline, deterministisch).
     'off'          keine Auto-Antworten.
   Sicherheit: Vor jeder KI läuft die Triage des Bots (falls vorhanden). Bei Notfall/Vergiftung kommt
   ZUERST sofort die feste Sicherheitsantwort, die KI darf danach ergänzen (Vertrag §5). */
import * as botModule from './bot/index.js';
import { vetSystemPrompt, toAiMessages, isAbortError } from './ai.js';
import { ANIMAL_SINGULAR, BOT_MODES } from './constants.js';
import { now as clockNow } from './clock.js';

export const TYPING_MIN_MS = 600;
export const TYPING_MAX_MS = 4000;

/* Realistische Tippdauer: wächst mit der Textlänge (~35 Zeichen/s), gedeckelt bei ~4 s —
   länger wartet in einer Vorführung niemand. typing:false → 0 (sofort). */
export function typingDuration(text, settings) {
  if (settings && settings.typing === false) return 0;
  const len = String(text || '').length;
  return Math.max(TYPING_MIN_MS, Math.min(TYPING_MAX_MS, 450 + len * 28));
}

/* Welche Seite antwortet? Die Gegenseite der letzten Nachricht. Leerer Chat: die Praxis begrüßt
   (im Netzwerk die angeschriebene Kollegin = Seite 'owner'). */
export function replySideFor(chat, lastMsg) {
  if (lastMsg && (lastMsg.from === 'owner' || lastMsg.from === 'clinic')) return lastMsg.from === 'owner' ? 'clinic' : 'owner';
  return chat && chat.kind === 'network' ? 'owner' : 'clinic';
}

/* Persona der Antwort: Tierhalter:in schrieb → Praxis antwortet ('clinic'); Praxis schrieb in
   request/direct → Tierhalter:in antwortet ('owner'); Netzwerk → 'colleague'. */
export function personaFor(chat, lastMsg) {
  if (chat && chat.kind === 'network') return 'colleague';
  return lastMsg && lastMsg.from === 'clinic' ? 'owner' : 'clinic';
}

function personaForSide(chat, side) {
  if (chat && chat.kind === 'network') return 'colleague';
  return side === 'owner' ? 'owner' : 'clinic';
}

/* Soll auf lastMsg automatisch geantwortet werden?
   Nein, wenn: Bot aus, Chat ist Mensch-zu-Mensch (autoReply false), Nachricht gelöscht, System-
   oder Abschlussnotiz, oder sie stammt selbst schon von der Simulation (source gesetzt bzw.
   opts.simulatedSide) — sonst würden sich Bot und Bot endlos gegenseitig antworten. */
export function shouldAutoReply(chat, lastMsg, settings, opts) {
  if (!chat || !lastMsg) return false;
  const s = settings || {};
  if (s.botMode === 'off') return false;
  if (!chat.autoReply) return false;
  if (lastMsg.deleted) return false;
  if (lastMsg.from !== 'owner' && lastMsg.from !== 'clinic') return false;
  if (lastMsg.type === 'note') return false;
  if (lastMsg.source) return false;
  if (opts && opts.simulatedSide && lastMsg.from === opts.simulatedSide) return false;
  return true;
}

function findPractice(practices, id) {
  if (!id || !Array.isArray(practices)) return null;
  for (let i = 0; i < practices.length; i++) if (practices[i] && practices[i].id === id) return practices[i];
  return null;
}

function hintText(e) {
  const msg = (e && e.message) || 'Unbekannter Fehler.';
  return 'Die KI konnte nicht antworten: ' + msg;
}

/* generateAutoReply({ chat, practices, settings, ai, now, signal, side?, resolveImage? })
   → { messages: [{ text, source, meta }], typingMs: number[], from, persona, mode, usedAi }
   - ai: KI-Client (createAiClient) oder null → dann Bot.
   - side: antwortende Seite erzwingen (Store: forceAutoReply); sonst Gegenseite der letzten Nachricht.
   - resolveImage(ref, message): darf ASYNCHRON sein (Handy liest file:// per expo-file-system);
     wird nur für das neueste unbeantwortete Bild aufgerufen.
   - bot: optional einzelne Bot-Funktionen ersetzen ({ botReply, triage, guardAiReply, … }) — für Tests
     der Sicherheitsschicht und für den Hub, falls er eine andere Bot-Version einhängen will.
   Wirft nur AbortError (Aufrufer hat abgebrochen, z. B. Chat gelöscht). */
export async function generateAutoReply(args) {
  const a = args || {};
  const bot = a.bot && typeof a.bot === 'object' ? { ...botModule, ...a.bot } : botModule;
  const chat = a.chat;
  const s = a.settings || {};
  const mode = BOT_MODES.indexOf(s.botMode) >= 0 ? s.botMode : 'ai-fallback';
  const now = typeof a.now === 'number' ? a.now : clockNow();
  const all = chat && Array.isArray(chat.messages) ? chat.messages : [];
  const alive = all.filter((m) => m && !m.deleted);
  const last = alive.length ? alive[alive.length - 1] : null;
  const from = a.side === 'owner' || a.side === 'clinic' ? a.side : replySideFor(chat, last);
  const persona = personaForSide(chat, from);
  const out = { messages: [], typingMs: [], from, persona, mode, usedAi: false };
  if (!chat || mode === 'off') return out;

  const practices = Array.isArray(a.practices) ? a.practices : [];
  const practice = findPractice(practices, chat.practiceId);
  const peer = findPractice(practices, chat.peerPracticeId);
  const replying = chat.kind === 'network' ? (from === 'owner' ? peer : practice) : practice;
  const practiceName = (replying && replying.name) || (chat.kind === 'network' && from === 'owner' ? chat.peerName || '' : '') || '';
  const addressed = persona === 'owner' ? ((practice && practice.name) || '') : practiceName;

  const push = (list) => {
    list.forEach((m) => {
      out.messages.push(m);
      out.typingMs.push(s.typing === false ? 0 : (m.source === 'error' ? 300 : typingDuration(m.text, s)));
    });
  };

  // Leerer Chat → Begrüßung (Einstellung „greeting").
  if (!last) {
    if (s.greeting === false) return out;
    const text = bot.botGreeting(persona, persona === 'owner' ? addressed : practiceName);
    if (text) push([{ text, source: 'bot', meta: { intent: 'greeting' } }]);
    return out;
  }

  const userText = String(last.text || '');
  const isImage = last.type === 'image';

  const viaBot = (reason) => {
    if (isImage) {
      const text = bot.botImageReply(persona, userText);
      const meta = { intent: 'image' };
      if (reason) meta.fallbackReason = reason;
      return text ? [{ text, source: 'bot', meta }] : [];
    }
    let r = null;
    try {
      r = bot.botReply({ messages: all, userText, persona, practiceName: persona === 'owner' ? addressed : practiceName, practice: replying, now });
    } catch {
      r = null;
    }
    const texts = (r && Array.isArray(r.texts) ? r.texts : []).filter((t) => typeof t === 'string' && t.trim());
    const base = r && r.meta && typeof r.meta === 'object' ? { ...r.meta } : {};
    if (!base.intent && r && r.intent) base.intent = r.intent;
    if (!base.triage && r && r.triage) base.triage = r.triage;
    if (reason) base.fallbackReason = reason;
    if (!texts.length) {
      // Bot hat nichts gefunden (sollte nicht passieren) — nie stumm bleiben.
      texts.push(persona === 'clinic'
        ? 'Danke für Ihre Nachricht! Wir melden uns gleich. Bei akuten Notfällen rufen Sie uns bitte sofort an.'
        : 'Danke für die Nachricht!');
    }
    return texts.map((text) => ({ text, source: 'bot', meta: { ...base } }));
  };

  // Sicherheitsschicht: Notfall/Gift → feste Antwort ZUERST (nur wenn der Bot eine Triage anbietet).
  let safety = [];
  if (persona === 'clinic' && !isImage && typeof bot.triage === 'function') {
    let tr = null;
    try { tr = bot.triage(userText); } catch { tr = null; }
    if (tr && (tr.level === 'emergency' || tr.level === 'poison')) {
      safety = viaBot();
      safety.forEach((m) => { m.meta.triage = m.meta.triage || tr; m.meta.safety = true; });
    }
  }

  const ai = a.ai && typeof a.ai.chat === 'function' ? a.ai : null;
  if (mode === 'bot' || !ai) {
    push(safety.length ? safety : viaBot(mode === 'bot' ? null : 'no-ai'));
    return out;
  }

  const t0 = Date.now();
  try {
    // Neuestes unbeantwortetes Bild ggf. asynchron auflösen (idb:/file:// können nur die Apps lesen).
    let preB64 = '';
    let preRef = '';
    if (typeof a.resolveImage === 'function') {
      for (let i = alive.length - 1; i >= 0; i--) {
        const m = alive[i];
        if (m.from === from) break;
        const ref = m.type === 'image' && m.attachment && m.attachment.ref;
        if (ref) {
          if (ref.indexOf('data:') !== 0 && ref.indexOf('hub:') !== 0) {
            preRef = ref;
            try { preB64 = (await a.resolveImage(ref, m)) || ''; } catch { preB64 = ''; }
          }
          break;
        }
      }
    }
    const history = toAiMessages(all, persona, {
      maxTurns: 10,
      side: from,
      resolveImage: preRef ? (ref) => (ref === preRef ? preB64 : '') : undefined,
    });
    const hasImage = history.some((m) => Array.isArray(m.images) && m.images.length);
    const aiCfg = s.ai || {};
    const system = vetSystemPrompt(persona, persona === 'owner' ? addressed : practiceName, {
      petName: chat.petName,
      animalLabel: ANIMAL_SINGULAR[chat.animal],
    });
    const req = { messages: [{ role: 'system', content: system }].concat(history), persona, signal: a.signal };
    const model = hasImage && aiCfg.visionModel ? aiCfg.visionModel : aiCfg.model;
    if (model) req.model = model;
    if (aiCfg.provider && aiCfg.provider !== 'auto') req.provider = aiCfg.provider;
    const res = await ai.chat(req);
    out.usedAi = true;
    let source = res.source || (res.provider === 'mock' ? 'mock-ai' : (res.vision ? 'ai-vision' : 'ai'));
    let texts = [String(res.text || '').trim()].filter(Boolean);
    const meta = { intent: 'ai', provider: res.provider || '', model: res.model || '' };
    // Nachfilter (Bot 3.0): Dosierungen, falscher Rat, nicht Deutsch → durch Bot-Antwort ersetzen.
    if (typeof bot.guardAiReply === 'function') {
      let gr = null;
      try { gr = bot.guardAiReply({ persona, userText, aiText: res.text, practice: replying }); } catch { gr = null; }
      if (gr && gr.ok === false && Array.isArray(gr.texts) && gr.texts.length) {
        texts = gr.texts.filter((t) => typeof t === 'string' && t.trim());
        source = 'bot';
        meta.fallbackReason = 'guard' + (gr.reason ? ':' + gr.reason : '');
      }
    }
    const aiMsgs = texts.map((text) => ({ text, source, meta: { ...meta } }));
    const elapsed = Date.now() - t0;
    push(safety);
    const firstAi = out.messages.length;
    push(aiMsgs);
    // Die KI hat schon „getippt", während sie rechnete → Wartezeit nur noch auffüllen.
    if (out.typingMs.length > firstAi && s.typing !== false) out.typingMs[firstAi] = Math.max(300, out.typingMs[firstAi] - elapsed);
    return out;
  } catch (e) {
    if (isAbortError(e) || (a.signal && a.signal.aborted)) throw e;
    const code = (e && e.code) || 'offline';
    if (mode === 'ai-fallback' && (code === 'offline' || code === 'timeout')) {
      push(safety.length ? safety : viaBot(code));
      return out;
    }
    const hint = { text: hintText(e), source: 'error', meta: { code } };
    if (mode === 'ai') push(safety.concat([hint]));
    else push([hint].concat(safety.length ? safety : viaBot(code)));
    return out;
  }
}
