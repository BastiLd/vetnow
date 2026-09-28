// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* VetNow — IDs.
   uid('ch') → 'ch-lq3k9x2a7f4m1b'. Präfixe laut Vertrag §4: p-, ch-, m-, ap-, lb-, f- (+ bl- für
   Blockzeiten, op- für Outbox-Einträge, c- für Geräte). 'ch-' mit Bindestrich geht auch.

   Zufall: crypto.getRandomValues, wo vorhanden (Browser, Node, Extension). React Native hat das
   ohne Polyfill nicht — dann Math.random. Ein Zähler dazu garantiert, dass zwei IDs aus
   derselben Millisekunde auf demselben Gerät nie gleich sind. */
let counter = 0;

function randomChars(n) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  let out = '';
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(n);
    c.getRandomValues(buf);
    for (let i = 0; i < n; i++) out += alphabet[buf[i] % 36];
    return out;
  }
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * 36)];
  return out;
}

export function uid(prefix) {
  const p = String(prefix == null ? 'id' : prefix).replace(/-+$/, '');
  counter = (counter + 1) % 1296; // 2 Stellen Base36
  const cnt = counter.toString(36);
  return p + '-' + Date.now().toString(36) + (cnt.length < 2 ? '0' + cnt : cnt) + randomChars(6);
}
