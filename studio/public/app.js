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
  { key: 'ollamaModel', cat: 'KI', type: 'text', placeholder: 'z. B. qwen2.5:7b',
    title: 'Vordergrund-Modell (Text)', desc: 'Beantwortet normale Chat-Nachrichten ohne Bild. Bequemer umzustellen im KI-Tab.',
    keywords: 'modell standard default vordergrund text gemma llama qwen bot antworten chat ki auswahl' },
  { key: 'ollamaVisionModel', cat: 'KI', type: 'text', placeholder: 'z. B. llama3.2-vision:11b (leer = aus)',
    title: 'Hintergrund-Modell (Bilder)', desc: 'Übernimmt automatisch, sobald eine Nachricht ein Foto enthält. Leer lassen = Bilderkennung aus; dann meldet die App ehrlich, dass sie das Bild nicht ansehen kann.',
    keywords: 'vision bild bilder foto multimodal hintergrund llava erkennung kamera sehen' },
  { key: 'aiAutoVision', cat: 'KI', type: 'toggle',
    title: 'Automatisch aufs Bild-Modell umschalten', desc: 'An: Bei Nachrichten mit Foto antwortet das Hintergrund-Modell, sonst das Vordergrund-Modell. Aus: Es antwortet immer das Vordergrund-Modell.',
    keywords: 'automatisch umschalten wechseln vision bild modell auto' },
  { key: 'aiTimeoutSec', cat: 'KI', type: 'number', min: 10, max: 600,
    title: 'Zeitlimit Text-Antwort (Sekunden)', desc: 'Nach dieser Zeit wird eine reine Text-Antwort abgebrochen (kleine Server brauchen länger).',
    keywords: 'timeout limit langsam abbrechen warten antwortzeit dauer sekunden text' },
  { key: 'aiVisionTimeoutSec', cat: 'KI', type: 'number', min: 30, max: 900,
    title: 'Zeitlimit Bild-Antwort (Sekunden)', desc: 'Bildverarbeitung auf der CPU dauert deutlich länger — hier lieber großzügig einstellen (Standard 180 s).',
    keywords: 'timeout bild vision langsam cpu warten sekunden limit' },
  { key: 'aiMaxImagePx', cat: 'KI', type: 'number', min: 256, max: 2048,
    title: 'Bild verkleinern auf … Pixel', desc: 'Längste Bildkante, bevor das Foto an die KI geht. Kleiner = schneller und weniger Speicher. Unter 512 leidet die Erkennung.',
    keywords: 'bild größe verkleinern pixel auflösung komprimieren speicher schneller' },
  { key: 'aiTemperature', cat: 'KI', type: 'number', min: 0, max: 2, step: 0.1,
    title: 'Kreativität (temperature)', desc: 'Niedrig = sachlich und vorhersehbar, hoch = fantasievoller. Für medizinische Auskünfte bewusst niedrig (0,3–0,5).',
    keywords: 'temperature kreativität zufall streuung sachlich fantasie modell feineinstellung' },
  { key: 'aiTopP', cat: 'KI', type: 'number', min: 0.1, max: 1, step: 0.05,
    title: 'Wortauswahl (top_p)', desc: 'Wie breit das Modell aus möglichen Wörtern wählt. 0,9 ist ein guter Standard.',
    keywords: 'top_p nucleus wortauswahl vielfalt feineinstellung modell' },
  { key: 'aiNumCtx', cat: 'KI', type: 'number', min: 512, max: 32768,
    title: 'Gedächtnis (num_ctx)', desc: 'Wie viel Gesprächsverlauf das Modell gleichzeitig sieht. Größer = mehr Kontext, aber mehr Arbeitsspeicher.',
    keywords: 'kontext gedächtnis num_ctx verlauf länge speicher token' },
  { key: 'aiRepeatPenalty', cat: 'KI', type: 'number', min: 1, max: 2, step: 0.05,
    title: 'Wiederholungen bremsen (repeat_penalty)', desc: 'Höher = das Modell wiederholt sich seltener. 1,15 hat sich bewährt.',
    keywords: 'wiederholung repeat penalty schleife doppelt feineinstellung' },

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

/* Kuratierter Modell-Katalog für den KI-„Shop".
   Strukturiert statt „alles in einen Satz": `gb` = Download, `ram` = grober
   Arbeitsspeicherbedarf beim Laden, `vision` = versteht Bilder, `stars` = wie
   gut das Modell für diesen Einsatzzweck (Deutsch + Tiermedizin-Chat) ist.

   WICHTIG zur Herkunft der Angaben: Größen und Fähigkeiten stammen aus dem
   Ollama-Katalog und sind Richtwerte. Ob ein installiertes Modell WIRKLICH
   Bilder kann, holt sich das Studio live über /api/ai/model/:name
   (Ollama `capabilities`) — der Katalog ist nur die Vorabinfo vor dem Download. */
const MODEL_CATALOG = [
  // --- Text: Vordergrund ---
  { name: 'qwen2.5:7b', gb: 4.7, ram: 6, cat: 'Text', stars: 5, star: true,
    desc: 'Unsere Empfehlung fürs Textmodell. Sehr gutes Deutsch, hält den Gesprächsfaden und befolgt Anweisungen zuverlässig — genau das, was der Praxis-Chat braucht.' },
  { name: 'qwen2.5:3b', gb: 1.9, ram: 3, cat: 'Text', stars: 4,
    desc: 'Die kompakte Variante derselben Familie: spürbar schneller, sprachlich noch gut. Sinnvoll, wenn der Server gleichzeitig ein Vision-Modell stemmen muss.' },
  { name: 'gemma2:9b', gb: 5.4, ram: 8, cat: 'Text', stars: 4,
    desc: 'Google Gemma 2 in groß — sehr saubere Formulierungen, dafür langsamer als qwen2.5:7b.' },
  { name: 'mistral:7b', gb: 4.1, ram: 6, cat: 'Text', stars: 3,
    desc: 'Solider Allrounder. Deutsch ist ordentlich, aber schwächer als bei den qwen-Modellen.' },
  { name: 'gemma2:2b', gb: 1.6, ram: 3, cat: 'Text', stars: 3,
    desc: 'Klein und flott mit erstaunlich gutem Deutsch. Gute Wahl für schwache Server.' },
  { name: 'llama3.2:3b', gb: 2.0, ram: 3, cat: 'Text', stars: 3,
    desc: 'Meta Llama 3.2 — brauchbarer Allrounder, im Deutschen etwas hölzern.' },
  { name: 'phi3.5', gb: 2.2, ram: 3, cat: 'Text', stars: 3,
    desc: 'Microsoft Phi-3.5 — klug für seine Größe, antwortet gern knapp.' },
  { name: 'qwen2.5:1.5b', gb: 1.0, ram: 2, cat: 'Text', stars: 2,
    desc: 'Winzig und erstaunlich fähig. Für Tests der Kette, nicht für die Vorführung.' },
  { name: 'llama3.2:1b', gb: 1.3, ram: 2, cat: 'Text', stars: 2,
    desc: 'Sehr schnell, dafür inhaltlich schwach. Nur für ganz schwache Hardware.' },
  { name: 'tinyllama', gb: 0.6, ram: 1, cat: 'Text', stars: 1,
    desc: 'Mini-Modell, um zu prüfen ob die Kette Studio → Ollama überhaupt läuft. Antworten sind bewusst nicht ernst zu nehmen.' },

  // --- Bild: Hintergrund ---
  { name: 'llama3.2-vision:11b', gb: 7.9, ram: 10, vision: true, cat: 'Bild', stars: 5, starVision: true,
    desc: 'Stärkstes Bildverständnis der Kandidaten UND das beste Deutsch davon. Erste Wahl fürs Hintergrund-Modell, wenn Genauigkeit wichtiger ist als Tempo (auf der CPU 30-60 s pro Bild).' },
  { name: 'qwen2.5vl:7b', gb: 6.0, ram: 8, vision: true, cat: 'Bild', stars: 4,
    desc: 'Bild-Variante der qwen-Familie — passt sprachlich zum Textmodell und ist etwas schneller als das 11B-Modell.' },
  { name: 'llava:13b', gb: 8.0, ram: 10, vision: true, cat: 'Bild', stars: 3,
    desc: 'Große LLaVA-Variante als Rückfall. Erkennt viel, formuliert aber oft englisch-lastig.' },
  { name: 'llava:7b', gb: 4.7, ram: 6, vision: true, cat: 'Bild', stars: 2,
    desc: 'Kleine LLaVA. ACHTUNG: Genau dieses Modell ist auf diesem Server beim Laden abgestürzt (Bild-Encoder auf der CPU, dann exit code -1). Erst nach dem CPU-Fix erneut versuchen.' },
  { name: 'moondream', gb: 1.7, ram: 3, vision: true, cat: 'Bild', stars: 2,
    desc: 'Sehr kleines Bildmodell — läuft fast überall und ist schnell, beschreibt aber nur grob und antwortet auf Englisch.' },
];

/* Sterne-Anzeige (kompakt, ohne Bilder) */
function starsHtml(n) {
  const s = Math.max(0, Math.min(5, n || 0));
  return '<span class="stars" title="Eignung für den VetNow-Chat: ' + s + ' von 5">' + '★'.repeat(s) + '<span class="dim">' + '★'.repeat(5 - s) + '</span></span>';
}

const PALETTE = ['#0f9b8e', '#0c7d72', '#2e6f9e', '#16a34a', '#eab308', '#dc2626', '#8a5d05', '#6c7d79', '#7c3aed', '#db2777'];
const EMOJIS = ['🐾', '📱', '🧩', '📦', '🌐', '🚀', '⚙️', '💊', '🏥', '🐶', '🐱', '📊', '🔧', '✨', '🗂️', '🔔', '⚖️', '🦉', '🎓', '🧪'];

let STATE = { hostIp: 'localhost', apps: [], groups: [], settings: {}, server: {}, tab: 'apps', groupId: null };

/* ---- Laufende Modell-Downloads ----
   Bewusst MODUL-GLOBAL und nicht im DOM: render() setzt `#view.innerHTML = ''`
   und hat damit früher die Fortschrittsbalken aus dem Dokument geworfen —
   pullModel() schrieb danach in abgehängte Knoten, der Download lief unsichtbar
   weiter. Auslöser waren u. a. ein Tabwechsel, ein zweiter fertiger Download,
   „Als Standard nutzen" und das Löschen eines Modells.
   Jetzt liegt der Zustand hier, die Anzeige liest nur daraus — und das Panel
   selbst hängt außerhalb von #view (siehe index.html). */
const activePulls = new Map(); // name -> { pct, status, phase, done, error, doneAt }
let pullPanelOpen = true;
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

/* Jeder Rerender bekommt eine eigene Nummer. Asynchrone Seiten (renderAi)
   prüfen nach jedem await, ob sie noch die aktuelle sind — sonst befüllten sie
   längst abgehängte Knoten und die Seite blieb leer. */
let renderSeq = 0;

function render() {
  const v = $('view'); v.innerHTML = '';
  const my = ++renderSeq;
  const stillCurrent = () => my === renderSeq && $('view') === v.parentNode ? true : my === renderSeq;
  if (STATE.tab === 'apps') renderGroups(v);
  else if (STATE.tab === 'group') renderGroupDetail(v, STATE.groupId);
  else if (STATE.tab === 'ai') renderAi(v, stillCurrent);
  else if (STATE.tab === 'settings') renderSettings(v);
  else if (STATE.tab === 'system') renderSystem(v);
  renderPullPanel();
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

/* Ein Wort für den Zustand einer App — steuert auch den Farbstreifen links.
   Vorher musste man sich das aus mehreren Pills zusammenreimen. */
function appState(a) {
  const st = a.status || {};
  if (st.busy) return { key: 'busy', label: (st.task || 'Arbeitet') + ' …', color: '#e3a008' };
  if (a.kind === 'expo') return st.running
    ? { key: 'on', label: 'Läuft · Port ' + (st.port || a.expoPort), color: '#16a34a' }
    : { key: 'off', label: 'Gestoppt', color: '#6c7d79' };
  if (a.kind === 'web') return a.built
    ? { key: 'on', label: 'Gebaut & abrufbar', color: '#16a34a' }
    : { key: 'off', label: 'Noch nicht gebaut', color: '#6c7d79' };
  return { key: 'off', label: 'Bereit', color: '#6c7d79' };
}

function renderCard(a) {
  const stt = appState(a);
  const card = el('div', 'card state-' + stt.key);
  card.style.setProperty('--state-color', stt.color);
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

  /* Werkzeugleiste: Logs lassen sich im Browser nur muehsam markieren (sie
     aktualisieren sich alle 1,5 s und scrollen dabei weg). Diese drei Knoepfe
     nehmen einem das ab. */
  const leiste = el('div', 'row');
  leiste.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap';

  const btnKopieren = el('button', 'btn sm', '📋 Alles kopieren');
  const btnDatei    = el('button', 'btn sm', '💾 Als Datei speichern');
  const btnPause    = el('button', 'btn sm', '⏸ Aktualisierung pausieren');
  const btnNurFehler = el('button', 'btn sm', '⚠️ Nur Fehler');
  leiste.append(btnKopieren, btnDatei, btnPause, btnNurFehler);
  body.appendChild(leiste);

  /* Suche im Log — bei mehreren hundert Zeilen findet man die relevante
     Stelle sonst nicht. Filtert live, ohne die Aktualisierung zu stoppen. */
  const suchLeiste = el('div', 'search-bar');
  suchLeiste.appendChild(el('span', null, '🔍'));
  const suche = el('input');
  suche.placeholder = 'Im Log suchen (z. B. „error", „port", Modellname) …';
  suchLeiste.appendChild(suche);
  const treffer = el('div', 'hint'); treffer.style.marginTop = '4px';
  body.append(suchLeiste, treffer);

  const pre = el('div', 'log', 'Lade Logs …'); body.appendChild(pre);
  modalShell(a.name + ' · Logs', body, true);

  let roh = '';
  let pausiert = false;
  let nurFehler = false;
  let alleZeilen = [];

  btnKopieren.onclick = async () => {
    try {
      await navigator.clipboard.writeText(roh);
      btnKopieren.textContent = '✅ Kopiert!';
      setTimeout(() => { btnKopieren.textContent = '📋 Alles kopieren'; }, 1800);
    } catch {
      /* Zwischenablage gesperrt (kein HTTPS): dann wenigstens alles markieren */
      const r = document.createRange();
      r.selectNodeContents(pre);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      btnKopieren.textContent = 'markiert - jetzt Strg+C';
      setTimeout(() => { btnKopieren.textContent = '📋 Alles kopieren'; }, 2500);
    }
  };

  btnDatei.onclick = () => {
    const blob = new Blob([roh], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = el('a');
    link.href = url;
    link.download = a.id + '-log.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  btnPause.onclick = () => {
    pausiert = !pausiert;
    btnPause.textContent = pausiert ? '▶ Aktualisierung fortsetzen' : '⏸ Aktualisierung pausieren';
  };

  /* Zeilen einfärben: Fehler rot, Warnungen gelb, Erfolg/Bereit grün.
     Vorher war ALLES gleich grau — man musste jede Zeile lesen. */
  const stufe = (line) => {
    if (/\b(error|fehler|fail|failed|exception|cannot|denied|refused|exit code [1-9-])/i.test(line)) return 'err';
    if (/\b(warn|warning|deprecat|achtung|hinweis)/i.test(line)) return 'warn';
    if (/\b(success|erfolgreich|fertig|ready|started|listening|built|kompiliert|✅)/i.test(line)) return 'ok';
    return '';
  };

  const zeichne = () => {
    const q = suche.value.trim().toLowerCase();
    let zeilen = alleZeilen;
    if (nurFehler) zeilen = zeilen.filter((l) => stufe(l) === 'err');
    if (q) zeilen = zeilen.filter((l) => l.toLowerCase().includes(q));
    treffer.textContent = (q || nurFehler)
      ? `${zeilen.length} von ${alleZeilen.length} Zeilen` : '';
    pre.innerHTML = zeilen.map((l) => {
      const cls = stufe(l);
      const txt = q ? highlight(l, q) : esc(l);
      return cls ? '<span class="' + cls + '">' + txt + '</span>' : '<span>' + txt + '</span>';
    }).join('\n') || (alleZeilen.length ? '(keine Zeile passt zum Filter)' : '(noch keine Ausgabe)');
    // Nur automatisch nach unten springen, wenn nicht gerade gefiltert wird.
    if (!q && !nurFehler) pre.scrollTop = pre.scrollHeight;
  };
  suche.oninput = zeichne;
  btnNurFehler.onclick = () => {
    nurFehler = !nurFehler;
    btnNurFehler.classList.toggle('primary', nurFehler);
    btnNurFehler.textContent = nurFehler ? '↩︎ Alle Zeilen' : '⚠️ Nur Fehler';
    zeichne();
  };

  const refresh = async () => {
    if (pausiert) return;
    try {
      const d = await api('/api/apps/' + a.id + '/logs');
      alleZeilen = d.lines.map((l) => l.line);
      roh = alleZeilen.join('\n');
      zeichne();
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
//  KI-Seite: Status, Vorder-/Hintergrundmodell, Modell-Browser, Schnelltest
// ============================================================
let aiCache = { status: null, installed: [], running: [], info: {} };
let modelQuery = '';
let modelFilter = 'Alle';

/* Live-Fähigkeiten eines installierten Modells (Ollama /api/show).
   Damit steht „Kann Bilder" nicht mehr hartkodiert im Katalog, sondern kommt
   direkt vom Modell selbst. Ergebnisse werden hier gepuffert. */
async function modelInfo(name) {
  if (aiCache.info[name]) return aiCache.info[name];
  try {
    const d = await api('/api/ai/model/' + encodeURIComponent(name));
    aiCache.info[name] = d;
    return d;
  } catch { return null; }
}

function catalogEntry(name) {
  const base = String(name).replace(/:latest$/, '');
  return MODEL_CATALOG.find((m) => m.name === name || m.name === base || base.startsWith(m.name.split(':')[0] + ':') && m.name === name) || null;
}

/* Kann dieses Modell Bilder? Live-Info schlägt Katalog, Katalog schlägt Namensrat. */
function isVision(name) {
  const info = aiCache.info[name];
  if (info && Array.isArray(info.capabilities) && info.capabilities.length) return !!info.vision;
  const c = catalogEntry(name);
  if (c) return !!c.vision;
  return /vision|llava|vl:|moondream|minicpm-v/i.test(name);
}

async function renderAi(v, stillCurrent) {
  const ok = () => (stillCurrent ? stillCurrent() : true);

  v.appendChild(el('div', null,
    '<div class="page-title">🧠 KI (Ollama)</div>'
    + '<div class="page-sub">Die Modelle laufen LOKAL auf deinem Server — kostenlos, ohne Cloud. '
    + '<b>Vordergrund</b> beantwortet normale Nachrichten, <b>Hintergrund</b> springt automatisch ein, sobald ein Bild im Chat ist.</div>'));

  // ---- Statusleiste: Verbindung + welches Modell wofür ----
  const statusBox = el('div', 'ai-status');
  statusBox.innerHTML = '<span class="ai-dot"></span><div style="flex:1"><b>Prüfe Verbindung…</b></div>';
  v.appendChild(statusBox);

  const slotWrap = el('div', 'slot-grid');
  v.appendChild(slotWrap);

  const runBox = el('div');
  v.appendChild(runBox);

  // ---- Aktionsleiste ----
  const actions = el('div', 'row', '');
  actions.style.margin = '14px 0 4px';
  const browseBtn = el('button', 'btn primary', '🔎 Modelle durchsuchen & installieren');
  browseBtn.onclick = () => modelBrowser();
  const reloadBtn = el('button', 'btn ghost', '↻ Aktualisieren');
  reloadBtn.onclick = () => { aiCache.info = {}; render(); };
  actions.append(browseBtn, reloadBtn);
  v.appendChild(actions);

  const installedWrap = el('div');
  v.appendChild(installedWrap);

  // ---- Schnelltest ----
  const chatBox = el('div', 'ai-chat-box');
  chatBox.innerHTML = '<div style="font-weight:800">💬 Schnelltest</div>'
    + '<div class="hint" style="margin-top:4px">Frage ans Vordergrund-Modell. Mit Bild antwortet automatisch das Hintergrund-Modell — so lässt sich die Bilderkennung ohne App prüfen.</div>';
  const chatRow = el('div', 'row');
  const prompt = el('input', 'input');
  prompt.placeholder = 'z. B. „Mein Hund humpelt, was tun?" — oder Bild wählen und „Was siehst du?"';
  const fileBtn = el('button', 'btn', '🖼 Bild');
  const send = el('button', 'btn primary', 'Senden'); send.style.flex = '0 0 auto';
  const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.style.display = 'none';
  chatRow.append(prompt, fileBtn, send, fileIn);
  chatBox.appendChild(chatRow);
  const picked = el('div', 'hint'); picked.style.display = 'none';
  chatBox.appendChild(picked);
  const answer = el('div', 'ai-answer'); answer.style.display = 'none';
  chatBox.appendChild(answer);
  v.appendChild(chatBox);

  let pickedB64 = null;
  fileBtn.onclick = () => fileIn.click();
  fileIn.onchange = async () => {
    const f = fileIn.files && fileIn.files[0]; fileIn.value = '';
    if (!f) return;
    try {
      const max = parseInt(STATE.settings.aiMaxImagePx, 10) || 1024;
      const r = await shrinkImageFile(f, max);
      pickedB64 = r.base64;
      picked.style.display = 'block';
      picked.innerHTML = `🖼 <b>${esc(f.name)}</b> · auf ${r.w}×${r.h} px verkleinert (${Math.round(r.bytes / 1024)} KB) — <a href="#" id="dropImg">entfernen</a>`;
      picked.querySelector('#dropImg').onclick = (e) => { e.preventDefault(); pickedB64 = null; picked.style.display = 'none'; };
    } catch (e) { toast('Bild konnte nicht gelesen werden: ' + e.message, true); }
  };
  send.onclick = async () => {
    const q = prompt.value.trim();
    if (!q && !pickedB64) return;
    answer.style.display = 'block';
    answer.textContent = pickedB64 ? '⏳ Bild-Modell denkt nach … (auf der CPU dauert das 20-60 s)' : '⏳ Modell denkt nach…';
    send.disabled = true;
    const msg = { role: 'user', content: q || 'Was ist auf diesem Bild zu sehen? Antworte auf Deutsch.' };
    if (pickedB64) msg.images = [pickedB64];
    try {
      const d = await api('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [msg] }),
      });
      const who = d.vnModel ? ` — geantwortet hat: ${d.vnModel}${d.vnVision ? ' (Bild-Modell)' : ''}` : '';
      answer.textContent = (d.message && d.message.content || '(leer)').trim();
      answer.appendChild(el('div', 'hint', esc(who)));
    } catch (e) { answer.textContent = '❌ ' + e.message; }
    send.disabled = false;
  };
  prompt.onkeydown = (e) => { if (e.key === 'Enter') send.onclick(); };

  // ---- Daten laden ----
  let installed = [];
  try {
    const st = await api('/api/ai/status');
    if (!ok()) return;
    aiCache.status = st;
    if (st.ok) {
      statusBox.innerHTML = `<span class="ai-dot ok"></span><div style="flex:1"><b>${esc(st.ollama)}</b> verbunden`
        + `<div class="hint">${esc(st.url)}</div></div>`;
      const md = await api('/api/ai/models');
      if (!ok()) return;
      installed = md.models || [];
      aiCache.installed = installed;
    } else {
      statusBox.innerHTML = `<span class="ai-dot"></span><div style="flex:1"><b>Ollama nicht erreichbar</b>`
        + `<div class="hint">${esc(st.hint || '')}<br>Adresse: ${esc(st.url)} — änderbar unter Einstellungen → KI.</div></div>`;
    }
  } catch (e) {
    if (!ok()) return;
    statusBox.innerHTML = '<span class="ai-dot"></span><div style="flex:1"><b>Studio-API nicht erreichbar</b><div class="hint">' + esc(e.message) + '</div></div>';
  }

  // Fähigkeiten der installierten Modelle live nachladen (für „Kann Bilder")
  await Promise.all(installed.slice(0, 12).map((m) => modelInfo(m.name)));
  if (!ok()) return;

  // ---- Vorder-/Hintergrund-Kacheln ----
  const s = STATE.settings;
  const slot = (title, sub, current, key, filterVision) => {
    const box = el('div', 'slot-card');
    const cur = current || '';
    const info = aiCache.info[cur];
    box.innerHTML = `<div class="slot-title">${title}</div><div class="hint">${sub}</div>`
      + `<div class="slot-model">${cur ? esc(cur) : '<span class="dim">— nicht gesetzt —</span>'}</div>`
      + (info ? `<div class="chip-row">${info.params ? '<span class="mini-chip">' + esc(info.params) + '</span>' : ''}`
        + `${info.quant ? '<span class="mini-chip">' + esc(info.quant) + '</span>' : ''}`
        + `${info.contextLength ? '<span class="mini-chip">' + Math.round(info.contextLength / 1024) + 'k Kontext</span>' : ''}`
        + `${info.vision ? '<span class="mini-chip vis">🖼 Bilder</span>' : ''}</div>` : '');
    const pick = el('select', 'input slim');
    const none = el('option', null, '— kein Modell —'); none.value = ''; pick.appendChild(none);
    installed.forEach((m) => {
      if (filterVision && !isVision(m.name)) return;
      const o = el('option', null, m.name + (isVision(m.name) ? '  🖼' : '')); o.value = m.name;
      if (m.name === cur) o.selected = true;
      pick.appendChild(o);
    });
    if (cur && !installed.some((m) => m.name === cur)) {
      const o = el('option', null, cur + ' (nicht installiert!)'); o.value = cur; o.selected = true; pick.appendChild(o);
    }
    pick.onchange = async () => {
      try {
        await api('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: pick.value }) });
        STATE.settings[key] = pick.value;
        toast(pick.value ? title + ': ' + pick.value : title + ' entfernt.');
        render();
      } catch (e) { toast('Speichern fehlgeschlagen: ' + e.message, true); }
    };
    box.appendChild(pick);
    if (filterVision && !installed.some((m) => isVision(m.name))) {
      box.appendChild(el('div', 'note warn', 'Noch kein Bild-Modell installiert. Über „Modelle durchsuchen" den Filter <b>Kann Bilder</b> nutzen.'));
    }
    return box;
  };
  slotWrap.append(
    slot('🗣️ Vordergrund — Text', 'Beantwortet normale Chat-Nachrichten.', s.ollamaModel, 'ollamaModel', false),
    slot('🖼️ Hintergrund — Bilder', 'Übernimmt automatisch, sobald ein Foto mitkommt.', s.ollamaVisionModel, 'ollamaVisionModel', true),
  );

  // ---- Was ist gerade wirklich geladen? ----
  try {
    const rp = await api('/api/ai/running');
    if (!ok()) return;
    aiCache.running = rp.running || [];
    if (aiCache.running.length) {
      const b = el('div', 'run-box');
      b.innerHTML = '<b>⚡ Gerade im Speicher</b>';
      aiCache.running.forEach((r) => {
        b.appendChild(el('div', 'run-row',
          `<span class="mini-chip on">${esc(r.name)}</span> <span class="hint">${r.sizeGb} GB`
          + (r.vramGb ? ` · davon ${r.vramGb} GB auf der Grafikkarte` : ' · rein auf der CPU') + '</span>'));
      });
      runBox.appendChild(b);
    } else {
      runBox.appendChild(el('div', 'hint', '💤 Aktuell ist kein Modell geladen — das erste Anfragen dauert deshalb etwas länger.'));
    }
  } catch { /* Ollama offline: Statusleiste sagt es bereits */ }

  // ---- Installierte Modelle ----
  if (installed.length) {
    installedWrap.appendChild(el('div', null, '<div class="page-title" style="font-size:16px">📦 Installiert (' + installed.length + ')</div>'));
    const grid = el('div', 'model-grid'); grid.style.marginTop = '10px';
    installed.forEach((m) => {
      grid.appendChild(modelCard(m.name, {
        installed: true, sizeGb: m.sizeGb, info: aiCache.info[m.name], tags: m,
      }));
    });
    installedWrap.appendChild(grid);
  } else if (aiCache.status && aiCache.status.ok) {
    installedWrap.appendChild(el('div', 'empty', 'Noch kein Modell installiert. Auf „Modelle durchsuchen & installieren" tippen.'));
  }
}

/* Eine Modell-Karte — wird für installierte Modelle UND im Browser benutzt. */
function modelCard(name, o) {
  const cat = catalogEntry(name);
  const info = o.info || aiCache.info[name];
  const vision = o.installed ? isVision(name) : !!(cat && cat.vision);
  const isText = name === STATE.settings.ollamaModel;
  const isVis = name === STATE.settings.ollamaVisionModel;
  const gb = o.sizeGb != null ? o.sizeGb : (cat ? cat.gb : null);

  const c = el('div', 'model-card' + (isText || isVis ? ' is-active' : ''));
  const badges = [];
  if (isText) badges.push('<span class="default-badge">Vordergrund ✓</span>');
  if (isVis) badges.push('<span class="default-badge vis">Hintergrund ✓</span>');
  if (o.installed) badges.push('<span class="mini-chip on">installiert</span>');
  if (vision) badges.push('<span class="mini-chip vis">🖼 Kann Bilder</span>');

  c.innerHTML = `<div class="model-name">${esc(name)} ${gb != null ? '<span class="size-badge">' + String(gb).replace('.', ',') + ' GB</span>' : ''}</div>`
    + (cat ? `<div class="model-stars">${starsHtml(cat.stars)} <span class="hint">${cat.ram ? '≈ ' + cat.ram + ' GB RAM' : ''}</span></div>` : '')
    + `<div class="badge-row">${badges.join(' ')}</div>`
    + `<div class="model-desc">${esc(cat ? cat.desc : (info && info.family ? info.family + ' · ' + (info.params || '') : 'Kein Katalog-Eintrag — Angaben kommen direkt von Ollama.'))}</div>`
    + (info ? `<div class="chip-row">${info.params ? '<span class="mini-chip">' + esc(info.params) + '</span>' : ''}`
      + `${info.quant ? '<span class="mini-chip">' + esc(info.quant) + '</span>' : ''}`
      + `${info.contextLength ? '<span class="mini-chip">' + Math.round(info.contextLength / 1024) + 'k Kontext</span>' : ''}`
      + `${info.tools ? '<span class="mini-chip">Werkzeuge</span>' : ''}</div>` : '');

  const row = el('div', 'row wrap');
  if (o.installed) {
    if (!isText) {
      const b = el('button', 'btn sm', '🗣️ Als Vordergrund');
      b.onclick = () => setSlot('ollamaModel', name, 'Vordergrund-Modell');
      row.appendChild(b);
    }
    if (vision && !isVis) {
      const b = el('button', 'btn sm', '🖼️ Als Hintergrund');
      b.onclick = () => setSlot('ollamaVisionModel', name, 'Hintergrund-Modell');
      row.appendChild(b);
    }
    const del = el('button', 'btn danger sm', '🗑');
    del.title = 'Modell vom Server löschen';
    del.onclick = async () => {
      if (!confirm('Modell „' + name + '" vom Server löschen?')) return;
      try {
        await api('/api/ai/models/' + encodeURIComponent(name), { method: 'DELETE' });
        delete aiCache.info[name];
        toast('Modell gelöscht.'); render();
      } catch (e) { toast('Fehler: ' + e.message, true); }
    };
    row.appendChild(del);
  } else {
    const p = activePulls.get(name);
    const btn = el('button', 'btn primary sm', p && !p.done ? '⏳ lädt …' : '⬇ Herunterladen');
    btn.disabled = !!(p && !p.done);
    btn.onclick = () => { pullModel(name); render(); };
    row.appendChild(btn);
  }
  c.appendChild(row);
  return c;
}

async function setSlot(key, name, label) {
  try {
    await api('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: name }) });
    STATE.settings[key] = name;
    toast(label + ': ' + name);
    render();
  } catch (e) { toast('Speichern fehlgeschlagen: ' + e.message, true); }
}

/* ---- Schwebender Modell-Browser mit Suche + Filter-Chips ----
   Gleiches Muster wie die Einstellungs-Suche: Mehrwort-UND-Suche, Treffer
   hervorgehoben, und es wird nur die INNERE Liste neu gezeichnet — nicht die
   ganze Seite. Dadurch bleibt die Tastatureingabe flüssig. */
function modelBrowser() {
  const body = el('div');
  const bar = el('div', 'search-bar');
  bar.appendChild(el('span', null, '🔍'));
  const inp = el('input');
  inp.placeholder = 'Modell suchen — Name oder Beschreibung (z. B. „bilder", „deutsch", „klein") …';
  inp.value = modelQuery;
  inp.oninput = () => { modelQuery = inp.value; draw(); };
  bar.appendChild(inp);
  body.appendChild(bar);

  const FILTERS = ['Alle', 'Empfohlen', 'Installiert', 'Kann Bilder', 'Klein (< 2 GB)'];
  const chips = el('div', 'cat-chips');
  FILTERS.forEach((f) => {
    const b = el('button', 'cat-chip' + (modelFilter === f ? ' is-on' : ''), esc(f));
    b.onclick = () => { modelFilter = f; chips.querySelectorAll('.cat-chip').forEach((x) => x.classList.toggle('is-on', x.textContent === f)); draw(); };
    chips.appendChild(b);
  });
  body.appendChild(chips);

  const hint = el('div', 'hint');
  hint.style.margin = '2px 0 8px';
  hint.innerHTML = 'Die Sterne bewerten die Eignung für den <b>VetNow-Chat</b> (Deutsch + Tiermedizin), nicht die allgemeine Stärke des Modells.';
  body.appendChild(hint);

  const list = el('div', 'model-grid');
  body.appendChild(list);

  const installedNames = new Set((aiCache.installed || []).map((m) => m.name));
  const isInstalled = (n) => installedNames.has(n) || [...installedNames].some((x) => x.split(':latest')[0] === n || x === n + ':latest');

  function matches(m, q) {
    if (!q) return true;
    const hay = (m.name + ' ' + m.desc + ' ' + m.cat + (m.vision ? ' bilder bild vision multimodal foto' : ' text')).toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  }

  function draw() {
    list.innerHTML = '';
    const q = modelQuery.trim();
    const items = MODEL_CATALOG.filter((m) => {
      if (!matches(m, q)) return false;
      if (modelFilter === 'Empfohlen') return m.stars >= 4;
      if (modelFilter === 'Installiert') return isInstalled(m.name);
      if (modelFilter === 'Kann Bilder') return !!m.vision;
      if (modelFilter === 'Klein (< 2 GB)') return m.gb < 2;
      return true;
    });
    if (!items.length) { list.appendChild(el('div', 'empty', 'Nichts gefunden für „' + esc(q) + '".')); return; }
    items.forEach((m) => {
      const card = modelCard(m.name, { installed: isInstalled(m.name), sizeGb: m.gb });
      // Treffer im Namen hervorheben
      if (q) {
        const nameEl = card.querySelector('.model-name');
        if (nameEl) nameEl.innerHTML = nameEl.innerHTML.replace(esc(m.name), highlight(m.name, q));
      }
      list.appendChild(card);
    });
  }
  draw();
  modalShell('🛒 Modelle', body, true);
  setTimeout(() => inp.focus(), 60);
}

// ============================================================
//  Modell-Download: Zustand lebt in activePulls, Anzeige im schwebenden Panel
// ============================================================
async function pullModel(name) {
  if (activePulls.get(name) && !activePulls.get(name).done) return; // läuft schon
  activePulls.set(name, { pct: 0, status: 'Starte Download…', done: false });
  pullPanelOpen = true;
  renderPullPanel();
  try {
    const res = await fetch('/api/ai/pull', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      let msg = 'Download fehlgeschlagen';
      try { msg = (await res.json()).error || msg; } catch { /* kein JSON */ }
      throw new Error(msg);
    }
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
        let d;
        try { d = JSON.parse(line); } catch { continue; }
        if (d.error) throw new Error(d.error);
        const cur = activePulls.get(name) || {};
        if (d.total && d.completed != null) {
          cur.pct = Math.round((d.completed / d.total) * 100);
          cur.status = (d.status || 'lädt') + ' · ' + (d.completed / 1e9).toFixed(1) + ' / ' + (d.total / 1e9).toFixed(1) + ' GB';
        } else if (d.status) {
          cur.status = d.status;
        }
        activePulls.set(name, cur);
        renderPullPanel();
      }
    }
    const cur = activePulls.get(name) || {};
    cur.pct = 100; cur.status = 'Fertig'; cur.done = true; cur.doneAt = Date.now();
    activePulls.set(name, cur);
    toast('Modell „' + name + '" installiert.');
    aiCache.info = {};
    renderPullPanel();
    // Nur die Seite neu zeichnen — laufende Downloads bleiben davon unberührt,
    // weil ihr Zustand nicht mehr im DOM hängt.
    if (STATE.tab === 'ai') render();
  } catch (e) {
    const cur = activePulls.get(name) || {};
    cur.done = true; cur.error = e.message; cur.status = e.message; cur.doneAt = Date.now();
    activePulls.set(name, cur);
    renderPullPanel();
    toast('Download fehlgeschlagen: ' + e.message, true);
  }
}

/* Das Panel hängt außerhalb von #view und wird von render() nie gelöscht. */
function renderPullPanel() {
  const host = $('pullPanel');
  if (!host) return;
  const entries = [...activePulls.entries()].filter(([, p]) => !p.done || Date.now() - (p.doneAt || 0) < 20000);
  if (!entries.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = 'block';
  host.innerHTML = '';

  const head = el('div', 'pp-head');
  const running = entries.filter(([, p]) => !p.done).length;
  head.innerHTML = `<b>⬇ Downloads</b> <span class="hint">${running ? running + ' läuft' : 'fertig'}</span>`;
  const toggle = el('button', 'dot-btn', pullPanelOpen ? '▾' : '▴');
  toggle.onclick = () => { pullPanelOpen = !pullPanelOpen; renderPullPanel(); };
  head.appendChild(toggle);
  host.appendChild(head);

  if (!pullPanelOpen) return;
  entries.forEach(([name, p]) => {
    const row = el('div', 'pp-row');
    row.appendChild(el('div', 'pp-name', esc(name)));
    const bar = el('div', 'progress');
    const fill = el('div'); fill.style.width = (p.pct || 0) + '%';
    if (p.error) fill.style.background = 'var(--red, #dc2626)';
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el('div', 'pp-status' + (p.error ? ' err' : ''), (p.error ? '❌ ' : p.done ? '✅ ' : '') + esc(p.status || '')));
    if (p.done) {
      const x = el('button', 'dot-btn', '✕');
      x.onclick = () => { activePulls.delete(name); renderPullPanel(); };
      row.appendChild(x);
    }
    host.appendChild(row);
  });
}

/* ---- Bild verkleinern (Browser) ----
   Ohne das landen 4-MB-Fotos als ~5,3 MB Base64 im Request und der Server
   antwortet mit HTTP 413. 1024 px Kantenlänge reichen jedem Vision-Modell. */
function shrinkImageFile(file, maxPx) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = cv.toDataURL('image/jpeg', 0.7);
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ base64, dataUrl, w, h, bytes: Math.round(base64.length * 0.75) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kein gültiges Bild')); };
    img.src = url;
  });
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
        const n = el('input', 'input slim'); n.type = 'number'; n.min = s.min; n.max = s.max;
        if (s.step) n.step = s.step;
        n.value = val != null ? val : '';
        n.onchange = () => {
          // Kommazahlen (temperature, top_p, repeat_penalty) würden mit parseInt
          // auf 0 bzw. 1 zusammenfallen — deshalb je nach `step` parsen.
          const raw = s.step ? parseFloat(n.value) : parseInt(n.value, 10);
          const num = Number.isFinite(raw) ? raw : s.min;
          const clamped = Math.max(s.min, Math.min(s.max, num));
          n.value = clamped;
          saveSetting(s.key, clamped);
        };
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
