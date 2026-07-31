/**
 * Tests für den Prozess-Manager — der Kern des „Port ist auf einmal belegt"-
 * Problems.
 *
 * MUSS UNTER LINUX LAUFEN (so wie der Studio-Container). Unter Windows greift
 * ein anderer Weg (taskkill /t), der nie kaputt war.
 *
 * Aufruf (aus dem studio-Ordner, im selben Image wie der Container):
 *   docker run --rm -v "$PWD:/studio" -w /studio -e STUDIO_DATA_DIR=/tmp/sd \
 *     node:22-bookworm node test/proc.test.js
 */
const net = require('net');
const path = require('path');

process.env.STUDIO_DATA_DIR = process.env.STUDIO_DATA_DIR || '/tmp/studio-test-data';
const proc = require('../lib/proc');

let gut = 0;
const fehler = [];
function pruefe(was, bedingung) {
  if (bedingung) { gut++; console.log('  ✓ ' + was); }
  else { fehler.push(was); console.log('  ✗ ' + was); }
}

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));
const HALTER = path.join(__dirname, '_port-halter.js');

function portBelegt(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(true));
    s.once('listening', () => s.close(() => resolve(false)));
    s.listen(port, '0.0.0.0');
  });
}

/** Wartet, bis der Port belegt ist (max. `ms`). */
async function warteBelegt(port, ms = 15000) {
  for (let i = 0; i < ms / 100; i++) {
    if (await portBelegt(port)) return true;
    await schlaf(100);
  }
  return false;
}

/** Wartet, bis der Port frei ist (max. `ms`). */
async function warteFrei(port, ms = 15000) {
  for (let i = 0; i < ms / 100; i++) {
    if (!(await portBelegt(port))) return true;
    await schlaf(100);
  }
  return false;
}

(async () => {
  if (process.platform === 'win32') {
    console.log('Dieser Test prüft das Linux-Verhalten — unter Windows übersprungen.');
    process.exit(0);
  }

  /* ── 1. Der eigentliche Fehler ────────────────────────────────────────────
     Nachstellen, was vorher passierte: nur die oberste PID mit SIGTERM
     beenden. Wenn dieser Test „belegt" meldet, ist der Fehler reproduziert —
     genau das war der Grund für „Port is being used by another process". */
  console.log('\n── 1. Der alte Weg (nur oberste PID) — Fehler nachstellen ──');
  {
    const PORT = 18701;
    const { spawn } = require('child_process');
    const p = spawn('bash', ['-c', `sleep 0.2 && node ${HALTER} ${PORT}`]);
    pruefe('Testaufbau: der Port wird belegt', await warteBelegt(PORT));

    p.kill('SIGTERM');            // exakt das alte Verhalten
    await schlaf(2500);
    const nochBelegt = await portBelegt(PORT);
    pruefe('FEHLER REPRODUZIERT: Port bleibt nach SIGTERM an die Schale belegt', nochBelegt === true);

    // aufräumen, damit der Rest des Tests sauber läuft
    try { process.kill(-p.pid, 'SIGKILL'); } catch { /* egal */ }
    await warteFrei(PORT);
  }

  /* ── 2. Der neue Weg ──────────────────────────────────────────────────── */
  console.log('\n── 2. Der neue Weg (ganze Prozessgruppe) ───────────────────');
  {
    const PORT = 18702;
    const r = await proc.startLongRunning('test-gruppe', {
      cmd: 'bash',
      args: ['-c', `sleep 0.2 && node ${HALTER} ${PORT}`],
      kind: 'test', port: PORT,
    });
    pruefe('Start meldet Erfolg', r.ok === true);
    pruefe('der Port wird belegt', await warteBelegt(PORT));
    pruefe('Status meldet „läuft"', proc.statusOf('test-gruppe').running === true);

    proc.stop('test-gruppe');
    pruefe('BEHOBEN: Port ist nach dem Stoppen wieder frei', await warteFrei(PORT));
    pruefe('Status meldet „läuft nicht" mehr', proc.statusOf('test-gruppe').running === false);
  }

  /* ── 3. Neustart direkt nach dem Stoppen ──────────────────────────────────
     Das ist der Ablauf, an dem es in der Praxis scheiterte: stoppen, dann
     gleich wieder starten. */
  console.log('\n── 3. Stoppen und sofort wieder starten ────────────────────');
  {
    const PORT = 18703;
    const start = () => proc.startLongRunning('test-neustart', {
      cmd: 'bash', args: ['-c', `sleep 0.2 && node ${HALTER} ${PORT}`], kind: 'test', port: PORT,
    });

    await start();
    await warteBelegt(PORT);
    proc.stop('test-neustart');
    await warteFrei(PORT);

    const zweiter = await start();
    pruefe('der zweite Start gelingt (vorher: „Port in use")', zweiter.ok === true);
    pruefe('und der Port ist wieder belegt', await warteBelegt(PORT));
    proc.stop('test-neustart');
    await warteFrei(PORT);
  }

  /* ── 4. Altlast aufräumen ─────────────────────────────────────────────────
     Der Fall des Nutzers JETZT: eine Waise von früher hält den Port noch
     fest. Ein neuer Start muss sie selbst wegräumen — ohne Containerneustart. */
  console.log('\n── 4. Verwaisten Prozess von früher aufräumen ──────────────');
  {
    const PORT = 18704;
    const { spawn } = require('child_process');
    const alt = spawn('bash', ['-c', `node ${HALTER} ${PORT}`], { detached: true });
    alt.unref();
    pruefe('Testaufbau: eine „Leiche" hält den Port', await warteBelegt(PORT));

    const pids = proc._intern.findePortInhaber(PORT);
    pruefe(`der Halter wird über /proc gefunden (PID ${pids.join(', ') || '—'})`, pids.length > 0);

    const r = await proc.startLongRunning('test-altlast', {
      cmd: 'bash', args: ['-c', `sleep 0.2 && node ${HALTER} ${PORT}`], kind: 'test', port: PORT,
    });
    pruefe('der Start räumt den Port frei und gelingt', r.ok === true);
    pruefe('und der neue Prozess hält den Port', await warteBelegt(PORT));

    proc.stop('test-altlast');
    await warteFrei(PORT);
  }

  /* ── 5. stopAll ──────────────────────────────────────────────────────────*/
  console.log('\n── 5. stopAll() beendet wirklich alles ─────────────────────');
  {
    const A = 18705; const B = 18706;
    await proc.startLongRunning('test-a', { cmd: 'bash', args: ['-c', `sleep 0.2 && node ${HALTER} ${A}`], kind: 'test', port: A });
    await proc.startLongRunning('test-b', { cmd: 'bash', args: ['-c', `sleep 0.2 && node ${HALTER} ${B}`], kind: 'test', port: B });
    await warteBelegt(A); await warteBelegt(B);

    proc.stopAll();
    pruefe('Port A ist frei', await warteFrei(A));
    pruefe('Port B ist frei', await warteFrei(B));
  }

  console.log(`\n${gut} Prüfungen bestanden, ${fehler.length} fehlgeschlagen.`);
  if (fehler.length) {
    console.log('\nFehlgeschlagen:');
    fehler.forEach((f) => console.log('  - ' + f));
  }
  process.exit(fehler.length ? 1 : 0);
})();
