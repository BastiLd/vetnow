import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAutoReply, personaFor, generateAutoReply, typingDuration, replySideFor } from '../autoreply.js';
import { aiError } from '../ai.js';
import { buildDemoSeed } from '../seed.js';
import { defaultSettings } from '../constants.js';

const NOW = new Date(2026, 8, 24, 12, 0).getTime();
const seed = buildDemoSeed(NOW);
const S = (patch = {}) => ({ ...defaultSettings(), ...patch });
const chatWith = (base, msgs) => ({ ...seed.chats.find((c) => c.id === base), messages: msgs });
const ownerMsg = (text, extra = {}) => ({ id: 'm-' + Math.random().toString(36).slice(2), ts: NOW, from: 'owner', type: 'text', text, ...extra });
const clinicMsg = (text, extra = {}) => ({ ...ownerMsg(text, extra), from: 'clinic' });

/* Fake-KI: zeichnet Aufrufe auf und liefert, was der Test vorgibt. */
function fakeAi(result) {
  const calls = [];
  return {
    calls,
    async chat(req) {
      calls.push(req);
      if (result instanceof Error) throw result;
      if (typeof result === 'function') return result(req);
      return result;
    },
  };
}

test('shouldAutoReply: alle Ausschlussgründe', () => {
  const c = chatWith('ch-berger-drautal', []);
  const m = ownerMsg('Hallo');
  assert.equal(shouldAutoReply(c, m, S()), true);
  assert.equal(shouldAutoReply(c, m, S({ botMode: 'off' })), false, 'Bot aus');
  assert.equal(shouldAutoReply({ ...c, autoReply: false }, m, S()), false, 'Mensch-zu-Mensch');
  assert.equal(shouldAutoReply(c, { ...m, deleted: true }, S()), false);
  assert.equal(shouldAutoReply(c, { ...m, source: 'bot' }, S()), false, 'Simulation antwortet nicht sich selbst');
  assert.equal(shouldAutoReply(c, { ...m, from: 'system' }, S()), false);
  assert.equal(shouldAutoReply(c, { ...m, type: 'note', from: 'clinic' }, S()), false);
  assert.equal(shouldAutoReply(c, m, S(), { simulatedSide: 'owner' }), false, 'Nachricht der simulierten Seite');
  assert.equal(shouldAutoReply(null, m, S()), false);
});

test('personaFor / replySideFor', () => {
  const direct = chatWith('ch-berger-drautal', []);
  const net = chatWith('ch-net-drautal-viktring', []);
  assert.equal(personaFor(direct, ownerMsg('x')), 'clinic');
  assert.equal(personaFor(direct, clinicMsg('x')), 'owner');
  assert.equal(personaFor(net, clinicMsg('x')), 'colleague');
  assert.equal(personaFor(net, ownerMsg('x')), 'colleague');
  assert.equal(replySideFor(direct, ownerMsg('x')), 'clinic');
  assert.equal(replySideFor(net, clinicMsg('x')), 'owner');
  assert.equal(replySideFor(direct, null), 'clinic');
  assert.equal(replySideFor(net, null), 'owner');
});

test('Tippdauer wächst mit der Länge, gedeckelt bei 4 s, 0 wenn typing aus', () => {
  assert.equal(typingDuration('ok', S()), 600);
  assert.ok(typingDuration('x'.repeat(60), S()) > typingDuration('x'.repeat(20), S()));
  assert.equal(typingDuration('x'.repeat(5000), S()), 4000);
  assert.equal(typingDuration('x'.repeat(50), S({ typing: false })), 0);
});

test('botMode bot: nur Regel-Bot, KI wird nicht gefragt', async () => {
  const ai = fakeAi({ text: 'KI', provider: 'ollama' });
  const r = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [ownerMsg('Was kostet die Impfung?')]), practices: seed.practices, settings: S({ botMode: 'bot' }), ai, now: NOW });
  assert.equal(ai.calls.length, 0);
  assert.ok(r.messages.length >= 1);
  assert.ok(r.messages.every((m) => m.source === 'bot'));
  assert.equal(r.from, 'clinic');
  assert.equal(r.persona, 'clinic');
  assert.equal(r.typingMs.length, r.messages.length);
  assert.ok(r.typingMs.every((ms) => ms >= 600 && ms <= 4000));
});

test('ai-fallback + KI ok: KI-Antwort mit System-Prompt und Persona', async () => {
  const ai = fakeAi({ text: 'Gute Besserung an Balu! Passt morgen 09:30?', provider: 'ollama', model: 'qwen2.5:7b', vision: false });
  const r = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [ownerMsg('Balu humpelt')]), practices: seed.practices, settings: S(), ai, now: NOW });
  assert.equal(ai.calls.length, 1);
  const req = ai.calls[0];
  assert.equal(req.persona, 'clinic');
  assert.equal(req.messages[0].role, 'system');
  assert.match(req.messages[0].content, /Tierarztpraxis Drautal/);
  assert.deepEqual(req.messages.slice(1), [{ role: 'user', content: 'Balu humpelt' }]);
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].source, 'ai');
  assert.equal(r.messages[0].meta.model, 'qwen2.5:7b');
  assert.equal(r.usedAi, true);
});

test('ai-fallback + offline/timeout → STILL der Bot', async () => {
  for (const code of ['offline', 'timeout']) {
    const r = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [ownerMsg('Hallo, haben Sie morgen Zeit?')]), practices: seed.practices, settings: S({ botMode: 'ai-fallback' }), ai: fakeAi(aiError(code)), now: NOW });
    assert.ok(r.messages.length >= 1, code);
    assert.ok(r.messages.every((m) => m.source === 'bot'), code + ': kein sichtbarer Hinweis');
    assert.equal(r.messages[0].meta.fallbackReason, code);
  }
});

test('ai-fallback + echter KI-Fehler → sichtbarer Hinweis + Bot-Antwort', async () => {
  const r = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [ownerMsg('Hallo')]), practices: seed.practices, settings: S(), ai: fakeAi(aiError('model-crash', 'Modell abgestürzt')), now: NOW });
  assert.equal(r.messages[0].source, 'error');
  assert.match(r.messages[0].text, /Modell abgestürzt/);
  assert.ok(r.messages.slice(1).length >= 1 && r.messages.slice(1).every((m) => m.source === 'bot'));
});

test('botMode ai: jeder Fehler wird sichtbar, kein Bot', async () => {
  const r = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [ownerMsg('Hallo')]), practices: seed.practices, settings: S({ botMode: 'ai' }), ai: fakeAi(aiError('offline')), now: NOW });
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].source, 'error');
  assert.equal(r.messages[0].meta.code, 'offline');
});

test('off → nichts; leerer Chat → Begrüßung (abschaltbar)', async () => {
  const off = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [ownerMsg('Hallo')]), practices: seed.practices, settings: S({ botMode: 'off' }), ai: null, now: NOW });
  assert.deepEqual(off.messages, []);
  const greet = await generateAutoReply({ chat: chatWith('ch-berger-drautal', []), practices: seed.practices, settings: S(), ai: null, now: NOW });
  assert.equal(greet.messages.length, 1);
  assert.match(greet.messages[0].text, /Tierarztpraxis Drautal/);
  assert.equal(greet.from, 'clinic');
  const none = await generateAutoReply({ chat: chatWith('ch-berger-drautal', []), practices: seed.practices, settings: S({ greeting: false }), ai: null, now: NOW });
  assert.equal(none.messages.length, 0);
});

test('Bilder: KI-Vision → ai-vision; ohne KI → Bot-Bildantwort; file:// wird asynchron aufgelöst', async () => {
  const photo = { ...ownerMsg(''), type: 'image', attachment: { kind: 'image', name: 'p.jpg', mime: 'image/jpeg', size: 4, ref: 'file:///cache/p.jpg' } };
  const ai = fakeAi((req) => ({ text: 'Auf dem Foto sieht man eine gerötete Pfote.', provider: 'ollama', model: 'llava', vision: !!req.messages.some((m) => m.images) }));
  const r = await generateAutoReply({
    chat: chatWith('ch-berger-drautal', [photo]), practices: seed.practices, settings: S({ ai: { provider: 'auto', model: 'qwen', visionModel: 'llava' } }), ai, now: NOW,
    resolveImage: async (ref) => (ref === 'file:///cache/p.jpg' ? 'QUJD' : ''),
  });
  assert.equal(r.messages[0].source, 'ai-vision');
  assert.deepEqual(ai.calls[0].messages.at(-1).images, ['QUJD']);
  assert.equal(ai.calls[0].model, 'llava', 'Bild-Modell aus den Einstellungen');
  const bot = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [photo]), practices: seed.practices, settings: S(), ai: null, now: NOW });
  assert.equal(bot.messages[0].source, 'bot');
  assert.match(bot.messages[0].text, /Bild/);
});

test('Test-KI (mock) → Stempel mock-ai; Netzwerk → colleague; typing aus → 0 ms', async () => {
  const ai = fakeAi({ text: 'Servus! Klar, schickt die Daten.', provider: 'mock', model: 'mock-1' });
  const r = await generateAutoReply({ chat: chatWith('ch-net-drautal-viktring', [clinicMsg('Habt ihr am Wochenende Kapazität?')]), practices: seed.practices, settings: S({ typing: false }), ai, now: NOW });
  assert.equal(r.persona, 'colleague');
  assert.equal(r.from, 'owner');
  assert.equal(r.messages[0].source, 'mock-ai');
  assert.match(ai.calls[0].messages[0].content, /Pferdeklinik Viktring/, 'antwortende Praxis = Kollegin');
  assert.deepEqual(r.typingMs, [0]);
});

test('Tierhalter:in-Persona, wenn die Praxis schreibt; Abbruch wirft AbortError', async () => {
  const ai = fakeAi({ text: 'Danke, wir kommen gern!', provider: 'ollama' });
  const r = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [clinicMsg('Passt Ihnen 14:00?')]), practices: seed.practices, settings: S(), ai, now: NOW });
  assert.equal(r.persona, 'owner');
  assert.equal(r.from, 'owner');
  assert.match(ai.calls[0].messages[0].content, /Tierhalter/);
  const ctrl = new AbortController();
  const slow = { chat: (req) => new Promise((_, rej) => req.signal.addEventListener('abort', () => { const e = new Error('ab'); e.name = 'AbortError'; rej(e); })) };
  const p = generateAutoReply({ chat: chatWith('ch-berger-drautal', [ownerMsg('Hallo')]), practices: seed.practices, settings: S(), ai: slow, now: NOW, signal: ctrl.signal });
  ctrl.abort();
  await assert.rejects(p, (e) => e.name === 'AbortError');
});

/* Sicherheitsschicht (Vertrag §5): triage() läuft VOR der KI, guardAiReply() filtert KI-Antworten.
   Ein Test-Bot ersetzt hier gezielt diese Funktionen — so ist das Verhalten unabhängig davon
   geprüft, welche Bot-Version gerade in shared/bot/ liegt. */
const POISON = 'GIFT-NOTFALL: Bitte rufen Sie sofort an!';
const fakeBot = {
  triage: (t) => (/schokolade/i.test(t) ? { level: 'poison', reason: 'Schokolade', matched: ['schokolade'] }
    : /atmet nicht/i.test(t) ? { level: 'emergency', reason: 'Atemnot', matched: ['atmet nicht'] } : { level: 'none', reason: '', matched: [] }),
  botReply: ({ userText }) => (/schokolade|atmet nicht/i.test(userText)
    ? { texts: [POISON], intent: 'emergency', confidence: 1, entities: {}, triage: { level: 'poison' }, meta: { intent: 'emergency', asked: 'phone' } }
    : { texts: ['Normale Bot-Antwort.'], intent: 'booking', confidence: 0.9, entities: {}, meta: { intent: 'booking', offeredSlots: ['09:30', '11:00'] } }),
  guardAiReply: ({ aiText }) => (/\d+\s*mg/i.test(aiText)
    ? { ok: false, texts: ['Zur Dosierung dürfen wir hier nichts sagen — bitte rufen Sie uns an.'], replaced: true, reason: 'dosage' }
    : { ok: true, texts: [aiText], replaced: false }),
};

test('Sicherheit: Gift/Notfall → feste Bot-Antwort ZUERST, die KI ergänzt danach', async () => {
  const ai = fakeAi({ text: 'Wie viel Schokolade war es ungefähr?', provider: 'ollama', model: 'qwen' });
  const r = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [ownerMsg('Balu hat eine Tafel Schokolade gefressen!')]), practices: seed.practices, settings: S(), ai, now: NOW, bot: fakeBot });
  assert.equal(ai.calls.length, 1, 'KI darf ergänzen');
  assert.deepEqual(r.messages.map((m) => m.source), ['bot', 'ai']);
  assert.equal(r.messages[0].text, POISON);
  assert.equal(r.messages[0].meta.safety, true);
  assert.equal(r.messages[0].meta.intent, 'emergency', 'meta aus botReply übernommen');
  assert.equal(r.typingMs.length, 2);
});

test('Sicherheit: Notfall + KI offline (ai-fallback) → nur die Sicherheitsantwort; botMode ai + Fehler → Sicherheitsantwort + Hinweis', async () => {
  const chat = chatWith('ch-berger-drautal', [ownerMsg('Hilfe, meine Katze atmet nicht richtig!')]);
  const off = await generateAutoReply({ chat, practices: seed.practices, settings: S(), ai: fakeAi(aiError('offline')), now: NOW, bot: fakeBot });
  assert.deepEqual(off.messages.map((m) => m.text), [POISON], 'keine doppelte Bot-Antwort, kein Hinweis');
  assert.equal(off.messages[0].meta.triage.level, 'poison');
  const strict = await generateAutoReply({ chat, practices: seed.practices, settings: S({ botMode: 'ai' }), ai: fakeAi(aiError('model-crash', 'Modell abgestürzt')), now: NOW, bot: fakeBot });
  assert.deepEqual(strict.messages.map((m) => m.source), ['bot', 'error'], 'auch im reinen KI-Modus kommt die Sicherheitsantwort');
  const plain = await generateAutoReply({ chat, practices: seed.practices, settings: S({ botMode: 'bot' }), ai: null, now: NOW, bot: fakeBot });
  assert.deepEqual(plain.messages.map((m) => m.text), [POISON], 'botMode bot: Sicherheitsantwort genau einmal');
});

test('guardAiReply ersetzt eine KI-Antwort mit Dosierung durch den Bot-Text; meta aus botReply bleibt erhalten', async () => {
  const ai = fakeAi({ text: 'Geben Sie 50 mg Metacam.', provider: 'ollama', model: 'qwen' });
  const r = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [ownerMsg('Welches Schmerzmittel darf Balu?')]), practices: seed.practices, settings: S(), ai, now: NOW, bot: fakeBot });
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].source, 'bot');
  assert.match(r.messages[0].text, /Dosierung/);
  assert.equal(r.messages[0].meta.fallbackReason, 'guard:dosage');
  const b = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [ownerMsg('Haben Sie morgen einen Termin?')]), practices: seed.practices, settings: S({ botMode: 'bot' }), ai: null, now: NOW, bot: fakeBot });
  assert.deepEqual(b.messages[0].meta.offeredSlots, ['09:30', '11:00'], 'Bot-Gedächtnis (meta) wandert in die Nachricht');
  // Schreibt die PRAXIS „Schokolade", antwortet die Tierhalter:in-Persona — ohne Praxis-Sicherheitstext.
  const own = await generateAutoReply({ chat: chatWith('ch-berger-drautal', [clinicMsg('Hat Balu Schokolade erwischt?')]), practices: seed.practices, settings: S(), ai: fakeAi({ text: 'Nein, zum Glück nicht.', provider: 'ollama' }), now: NOW, bot: fakeBot });
  assert.deepEqual(own.messages.map((m) => m.source), ['ai']);
});
