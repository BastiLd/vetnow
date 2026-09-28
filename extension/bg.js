/* Hintergrund-Dienst der Extension (Chrome/Edge: Service Worker, Firefox: Event-Page).
   Fragt jede Minute den VetNow Hub und zeigt am Symbol:
   - die Zahl ungelesener Anfragen/Nachrichten der eigenen Praxis,
   - die Farbe des aktuellen Praxis-Status (grün/gelb/rot, grau = nicht bestätigt).
   Ohne Hub bleibt das Symbol neutral. */
const api = globalThis.browser ?? globalThis.chrome;
const COLORS = { green: '#16a34a', yellow: '#e3a008', red: '#dc2626', grey: '#94a39f' };

function effective(p, now) {
  if (!p) return 'grey';
  if (p.absence && p.absence.from <= now && now <= p.absence.to) return 'red';
  if (!p.status || !p.status.value || !p.status.expiresAt || now > p.status.expiresAt) return 'grey';
  return p.status.value;
}

async function refresh() {
  const o = await api.storage.local.get(['hubUrl', 'practiceId']);
  const hub = (o.hubUrl || 'http://localhost:8787').replace(/\/+$/, '');
  const pid = o.practiceId || 'drautal';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const st = await (await fetch(hub + '/api/v1/state', { signal: ctrl.signal, headers: { 'x-vn-client': 'extension-bg' } })).json();
    clearTimeout(t);
    const p = st.practices.find((x) => x.id === pid);
    const eff = effective(p, Date.now() + (st.clockOffsetMs || 0));
    const unread = st.chats.filter((c) => c.practiceId === pid && c.kind !== 'network').reduce((n, c) => n + ((c.unread && c.unread.clinic) || 0), 0);
    await api.action.setBadgeBackgroundColor({ color: unread ? '#dc2626' : COLORS[eff] });
    await api.action.setBadgeText({ text: unread ? String(Math.min(unread, 99)) : '●' });
    await api.action.setTitle({ title: `VetNow – ${p ? p.name : 'Praxis'}: ${({ green: 'Erreichbar', yellow: 'Rücksprache', red: 'Nicht verfügbar', grey: 'Nicht bestätigt' })[eff]}${unread ? ' · ' + unread + ' ungelesen' : ''}` });
  } catch {
    await api.action.setBadgeText({ text: '' });
    await api.action.setTitle({ title: 'VetNow Kärnten – Praxis (kein Hub verbunden)' });
  }
}

api.alarms.create('vn-sync', { periodInMinutes: 1 });
api.alarms.onAlarm.addListener((a) => { if (a.name === 'vn-sync') refresh(); });
api.runtime.onMessage.addListener((m) => { if (m && m.type === 'vn:refresh') refresh(); });
api.runtime.onInstalled.addListener(() => refresh());
api.runtime.onStartup && api.runtime.onStartup.addListener(() => refresh());
refresh();
