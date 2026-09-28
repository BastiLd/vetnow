/* Handy-App starten: ermittelt die WLAN-Adresse dieses PCs und gibt sie der App als Hub-Adresse mit,
   damit iPhone/Android (Expo Go, SDK 57) sich automatisch mit dem VetNow Hub verbinden.
   Vorher in einem zweiten Fenster „npm run hub" (oder START-VETNOW.bat) starten. */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ip = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal && !/^169\.254\./.test(i.address));
const env = { ...process.env };
if (ip) {
  env.EXPO_PUBLIC_HUB_URL = env.EXPO_PUBLIC_HUB_URL || `http://${ip.address}:8787`;
  env.REACT_NATIVE_PACKAGER_HOSTNAME = env.REACT_NATIVE_PACKAGER_HOSTNAME || ip.address;
  console.log(`\n  Hub-Adresse für das Handy: ${env.EXPO_PUBLIC_HUB_URL}\n  QR-Code gleich unten mit der iPhone-Kamera bzw. in Expo Go (Android) scannen.\n`);
}
spawn('npx', ['expo', 'start', ...process.argv.slice(2)], { cwd: join(ROOT, 'mobile'), stdio: 'inherit', shell: true, env });
