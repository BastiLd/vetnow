/* VetNow Studio — Dashboard-Logik (vanilla JS). */
const PALETTE = ['#0f9b8e', '#0c7d72', '#2e6f9e', '#16a34a', '#eab308', '#dc2626', '#8a5d05', '#6c7d79', '#7c3aed', '#db2777'];
const EMOJIS = ['🐾', '📱', '🧩', '📦', '🌐', '🚀', '⚙️', '💊', '🏥', '🐶', '🐱', '📊', '🔧', '✨', '🗂️', '🔔'];

let STATE = { hostIp: 'localhost', apps: [], groups: [] };
let logTimer = null;

const $ = (id) => document.getElementById(id);
function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
async function api(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) { let e = {}; try { e = await r.json(); } catch {} throw new Error(e.error || ('HTTP ' + r.status)); }
  return r.json();
}
function toast(msg, err) { const t = el('div', 'toast' + (err ? ' err' : ''), msg); $('toastHost').appendChild(t); setTimeout(() => t.remove(), 3200); }
function openModal(node, wide) { const m = $('modal'); m.className = 'modal' + (wide ? ' wide' : ''); m.innerHTML = ''; m.appendChild(node); $('modalBg').style.display = 'grid'; }
function closeModal() { $('modalBg').style.display = 'none'; if (logTimer) { clearInterval(logTimer); logTimer = null; } }
$('modalBg').addEventListener('click', (e) => { if (e.target === $('modalBg')) closeModal(); });

function modalShell(title, bodyNode, wide) {
  const wrap = el('div');
  const head = el('div', 'modal-head');
  head.appendChild(el('div', 'modal-title', title));
  const x = el('button', 'dot-btn', '✕'); x.onclick = closeModal; head.appendChild(x);
  wrap.appendChild(head); wrap.appendChild(bodyNode);
  openModal(wrap, wide);
  return wrap;
}

// ---------------- Laden & Rendern ----------------
async function load() {
  try {
    const status = await api('/api/status');
    STATE.hostIp = status.hostIp;
    $('hostChip').textContent = '🖧 ' + status.hostIp + ':' + status.port;
    const data = await api('/api/apps');
    STATE.apps = data.apps; STATE.groups = data.groups;
    render();
  } catch (e) { toast('Laden fehlgeschlagen: ' + e.message, true); }
}

function render() {
  const wrap = $('groupsWrap'); wrap.innerHTML = '';
  const groups = STATE.groups.length ? STATE.groups : [{ id: 'andere', name: 'Apps', color: '#0f9b8e' }];
  const seen = new Set();
  const allGroupIds = groups.map((g) => g.id);
  STATE.apps.forEach((a) => { if (!allGroupIds.includes(a.group)) { groups.push({ id: a.group, name: a.group, color: '#6c7d79' }); allGroupIds.push(a.group); } });

  let total = 0;
  groups.forEach((g) => {
    const apps = STATE.apps.filter((a) => a.group === g.id);
    if (apps.length === 0) return;
    total += apps.length;
    const sec = el('div', 'group');
    const head = el('div', 'group-head');
    const dot = el('span', 'group-dot'); dot.style.background = g.color; head.appendChild(dot);
    head.appendChild(el('span', 'group-name', g.name));
    head.appendChild(el('span', 'group-count', apps.length + (apps.length === 1 ? ' App' : ' Apps')));
    sec.appendChild(head);
    const cards = el('div', 'cards');
    apps.forEach((a) => cards.appendChild(renderCard(a)));
    sec.appendChild(cards);
    wrap.appendChild(sec);
  });
  $('emptyHint').style.display = total === 0 ? 'block' : 'none';
}

function renderCard(a) {
  const card = el('div', 'card');
  const head = el('div', 'card-head');
  const icon = el('span', 'card-icon', a.icon || '📦'); icon.style.background = (a.color || '#0f9b8e') + '22';
  head.appendChild(icon);
  const titleBox = el('div');
  titleBox.appendChild(el('div', 'card-title', a.name));
  titleBox.appendChild(el('div', 'card-kind', a.kind === 'web' ? 'Web-App / PWA' : a.kind === 'expo' ? 'Expo · iPhone' : 'Chrome-Extension'));
  head.appendChild(titleBox);
  const menu = el('div', 'card-menu');
  const dotBtn = el('button', 'dot-btn', '⋯'); dotBtn.onclick = () => editApp(a); menu.appendChild(dotBtn);
  head.appendChild(menu);
  card.appendChild(head);

  const meta = el('div', 'card-meta');
  const st = a.status || {};
  if (a.kind === 'web') {
    meta.appendChild(el('span', 'pill ' + (a.built ? 'built' : 'off'), (a.built ? '● Gebaut' : '○ Noch nicht gebaut')));
    if (st.busy) meta.appendChild(el('span', 'pill busy', '<span class="d"></span>' + st.task + ' …'));
  } else if (a.kind === 'expo') {
    meta.appendChild(el('span', 'pill ' + (st.running ? 'on' : 'off'), '<span class="d"></span>' + (st.running ? 'Läuft · Port ' + (st.port || a.expoPort) : 'Gestoppt')));
    meta.appendChild(el('span', 'pill sdk', 'SDK ' + (a.expoSdk || '?')));
    if (st.busy) meta.appendChild(el('span', 'pill busy', '<span class="d"></span>' + st.task + ' …'));
  }
  if (meta.children.length) card.appendChild(meta);

  if (a.kind === 'web' && a.publicUrl) card.appendChild(el('div', 'url-line', a.publicUrl));
  if (a.kind === 'expo' && a.expUrl) card.appendChild(el('div', 'url-line', a.expUrl));

  const actions = el('div', 'card-actions');
  if (a.kind === 'web') {
    const build = el('button', 'btn primary sm', st.busy ? '⏳ läuft…' : '🔨 Bauen / Aktualisieren'); build.disabled = !!st.busy;
    build.onclick = () => doAction(a, 'build', 'Build gestartet — siehe Logs.');
    const openBtn = el('button', 'btn sm', '🌐 Web öffnen'); openBtn.disabled = !a.built; openBtn.onclick = () => window.open(a.previewUrl, '_blank');
    const phone = el('button', 'btn sm', '📱 Handy-Vorschau'); phone.disabled = !a.built; phone.onclick = () => phonePreview(a);
    const qr = el('button', 'btn sm', '🔳 QR'); qr.onclick = () => qrModal(a.name, a.publicUrl);
    const logs = el('button', 'btn sm', '📜 Logs'); logs.onclick = () => logModal(a);
    actions.append(build, openBtn, phone, qr, logs);
  } else if (a.kind === 'expo') {
    if (st.running) { const stop = el('button', 'btn danger sm', '⏹ Stop'); stop.onclick = () => doAction(a, 'stop', 'Expo gestoppt.'); actions.appendChild(stop); }
    else { const start = el('button', 'btn primary sm', st.busy ? '⏳ läuft…' : '▶ Expo starten'); start.disabled = !!st.busy; start.onclick = () => doAction(a, 'start', 'Expo-Server startet — siehe Logs.'); actions.appendChild(start); }
    const qr = el('button', 'btn sm', '🔳 QR (exp://)'); qr.onclick = () => qrModal(a.name, a.expUrl, 'In Expo Go scannen bzw. „Enter URL manually“.'); actions.appendChild(qr);
    const sdk = el('button', 'btn sm', '⚙️ Expo-Version'); sdk.onclick = () => sdkModal(a); actions.appendChild(sdk);
    const logs = el('button', 'btn sm', '📜 Logs'); logs.onclick = () => logModal(a); actions.appendChild(logs);
  } else if (a.kind === 'extension') {
    const dl = el('button', 'btn primary sm', '⬇ ZIP herunterladen'); dl.onclick = () => window.open(a.zipUrl, '_blank');
    const info = el('button', 'btn sm', 'ℹ️ Anleitung'); info.onclick = () => extInfo();
    actions.append(dl, info);
  }
  card.appendChild(actions);
  return card;
}

// ---------------- Aktionen ----------------
async function doAction(a, action, msg, extra) {
  try {
    await api('/api/apps/' + a.id + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...(extra || {}) }) });
    toast(msg);
    if (action === 'build' || action === 'start' || action === 'set-sdk') setTimeout(() => logModal(a), 400);
    setTimeout(load, 800);
  } catch (e) { toast('Fehler: ' + e.message, true); }
}

// ---------------- Handy-Vorschau ----------------
function phonePreview(a) {
  const body = el('div', 'phone-wrap');
  const phone = el('div', 'phone');
  const iframe = el('iframe'); iframe.src = a.previewUrl; phone.appendChild(iframe);
  body.appendChild(phone);
  body.appendChild(el('div', 'hint', 'Live-Vorschau der Web-App im iPhone-Rahmen. „Web öffnen“ zeigt sie in voller Größe.'));
  modalShell(a.name + ' · Handy-Vorschau', body, true);
}

// ---------------- QR ----------------
function qrModal(name, url, hint) {
  const body = el('div', 'qr-box');
  const img = el('img'); img.src = '/api/qr?text=' + encodeURIComponent(url); body.appendChild(img);
  body.appendChild(el('div', 'url-line', url));
  if (hint) body.appendChild(el('div', 'hint', hint));
  else body.appendChild(el('div', 'hint', 'Mit der iPhone-Kamera scannen, um im selben WLAN zu öffnen.'));
  modalShell(name + ' · QR-Code', body);
}

// ---------------- Logs ----------------
function logModal(a) {
  const body = el('div');
  const pre = el('div', 'log', 'Lade Logs …'); body.appendChild(pre);
  modalShell(a.name + ' · Logs', body, true);
  const refresh = async () => {
    try {
      const d = await api('/api/apps/' + a.id + '/logs');
      pre.innerHTML = d.lines.map((l) => {
        const cls = /error|fehler|fail/i.test(l.line) ? ' class="err"' : '';
        return '<span' + cls + '>' + l.line.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) + '</span>';
      }).join('\n') || '(noch keine Ausgabe)';
      pre.scrollTop = pre.scrollHeight;
    } catch {}
  };
  refresh();
  if (logTimer) clearInterval(logTimer);
  logTimer = setInterval(refresh, 1500);
}

// ---------------- Extension-Info ----------------
function extInfo() {
  const body = el('div');
  body.innerHTML = '<div class="note" style="margin-bottom:12px">So lädst du die Extension in Chrome/Edge/Brave:</div>' +
    '<ol class="hint" style="padding-left:18px;line-height:1.9">' +
    '<li>ZIP herunterladen und entpacken (oder den Ordner <b>extension/</b> aus dem Repo nehmen).</li>' +
    '<li><b>chrome://extensions</b> öffnen.</li>' +
    '<li>Oben rechts <b>Entwicklermodus</b> einschalten.</li>' +
    '<li><b>„Entpackte Erweiterung laden“</b> klicken und den entpackten Ordner wählen.</li>' +
    '<li>Das VetNow-Icon erscheint in der Toolbar.</li></ol>';
  modalShell('Chrome-Extension installieren', body);
}

// ---------------- Expo-SDK wechseln ----------------
function sdkModal(a) {
  const body = el('div');
  body.appendChild(el('div', 'note', 'Wechselt die Expo-SDK-Version dieser App und passt alle Pakete an (npm install + expo install --fix). Dauert 1–3 Minuten.'));
  const f = el('div', 'field'); f.style.marginTop = '14px';
  f.innerHTML = '<label>Neue Expo-SDK-Version</label>';
  const sel = el('select', 'input');
  ['54', '53', '52', '51', '50'].forEach((v) => { const o = el('option', null, 'SDK ' + v); o.value = v; if (v === String(a.expoSdk)) o.selected = true; sel.appendChild(o); });
  f.appendChild(sel); body.appendChild(f);
  const btn = el('button', 'btn primary', 'Version wechseln & anpassen'); btn.style.width = '100%';
  btn.onclick = () => { closeModal(); doAction(a, 'set-sdk', 'SDK-Wechsel gestartet — siehe Logs.', { sdk: sel.value }); };
  body.appendChild(btn);
  modalShell(a.name + ' · Expo-Version', body);
}

// ---------------- App hinzufügen / bearbeiten ----------------
function appForm(existing) {
  const a = existing || { kind: 'web', color: '#0f9b8e', icon: '📦', group: (STATE.groups[0] && STATE.groups[0].id) || 'andere' };
  const body = el('div');
  const mkField = (label, inner) => { const f = el('div', 'field'); f.innerHTML = '<label>' + label + '</label>'; f.appendChild(inner); return f; };
  const nameIn = el('input', 'input'); nameIn.value = a.name || ''; nameIn.placeholder = 'App-Name';
  body.appendChild(mkField('Name', nameIn));

  const groupSel = el('select', 'input');
  (STATE.groups.length ? STATE.groups : [{ id: 'andere', name: 'Apps' }]).forEach((g) => { const o = el('option', null, g.name); o.value = g.id; if (g.id === a.group) o.selected = true; groupSel.appendChild(o); });
  body.appendChild(mkField('Gruppe', groupSel));

  const kindSel = el('select', 'input');
  [['web', 'Web-App / PWA'], ['expo', 'Expo · iPhone-App'], ['extension', 'Chrome-Extension']].forEach(([v, l]) => { const o = el('option', null, l); o.value = v; if (v === a.kind) o.selected = true; kindSel.appendChild(o); });
  body.appendChild(mkField('Typ', kindSel));

  // Farbe
  const swWrap = el('div', 'swatches'); let color = a.color || '#0f9b8e';
  PALETTE.forEach((c) => { const s = el('button', 'swatch' + (c === color ? ' on' : '')); s.style.background = c; s.onclick = () => { color = c; [...swWrap.children].forEach((x, i) => x.className = 'swatch' + (PALETTE[i] === c ? ' on' : '')); }; swWrap.appendChild(s); });
  body.appendChild(mkField('Farbe', swWrap));
  // Icon
  const emWrap = el('div', 'emojis'); let icon = a.icon || '📦';
  EMOJIS.forEach((e) => { const s = el('button', 'emoji-btn' + (e === icon ? ' on' : ''), e); s.onclick = () => { icon = e; [...emWrap.children].forEach((x, i) => x.className = 'emoji-btn' + (EMOJIS[i] === icon ? ' on' : '')); }; emWrap.appendChild(s); });
  body.appendChild(mkField('Icon', emWrap));

  // Kind-spezifische Felder
  const kindBox = el('div');
  const inputs = {};
  function renderKind() {
    kindBox.innerHTML = '';
    const k = kindSel.value;
    const mk = (key, label, val, ph) => { const i = el('input', 'input'); i.value = val || ''; i.placeholder = ph || ''; inputs[key] = i; kindBox.appendChild(mkField(label, i)); };
    if (k === 'web') {
      mk('webDir', 'Projektordner (relativ zum Repo)', a.webDir || 'web', 'web');
      mk('distDir', 'Build-Ausgabeordner', a.distDir || 'dist', 'dist');
      mk('basePath', 'Vorschau-Pfad', a.basePath || '/meine-app/', '/meine-app/');
      mk('buildCmd', 'Build-Befehl', a.buildCmd || 'npm ci && npm run build', 'npm ci && npm run build');
    } else if (k === 'expo') {
      mk('expoDir', 'Projektordner (relativ zum Repo)', a.expoDir || 'mobile', 'mobile');
      mk('expoSdk', 'Expo-SDK', a.expoSdk || '54', '54');
      mk('expoPort', 'Port', a.expoPort || 8081, '8081');
    } else {
      mk('extensionDir', 'Extension-Ordner (relativ zum Repo)', a.extensionDir || 'extension', 'extension');
    }
  }
  kindSel.onchange = renderKind; renderKind();
  body.appendChild(kindBox);

  const actions = el('div', 'row'); actions.style.marginTop = '8px';
  const save = el('button', 'btn primary', existing ? 'Speichern' : 'App hinzufügen');
  save.onclick = async () => {
    const payload = { name: nameIn.value.trim(), group: groupSel.value, color, icon, kind: kindSel.value };
    Object.keys(inputs).forEach((k) => { payload[k] = inputs[k].value.trim(); });
    if (payload.expoPort) payload.expoPort = parseInt(payload.expoPort, 10) || 8081;
    if (!payload.name) { toast('Bitte einen Namen eingeben.', true); return; }
    try {
      if (existing) await api('/api/apps/' + existing.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      else await api('/api/apps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      toast(existing ? 'Gespeichert.' : 'App hinzugefügt.'); closeModal(); load();
    } catch (e) { toast('Fehler: ' + e.message, true); }
  };
  actions.appendChild(save);
  if (existing) {
    const del = el('button', 'btn danger', '🗑 Löschen');
    del.onclick = async () => { if (!confirm('App „' + existing.name + '“ entfernen?')) return; try { await api('/api/apps/' + existing.id, { method: 'DELETE' }); toast('Entfernt.'); closeModal(); load(); } catch (e) { toast('Fehler: ' + e.message, true); } };
    actions.appendChild(del);
  }
  body.appendChild(actions);
  modalShell(existing ? 'App bearbeiten' : 'Neue App', body);
}
function editApp(a) { appForm(a); }

// ---------------- Gruppen verwalten ----------------
function groupsModal() {
  const body = el('div');
  const list = el('div'); body.appendChild(list);
  let groups = STATE.groups.map((g) => ({ ...g }));
  function draw() {
    list.innerHTML = '';
    groups.forEach((g, i) => {
      const rowW = el('div', 'field'); rowW.style.marginBottom = '10px';
      const row = el('div', 'row');
      const name = el('input', 'input'); name.value = g.name; name.oninput = () => { groups[i].name = name.value; };
      const colorPick = el('input'); colorPick.type = 'color'; colorPick.value = g.color; colorPick.style.width = '46px'; colorPick.style.height = '40px'; colorPick.style.border = 'none'; colorPick.style.background = 'transparent'; colorPick.oninput = () => { groups[i].color = colorPick.value; };
      const del = el('button', 'btn danger sm', '✕'); del.style.flex = '0 0 auto'; del.onclick = () => { groups.splice(i, 1); draw(); };
      row.append(name, colorPick, del); rowW.appendChild(row); list.appendChild(rowW);
    });
  }
  draw();
  const add = el('button', 'btn sm', '+ Gruppe'); add.onclick = () => { groups.push({ id: 'g' + Math.random().toString(36).slice(2, 7), name: 'Neue Gruppe', color: '#6c7d79' }); draw(); };
  const save = el('button', 'btn primary'); save.textContent = 'Speichern';
  save.onclick = async () => { try { await api('/api/groups', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groups }) }); toast('Gruppen gespeichert.'); closeModal(); load(); } catch (e) { toast('Fehler: ' + e.message, true); } };
  const bar = el('div', 'row'); bar.style.marginTop = '8px'; bar.append(add, save);
  body.appendChild(bar);
  modalShell('Gruppen verwalten', body);
}

$('btnAddApp').onclick = () => appForm(null);
$('btnGroups').onclick = groupsModal;

load();
setInterval(() => { if ($('modalBg').style.display === 'none') load(); }, 5000);
