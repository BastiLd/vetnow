/* Smoke-Test: rendert jeden Screen einmal serverseitig — fängt Runtime-Fehler
   (fehlende Exporte, undefinierte Komponenten) ohne Browser ab.
   Aufruf: npx vite build --ssr scripts/smoke-ssr.jsx --outDir dist-ssr && node dist-ssr/smoke-ssr.js */
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App.jsx';
import { AdminProvider } from '../src/lib/adminContext.jsx';

const SCREENS = ['home','search','results','detail','request','dashboard','owner-messages','auth','login','register-owner','register-clinic','extension','admin'];

let failed = 0;
for (const s of SCREENS) {
  try {
    const html = renderToString(
      <AdminProvider>
        <App initialScreen={s} initialId={s === 'detail' ? 'drautal' : undefined} />
      </AdminProvider>
    );
    if (!html || html.length < 100) throw new Error('leere Ausgabe');
    console.log(`OK  ${s} (${html.length} Zeichen)`);
  } catch (err) {
    failed++;
    console.error(`FEHLER  ${s}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
