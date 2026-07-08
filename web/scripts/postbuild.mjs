/* GitHub-Pages-SPA-Fallback: 404.html = index.html, damit /vetnow-app/admin
   direkt aufrufbar ist (Pages kennt sonst nur echte Dateien). */
import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../dist/index.html', import.meta.url), new URL('../dist/404.html', import.meta.url));
console.log('dist/404.html erstellt (SPA-Fallback).');
