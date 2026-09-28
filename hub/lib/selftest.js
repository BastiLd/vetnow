/* VetNow Hub — serverseitiger Selbsttest (GET /api/v1/admin/selftest).

   Prüft die Bausteine, die bei einer Vorführung auf keinen Fall ausfallen dürfen — jeder Check
   liefert { name, ok, ms, detail }. Der Test verändert KEINE Nutzdaten: Er schreibt in eine eigene
   Temp-Datei, schickt sein SSE-Testereignis nur an einen internen Abonnenten und löscht seine
   Testdatei im Anhang-Speicher wieder. */
import { promises as fsp } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { atomicWrite } from './store.js';
import { makePng } from './png.js';
import { createMockProvider } from '../ai/mock.js';
import {
  buildDemoSeed, runBotSuite, botReply, botImageReply, SHARED_FALLBACKS, SHARED_LOAD_ERRORS,
} from './shared.js';

const FROM = new Set(['owner', 'clinic', 'system']);

/* Prüft einen Datenbestand (Seed oder aktueller Zustand) auf Verweis-Fehler. → string[] Probleme */
export function integrityProblems(s) {
  const problems = [];
  const ids = new Set();
  const dup = (kind, id) => { const k = kind + ':' + id; if (ids.has(k)) problems.push(`${kind} ${id} doppelt`); ids.add(k); };
  const practices = new Set();
  for (const p of s.practices || []) {
    dup('Praxis', p.id);
    practices.add(p.id);
    const v = p.status && p.status.value;
    if (v != null && !['green', 'yellow', 'red'].includes(v)) problems.push(`Praxis ${p.id}: ungültiger Status ${v}`);
  }
  const chats = new Set();
  for (const c of s.chats || []) {
    dup('Chat', c.id);
    chats.add(c.id);
    if (!practices.has(c.practiceId)) problems.push(`Chat ${c.id}: Praxis ${c.practiceId} fehlt`);
    if (c.kind === 'network' && !practices.has(c.peerPracticeId)) problems.push(`Chat ${c.id}: Partner-Praxis ${c.peerPracticeId} fehlt`);
    const mids = new Set();
    for (const m of c.messages || []) {
      if (!m.id || mids.has(m.id)) problems.push(`Chat ${c.id}: Nachricht ohne/mit doppelter ID`);
      mids.add(m.id);
      if (typeof m.ts !== 'number') problems.push(`Chat ${c.id}/${m.id}: ts ist keine Zahl`);
      if (!FROM.has(m.from)) problems.push(`Chat ${c.id}/${m.id}: ungültiges from`);
    }
  }
  for (const a of s.appointments || []) {
    dup('Termin', a.id);
    if (!practices.has(a.practiceId)) problems.push(`Termin ${a.id}: Praxis ${a.practiceId} fehlt`);
    if (a.chatId && !chats.has(a.chatId)) problems.push(`Termin ${a.id}: Chat ${a.chatId} fehlt`);
  }
  const labels = new Set((s.labels || []).map((l) => l.id));
  for (const need of ['posteingang', 'notfall']) if (!labels.has(need)) problems.push(`Label ${need} fehlt`);
  return problems;
}

/* Minimaler „Antwort"-Ersatz für einen internen SSE-Abonnenten. */
function fakeSse() {
  const res = new EventEmitter();
  res.chunks = [];
  res.writableEnded = false;
  res.destroyed = false;
  res.headersSent = false;
  res.writeHead = () => { res.headersSent = true; return res; };
  res.flushHeaders = () => {};
  res.write = (c) => { res.chunks.push(String(c)); res.emit('chunk'); return true; };
  res.end = () => { res.writableEnded = true; res.emit('close'); };
  const req = new EventEmitter();
  req.headers = {};
  return { req, res };
}

export function createSelftest({ store, files, realtime, ai, dataDir }) {
  async function check(name, fn) {
    const t0 = Date.now();
    try {
      const r = await fn();
      const ok = r && typeof r === 'object' && 'ok' in r ? !!r.ok : true;
      const detail = r && typeof r === 'object' ? (r.detail || '') : String(r || '');
      return { name, ok, ms: Date.now() - t0, detail };
    } catch (e) {
      return { name, ok: false, ms: Date.now() - t0, detail: (e && e.message) || String(e) };
    }
  }

  const checks = [
    ['store-write-read', async () => {
      const nonce = randomBytes(8).toString('hex');
      const f = path.join(dataDir, `selftest-${nonce}.json`);
      try {
        await atomicWrite(f, JSON.stringify({ nonce }));
        const back = JSON.parse(await fsp.readFile(f, 'utf8'));
        return { ok: back.nonce === nonce, detail: back.nonce === nonce ? 'Atomares Schreiben + Lesen im Datenordner funktioniert.' : 'Gelesener Inhalt weicht ab.' };
      } finally {
        await fsp.rm(f, { force: true });
      }
    }],
    ['persistence', async () => {
      await store.flush();
      if (store.lastSaveError) return { ok: false, detail: 'Letztes Speichern fehlgeschlagen: ' + store.lastSaveError.message };
      const saved = JSON.parse(await fsp.readFile(store.file, 'utf8'));
      const ok = Array.isArray(saved.chats) && Array.isArray(saved.practices) && Number.isFinite(saved.rev);
      return { ok, detail: ok ? `state.json lesbar (rev ${saved.rev}, ${saved.chats.length} Chats).` : 'state.json unvollständig.' };
    }],
    ['seed-integrity', () => {
      const seed = buildDemoSeed(Date.now());
      const problems = integrityProblems(seed);
      if (!(seed.practices || []).length) problems.unshift('Demo-Seed enthält keine Praxen');
      return {
        ok: !problems.length,
        detail: problems.length ? problems.slice(0, 5).join('; ') : `Demo-Seed stimmig: ${seed.practices.length} Praxen, ${seed.chats.length} Chats, ${(seed.appointments || []).length} Termine.`,
      };
    }],
    ['state-integrity', () => {
      const problems = integrityProblems(store.state);
      return { ok: !problems.length, detail: problems.length ? problems.slice(0, 5).join('; ') : 'Aktueller Zustand ohne Verweis-Fehler.' };
    }],
    ['bot-suite', () => {
      const r = runBotSuite();
      const total = r.total ?? ((r.passed || 0) + (r.failed || 0));
      return { ok: (r.failed || 0) === 0, detail: total ? `${r.passed}/${total} Bot-Testfälle bestanden.` : 'Keine Bot-Testfälle hinterlegt (Bot-Adapter ohne Suite).' };
    }],
    ['bot-reply', () => {
      const r = botReply({ messages: [], userText: 'Mein Hund hat Schokolade gefressen!', persona: 'clinic', practiceName: 'Selbsttest-Praxis' });
      const texts = (r && r.texts) || [];
      return { ok: texts.length > 0 && texts.every((t) => typeof t === 'string' && t.trim()), detail: texts.length ? `Bot antwortet: „${texts[0].slice(0, 80)}…"` : 'Bot lieferte keine Antwort.' };
    }],
    ['mock-ai', async () => {
      const mock = createMockProvider({ botReply, botImageReply, wordDelayMs: 0 });
      const a = await mock.chat({ messages: [{ role: 'user', content: 'Sag Apfel' }] });
      if (a.text !== 'Apfel') return { ok: false, detail: `„Sag Apfel" ergab „${a.text}".` };
      let streamed = '';
      const b = await mock.chat({ messages: [{ role: 'user', content: 'Mein Hund humpelt seit gestern.' }], stream: true, onDelta: (d) => { streamed += d; } });
      if (!b.text || streamed !== b.text) return { ok: false, detail: 'Gestreamte Teile ergeben nicht den Gesamttext.' };
      const plan = JSON.parse((await mock.chat({ messages: [{ role: 'user', content: 'AUFGABE: Notfall-Durchlauf' }], format: 'json' })).text);
      if (!Array.isArray(plan.steps) || !plan.steps.length) return { ok: false, detail: 'JSON-Plan ohne Schritte.' };
      const png = makePng(8, 8).toString('base64');
      const v = await mock.chat({ messages: [{ role: 'user', content: 'Was ist das?', images: [png] }] });
      if (!v.vision) return { ok: false, detail: 'Bild wurde nicht erkannt.' };
      return { ok: true, detail: `Test-KI ok (Text, Stream mit ${streamed.split(/\s+/).length} Wörtern, JSON-Plan, Bild).` };
    }],
    ['ai-registry', async () => {
      const st = await ai.status();
      const list = st.providers.map((p) => `${p.id}:${p.ok ? 'bereit' : 'aus'}`).join(', ');
      return { ok: true, detail: `Einstellung „${st.provider}", aktiv: ${st.active ? st.active.id : 'keiner (Bot übernimmt)'} — ${list}` };
    }],
    ['sse-roundtrip', async () => {
      const { req, res } = fakeSse();
      const conn = realtime.openSse(req, res, {}, { internal: true });
      try {
        const hello = res.chunks.some((c) => c.includes('"type":"hello"'));
        const nonce = randomBytes(6).toString('hex');
        // Ziel = nur dieser interne Abonnent: Echte Geräte bekommen das Test-Ereignis nicht zu sehen.
        store.emit('broadcast', { kind: 'selftest', target: conn.clientId, nonce }, { persist: false });
        const got = await new Promise((resolve) => {
          const has = () => res.chunks.some((c) => c.includes(nonce));
          if (has()) { resolve(true); return; }
          const t = setTimeout(() => { res.off('chunk', on); resolve(false); }, 2000);
          function on() { if (has()) { clearTimeout(t); res.off('chunk', on); resolve(true); } }
          res.on('chunk', on);
        });
        const poll = store.eventsSince(store.rev - 1);
        const inRing = !poll.resync && poll.events.some((e) => e.nonce === nonce);
        return { ok: hello && got && inRing, detail: `hello ${hello ? 'ok' : 'fehlt'}, Ereignis per SSE ${got ? 'ok' : 'fehlt'}, im Long-Poll-Puffer ${inRing ? 'ok' : 'fehlt'}.` };
      } finally {
        conn.close();
      }
    }],
    ['files-roundtrip', async () => {
      const png = makePng(16, 16);
      const meta = await files.save(png, { mime: 'image/png', name: 'selbsttest.png' });
      try {
        const back = await files.read(meta.id);
        const same = back && createHash('sha256').update(back.data).digest('hex') === meta.sha256;
        return { ok: !!same, detail: same ? `Anhang gespeichert und identisch gelesen (${meta.size} Byte).` : 'Gelesene Datei weicht ab.' };
      } finally {
        await files.remove(meta.id);
      }
    }],
    ['shared-module', () => {
      const fb = SHARED_FALLBACKS || [];
      const errs = Object.entries(SHARED_LOAD_ERRORS || {}).map(([f, e]) => `${f}: ${e}`);
      return {
        ok: fb.length === 0,
        detail: fb.length ? `Notbehelf aktiv für: ${fb.join(', ')}${errs.length ? ' — Ladefehler: ' + errs.join(' | ').slice(0, 300) : ''}` : 'Alle Vertragsfunktionen kommen aus shared/.',
      };
    }],
  ];

  return {
    names: checks.map(([n]) => n),
    async run() {
      const out = [];
      for (const [name, fn] of checks) out.push(await check(name, fn));
      return out;
    },
  };
}
