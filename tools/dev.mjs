/* Entwicklung: startet VetNow Hub (8787) + Vite-Dev-Server der Web-App (5199, im WLAN erreichbar).
   Die Web-App leitet /api automatisch an den Hub weiter. Strg+C beendet beides. */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const kids = [
  spawn(process.execPath, ['hub/index.js'], { cwd: ROOT, stdio: 'inherit' }),
  spawn('npm', ['run', 'dev', '--', '--port', '5199', '--host'], { cwd: join(ROOT, 'web'), stdio: 'inherit', shell: true }),
];
const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
setTimeout(() => {
  console.log('\n  VetNow Entwicklung läuft:');
  console.log('   Web-App (Live-Reload): http://localhost:5199/vetnow/' + ips.map((ip) => `  ·  http://${ip}:5199/vetnow/`).join(''));
  console.log('   Kontrollzentrum:       http://localhost:8787/konsole/');
  console.log('   Beenden: Strg+C\n');
}, 2500);
const stop = () => { for (const k of kids) { try { k.kill(); } catch { /* schon beendet */ } } process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const k of kids) k.on('exit', (code) => { if (code) console.log('Ein Teil wurde beendet (Code ' + code + ').'); });
