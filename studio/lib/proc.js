/* VetNow Studio — Prozess-Manager. Startet/stoppt langlaufende Prozesse
   (z. B. Expo/Metro) und führt einmalige Kommandos aus (Build, SDK-Wechsel),
   mit gepuffertem Log pro App. */
const { spawn } = require('child_process');

const running = {};   // id -> { proc, kind, port, startedAt }
const logs = {};      // id -> [ {t, line} ]  (Ringpuffer)
const oneShot = {};   // id -> { busy, task }

const MAX_LINES = 400;
const isWin = process.platform === 'win32';

function pushLog(id, line) {
  if (!logs[id]) logs[id] = [];
  String(line).split(/\r?\n/).forEach((l) => {
    if (l.length === 0) return;
    logs[id].push({ t: Date.now(), line: l });
  });
  if (logs[id].length > MAX_LINES) logs[id] = logs[id].slice(-MAX_LINES);
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

/* Startet einen langlaufenden Prozess (z. B. expo start). */
function startLongRunning(id, { cmd, args, cwd, env, kind, port }) {
  if (running[id]) return { ok: false, error: 'läuft bereits' };
  clearLogs(id);
  pushLog(id, `$ ${cmd} ${args.join(' ')}`);
  const proc = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, shell: isWin });
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
  try {
    if (isWin) spawn('taskkill', ['/pid', String(r.proc.pid), '/f', '/t']);
    else r.proc.kill('SIGTERM');
  } catch (e) { /* ignore */ }
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
  const proc = spawn(sh, shArgs, { cwd, env: { ...process.env, ...env } });
  proc.stdout.on('data', (d) => pushLog(id, d.toString()));
  proc.stderr.on('data', (d) => pushLog(id, d.toString()));
  proc.on('exit', (code) => { pushLog(id, `[${task} fertig, Code ${code}]`); oneShot[id] = { busy: false, task: null }; });
  proc.on('error', (err) => { pushLog(id, `[Fehler: ${err.message}]`); oneShot[id] = { busy: false, task: null }; });
  return { ok: true };
}

function stopAll() { Object.keys(running).forEach(stop); }

module.exports = { startLongRunning, stop, runOnce, statusOf, getLogs, clearLogs, stopAll };
