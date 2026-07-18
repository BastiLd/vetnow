/* VetNow Studio 2.0 — Dashboard-Logik (vanilla JS, kein Build). */

// ============================================================
//  Einstellungs-Registry: durchsuchbar nach Titel, BESCHREIBUNG
//  und Stichwörtern (man findet eine Einstellung also auch,
//  wenn man nur weiß, WAS sie tut).
// ============================================================
const SETTINGS_REGISTRY = [
  // --- Darstellung ---
  { key: 'theme', cat: 'Darstellung', type: 'select', options: [['dark', '🌙 Dunkel'], ['light', '☀️ Hell']],
    title: 'Farbschema', desc: 'Dunkles oder helles Design für das ganze Studio.',
    keywords: 'dark light hell dunkel modus theme aussehen farbe design nachtmodus' },
  { key: 'accent', cat: 'Darstellung', type: 'color',
    title: 'Akzentfarbe', desc: 'Hauptfarbe für Buttons, Tabs und Hervorhebungen im Studio.',
    keywords: 'farbe bunt akzent highlight buttons grün teal anpassen personalisieren' },
  { key: 'cardDensity', cat: 'Darstellung', type: 'select', options: [['normal', 'Normal'], ['compact', 'Kompakt']],
    title: 'Kartendichte', desc: 'Kompakt zeigt mehr App-Karten auf einmal (kleinere Abstände).',
    keywords: 'dichte kompakt platz größe karten layout mehr anzeigen übersicht' },
  { key: 'showKindBadges', cat: 'Darstellung', type: 'toggle',
    title: 'Typ-Anzeige auf Karten', desc: 'Zeigt auf jeder App-Karte, ob es eine Web-App, Expo-App oder Extension ist.',
    keywords: 'badge typ label web expo extension anzeigen kennzeichnung' },
  { key: 'groupView', cat: 'Darstellung', type: 'select', options: [['grid', 'Kacheln'], ['list', 'Liste']],
    title: 'Gruppen-Ansicht', desc: 'Gruppen als große Kacheln oder als schmale Liste darstellen.',
    keywords: 'gruppen kacheln liste ansicht layout startseite übersicht' },

  // --- Verhalten ---
  { key: 'autoRefreshSec', cat: 'Verhalten', type: 'number', min: 0, max: 120,
    title: 'Auto-Aktualisierung (Sekunden)', desc: 'Wie oft das Dashboard den Status aller Apps neu lädt. 0 schaltet die automatische Aktualisierung aus.',
    keywords: 'refresh aktualisieren intervall polling neu laden sekunden automatisch status live' },
  { key: 'logLines', cat: 'Verhalten', type: 'number', min: 50, max: 5000,
    title: 'Log-Zeilen pro App', desc: 'Wie viele Protokoll-Zeilen pro App gespeichert werden (ältere fallen raus).',
    keywords: 'logs protokoll zeilen puffer speicher verlauf ausgabe konsole' },
  { key: 'autoOpenLogs', cat: 'Verhalten', type: 'toggle',
    title: 'Logs automatisch öffnen', desc: 'Öffnet das Log-Fenster von selbst, wenn ein Build oder Start losläuft.',
    keywords: 'logs automatisch öffnen build start fortschritt fenster popup anzeigen' },
  { key: 'confirmDelete', cat: 'Verhalten', type: 'toggle',
    title: 'Löschen bestätigen', desc: 'Fragt vor dem Entfernen von Apps sicherheitshalber nach.',
    keywords: 'löschen bestätigen sicherheit nachfrage entfernen schutz versehentlich' },

  // --- KI (Ollama) ---
  { key: 'ollamaUrl', cat: 'KI', type: 'text', placeholder: 'leer = automatisch (HOST_IP:11434)',
    title: 'Ollama-Adresse', desc: 'Wo dein Ollama läuft. Leer lassen = automatisch die Server-IP mit Standard-Port 11434.',
    keywords: 'ollama url adresse server ki modell verbindung port 11434 host endpoint' },
  { key: 'ollamaModel', cat: 'KI', type: 'text', placeholder: 'z. B. gemma2:2b',
    title: 'Standard-KI-Modell', desc: 'Dieses Modell antwortet, wenn die App keinen eigenen Modellnamen mitschickt. Im KI-Tab installieren & wechseln.',
    keywords: 'modell standard default gemma llama qwen bot antworten chat ki auswahl' },
  { key: 'aiTimeoutSec', cat: 'KI', type: 'number', min: 10, max: 600,
    title: 'KI-Antwortzeit-Limit (Sekunden)', desc: 'Nach dieser Zeit wird eine KI-Antwort abgebrochen (kleine Server brauchen länger).',
    keywords: 'timeout limit langsam abbrechen warten antwortzeit dauer sekunden' },

  // --- Updates ---
  { key: 'updateCheckMin', cat: 'Updates', type: 'number', min: 0, max: 1440,
    title: 'Update-Prüfung (Minuten)', desc: 'Wie oft das Studio auf GitHub nach neuen Versionen schaut und den gelben Punkt am System-Tab zeigt. 0 = aus.',
    keywords: 'update prüfen check github neu version automatisch intervall benachrichtigung punkt' },
  { key: 'autoUpdateOnStart', cat: 'Updates', type: 'info',
    title: 'Auto-Update beim Start', desc: 'Der Container zieht bei JEDEM Start automatisch den neuesten Code von GitHub. Ein Neustart der App in ZimaOS = Update. Zusätzlich gibt es im System-Tab den Knopf „Update installieren & neu starten“.',
    keywords: 'automatisch update start neustart container docker zimaos latest aktualisieren git pull' },

  // --- Info (nur Erklärung, durchsuchbar) ---
  { key: '_info_ports', cat: 'Info', type: 'info',
    title: 'Ports des Studios', desc: 'Studio-Oberfläche: Port 3000. Expo-Server: Port 8081 (sauber) und 8082 (Demo). Web-Vorschauen laufen über Port 3000 mit.',
    keywords: 'port 3000 8081 8082 expo weboberfläche erreichbar adresse netzwerk firewall' },
  { key: '_info_data', cat: 'Info', type: 'info',
    title: 'Wo liegen meine Daten?', desc: 'Apps/Gruppen und diese Einstellungen liegen im Daten-Volume (/data). Das Repo liegt unter /repo. Beide überleben Container-Neustarts.',
    keywords: 'daten speicherort volume persistenz backup sichern apps.json settings.json wo gespeichert' },
  { key: '_info_generic', cat: 'Info', type: 'info',
    title: 'Eigene Projekte hinzufügen', desc: 'Über „+ App“ kannst du beliebige Projekte anlegen — auch aus fremden Git-Repos (Feld „Git-Repo-URL“). Ideal, um z. B. eine ganz andere App („Duolingo für Recht“) auf demselben Server zu testen.',
    keywords: 'eigene projekte fremde repos git url andere apps duolingo hinzufügen generisch clone' },
];

// Kuratierter Modell-Katalog für den KI-„Shop“
const MODEL_CATALOG = [
  { name: 'gemma2:2b', size: '1,6 GB', desc: 'Google Gemma 2 — klein, flott, gutes Deutsch. Unsere Empfehlung für den Chat-Bot.', star: true },
  { name: 'llama3.2:1b', size: '1,3 GB', desc: 'Meta Llama 3.2 — sehr schnell, für schwache Hardware.' },
  { name: 'llama3.2:3b', size: '2,0 GB', desc: 'Meta Llama 3.2 — guter Allrounder mit mehr Verständnis.' },
  { name: 'qwen2.5:1.5b', size: '1,0 GB', desc: 'Qwen 2.5 — winzig und erstaunlich fähig.' },
  { name: 'qwen2.5:3b', size: '1,9 GB', desc: 'Qwen 2.5 — stark bei Anweisungen, kompakt.' },
  { name: 'phi3.5', size: '2,2 GB', desc: 'Microsoft Phi-3.5 — klug für seine Größe.' },
  { name: 'mistral:7b', size: '4,1 GB', desc: 'Mistral 7B — deutlich stärker, braucht ~8 GB RAM.' },
  { name: 'gemma2:9b', size: '5,4 GB', desc: 'Gemma 2 9B — sehr gute Qualität, braucht ~10 GB RAM.' },
  { name: 'llava:7b', size: '4,7 GB', desc: 'LLaVA — versteht auch BILDER (multimodal).' },
  { name: 'tinyllama', size: '0,6 GB', desc: 'Mini-Modell zum schnellen Ausprobieren der Kette.' },
];

const PALETTE = ['#0f9b8e', '#0c7d72', '#2e6f9e', '#16a34a', '#eab308', '#dc2626', '#8a5d05', '#6c7d79', '#7c3aed', '#db2777'];
const EMOJIS = ['🐾', '📱', '🧩', '📦', '🌐', '🚀', '⚙️', '💊', '🏥', '🐶', '🐱', '📊', '🔧', '✨', '🗂️', '🔔', '⚖️', '🦉', '🎓', '🧪'];

let STATE = { hostIp: 'localhost', apps: [], groups: [], settings: {}, server: {}, tab: 'apps', groupId: null };
let logTimer = null;
let refreshTimer = null;
let updateTimer = null;

const $ = (id) => document.getElementById(id);
function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
async function api(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) { let e = {}; try { e = await r.json(); } catch { /* leer */ } throw new Error(e.error || ('HTTP ' + r.status)); }
  return r.json();
}
function toast(msg, err) { const t = el('div', 'toast' + (err ? ' err' : ''), esc(msg)); $('toastHost').appendChild(t); setTimeout(() => t.remove(), 3400); }
function openModal(node, wide) { const m = $('modal'); m.className = 'modal' + (wide ? ' wide' : ''); m.innerHTML = ''; m.appendChild(node); $('modalBg').style.display = 'grid'; }
function closeModal() { $('modalBg').style.display = 'none'; if (logTimer) { clearInterval(logTimer); logTimer = null; } }
$('modalBg').addEventListener('click', (e) => { if (e.target === $('modalBg')) closeModal(); });

function modalShell(title, bodyNode, wide) {
  const wrap = el('div');
  const head = el('div', 'modal-head');
  head.appendChild(el('div', 'modal-title', esc(title)));
  const x = el('button', 'dot-btn', '✕'); x.onclick = closeModal; head.appendChild(x);
  wrap.appendChild(head); wrap.appendChild(bodyNode);
  openModal(wrap, wide);
  return wrap;
}

// ============================================================
//  Laden + Darstellung anwenden
// ============================================================
function applyAppearance() {
  const s = STATE.settings;
  document.body.dataset.theme = s.theme === 'light' ? 'light' : 'dark';
  document.body.dataset.density = s.cardDensity === 'compact' ? 'compact' : 'normal';
  document.documentElement.style.setProperty('--accent', s.accent || '#0f9b8e');
}

async function load(soft) {
  try {
    const [status, data, settings] = await Promise.all([api('/api/status'), api('/api/apps'), api('/api/settings')]);
    STATE.hostIp = status.hostIp; STATE.server = status;
    STATE.apps = data.apps; STATE.groups = data.groups;
    STATE.settings = settings;
    applyAppearance();
    $('hostChip').textContent = '🖧 ' + status.hostIp + ':' + status.port + (status.git && status.git.commit ? ' · ' + status.git.commit : '');
    if (!soft || ['apps', 'group'].includes(STATE.tab)) render();
    setupTimers();
  } catch (e) { toast('Laden fehlgeschlagen: ' + e.message, true); }
}

function setupTimers() {
  const sec = parseInt(STATE.settings.autoRefreshSec, 10);
  if (refreshTimer) clearInterval(refreshTimer);
  if (sec > 0) refreshTimer = setInterval(() => { if ($('modalBg').style.display === 'none') load(true); }, sec * 1000);
  const min = parseInt(STATE.settings.updateCheckMin, 10);
  if (updateTimer) clearInterval(updateTimer);
  if (min > 0) { checkUpdateBadge(); updateTimer = setInterval(checkUpdateBadge, min * 60000); }
}

async function checkUpdateBadge() {
  try {
    const d = await api('/api/update/check');
    $('updateDot').style.display = d.ok && d.behind > 0 ? 'block' : 'none';
  } catch { /* egal */ }
}

// ============================================================
//  Tab-Navigation
// ============================================================
document.querySelectorAll('#tabs button').forEach((b) => {
  b.onclick = () => { setTab(b.dataset.tab); };
});
$('brandHome').onclick = () => setTab('apps');

function setTab(tab, groupId) {
  STATE.tab = tab; STATE.groupId = groupId || null;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === tab || (tab === 'group' && b.dataset.tab === 'apps')));
  render();
}

function render() {
  const v = $('view'); v.innerHTML = '';
  if (STATE.tab === 'apps') renderGroups(v);
  else if (STATE.tab === 'group') renderGroupDetail(v, STATE.groupId);
  else if (STATE.tab === 'ai') renderAi(v);
  else if (STATE.tab === 'settings') renderSettings(v);
  else if (STATE.tab === 'system') renderSystem(v);
}

// ============================================================
//  Apps: Gruppen-Übersicht (klickbare Kacheln)
// ============================================================
function groupsWithFallback() {
  const groups = (STATE.groups || []).map((g) => ({ ...g }));
  const ids = new Set(groups.map((g) => g.id));
  STATE.apps.forEach((a) => { if (!ids.has(a.group)) { groups.push({ id: a.group, name: a.group, color: '#6c7d79', icon: '📦' }); ids.add(a.group); } });
  return groups;
}

function renderGroups(v) {
  const head = el('div', 'page-head');
  head.appendChild(el('div', null, '<div class="page-title">🗂️ Deine Projekte</div><div class="page-sub">Auf eine Gruppe tippen, um ihre Apps zu sehen — Studio funktioniert für beliebige Projekte, nicht nur VetNow.</div>'));
  const actions = el('div', 'row');
  const addGroup = el('button', 'btn', '+ Gruppe'); addGroup.onclick = groupsModal;
  const addApp = el('button', 'btn primary', '+ App'); addApp.onclick = () => appForm(null);
  actions.append(addGroup, addApp);
  head.appendChild(actions);
  v.appendChild(head);

  const groups = groupsWithFallback();
  const grid = el('div', 'group-grid');
  if (STATE.settings.groupView === 'list') grid.style.gridTemplateColumns = '1fr';
  let shown = 0;
  groups.forEach((g) => {
    const apps = STATE.apps.filter((a) => a.group === g.id);
    const running = apps.filter((a) => a.status && a.status.running).length;
    const tile = el('button', 'group-tile');
    tile.style.setProperty('--g-color', g.color || '#0f9b8e');
    tile.innerHTML = `
      <span class="g-icon">${esc(g.icon || '📦')}</span>
      <span style="flex:1;min-width:0">
        <span class="g-name">${esc(g.name)}</span>
        <div class="g-desc">${esc(g.description || '')}</div>
        <span class="g-meta">
          <span class="pill built">${apps.length} App${apps.length === 1 ? '' : 's'}</span>
          ${running > 0 ? '<span class="pill on"><span class="d"></span>' + running + ' läuft</span>' : ''}
        </span>
      </span>
      <span class="g-arrow">›</span>`;
    tile.onclick = () => setTab('group', g.id);
    grid.appendChild(tile);
    shown++;
  });
  v.appendChild(grid);
  if (shown === 0) v.appendChild(el('div', 'empty', 'Noch keine Projekte. Lege mit „+ App“ los.'));
}

// ============================================================
//  Apps: Gruppen-Detail (App-Karten)
// ============================================================
function renderGroupDetail(v, groupId) {
  const g = groupsWithFallback().find((x) => x.id === groupId) || { id: groupId, name: groupId, color: '#0f9b8e', icon: '📦' };
  const apps = STATE.apps.filter((a) => a.group === groupId);

  const head = el('div', 'page-head');
  const left = el('div');
  const backBtn = el('button', 'btn ghost sm', '‹ Alle Projekte'); backBtn.onclick = () => setTab('apps');
  left.appendChild(backBtn);
  left.appendChild(el('div', 'page-title', esc(g.icon || '📦') + ' ' + esc(g.name)));
  if (g.description) left.appendChild(el('div', 'page-sub', esc(g.description)));
  head.appendChild(left);
  const addApp = el('button', 'btn primary', '+ App in dieser Gruppe');
  addApp.onclick = () => appForm(null, g.id);
  head.appendChild(addApp);
  v.appendChild(head);

  if (apps.length === 0) { v.appendChild(el('div', 'empty', 'Diese Gruppe hat noch keine Apps.')); return; }
  const cards = el('div', 'cards');
  apps.forEach((a) => cards.appendChild(renderCard(a)));
  v.appendChild(cards);
}

function kindLabel(a) { return a.kind === 'web' ? 'Web-App / PWA' : a.kind === 'expo' ? 'Expo · iPhone' : 'Chrome-Extension'; }

function renderCard(a) {
  const card = el('div', 'card');
  const head = el('div', 'card-head');
  const icon = el('span', 'card-icon', esc(a.icon || '📦')); icon.style.background = (a.color || '#0f9b8e') + '26';
  head.appendChild(icon);
  const titleBox = el('div');
  titleBox.appendChild(el('div', 'card-title', esc(a.name)));
  if (STATE.settings.showKindBadges !== false) titleBox.appendChild(el('div', 'card-kind', kindLabel(a) + (a.repoUrl ? ' · externes Repo' : '')));
  head.appendChild(titleBox);
  const menu = el('div', 'card-menu');
  const dup = el('button', 'dot-btn', '⧉'); dup.title = 'Duplizieren';
  dup.onclick = async () => { try { await api('/api/apps/' + a.id + '/duplicate', { method: 'POST' }); toast('App dupliziert.'); load(); } catch (e) { toast('Fehler: ' + e.message, true); } };
  const edit = el('button', 'dot-btn', '✎'); edit.title = 'Bearbeiten'; edit.onclick = () => appForm(a);
  menu.append(dup, edit);
  head.appendChild(menu);
  card.appendChild(head);

  const meta = el('div', 'card-meta');
  const st = a.status || {};
  if (a.kind === 'web') {
    meta.appendChild(el('span', 'pill ' + (a.built ? 'built' : 'off'), a.built ? '● Gebaut' : '○ Noch nicht gebaut'));
    if (st.busy) meta.appendChild(el('span', 'pill busy', '<span class="d"></span>' + esc(st.task) + ' …'));
  } else if (a.kind === 'expo') {
    meta.appendChild(el('span', 'pill ' + (st.running ? 'on' : 'off'), '<span class="d"></span>' + (st.running ? 'Läuft · Port ' + (st.port || a.expoPort) : 'Gestoppt')));
    meta.appendChild(el('span', 'pill sdk', 'SDK ' + esc(a.expoSdk || '?')));
    if (a.env && Object.keys(a.env).length) meta.appendChild(el('span', 'pill built', 'Env ✓'));
    if (st.busy) meta.appendChild(el('span', 'pill busy', '<span class="d"></span>' + esc(st.task) + ' …'));
  }
  if (meta.children.length) card.appendChild(meta);

  if (a.kind === 'web' && a.publicUrl) card.appendChild(el('div', 'url-line', esc(a.publicUrl)));
  if (a.kind === 'expo' && a.expUrl) card.appendChild(el('div', 'url-line', esc(a.expUrl)));

  const actions = el('div', 'card-actions');
  const maybeLogs = () => { if (STATE.settings.autoOpenLogs !== false) setTimeout(() => logModal(a), 400); };
  if (a.kind === 'web') {
    const build = el('button', 'btn primary sm', st.busy ? '⏳ läuft…' : '🔨 Bauen'); build.disabled = !!st.busy;
    build.onclick = () => doAction(a, 'build', 'Build gestartet.', null, maybeLogs);
    const openBtn = el('button', 'btn sm', '🌐 Öffnen'); openBtn.disabled = !a.built; openBtn.onclick = () => window.open(a.previewUrl, '_blank');
    const phone = el('button', 'btn sm', '📱 Handy'); phone.disabled = !a.built; phone.onclick = () => phonePreview(a);
    const qr = el('button', 'btn sm', '🔳 QR'); qr.onclick = () => qrModal(a.name, a.publicUrl);
    const logs = el('button', 'btn sm', '📜'); logs.title = 'Logs'; logs.onclick = () => logModal(a);
    actions.append(build, openBtn, phone, qr, logs);
  } else if (a.kind === 'expo') {
    if (st.running) { const stop = el('button', 'btn danger sm', '⏹ Stop'); stop.onclick = () => doAction(a, 'stop', 'Expo gestoppt.'); actions.appendChild(stop); }
    else { const start = el('button', 'btn primary sm', st.busy ? '⏳ läuft…' : '▶ Starten'); start.disabled = !!st.busy; start.onclick = () => doAction(a, 'start', 'Expo-Server startet.', null, maybeLogs); actions.appendChild(start); }
    const qr = el('button', 'btn sm', '🔳 QR'); qr.onclick = () => qrModal(a.name, a.expUrl, 'In Expo Go scannen bzw. „Enter URL manually“.'); actions.appendChild(qr);
    const apk = el('button', 'btn sm', st.busy ? '⏳ läuft…' : '📦 APK bauen'); apk.disabled = !!st.busy;
    apk.title = 'Android-APK in der EAS-Cloud bauen — installierbar, läuft überall OHNE WLAN/Server. Einmalige Einrichtung nötig (siehe ANLEITUNG-AUSSERHALB-WLAN.md).';
    apk.onclick = () => doAction(a, 'build-apk', 'APK-Build in der Cloud gestartet — dauert einige Minuten. Der Installations-Link erscheint am Ende in den Logs.', null, () => logModal(a));
    actions.appendChild(apk);
    const sdk = el('button', 'btn sm', '⚙️ Expo-Version'); sdk.onclick = () => sdkModal(a); actions.appendChild(sdk);
    const logs = el('button', 'btn sm', '📜'); logs.title = 'Logs'; logs.onclick = () => logModal(a); actions.appendChild(logs);
  } else if (a.kind === 'extension') {
    const dl = el('button', 'btn primary sm', '⬇ ZIP herunterladen'); dl.onclick = () => window.open(a.zipUrl, '_blank');
    const info = el('button', 'btn sm', 'ℹ️ Anleitung'); info.onclick = extInfo;
    actions.append(dl, info);
  }
  card.appendChild(actions);
  return card;
}

async function doAction(a, action, msg, extra, after) {
  try {
    await api('/api/apps/' + a.id + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...(extra || {}) }) });
    toast(msg);
    if (after) after();
    setTimeout(() => load(true), 800);
  } catch (e) { toast('Fehler: ' + e.message, true); }
}

// ---------- Handy-Vorschau / QR / Logs / Extension / SDK ----------
function phonePreview(a) {
  const body = el('div', 'phone-wrap');
  const phone = el('div', 'phone');
  const iframe = el('iframe'); iframe.src = a.previewUrl; phone.appendChild(iframe);
  body.appendChild(phone);
  body.appendChild(el('div', 'hint', 'Live-Vorschau im iPhone-Rahmen. „Öffnen“ zeigt sie in voller Größe.'));
  modalShell(a.name + ' · Handy-Vorschau', body, true);
}

function qrModal(name, url, hint) {
  const body = el('div', 'qr-box');
  const img = el('img'); img.src = '/api/qr?text=' + encodeURIComponent(url); body.appendChild(img);
  body.appendChild(el('div', 'url-line', esc(url)));
  body.appendChild(el('div', 'hint', hint || 'Mit der iPhone-Kamera scannen (gleiches WLAN).'));
  modalShell(name + ' · QR-Code', body);
}

function logModal(a) {
  const body = el('div');
  const pre = el('div', 'log', 'Lade Logs …'); body.appendChild(pre);
  modalShell(a.name + ' · Logs', body, true);
  const refresh = async () => {
    try {
      const d = await api('/api/apps/' + a.id + '/logs');
      pre.innerHTML = d.lines.map((l) => {
        const cls = /error|fehler|fail/i.test(l.line) ? ' class="err"' : '';
        return '<span' + cls + '>' + esc(l.line) + '</span>';
      }).join('\n') || '(noch keine Ausgabe)';
      pre.scrollTop = pre.scrollHeight;
    } catch { /* egal */ }
  };
  refresh();
  if (logTimer) clearInterval(logTimer);
  logTimer = setInterval(refresh, 1500);
}

function extInfo() {
  const body = el('div');
  body.innerHTML = '<div class="note" style="margin-bottom:12px">So lädst du die Extension in Chrome/Edge/Brave:</div>' +
    '<ol class="hint" style="padding-left:18px;line-height:1.9">' +
    '<li>ZIP herunterladen und entpacken.</li>' +
    '<li><b>chrome://extensions</b> öffnen.</li>' +
    '<li>Oben rechts <b>Entwicklermodus</b> einschalten.</li>' +
    '<li><b>„Entpackte Erweiterung laden“</b> → entpackten Ordner wählen.</li></ol>';
  modalShell('Chrome-Extension installieren', body);
}

function sdkModal(a) {
  const body = el('div');
  body.appendChild(el('div', 'note', 'Wechselt die Expo-SDK-Version dieser App (npm install + expo install --fix). Dauert 1–3 Minuten — Fortschritt in den Logs.'));
  const f = el('div', 'field'); f.style.marginTop = '14px';
  f.innerHTML = '<label>Neue Expo-SDK-Version</label>';
  const sel = el('select', 'input');
  ['54', '53', '52', '51', '50'].forEach((ver) => { const o = el('option', null, 'SDK ' + ver); o.value = ver; if (ver === String(a.expoSdk)) o.selected = true; sel.appendChild(o); });
  f.appendChild(sel); body.appendChild(f);
  const btn = el('button', 'btn primary', 'Version wechseln'); btn.style.width = '100%';
  btn.onclick = () => { closeModal(); doAction(a, 'set-sdk', 'SDK-Wechsel gestartet.', { sdk: sel.value }, () => logModal(a)); };
  body.appendChild(btn);
  modalShell(a.name + ' · Expo-Version', body);
}

// ============================================================
//  App-Formular (generisch, mit externem Git-Repo + Env)
// ============================================================
function appForm(existing, presetGroup) {
  const a = existing || { kind: 'web', color: '#0f9b8e', icon: '📦', group: presetGroup || (STATE.groups[0] && STATE.groups[0].id) || 'andere' };
  const body = el('div');
  const mkField = (label, inner, hint) => {
    const f = el('div', 'field'); f.innerHTML = '<label>' + label + '</label>'; f.appendChild(inner);
    if (hint) f.appendChild(el('div', 'hint', hint));
    return f;
  };
  const nameIn = el('input', 'input'); nameIn.value = a.name || ''; nameIn.placeholder = 'App-Name';
  body.appendChild(mkField('Name', nameIn));

  const groupSel = el('select', 'input');
  groupsWithFallback().forEach((g) => { const o = el('option', null, esc(g.name)); o.value = g.id; if (g.id === a.group) o.selected = true; groupSel.appendChild(o); });
  body.appendChild(mkField('Gruppe', groupSel));

  const kindSel = el('select', 'input');
  [['web', 'Web-App / PWA'], ['expo', 'Expo · iPhone-App'], ['extension', 'Chrome-Extension']].forEach(([val, l]) => { const o = el('option', null, l); o.value = val; if (val === a.kind) o.selected = true; kindSel.appendChild(o); });
  body.appendChild(mkField('Typ', kindSel));

  const repoIn = el('input', 'input'); repoIn.value = a.repoUrl || ''; repoIn.placeholder = 'https://github.com/…/mein-projekt.git (optional)';
  body.appendChild(mkField('Git-Repo-URL', repoIn, 'Leer = Ordner aus dem VetNow-Repo. Mit URL klont das Studio das fremde Repo automatisch — so kannst du beliebige eigene Projekte testen.'));

  const swWrap = el('div', 'swatches'); let color = a.color || '#0f9b8e';
  PALETTE.forEach((c) => { const s = el('button', 'swatch' + (c === color ? ' on' : '')); s.style.background = c; s.onclick = () => { color = c; [...swWrap.children].forEach((x, i) => x.className = 'swatch' + (PALETTE[i] === c ? ' on' : '')); }; swWrap.appendChild(s); });
  body.appendChild(mkField('Farbe', swWrap));
  const emWrap = el('div', 'emojis'); let icon = a.icon || '📦';
  EMOJIS.forEach((e) => { const s = el('button', 'emoji-btn' + (e === icon ? ' on' : ''), e); s.onclick = () => { icon = e; [...emWrap.children].forEach((x, i) => x.className = 'emoji-btn' + (EMOJIS[i] === icon ? ' on' : '')); }; emWrap.appendChild(s); });
  body.appendChild(mkField('Icon', emWrap));

  const kindBox = el('div');
  const inputs = {};
  function renderKind() {
    kindBox.innerHTML = '';
    const k = kindSel.value;
    const mk = (key, label, val, ph, hint) => { const i = el('input', 'input'); i.value = val == null ? '' : val; i.placeholder = ph || ''; inputs[key] = i; kindBox.appendChild(mkField(label, i, hint)); };
    if (k === 'web') {
      mk('webDir', 'Projektordner (im Repo)', a.webDir || 'web', 'web');
      mk('distDir', 'Build-Ausgabeordner', a.distDir || 'dist', 'dist');
      mk('basePath', 'Vorschau-Pfad', a.basePath || '/meine-app/', '/meine-app/', 'Unter dieser Adresse wird die gebaute App serviert (Port 3000).');
      mk('buildCmd', 'Build-Befehl', a.buildCmd || 'npm ci && npm run build', 'npm ci && npm run build');
    } else if (k === 'expo') {
      mk('expoDir', 'Projektordner (im Repo)', a.expoDir || 'mobile', 'mobile');
      mk('expoSdk', 'Expo-SDK', a.expoSdk || '54', '54');
      mk('expoPort', 'Port', a.expoPort || 8081, '8081', 'Jede Expo-App braucht einen eigenen Port (z. B. 8081, 8082, …). Der Port muss in Docker freigegeben sein.');
      const envTa = el('textarea', 'input'); envTa.style.minHeight = '70px';
      envTa.value = Object.entries(a.env || {}).map(([k2, v2]) => k2 + '=' + v2).join('\n');
      envTa.placeholder = 'EXPO_PUBLIC_VN_CLEAN=true';
      inputs._env = envTa;
      kindBox.appendChild(mkField('Umgebungsvariablen (eine pro Zeile)', envTa, 'z. B. EXPO_PUBLIC_VN_CLEAN=true für die saubere Variante.'));
    } else {
      mk('extensionDir', 'Extension-Ordner (im Repo)', a.extensionDir || 'extension', 'extension');
    }
  }
  kindSel.onchange = renderKind; renderKind();
  body.appendChild(kindBox);

  const actions = el('div', 'row'); actions.style.marginTop = '8px';
  const save = el('button', 'btn primary', existing ? 'Speichern' : 'App hinzufügen');
  save.onclick = async () => {
    const payload = { name: nameIn.value.trim(), group: groupSel.value, color, icon, kind: kindSel.value, repoUrl: repoIn.value.trim() };
    Object.keys(inputs).forEach((k) => {
      if (k === '_env') {
        const env = {};
        inputs._env.value.split('\n').forEach((line) => { const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim(); });
        payload.env = env;
      } else payload[k] = inputs[k].value.trim();
    });
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
    del.onclick = async () => {
      if (STATE.settings.confirmDelete !== false && !confirm('App „' + existing.name + '“ entfernen?')) return;
      try { await api('/api/apps/' + existing.id, { method: 'DELETE' }); toast('Entfernt.'); closeModal(); load(); } catch (e) { toast('Fehler: ' + e.message, true); }
    };
    actions.appendChild(del);
  }
  body.appendChild(actions);
  modalShell(existing ? 'App bearbeiten' : 'Neue App', body);
}

// ============================================================
//  Gruppen verwalten
// ============================================================
function groupsModal() {
  const body = el('div');
  const list = el('div'); body.appendChild(list);
  let groups = groupsWithFallback();
  function draw() {
    list.innerHTML = '';
    groups.forEach((g, i) => {
      const rowW = el('div', 'field'); rowW.style.marginBottom = '10px';
      const row = el('div', 'row');
      const iconIn = el('input', 'input slim'); iconIn.value = g.icon || '📦'; iconIn.style.flex = '0 0 58px'; iconIn.oninput = () => { groups[i].icon = iconIn.value; };
      const name = el('input', 'input'); name.value = g.name; name.oninput = () => { groups[i].name = name.value; };
      const colorPick = el('input'); colorPick.type = 'color'; colorPick.value = g.color || '#0f9b8e'; colorPick.style.cssText = 'width:46px;height:40px;border:none;background:transparent;flex:0 0 46px;cursor:pointer';
      colorPick.oninput = () => { groups[i].color = colorPick.value; };
      const del = el('button', 'btn danger sm', '✕'); del.style.flex = '0 0 auto'; del.onclick = () => { groups.splice(i, 1); draw(); };
      row.append(iconIn, name, colorPick, del);
      rowW.appendChild(row);
      const desc = el('input', 'input'); desc.value = g.description || ''; desc.placeholder = 'Beschreibung (optional)'; desc.style.marginTop = '6px';
      desc.oninput = () => { groups[i].description = desc.value; };
      rowW.appendChild(desc);
      list.appendChild(rowW);
    });
  }
  draw();
  const add = el('button', 'btn sm', '+ Gruppe'); add.onclick = () => { groups.push({ id: 'g' + Math.random().toString(36).slice(2, 7), name: 'Neue Gruppe', color: '#6c7d79', icon: '📦' }); draw(); };
  const save = el('button', 'btn primary', 'Speichern');
  save.onclick = async () => { try { await api('/api/groups', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groups }) }); toast('Gruppen gespeichert.'); closeModal(); load(); } catch (e) { toast('Fehler: ' + e.message, true); } };
  const bar = el('div', 'row'); bar.style.marginTop = '8px'; bar.append(add, save);
  body.appendChild(bar);
  modalShell('Gruppen verwalten', body, true);
}

// ============================================================
//  KI-Seite: Ollama-Status, Modell-Shop, Test-Chat
// ============================================================
async function renderAi(v) {
  v.appendChild(el('div', null, '<div class="page-title">🧠 KI (Ollama)</div><div class="page-sub">Modelle laufen LOKAL auf deinem Server — kostenlos, ohne Cloud. Der Chat-Bot der Apps nutzt das hier gewählte Standard-Modell.</div>'));

  const statusBox = el('div', 'ai-status');
  statusBox.innerHTML = '<span class="ai-dot"></span><div style="flex:1"><b>Prüfe Verbindung…</b></div>';
  v.appendChild(statusBox);

  const installedWrap = el('div');
  v.appendChild(installedWrap);

  v.appendChild(el('div', null, '<div class="page-title" style="font-size:16px;margin-top:8px">🛒 Modell-Shop</div><div class="page-sub">Ein Klick lädt das Modell direkt auf deinen Server (über Ollama).</div>'));
  const shop = el('div', 'model-grid');
  v.appendChild(shop);

  const chatBox = el('div', 'ai-chat-box');
  chatBox.innerHTML = '<div style="font-weight:800">💬 Schnelltest</div>';
  const chatRow = el('div', 'row');
  const prompt = el('input', 'input'); prompt.placeholder = 'Frag das Standard-Modell etwas … (z. B. „Mein Hund humpelt, was tun?“)';
  const send = el('button', 'btn primary', 'Senden'); send.style.flex = '0 0 auto';
  chatRow.append(prompt, send);
  chatBox.appendChild(chatRow);
  const answer = el('div', 'ai-answer'); answer.style.display = 'none';
  chatBox.appendChild(answer);
  v.appendChild(chatBox);
  send.onclick = async () => {
    const q = prompt.value.trim(); if (!q) return;
    answer.style.display = 'block'; answer.textContent = '⏳ Modell denkt nach…'; send.disabled = true;
    try {
      const d = await api('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: q }] }) });
      answer.textContent = (d.message && d.message.content || '(leer)').trim();
    } catch (e) { answer.textContent = '❌ ' + e.message; }
    send.disabled = false;
  };
  prompt.onkeydown = (e) => { if (e.key === 'Enter') send.onclick(); };

  // Status + Modelle laden
  let installed = [];
  try {
    const st = await api('/api/ai/status');
    if (st.ok) {
      statusBox.innerHTML = `<span class="ai-dot ok"></span><div style="flex:1"><b>${esc(st.ollama)}</b> verbunden<div class="hint">${esc(st.url)} · Standard-Modell: <b>${esc(st.defaultModel || '—')}</b></div></div>`;
      const md = await api('/api/ai/models');
      installed = md.models || [];
    } else {
      statusBox.innerHTML = `<span class="ai-dot"></span><div style="flex:1"><b>Ollama nicht erreichbar</b><div class="hint">${esc(st.url)} — Läuft Ollama auf dem Server? In ZimaOS installieren/starten, dann hier neu laden. Adresse änderbar unter Einstellungen → KI.</div></div>`;
    }
  } catch { statusBox.innerHTML = '<span class="ai-dot"></span><div style="flex:1"><b>Studio-API nicht erreichbar</b></div>'; }

  // Installierte Modelle
  if (installed.length) {
    const box = el('div');
    box.appendChild(el('div', null, '<div class="page-title" style="font-size:16px">📦 Installierte Modelle</div>'));
    const grid = el('div', 'model-grid'); grid.style.marginTop = '10px';
    installed.forEach((m) => {
      const isDefault = m.name === STATE.settings.ollamaModel;
      const c = el('div', 'model-card');
      c.innerHTML = `<div class="model-name">${esc(m.name)} ${m.sizeGb ? '<span class="size-badge">' + m.sizeGb + ' GB</span>' : ''} ${isDefault ? '<span class="default-badge">Standard ✓</span>' : ''}</div>` +
        `<div class="model-desc">${esc(m.params || '')} ${esc(m.family || '')}</div>`;
      const row = el('div', 'row');
      if (!isDefault) {
        const act = el('button', 'btn primary sm', '⭐ Als Standard nutzen');
        act.onclick = async () => { await api('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ollamaModel: m.name }) }); toast('Standard-Modell: ' + m.name); load(true); render(); };
        row.appendChild(act);
      }
      const del = el('button', 'btn danger sm', '🗑');
      del.onclick = async () => { if (!confirm('Modell „' + m.name + '“ vom Server löschen?')) return; try { await api('/api/ai/models/' + encodeURIComponent(m.name), { method: 'DELETE' }); toast('Modell gelöscht.'); render(); } catch (e) { toast('Fehler: ' + e.message, true); } };
      row.appendChild(del);
      c.appendChild(row);
      grid.appendChild(c);
    });
    box.appendChild(grid);
    installedWrap.appendChild(box);
  }

  // Shop
  const installedNames = new Set(installed.map((m) => m.name.split(':latest')[0]));
  MODEL_CATALOG.forEach((m) => {
    const has = installedNames.has(m.name) || installed.some((x) => x.name.startsWith(m.name));
    const c = el('div', 'model-card');
    c.innerHTML = `<div class="model-name">${m.star ? '⭐ ' : ''}${esc(m.name)} <span class="size-badge">${m.size}</span> ${has ? '<span class="default-badge">installiert</span>' : ''}</div>` +
      `<div class="model-desc">${esc(m.desc)}</div>`;
    const prog = el('div', 'progress'); prog.style.display = 'none'; prog.appendChild(el('div'));
    const progText = el('div', 'hint'); progText.style.display = 'none';
    c.append(prog, progText);
    const btn = el('button', 'btn ' + (has ? '' : 'primary') + ' sm', has ? '↻ Erneut laden' : '⬇ Herunterladen');
    btn.onclick = () => pullModel(m.name, btn, prog, progText);
    c.appendChild(btn);
    shop.appendChild(c);
  });
}

async function pullModel(name, btn, prog, progText) {
  btn.disabled = true; btn.textContent = '⏳ lädt…';
  prog.style.display = 'block'; progText.style.display = 'block'; progText.textContent = 'Starte Download…';
  try {
    const res = await fetch('/api/ai/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error('Ollama nicht erreichbar');
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const d = JSON.parse(line);
          if (d.total && d.completed != null) {
            const pct = Math.round((d.completed / d.total) * 100);
            prog.firstChild.style.width = pct + '%';
            progText.textContent = (d.status || 'lädt') + ' · ' + pct + '% (' + (d.completed / 1e9).toFixed(1) + ' / ' + (d.total / 1e9).toFixed(1) + ' GB)';
          } else if (d.status) progText.textContent = d.status;
          if (d.error) throw new Error(d.error);
        } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
      }
    }
    prog.firstChild.style.width = '100%';
    progText.textContent = '✅ Fertig!';
    toast('Modell „' + name + '“ installiert.');
    setTimeout(() => render(), 900);
  } catch (e) {
    progText.textContent = '❌ ' + e.message;
    btn.disabled = false; btn.textContent = '⬇ Herunterladen';
    toast('Download fehlgeschlagen: ' + e.message, true);
  }
}

// ============================================================
//  Einstellungen: Tabs + Suche über Titel/Beschreibung/Keywords
// ============================================================
let settingsQuery = '';
let settingsCat = 'Alle';
let saveTimer = null;

function highlight(text, q) {
  if (!q) return esc(text);
  const safe = esc(text);
  try {
    const rx = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return safe.replace(rx, '<mark>$1</mark>');
  } catch { return safe; }
}

function renderSettings(v) {
  v.appendChild(el('div', null, '<div class="page-title">⚙️ Einstellungen</div><div class="page-sub">Suche nach Name ODER Funktion — z. B. „dunkel“, „wie oft aktualisieren“, „modell“ oder „port“.</div>'));

  const bar = el('div', 'search-bar');
  bar.appendChild(el('span', null, '🔍'));
  const inp = el('input'); inp.placeholder = 'Einstellung suchen (Name, Beschreibung oder Stichwort) …'; inp.value = settingsQuery;
  inp.oninput = () => { settingsQuery = inp.value; drawList(); };
  bar.appendChild(inp);
  v.appendChild(bar);

  const cats = ['Alle', ...new Set(SETTINGS_REGISTRY.map((s) => s.cat))];
  const chips = el('div', 'cat-chips');
  cats.forEach((c) => {
    const b = el('button', 'cat-chip' + (settingsCat === c ? ' is-on' : ''), esc(c));
    b.onclick = () => { settingsCat = c; render(); };
    chips.appendChild(b);
  });
  v.appendChild(chips);

  const list = el('div', 'settings-list');
  v.appendChild(list);

  function matches(s, q) {
    if (!q) return true;
    const hay = (s.title + ' ' + s.desc + ' ' + s.keywords + ' ' + s.key).toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  }

  function saveSetting(key, value) {
    STATE.settings[key] = value;
    applyAppearance();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { await api('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value }) }); toast('Gespeichert.'); setupTimers(); }
      catch (e) { toast('Speichern fehlgeschlagen: ' + e.message, true); }
    }, 400);
  }

  function drawList() {
    list.innerHTML = '';
    const q = settingsQuery.trim();
    const items = SETTINGS_REGISTRY.filter((s) => (settingsCat === 'Alle' || s.cat === settingsCat) && matches(s, q));
    if (items.length === 0) { list.appendChild(el('div', 'empty', 'Nichts gefunden für „' + esc(q) + '“.')); return; }
    items.forEach((s) => {
      const row = el('div', 'setting-row');
      const main = el('div', 'setting-main');
      main.innerHTML = `<div class="setting-title">${highlight(s.title, q)} <span class="setting-cat">${esc(s.cat)}</span></div><div class="setting-desc">${highlight(s.desc, q)}</div>`;
      row.appendChild(main);
      const ctrl = el('div', 'setting-ctrl');
      const val = STATE.settings[s.key];
      if (s.type === 'toggle') {
        const t = el('button', 'toggle' + (val !== false ? ' on' : ''));
        t.onclick = () => { const nv = !(STATE.settings[s.key] !== false); t.classList.toggle('on', nv); saveSetting(s.key, nv); };
        ctrl.appendChild(t);
      } else if (s.type === 'select') {
        const sel = el('select', 'input slim');
        s.options.forEach(([ov, ol]) => { const o = el('option', null, ol); o.value = ov; if (ov === val) o.selected = true; sel.appendChild(o); });
        sel.onchange = () => saveSetting(s.key, sel.value);
        ctrl.appendChild(sel);
      } else if (s.type === 'number') {
        const n = el('input', 'input slim'); n.type = 'number'; n.min = s.min; n.max = s.max; n.value = val != null ? val : '';
        n.onchange = () => saveSetting(s.key, Math.max(s.min, Math.min(s.max, parseInt(n.value, 10) || 0)));
        ctrl.appendChild(n);
      } else if (s.type === 'text') {
        const t = el('input', 'input'); t.style.width = '220px'; t.placeholder = s.placeholder || ''; t.value = val || '';
        t.onchange = () => saveSetting(s.key, t.value.trim());
        ctrl.appendChild(t);
      } else if (s.type === 'color') {
        const cIn = el('input'); cIn.type = 'color'; cIn.value = val || '#0f9b8e'; cIn.style.cssText = 'width:46px;height:36px;border:none;background:transparent;cursor:pointer';
        cIn.oninput = () => saveSetting(s.key, cIn.value);
        ctrl.appendChild(cIn);
      } // 'info' hat kein Control
      row.appendChild(ctrl);
      list.appendChild(row);
    });
  }
  drawList();
  setTimeout(() => inp.focus(), 50);
}

// ============================================================
//  System-Seite: Version, Update, Infos
// ============================================================
async function renderSystem(v) {
  const s = STATE.server || {};
  const g = s.git || {};
  v.appendChild(el('div', null, '<div class="page-title">🖥️ System & Updates</div><div class="page-sub">Version, Selbst-Update und Infos zum Server.</div>'));

  const grid = el('div', 'kv-grid');
  const kv = (k, val) => { const b = el('div', 'kv-box'); b.innerHTML = `<div class="k">${k}</div><div class="v">${esc(val || '—')}</div>`; return b; };
  const up = s.uptimeSec || 0;
  const uptime = up > 3600 ? Math.floor(up / 3600) + ' h ' + Math.floor((up % 3600) / 60) + ' min' : Math.floor(up / 60) + ' min';
  grid.append(
    kv('Studio-Version', s.version), kv('Code-Stand (Commit)', g.commit + (g.branch ? ' @ ' + g.branch : '')),
    kv('Letzte Änderung', g.lastMsg), kv('Läuft seit', uptime),
    kv('Server-IP', s.hostIp + ':' + s.port), kv('Umgebung', (s.inDocker ? 'Docker-Container' : 'Lokal') + ' · Node ' + (s.node || '')),
  );
  v.appendChild(grid);

  const upBox = el('div', 'ai-chat-box');
  upBox.appendChild(el('div', null, '<b>🔄 Updates</b><div class="hint" style="margin-top:4px">Der Container zieht bei jedem Neustart automatisch den neuesten Code von GitHub (App in ZimaOS neu starten = Update). Hier geht es auch per Klick:</div>'));
  const upStatus = el('div', 'note'); upStatus.textContent = 'Noch nicht geprüft.';
  upBox.appendChild(upStatus);
  const row = el('div', 'row');
  const check = el('button', 'btn', '🔍 Auf Updates prüfen');
  const apply = el('button', 'btn primary', '⬆ Update installieren & neu starten'); apply.disabled = true;
  row.append(check, apply);
  upBox.appendChild(row);
  v.appendChild(upBox);

  check.onclick = async () => {
    check.disabled = true; upStatus.textContent = 'Prüfe…';
    try {
      const d = await api('/api/update/check');
      if (!d.ok) upStatus.textContent = '⚠️ ' + (d.error || 'Prüfung fehlgeschlagen.');
      else if (d.behind > 0) { upStatus.textContent = `🆕 ${d.behind} Update(s) verfügbar — Neuestes: „${d.latestMsg}“`; apply.disabled = false; $('updateDot').style.display = 'block'; }
      else { upStatus.textContent = '✅ Du bist auf dem neuesten Stand.'; $('updateDot').style.display = 'none'; }
    } catch (e) { upStatus.textContent = '⚠️ ' + e.message; }
    check.disabled = false;
  };
  apply.onclick = async () => {
    if (!confirm('Update installieren? Das Studio startet danach neu (laufende Expo-Server stoppen kurz).')) return;
    apply.disabled = true; upStatus.textContent = '⬇ Installiere Update…';
    try {
      const d = await api('/api/update/apply', { method: 'POST' });
      upStatus.textContent = d.restarting ? '♻ Studio startet neu — Seite lädt gleich automatisch…' : '✅ ' + d.note;
      if (d.restarting) setTimeout(() => location.reload(), 15000);
    } catch (e) { upStatus.textContent = '❌ ' + e.message; apply.disabled = false; }
  };

  const links = el('div', 'ai-chat-box');
  links.innerHTML = '<b>🔗 Schnellzugriff</b>';
  const lr = el('div', 'row');
  const gh = el('button', 'btn', '🐙 GitHub-Repo'); gh.onclick = () => window.open('https://github.com/BastiLd/vetnow', '_blank');
  const live = el('button', 'btn', '🌍 Öffentliche Web-App'); live.onclick = () => window.open('https://bastild.github.io/vetnow/', '_blank');
  lr.append(gh, live);
  links.appendChild(lr);
  v.appendChild(links);
}

// Start
load();
