// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* Brücke: Hub-Chats (Schema 3, ein Datensatz für beide Seiten) → die Chat-Form, die die
   bestehenden Screens in Web und Handy-App erwarten (role, title, sub, messages mit from/time/src).

   Warum eine Brücke statt alle Screens neu zu schreiben: Die Screens (Liste, Thread, Labels,
   Reaktionen, Bearbeiten) funktionieren und sind getestet. Mit dieser Übersetzung zeigen sie im
   Hub-Modus einfach die gemeinsamen Hub-Chats — Web, iPhone, Android und Extension sehen dieselben
   Unterhaltungen live. Ohne Hub bleibt alles lokal wie bisher. */
import { chatView } from './chats.js';

const pad = (n) => String(n).padStart(2, '0');

/* Zeitstempel → „09:30", „Gestern 16:20", „02.06. 11:00" (wie die alten Demo-Texte). */
export function legacyTime(ts, now) {
  if (!ts) return '';
  const d = new Date(ts);
  const n = new Date(now || Date.now());
  const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, n)) return hm;
  const y = new Date(n.getTime() - 86400000);
  if (sameDay(d, y)) return 'Gestern ' + hm;
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '. ' + hm;
}

/* In Netzwerk-Chats, in denen meine Praxis die „Gegenpraxis" ist (Seite 'owner' im Hub), zeigen die
   alten Screens mich trotzdem als 'clinic' → Absender und Reaktionen spiegeln. */
function swapper(view) {
  const swap = view.rubric === 'network' && view.side === 'owner';
  const flip = (s) => (s === 'owner' ? 'clinic' : s === 'clinic' ? 'owner' : s);
  return { swap, map: swap ? flip : (s) => s };
}

export function legacyChatsFromHub(hubChats, auth, practices, opts = {}) {
  const fileUrl = opts.fileUrl || ((ref) => ref);
  const now = opts.now || Date.now();
  const out = [];
  for (const chat of hubChats || []) {
    const view = chatView(chat, auth, practices);
    if (!view) continue;
    const { map } = swapper(view);
    out.push({
      id: chat.id,
      hub: true,
      role: view.rubric, // 'owner' | 'clinic' | 'network' → wie früher die Rubrik
      side: view.side, // meine Seite im Hub
      title: view.title,
      sub: view.subtitle,
      animal: chat.animal || 'other',
      color: chat.color || '#0f9b8e',
      icon: chat.icon || 'chat',
      labels: chat.labels || [],
      pinned: !!view.pinned,
      unread: view.unread || 0,
      isTestData: !!chat.isTestData,
      autoReply: !!chat.autoReply,
      practiceId: chat.practiceId,
      updatedAt: chat.updatedAt || 0,
      messages: (chat.messages || []).map((m) => {
        const att = m.attachment || null;
        const msg = {
          id: m.id,
          from: map(m.from),
          type: m.type || 'text',
          text: m.text || '',
          time: legacyTime(m.ts, now),
          ts: m.ts,
        };
        if (att) {
          if (att.kind === 'image' || m.type === 'image') msg.src = fileUrl(att.ref);
          else { msg.src = fileUrl(att.ref); msg.fileName = att.name; msg.fileMime = att.mime; msg.fileSize = att.size; }
        }
        if (m.source) msg.source = m.source;
        if (m.editedAt) msg.editedAt = m.editedAt;
        if (m.deleted) msg.deleted = true;
        if (m.rating) msg.rating = m.rating;
        if (m.reactions) {
          msg.reactions = {};
          for (const [side, emoji] of Object.entries(m.reactions)) msg.reactions[map(side)] = emoji;
        }
        return msg;
      }),
    });
  }
  // Wie die alte Liste: neueste Unterhaltung oben (Anpinnen sortieren die Screens selbst).
  out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return out;
}

/* Umgekehrt: Absender aus Sicht der alten Screens → Seite im Hub. */
export function hubSideFor(legacyChat, legacyFrom) {
  const swap = legacyChat && legacyChat.role === 'network' && legacyChat.side === 'owner';
  if (!swap) return legacyFrom;
  return legacyFrom === 'owner' ? 'clinic' : legacyFrom === 'clinic' ? 'owner' : legacyFrom;
}
