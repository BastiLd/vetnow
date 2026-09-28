/* Bot 3.0 — Regressionstest im normalen `node --test`-Lauf.
   Die eigentlichen Fälle stehen in shared/bot/suite.de.js (sie laufen auch im Admin-Center
   und über den Hub-Endpunkt /api/v1/bot/suite). Hier prüfen wir zusätzlich die harten
   Sicherheitsregeln, die Geschwindigkeit und dass der Bot auf dem Handy (Hermes) lauffähig bleibt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  botReply, botGreeting, botImageReply, botConversationReply, triage, guardAiReply, BOT_SUITE, runBotSuite,
} from '../bot/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const PRACTICE = { name: 'Tierarztpraxis Drautal', phone: '+43 000 000000', hoursShort: 'Mo–Fr 8–18, Sa 9–12' };
const reply = (userText, persona = 'clinic', extra = {}) =>
  botReply({ userText, persona, practiceName: PRACTICE.name, practice: PRACTICE, messages: [], ...extra });
const all = (r) => r.texts.join(' ');

test('Regressions-Suite: alle Fälle grün, keine unsicheren Antworten', () => {
  const r = runBotSuite();
  assert.ok(BOT_SUITE.length >= 200, 'mindestens 200 Fälle in der Suite');
  assert.ok(r.total >= BOT_SUITE.length - 1, 'alle Fälle wurden ausgeführt');
  const failed = r.results.filter((x) => !x.ok);
  assert.equal(r.failed, 0, 'Fehlgeschlagen: ' + failed.slice(0, 5).map((f) => f.id + ' ' + (f.problems || []).join('; ')).join(' | '));
});

test('Notfälle werden erkannt und beginnen mit einer Handlungsaufforderung', () => {
  for (const t of [
    'Mein Hund hat aufgehört zu atmen',
    'Katze bekommt keine Luft',
    'Unser Hund wurde angefahren',
    'Pferd hat Kolik und wälzt sich',
    'Hund erbricht Blut',
    'mein hund atmet jetzt ganz schwer',
  ]) {
    const r = reply(t);
    assert.ok(['emergency', 'urgent', 'poison'].includes(r.triage.level), t + ' → ' + r.triage.level);
    assert.match(r.texts[0], /sofort|anrufen|Notdienst|losfahren/i, t);
  }
});

test('Gift- und Medikamentenfragen werden nie bejaht, nie Dosierungen', () => {
  for (const t of [
    'Kann ich meiner Katze Paracetamol geben?',
    'Darf mein Hund Weintrauben essen?',
    'Ist ein bisschen Schokolade okay für den Hund?',
    'Kann ich Ibuprofen geben?',
  ]) {
    const text = all(reply(t));
    assert.doesNotMatch(text, /ja, das ist grundsätzlich möglich/i, t);
    assert.doesNotMatch(text, /\d+\s*(mg|ml|tabletten?|tropfen)\b/i, t);
    assert.match(text, /nein|nicht|giftig/i, t);
  }
});

test('Keine Fehlalarme bei harmlosen Nachrichten', () => {
  for (const t of ['Brauche ich eine Unfallversicherung für meinen Hund?', 'Er hat keine Schokolade gegessen, alles gut.', 'Ist nicht dringend, nur eine Frage zur Impfung.']) {
    const r = reply(t);
    assert.notEqual(r.triage.level, 'emergency', t);
  }
});

test('Hitzschlag: nie „warm halten"', () => {
  const text = all(reply('Mein Hund hatte einen Hitzschlag im Auto und hechelt stark'));
  assert.doesNotMatch(text, /warm halten/i);
});

test('Deterministisch: gleiche Eingabe → gleiche Antwort', () => {
  const a = reply('Was kostet eine Kastration bei der Katze?');
  const b = reply('Was kostet eine Kastration bei der Katze?');
  assert.deepEqual(a.texts, b.texts);
});

test('Personas: Praxis, Tierhalter:in, Kolleg:in antworten unterschiedlich', () => {
  const clinic = reply('Hallo, haben Sie heute noch einen Termin frei?', 'clinic');
  const owner = reply('Guten Tag, wie geht es Balu heute?', 'owner');
  const colleague = reply('Könnt ihr am Wochenende einen Notfall übernehmen?', 'colleague');
  for (const r of [clinic, owner, colleague]) assert.ok(r.texts.length > 0 && r.texts.every((t) => typeof t === 'string' && t.trim()));
  assert.notDeepEqual(clinic.texts, owner.texts);
  assert.ok(typeof botGreeting('clinic', PRACTICE.name) === 'string');
  assert.ok(typeof botImageReply('clinic', 'Die Wunde am Bein') === 'string');
});

test('Legacy-Einstieg botConversationReply liefert { texts }', () => {
  for (const fromRole of ['clinic', 'owner']) {
    const r = botConversationReply({ messages: [], userText: 'Hallo', fromRole, practiceName: PRACTICE.name });
    assert.ok(Array.isArray(r.texts) && r.texts.length > 0);
  }
});

test('Randfälle stürzen nicht ab', () => {
  for (const t of ['', '   ', '?', 'Ok', '🐶🐶🐶', 'x'.repeat(5000), 'My dog ate chocolate']) {
    const r = reply(t);
    assert.ok(Array.isArray(r.texts));
  }
  assert.equal(triage('My dog ate chocolate').level, 'poison');
});

test('KI-Nachfilter ersetzt Dosierungen', () => {
  const g = guardAiReply({ persona: 'clinic', userText: 'Wie viel Ibuprofen darf mein Hund?', aiText: 'Geben Sie 200 mg Ibuprofen.', practice: PRACTICE });
  assert.equal(g.ok, false);
  assert.ok(g.replaced);
  assert.doesNotMatch(g.texts.join(' '), /200 mg/);
});

test('Geschwindigkeit: 2000 Zeichen < 50 ms, Suite < 3 s', () => {
  const long = ('Mein Hund frisst seit gestern schlecht und die Nase ist warm und trocken, ist er krank? ').repeat(25).slice(0, 2000);
  let worst = 0;
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    reply(long);
    worst = Math.max(worst, performance.now() - t0);
  }
  assert.ok(worst < 50, 'langsamste Antwort ' + worst.toFixed(1) + ' ms');
  const t0 = performance.now();
  runBotSuite();
  assert.ok(performance.now() - t0 < 3000);
});

test('Hermes-sicher: kein Lookbehind, keine \\p{…}, keine Node-/DOM-APIs in shared/bot', () => {
  const dir = join(here, '..', 'bot');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'legacy-bot.js')) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const bad of ['(?<=', '(?<!', '\\p{', 'require(', 'process.', 'window.', 'document.']) {
      assert.ok(!src.includes(bad), f + ' enthält ' + bad);
    }
  }
});
