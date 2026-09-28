/* VetNow Hub — Simulator für das Admin-/Test-Center (POST /api/v1/admin/simulate).

   Jede Aktion löst eine ECHTE Änderung über dieselben Wege aus wie ein Client (ops.js) —
   also mit Ereignissen an alle Geräte, Auto-Antworten usw. So testet man z. B. vom PC aus:
   „Kommt eine Notfall-Anfrage wirklich live im Posteingang am Handy an?" */
import { HttpError, badRequest } from './http.js';
import { clamp, isoDate } from './util.js';
import { makePng } from './png.js';
import { DEMO_PRACTICE_ID, DEMO_OWNER } from './shared.js';

export const SIMULATE_ACTIONS = [
  'emergency-request', 'owner-message', 'clinic-message', 'status', 'status-all', 'status-random',
  'expire-status', 'absence', 'appointment-request', 'burst', 'xss-message', 'image-message', 'long-message',
];

const EMERGENCIES = [
  { animal: 'dog', petName: 'Rex', message: 'Unser Hund Rex hat eine ganze Tafel Zartbitter-Schokolade gefressen! Was sollen wir tun?' },
  { animal: 'cat', petName: 'Minka', message: 'Meine Katze Minka atmet sehr schwer und liegt nur noch apathisch da.' },
  { animal: 'dog', petName: 'Bello', message: 'Bello wurde angefahren und blutet stark am Hinterbein.' },
  { animal: 'small', petName: 'Hoppel', message: 'Unser Kaninchen Hoppel frisst seit gestern nichts mehr und hat einen harten Bauch.' },
];
const OWNER_TEXTS = [
  'Guten Tag, wie lange dauert die Untersuchung ungefähr?',
  'Danke! Sollen wir den Impfpass mitbringen?',
  'Unser Hund humpelt seit heute Morgen am linken Vorderbein.',
  'Können wir morgen um 10 Uhr vorbeikommen?',
];
const CLINIC_TEXTS = [
  'Guten Tag! Bitte bringen Sie den Impfpass mit.',
  'Wir haben morgen um 09:30 oder 14:00 Uhr einen Termin frei.',
  'Die Befunde sind da — alles unauffällig. Gute Besserung!',
];

export function createSimulator({ store, ops, files, random = Math.random } = {}) {
  const pick = (list) => list[Math.floor(random() * list.length) % list.length];

  function pickPractice(id) {
    if (id) return ops.requirePractice(id);
    const p = store.practice(DEMO_PRACTICE_ID) || store.state.practices[0];
    if (!p) throw new HttpError(409, 'Es gibt keine Praxis — bitte zuerst Demo-Daten laden.', 'no-practice');
    return p;
  }

  function pickChat(id) {
    if (id) return ops.requireChat(id);
    const all = store.state.chats;
    const direct = all.filter((c) => c.kind === 'request' || c.kind === 'direct');
    const demo = direct.filter((c) => c.practiceId === DEMO_PRACTICE_ID);
    const pool = demo.length ? demo : (direct.length ? direct : all);
    if (!pool.length) throw new HttpError(409, 'Es gibt keinen Chat — bitte zuerst eine Anfrage simulieren oder Demo-Daten laden.', 'no-chat');
    return pool.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  }

  const say = (chat, from, text, extra = {}) => ops.addMessage(chat.id, { from, type: 'text', text, ...extra }).message;

  const actions = {
    'emergency-request'(p) {
      const practice = pickPractice(p.practiceId);
      const e = pick(EMERGENCIES);
      const { chat } = ops.createRequest({
        practiceId: practice.id, ownerId: p.ownerId || DEMO_OWNER.ownerId, ownerName: p.ownerName || 'Test-Tierhalter:in',
        animal: e.animal, petName: e.petName, situation: 'emergency', phone: '+43 660 1234567',
        district: practice.district, message: p.text || e.message, isTestData: true,
        ...(p.autoReply === false ? { autoReply: false } : {}),
      });
      return { chatId: chat.id, practiceId: practice.id };
    },
    'owner-message'(p) {
      const chat = pickChat(p.chatId);
      const m = say(chat, 'owner', p.text || pick(OWNER_TEXTS));
      return { chatId: chat.id, messageId: m.id };
    },
    'clinic-message'(p) {
      const chat = pickChat(p.chatId);
      const m = say(chat, 'clinic', p.text || pick(CLINIC_TEXTS));
      return { chatId: chat.id, messageId: m.id };
    },
    status(p) {
      const practice = pickPractice(p.practiceId);
      ops.setStatus(practice.id, { value: p.value, hours: p.hours === undefined ? 24 : p.hours, note: p.note });
      return { practiceId: practice.id, value: p.value };
    },
    'status-all'(p) {
      if (!['green', 'yellow', 'red', 'grey'].includes(p.value)) throw badRequest('„value" muss green, yellow, red oder grey sein.', 'bad-status');
      for (const pr of store.state.practices) ops.setStatus(pr.id, { value: p.value, hours: p.hours === undefined ? 24 : p.hours });
      return { count: store.state.practices.length, value: p.value };
    },
    'status-random'() {
      const values = {};
      for (const pr of store.state.practices) {
        const r = random();
        const value = r < 0.45 ? 'green' : r < 0.7 ? 'yellow' : r < 0.85 ? 'red' : 'grey';
        ops.setStatus(pr.id, { value, hours: 24 });
        values[pr.id] = value;
      }
      return { values };
    },
    'expire-status'(p) {
      const practice = pickPractice(p.practiceId);
      const inMs = Number(p.inMs) || 0;
      ops.setStatus(practice.id, inMs > 0 ? { expiresInMs: inMs } : { expire: true });
      return { practiceId: practice.id, expiresAt: practice.status.expiresAt };
    },
    absence(p) {
      const practice = pickPractice(p.practiceId);
      if (p.on === false || p.on === 'false' || p.on === 0) {
        ops.setAbsence(practice.id, null);
        return { practiceId: practice.id, absence: null };
      }
      const t = store.now();
      const other = store.state.practices.find((x) => x.id !== practice.id);
      const hours = clamp(Number(p.hours) || 8, 0.01, 24 * 30);
      ops.setAbsence(practice.id, { from: t - 60e3, to: t + hours * 3600e3, vertretung: p.vertretung || (other ? other.name : '') });
      return { practiceId: practice.id, absence: practice.absence };
    },
    'appointment-request'(p) {
      const practice = pickPractice(p.practiceId);
      const { chat } = ops.createRequest({
        practiceId: practice.id, ownerId: p.ownerId || DEMO_OWNER.ownerId, ownerName: p.ownerName || 'Test-Tierhalter:in',
        animal: 'cat', petName: 'Luna', situation: 'regular', phone: '+43 660 7654321', district: practice.district,
        message: p.text || 'Guten Tag, wir hätten gern einen Termin zur Impfung für Luna. Passt es morgen Vormittag?', isTestData: true,
      });
      ops.updateChat(chat.id, { labels: [...new Set([...(chat.labels || []), 'termin'])] });
      const tomorrow = isoDate(store.now() + 24 * 3600e3);
      const { appointment } = ops.createAppointment({
        practiceId: practice.id, date: p.date || tomorrow, time: p.time || '10:00', durationMin: 20,
        name: chat.ownerName, animal: 'cat', status: 'open', reason: 'Impfung (Terminanfrage)', chatId: chat.id, isTestData: true,
      });
      return { chatId: chat.id, appointmentId: appointment.id };
    },
    burst(p) {
      const chat = pickChat(p.chatId);
      const count = clamp(Math.floor(Number(p.count) || 20), 1, 200);
      const from = p.from === 'clinic' ? 'clinic' : 'owner';
      const ids = [];
      for (let i = 1; i <= count; i++) ids.push(say(chat, from, `Burst-Nachricht ${i}/${count}`).id);
      return { chatId: chat.id, count, first: ids[0], last: ids[ids.length - 1] };
    },
    'xss-message'(p) {
      const chat = pickChat(p.chatId);
      // Muss in JEDEM Client als reiner Text erscheinen — kein Alert, kein fettes „fett".
      const text = '<img src=x onerror="alert(\'XSS\')"><script>alert("XSS")</script> <b>fett?</b> <a href="javascript:alert(1)">Link</a>';
      const m = say(chat, p.from === 'clinic' ? 'clinic' : 'owner', text);
      return { chatId: chat.id, messageId: m.id };
    },
    async 'image-message'(p) {
      const chat = pickChat(p.chatId);
      if (!files) throw new HttpError(500, 'Datei-Speicher nicht verfügbar.', 'no-files');
      const png = makePng(96, 96);
      const meta = await files.save(png, { mime: 'image/png', name: 'testbild.png' });
      const m = ops.addMessage(chat.id, {
        from: p.from === 'clinic' ? 'clinic' : 'owner', type: 'image', text: p.text || 'Hier ein Foto (Testbild).',
        attachment: { kind: 'image', name: meta.name, mime: meta.mime, size: meta.size, ref: 'hub:' + meta.id, w: 96, h: 96 },
      }).message;
      return { chatId: chat.id, messageId: m.id, fileId: meta.id };
    },
    'long-message'(p) {
      const chat = pickChat(p.chatId);
      // Ein 170 Zeichen langes „Wort" ohne Umbruchstelle prüft, ob Chat-Blasen überlaufen.
      const word = 'Donaudampfschifffahrtsgesellschaftskapitänsmützenabzeichen'.repeat(3).slice(0, 170);
      const para = 'Das ist eine sehr lange Test-Nachricht, damit man Zeilenumbrüche, Scrollen und die Darstellung in schmalen Chat-Blasen prüfen kann. ';
      const text = `${word}\n\n${para.repeat(18)}\n\nEnde der langen Nachricht.`;
      const m = say(chat, p.from === 'clinic' ? 'clinic' : 'owner', text);
      return { chatId: chat.id, messageId: m.id, length: text.length };
    },
  };

  async function run(action, params = {}) {
    const fn = actions[action];
    if (!fn) throw badRequest(`Unbekannte Simulator-Aktion. Erlaubt: ${SIMULATE_ACTIONS.join(', ')}.`, 'bad-action');
    const result = await fn(params || {});
    return { ok: true, action, ...result };
  }

  return { run, actions: SIMULATE_ACTIONS };
}
