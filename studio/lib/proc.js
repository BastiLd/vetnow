/* VetNow Studio — Prozess-Manager. Startet/stoppt langlaufende Prozesse
   (z. B. Expo/Metro) und führt einmalige Kommandos aus (Build, SDK-Wechsel),
   mit gepuffertem Log pro App.

   ── Warum hier mit Prozessgruppen gearbeitet wird ────────────────────────
   Ein Start sieht in Wirklichkeit so aus:

       bash -c "git fetch … && npm install … && npx expo start --port 8046"
         └─ npm
              └─ npx
                   └─ node (Metro — DER Prozess, der den Port hält)

   Gemerkt wird nur die PID von `bash`. Ein einfaches SIGTERM an diese PID
   beendet die Schale — die bereits gestarteten Kinder bekommen davon nichts
   mit. Metro läuft als Waise weiter, hängt sich an PID 1 und hält den Port
   fest. Der nächste Start meldet dann „Port is being used by another
   process"; weil `npx expo` mit CI=1 nicht nachfragen darf, überspringt es
   den Dev-Server und endet trotzdem mit Code 0 — es sieht also aus, als wäre
   alles in Ordnung, obwohl gar nichts läuft. Genau dieses Verhalten war
   monatelang zu sehen ("geht einmal, danach ist der Port belegt").

   Deshalb:
   • Start unter Linux mit `detached: true` → das Kind wird Anführer einer
     eigenen Prozessgruppe, alle Enkel landen automatisch darin.
   • Stopp per `process.kill(-pid, …)` → das negative Vorzeichen adressiert
     die ganze GRUPPE, nicht nur die Schale. Danach SIGKILL als Nachschlag,
     falls jemand SIGTERM ignoriert.
   • Zusätzlich vor jedem Start: Hält noch eine Leiche von früher den Port
     fest, wird sie gesucht und beendet (sonst müsste man den Container neu
     starten, um wieder starten zu können). */
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const store = require('./store');

const running = {};   // id -> { proc, kind, port, startedAt }
const logs = {};      // id -> [ {t, line} ]  (Ringpuffer)
const oneShot = {};   // id -> { busy, task }

const isWin = process.platform === 'win32';

/* Wie lange darf sich ein Prozess nach SIGTERM Zeit lassen, bevor SIGKILL
   kommt? Metro braucht normalerweise deutlich weniger. */
const KILL_GRACE_MS = 3000;

function maxLines() {
  try { return Math.max(50, parseInt(store.readSettings().logLines, 10) || 400); } catch { return 400; }
}

function pushLog(id, line) {
  if (!logs[id]) logs[id] = [];
  String(line).split(/\r?\n/).forEach((l) => {
    if (l.length === 0) return;
    logs[id].push({ t: Date.now(), line: l });
  });
  const max = maxLines();
  if (logs[id].length > max) logs[id] = logs[id].slice(-max);
}

function getLogs(id) { return logs[id] || []; }
function clearLogs(id) { logs[id] = []; }

function statusOf(id) {
  const r = running[id];
  const o = oneShot[id];
  return {
    running: !!r,
    kind: r ? r.kind : null,
    port: r ? r.port : null,
    startedAt: r ? r.startedAt : null,
    busy: !!(o && o.busy),
    task: o && o.busy ? o.task : null,
  };
}

/* ── Prozessbaum sicher beenden ──────────────────────────────────────────── */

/** Beendet einen Prozess samt aller Kindprozesse. */
function killTree(proc, { onLog } = {}) {
  const pid = proc && proc.pid;
  if (!pid) return;
  const sag = (t) => { try { onLog && onLog(t); } catch { /* egal */ } };

  if (isWin) {
    // /t = mitsamt Kindern, /f = hart. Unter Windows der zuverlässige Weg.
    try { spawn('taskkill', ['/pid', String(pid), '/f', '/t']); } catch { /* egal */ }
    return;
  }

  // Linux/macOS: erst die ganze Gruppe höflich, dann hart.
  let gruppeGetroffen = false;
  try {
    process.kill(-pid, 'SIGTERM');
    gruppeGetroffen = true;
  } catch (e) {
    // ESRCH = Gruppe gibt es nicht (Prozess schon weg oder nie detached
    // gestartet). Dann wenigstens den einzelnen Prozess versuchen.
    if (e && e.code !== 'ESRCH') sag(`[Hinweis: Gruppenstopp nicht möglich: ${e.message}]`);
    try { proc.kill('SIGTERM'); } catch { /* egal */ }
  }

  setTimeout(() => {
    // Läuft nach der Schonfrist immer noch etwas? Dann hart nachlegen.
    try {
      if (gruppeGetroffen) {
        process.kill(-pid, 0);          // wirft, wenn die Gruppe weg ist
        process.kill(-pid, 'SIGKILL');
        sag('[musste hart beendet werden (SIGKILL)]');
      }
    } catch { /* Gruppe ist weg — alles gut */ }
  }, KILL_GRACE_MS).unref();
}

/* ── Belegte Ports aufräumen ─────────────────────────────────────────────── */

/** Ist der Port frei? (Bindet kurz testweise.) */
function portFrei(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '0.0.0.0');
  });
}

/**
 * Welcher Prozess hält den Port? Rein über /proc, damit keine Zusatzwerkzeuge
 * (lsof/fuser/ss) im Container nötig sind — die fehlen in node:22-bookworm.
 *
 * Weg: /proc/net/tcp{,6} liefert zum lauschenden Port die Socket-Inode;
 * die Inode taucht als "socket:[NNN]" unter /proc/<pid>/fd/ wieder auf.
 */
function findePortInhaber(port) {
  if (isWin) return [];
  const inodes = new Set();
  for (const datei of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text;
    try { text = fs.readFileSync(datei, 'utf8'); } catch { continue; }
    for (const zeile of text.split('\n').slice(1)) {
      const f = zeile.trim().split(/\s+/);
      if (f.length < 10) continue;
      const lokal = f[1] || '';
      const zustand = f[3];
      if (zustand !== '0A') continue;              // 0A = LISTEN
      const hexPort = lokal.split(':')[1];
      if (!hexPort || parseInt(hexPort, 16) !== port) continue;
      inodes.add(f[9]);
    }
  }
  if (!inodes.size) return [];

  const pids = new Set();
  let eintraege;
  try { eintraege = fs.readdirSync('/proc'); } catch { return []; }
  for (const name of eintraege) {
    if (!/^\d+$/.test(name)) continue;
    if (name === String(process.pid)) continue;    // uns selbst nie abschießen
    let fds;
    try { fds = fs.readdirSync(`/proc/${name}/fd`); } catch { continue; }
    for (const fd of fds) {
      let ziel;
      try { ziel = fs.readlinkSync(`/proc/${name}/fd/${fd}`); } catch { continue; }
      const m = /^socket:\[(\d+)\]$/.exec(ziel);
      if (m && inodes.has(m[1])) { pids.add(parseInt(name, 10)); break; }
    }
  }
  return [...pids];
}

/**
 * Sorgt dafür, dass `port` benutzbar ist. Räumt Überbleibsel früherer Starts
 * weg (siehe Kopf dieser Datei). Gibt true zurück, wenn der Port am Ende frei
 * ist.
 */
async function portFreiraeumen(port, id) {
  if (!port) return true;
  if (await portFrei(port)) return true;

  const pids = findePortInhaber(port);
  if (!pids.length) {
    pushLog(id, `[Port ${port} ist belegt — der Halter konnte nicht ermittelt werden.]`);
    pushLog(id, '[Wahrscheinlich belegt ihn ein anderes Programm. Auf der App-Karte einen anderen Port eintragen.]');
    return false;
  }

  pushLog(id, `[Port ${port} war noch von einem früheren Start belegt (PID ${pids.join(', ')}) — wird aufgeräumt]`);
  for (const pid of pids) {
    // Erst die Gruppe, dann den einzelnen Prozess — je nachdem, wie er
    // gestartet wurde, greift das eine oder das andere.
    try { process.kill(-pid, 'SIGTERM'); } catch { /* egal */ }
    try { process.kill(pid, 'SIGTERM'); } catch { /* egal */ }
  }

  // Bis zu 5 s auf das Freiwerden warten, sonst hart nachlegen.
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await portFrei(port)) return true;
  }
  for (const pid of pids) {
    try { process.kill(-pid, 'SIGKILL'); } catch { /* egal */ }
    try { process.kill(pid, 'SIGKILL'); } catch { /* egal */ }
  }
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await portFrei(port)) return true;
  }
  pushLog(id, `[Port ${port} lässt sich nicht freiräumen.]`);
  return false;
}

/* ── Start/Stopp ─────────────────────────────────────────────────────────── */

/* Startet einen langlaufenden Prozess (z. B. expo start). */
async function startLongRunning(id, { cmd, args, cwd, env, kind, port }) {
  if (running[id]) return { ok: false, error: 'läuft bereits' };
  clearLogs(id);

  if (port && !(await portFreiraeumen(port, id))) {
    return { ok: false, error: `Port ${port} ist belegt und ließ sich nicht freiräumen. Bitte auf der App-Karte einen anderen Port eintragen.` };
  }

  pushLog(id, `$ ${cmd} ${args.join(' ')}`);
  const proc = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    shell: isWin,
    // Eigene Prozessgruppe: nur so lässt sich später der ganze Baum beenden.
    detached: !isWin,
  });
  running[id] = { proc, kind, port, startedAt: Date.now() };
  proc.stdout.on('data', (d) => pushLog(id, d.toString()));
  proc.stderr.on('data', (d) => pushLog(id, d.toString()));
  proc.on('exit', (code) => { pushLog(id, `[Prozess beendet, Code ${code}]`); delete running[id]; });
  proc.on('error', (err) => { pushLog(id, `[Fehler: ${err.message}]`); delete running[id]; });
  return { ok: true };
}

function stop(id) {
  const r = running[id];
  if (!r) return { ok: false, error: 'läuft nicht' };
  killTree(r.proc, { onLog: (t) => pushLog(id, t) });
  pushLog(id, '[gestoppt]');
  delete running[id];
  return { ok: true };
}

/* Führt ein einmaliges Shell-Kommando aus (Build, git pull, SDK-Wechsel). */
function runOnce(id, { task, shellCmd, cwd, env }) {
  if (oneShot[id] && oneShot[id].busy) return { ok: false, error: 'anderer Vorgang läuft' };
  oneShot[id] = { busy: true, task };
  pushLog(id, `$ ${shellCmd}`);
  const sh = isWin ? 'cmd' : 'sh';
  const shArgs = isWin ? ['/c', shellCmd] : ['-c', shellCmd];
  const proc = spawn(sh, shArgs, {
    cwd,
    env: { ...process.env, ...env },
    // Auch hier eigene Gruppe: ein hängender Build (npm/eas) soll sich mit
    // stopOnce()/stopAll() vollständig beenden lassen.
    detached: !isWin,
  });
  oneShot[id].proc = proc;
  proc.stdout.on('data', (d) => pushLog(id, d.toString()));
  proc.stderr.on('data', (d) => pushLog(id, d.toString()));
  proc.on('exit', (code) => { pushLog(id, `[${task} fertig, Code ${code}]`); oneShot[id] = { busy: false, task: null }; });
  proc.on('error', (err) => { pushLog(id, `[Fehler: ${err.message}]`); oneShot[id] = { busy: false, task: null }; });
  return { ok: true };
}

/** Einmaligen Vorgang (Build o. Ä.) abbrechen. */
function stopOnce(id) {
  const o = oneShot[id];
  if (!o || !o.busy || !o.proc) return { ok: false, error: 'kein Vorgang aktiv' };
  killTree(o.proc, { onLog: (t) => pushLog(id, t) });
  pushLog(id, '[abgebrochen]');
  oneShot[id] = { busy: false, task: null };
  return { ok: true };
}

function stopAll() {
  Object.keys(running).forEach(stop);
  Object.keys(oneShot).forEach((id) => { if (oneShot[id] && oneShot[id].busy) stopOnce(id); });
}

module.exports = {
  startLongRunning, stop, runOnce, stopOnce, statusOf, getLogs, clearLogs, stopAll,
  // für Tests
  _intern: { findePortInhaber, portFrei, portFreiraeumen },
};
