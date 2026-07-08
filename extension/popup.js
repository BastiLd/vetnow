/* VetNow Extension — Popup-Logik (vanilla JS, kein Build).
   Drei Ansichten: Status / Termine / Nachrichten. Status & Countdown in
   chrome.storage persistiert; Nachrichten-Antworten pro Sitzung. */
(function () {
  const D = window.VN_EXT_DATA;
  const DURATION = 24 * 3600 * 1000;
  const view = document.getElementById('view');
  const nav = document.getElementById('nav');
  const el = (t, c, html) => { const n = document.createElement(t); if (c) n.className = c; if (html != null) n.innerHTML = html; return n; };
  const pad = (n) => String(n).padStart(2, '0');

  // Laufzeit-Zustand (Nachrichten pro Popup-Sitzung)
  const store = {};
  D.CONVERSATIONS.forEach((c) => { store[c.id] = c.messages.map((m) => ({ ...m })); });
  const unreadMap = {};
  D.CONVERSATIONS.forEach((c) => { unreadMap[c.id] = c.unread; });

  const state = { view: 'status', picked: 'green', expiry: Date.now() + DURATION, openChat: null, tick: null };

  // Persistenz (chrome.storage.local, mit Fallback)
  const sget = (cb) => { try { chrome.storage.local.get(['picked', 'expiry'], cb); } catch { cb({}); } };
  const sset = (obj) => { try { chrome.storage.local.set(obj); } catch { /* ignore */ } };

  function liveStatus() { return Date.now() < state.expiry ? state.picked : 'grey'; }

  function renderMini() {
    const s = liveStatus();
    const info = D.STATUS[s];
    const mini = document.getElementById('statusMini');
    document.getElementById('statusMiniLabel').textContent = info.label;
    mini.querySelector('.d').style.background = info.color;
    mini.style.background = info.color + '22';
    mini.style.color = info.color;
    // Badge
    const total = Object.values(unreadMap).reduce((a, b) => a + b, 0);
    const badge = document.getElementById('navBadge');
    if (total > 0) { badge.style.display = 'grid'; badge.textContent = total; } else { badge.style.display = 'none'; }
  }

  function svgSiren() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21h14"/></svg>'; }

  // ---------------- STATUS ----------------
  function renderStatus() {
    view.innerHTML = '';
    const active = Date.now() < state.expiry;
    const opts = [
      { key: 'green', cls: 'on-green' }, { key: 'yellow', cls: 'on-yellow' }, { key: 'red', cls: 'on-red' },
    ];
    const h = el('div', 'section-h', 'Heutiger Status');
    view.appendChild(h);
    const row = el('div', 'status-row');
    opts.forEach((o) => {
      const b = el('button', 'status-btn ' + o.cls + (state.picked === o.key ? ' is-on' : ''),
        '<span class="d" style="background:' + D.STATUS[o.key].color + '"></span>' + D.STATUS[o.key].label);
      b.onclick = () => { state.picked = o.key; state.expiry = Date.now() + DURATION; sset({ picked: o.key, expiry: state.expiry }); renderStatus(); renderMini(); };
      row.appendChild(b);
    });
    view.appendChild(row);

    const rem = Math.max(0, state.expiry - Date.now());
    const hh = Math.floor(rem / 3600000), mm = Math.floor((rem % 3600000) / 60000), ss = Math.floor((rem % 60000) / 1000);
    const cd = el('div', 'countdown' + (active ? '' : ' expired') + ' mt12');
    cd.innerHTML = '<div><div class="cd-lab">' + (active ? 'Läuft ab in' : 'Status abgelaufen') + '</div><div class="cd-time">' + (active ? pad(hh) + ':' + pad(mm) + ':' + pad(ss) : '00:00:00') + '</div></div>';
    const ext = el('button', 'btn btn-light btn-sm', 'Verlängern');
    ext.onclick = () => { state.expiry = Date.now() + DURATION; sset({ expiry: state.expiry }); renderStatus(); renderMini(); };
    cd.appendChild(ext);
    view.appendChild(cd);

    const confirm = el('button', 'btn btn-primary btn-block mt12', 'Status für 24 Stunden bestätigen');
    confirm.onclick = () => { state.expiry = Date.now() + DURATION; sset({ expiry: state.expiry }); renderStatus(); renderMini(); };
    view.appendChild(confirm);

    view.appendChild(el('div', 'notice mt12', 'Erinnerungen pausieren außerhalb der Öffnungszeiten und während Abwesenheiten.'));

    view.appendChild(el('div', 'divider'));
    const open = el('button', 'btn btn-secondary btn-block btn-sm', 'Vollansicht (Web-App) öffnen ›');
    open.onclick = () => openWeb('dashboard');
    view.appendChild(open);
  }

  // ---------------- TERMINE ----------------
  function renderAppts() {
    view.innerHTML = '';
    view.appendChild(el('div', 'daynav', '<span class="lab">Heute · Mi, 04. Jun</span>'));
    D.APPOINTMENTS.forEach((a) => {
      const st = D.APPT_STATUS[a.status];
      const item = el('button', 'item');
      item.innerHTML = '<span class="time">' + a.time + '</span><span class="av">' + (D.ANIMAL_EMOJI[a.animal] || '🐾') +
        '</span><span class="main"><span class="name">' + a.name + '</span><span class="sub">' + a.reason + '</span></span>' +
        '<span class="appt-tag ' + st.cls + '">' + st.label + '</span>';
      item.onclick = () => alert(a.name + '\n' + a.reason + '\nStatus: ' + st.label);
      view.appendChild(item);
    });
    view.appendChild(el('div', 'divider'));
    const open = el('button', 'btn btn-secondary btn-block btn-sm', 'Kalender in der Web-App öffnen ›');
    open.onclick = () => openWeb('dashboard');
    view.appendChild(open);
  }

  // ---------------- NACHRICHTEN ----------------
  function renderMessages() {
    view.innerHTML = '';
    if (state.openChat) { renderThread(state.openChat); return; }
    const total = Object.values(unreadMap).reduce((a, b) => a + b, 0);
    view.appendChild(el('div', 'section-h', '<span>Konversationen</span>' + (total > 0 ? '<span>' + total + ' ungelesen</span>' : '')));
    D.CONVERSATIONS.forEach((c) => {
      const msgs = store[c.id]; const last = msgs[msgs.length - 1];
      const lastText = last ? (last.type === 'note' ? 'Abschlussnotiz' : last.text) : '';
      const item = el('button', 'item');
      item.innerHTML = '<span class="av">' + (D.ANIMAL_EMOJI[c.animal] || '🐾') + '</span><span class="main"><span class="name">' + c.owner +
        '</span><span class="sub">' + lastText + '</span></span>' + (unreadMap[c.id] > 0 ? '<span class="unread">' + unreadMap[c.id] + '</span>' : '');
      item.onclick = () => { state.openChat = c.id; unreadMap[c.id] = 0; renderMessages(); renderMini(); };
      view.appendChild(item);
    });
  }

  function renderThread(id) {
    const c = D.CONVERSATIONS.find((x) => x.id === id);
    const back = el('button', 'back', '‹ Nachrichten');
    back.onclick = () => { state.openChat = null; renderMessages(); };
    view.appendChild(back);
    view.appendChild(el('div', 'section-h', '<span>' + c.owner + ' · ' + (D.ANIMAL_LABEL[c.animal] || '') + '</span>'));
    const scroll = el('div', 'chat-scroll');
    store[id].forEach((m) => {
      if (m.type === 'note') { scroll.appendChild(el('div', 'note-box', '<div class="lab">Abschlussnotiz</div>' + m.text)); return; }
      const row = el('div', 'bubble-row' + (m.from === 'clinic' ? ' me' : ''));
      row.appendChild(el('div', 'bubble ' + m.from, m.text));
      scroll.appendChild(row);
    });
    view.appendChild(scroll);

    const quick = el('div', 'quick');
    ['Gerne, kommen Sie vorbei.', 'Bitte kurz anrufen.', 'Wir melden uns gleich.'].forEach((q) => {
      const b = el('button', 'qr', q);
      b.onclick = () => sendReply(id, q);
      quick.appendChild(b);
    });
    view.appendChild(quick);

    const compose = el('div', 'compose');
    const input = el('input'); input.placeholder = 'Antwort schreiben …';
    input.onkeydown = (e) => { if (e.key === 'Enter' && input.value.trim()) sendReply(id, input.value.trim()); };
    const send = el('button', 'send', '➤');
    send.onclick = () => { if (input.value.trim()) sendReply(id, input.value.trim()); };
    compose.appendChild(input); compose.appendChild(send);
    view.appendChild(compose);
    setTimeout(() => { scroll.scrollTop = scroll.scrollHeight; input.focus(); }, 0);
  }

  function sendReply(id, text) {
    store[id].push({ from: 'clinic', text, time: 'jetzt' });
    renderThread(id);
  }

  function openWeb(screen) {
    const url = D.WEB_URL + (screen ? '?screen=' + screen : '');
    try { chrome.tabs.create({ url }); } catch { window.open(url, '_blank'); }
  }

  // ---------------- Navigation ----------------
  function setView(v) {
    state.view = v; state.openChat = null;
    [...nav.querySelectorAll('button')].forEach((b) => b.classList.toggle('is-on', b.dataset.view === v));
    if (v === 'status') renderStatus();
    else if (v === 'appts') renderAppts();
    else renderMessages();
  }
  nav.querySelectorAll('button').forEach((b) => { b.onclick = () => setView(b.dataset.view); });

  // Init
  sget((got) => {
    if (got.picked) state.picked = got.picked;
    if (got.expiry) state.expiry = got.expiry;
    renderMini();
    setView('status');
    // Countdown-Ticker
    state.tick = setInterval(() => { if (state.view === 'status') renderStatus(); renderMini(); }, 1000);
  });
})();
