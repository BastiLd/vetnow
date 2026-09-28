// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* VetNow shared — offizieller Einstieg (Vertrag §5: „shared/index.js exportiert alles").
   Web/Handy importieren über den Alias '@shared', die Extension aus ihrer Kopie extension/shared/,
   der Hub über hub/lib/shared.js.
   `export *` auch für den Bot: Was Bot 3.0 zusätzlich exportiert (triage, guardAiReply, …),
   ist damit automatisch hier verfügbar, ohne diese Datei anzufassen. */
export * from './version.js';
export * from './constants.js';
export * from './clock.js';
export * from './format.js';
export * from './status.js';
export * from './filters.js';
export * from './ids.js';
export * from './seed.js';
export * from './chats.js';
export * from './migrate.js';
export * from './ai.js';
export * from './autoreply.js';
export * from './hubclient.js';
export * from './store.js';
export * from './bot/index.js';
export * from './legacyview.js';
