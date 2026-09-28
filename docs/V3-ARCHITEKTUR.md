# VetNow v3 — Architektur & Schnittstellen-Vertrag

> Verbindliche Vorgabe für alle Teile von v3. Wer etwas an einer Schnittstelle ändert,
> ändert zuerst dieses Dokument. Sprache der Oberfläche: Deutsch. Endnutzer:innen werden
> gesiezt ("Bitte prüfen Sie …"), Admin/Test-Center/Studio/Doku duzen. Gender-Doppelpunkt
> (Tierhalter:in). Kommentare im Code auf Deutsch und erklären das *Warum*.

## 1. Ziel

Eine Codebasis, in der **Web (PC + Handy-Browser + PWA), iPhone/Android-App (Expo SDK 57),
Chrome/Edge/Firefox-Extension, Bot und KI** dieselben Daten, dieselbe Bot-Logik und denselben
optionalen Server (**VetNow Hub**) nutzen.

- **Ohne Hub** läuft jede App wie bisher komplett lokal (Offline-Demo-Garantie für die Vorführung).
- **Mit Hub** (PC oder ZimaOS/Studio) sind alle Geräte live synchron: Eine Praxis ändert ihren
  Status in der Extension → das Handy sieht es sofort. Eine Tierhalter:in schickt vom Handy eine
  Anfrage → sie landet live im Praxis-Posteingang (Web-Dashboard + Extension).
- Bot und KI laufen im Hub-Modus **serverseitig** (keine doppelten Antworten von mehreren Geräten).

## 2. Ordner (`vetnow-app/`)

| Ordner | Inhalt | Besitzer (Bau-Phase) |
|---|---|---|
| `shared/` | Reines ESM-JavaScript **ohne Abhängigkeiten, ohne DOM/React/RN**. Einzige Quelle für Daten-Seed, Status-Logik, Filter, Chat-Modell, Store (lokal + Hub-Sync), Hub-Client, KI-Client/Prompts, Auto-Antwort, Uhr, Version, Bot 3.0. | shared-core, shared-bot |
| `hub/` | **VetNow Hub**: Node ≥ 20, nur `node:`-Module (optional `@anthropic-ai/sdk`). Port **8787**. API `/api/v1`, SSE + Long-Poll, JSON-Datei-Speicher, Bot/KI serverseitig, Admin-/Test-Endpunkte, liefert `web/dist` unter `/vetnow/` aus. Auch als Handler ins Studio einhängbar. | hub |
| `web/` | Vite + React 19 PWA. Importiert shared über Alias `@shared`. Neues Admin-/Test-Center in `web/src/admin/`. | web-app, web-design, web-admin |
| `mobile/` | Expo **SDK 57** (RN 0.86, React 19.2). Importiert shared über Metro `watchFolders` + Alias `@shared`. | mobile |
| `extension/` | MV3 (Chrome/Edge/Firefox). Bekommt eine **generierte Kopie** von `shared/` nach `extension/shared/` (`npm run sync:shared`), damit „Entpackt laden" ohne Build geht. | extension |
| `studio/` | Studio hängt den Hub unter `/api/v1` ein. | tooling |
| `tools/` | Node-Skripte: `dev.mjs`, `sync-shared.mjs`, `check.mjs`, `test-all.mjs`, `mobile.mjs`. | tooling |
| `docs/` | Diese Datei, `TESTEN.md`, `CHANGELOG-v3.md`. | tooling |

Ports: **Hub 8787** · Web-Dev 5199 · Studio 3000 · Expo 8081 (sauber) / 8082 (Demo) · Avocado 8083 · Ollama 11434.

## 3. Versionen

`shared/version.js`:
```js
export const APP_VERSION = '3.0.0';
export const PROTOCOL = 3;          // Hub-API-Protokoll
export const DATA_SCHEMA = 3;       // Store-/Speicher-Schema
```
Jeder Client meldet `APP_VERSION` + Plattform an den Hub; das Admin-Center zeigt Abweichungen.

## 4. Datenmodell (Schema 3)

Alle Zeitstempel sind **Millisekunden seit 1970 (`ts`)**, nie Anzeige-Strings. Formatiert wird
beim Rendern (`shared/format.js`). IDs sind Strings (`p-`, `ch-`, `m-`, `ap-`, `lb-`, `f-` + zufällig).

```ts
Practice {
  id, name, district /* Kurzname aus DISTRICTS, z.B. 'Spittal' */, districtLong, address, phone,
  specialties[], animals[], services[], hoursShort, hoursWeek[7] /* Mo..So Anzeige */,
  emergency, emergencyLong, isTestData,
  status: { value: 'green'|'yellow'|'red', setAt: ts|null, expiresAt: ts|null, note?: string },
  absence: { from: ts, to: ts, vertretung?: string } | null,
  profile?: { about, verification, team[], notifications{} , hoursEdit[] },
}
// Effektiver Status (shared/status.js → effectiveStatus(practice, now)):
//   Abwesenheit deckt now ab → 'red'; status.value fehlt oder now > expiresAt → 'grey'; sonst status.value.
// Rangfolge: green 0 < yellow 1 < grey 2 < red 3.
// Einheitliche Labels (ALLE Clients, auch Extension):
//   green  kurz 'Erreichbar'      lang 'Heute erreichbar'
//   yellow kurz 'Rücksprache'     lang 'Nur nach Rücksprache'
//   grey   kurz 'Nicht bestätigt' lang 'Nicht aktuell bestätigt'
//   red    kurz 'Nicht verfügbar' lang 'Heute nicht verfügbar'

Chat {                      // EIN Datensatz pro Unterhaltung, von beiden Seiten gesehen
  id, kind: 'request'|'direct'|'network',
  practiceId,               // die Praxis (bei network: Praxis A)
  peerPracticeId?,          // nur network: Praxis B
  ownerId?, ownerName?,     // Tierhalter:in (request/direct)
  petName?, animal, topic?, // z.B. 'Lahmheit'
  color, icon, labels: string[],
  pinned: { owner?: bool, clinic?: bool },
  unread: { owner: number, clinic: number },
  autoReply: bool,          // Gegenseite wird von Bot/KI simuliert (Demo). false = Mensch-zu-Mensch
  isTestData, createdAt, updatedAt,
  messages: Message[],
}
Message {
  id, ts, from: 'owner'|'clinic'|'system',   // bei network: 'clinic' = practiceId, 'owner' = peerPracticeId (Kolleg:in)
  type: 'text'|'image'|'file'|'note',
  text,
  attachment?: { kind:'image'|'file', name, mime, size, ref, w?, h? },
      // ref: 'data:…' (klein/Legacy) | 'idb:<id>' (Web-IndexedDB) | 'file://…' (Handy, documentDirectory)
      //      | 'hub:<fileId>' (liegt am Hub: GET /api/v1/files/<fileId>)
  source?: 'ai'|'ai-vision'|'bot'|'mock-ai'|'error',   // Stempel '· KI', '· KI · Bild', '· Bot', '· Test-KI', '· Hinweis'
  clientMsgId?, editedAt?, deleted?, deletedAt?,
  reactions?: { owner?: emoji, clinic?: emoji },
  rating?: 1..5,           // Feedback-Sterne der Tierhalter:in nach Abschlussnotiz
  meta?: object,           // Bot-Gedächtnis an Bot-/KI-Nachrichten: { intent, triage, offeredSlots[], asked, booked, fallbackReason }
                           // Store und Hub müssen unbekannte Felder (v. a. meta) unverändert durchreichen und speichern.
}
Label { id, name, color, icon, roles: ('owner'|'clinic')[], seed: bool }
Appointment {
  id, practiceId, date: 'YYYY-MM-DD', time: 'HH:MM', durationMin, name, animal,
  status: 'open'|'confirmed'|'done'|'cancelled', reason, chatId?, note?, isTestData,
}
Block { practiceId, weekday 0..6 (Mo=0), time, end, label }       // Mittagspause, OP-Zeit
Settings {
  botMode: 'ai-fallback'|'ai'|'bot'|'off',  // ai-fallback = KI, bei 'offline' still Bot (Standard)
  typing: bool, greeting: bool, agentEnabled: bool, showLabels: bool,
  enableOwner: bool, enablePosteingang: bool, enableNetwork: bool, hideTestData: bool,
  ai: { provider: 'auto'|'mock'|'ollama'|'anthropic'|'openai', model: '', visionModel: '' },
}
Auth { role: 'owner'|'clinic'|null, name, ownerId?, practiceId? }
      // Demo-Identitäten: Tierhalter:in { ownerId:'owner-demo', name:'Familie Berger' },
      //                   Praxis { practiceId:'drautal', name:'Tierarztpraxis Drautal' }
```

**Sicht pro Rolle** (`shared/chats.js → chatView(chat, auth, practices)`):
- Tierhalter:in sieht `kind in (request, direct)` mit `ownerId === auth.ownerId` (Demo: `owner-demo`).
  Titel = Praxisname, Untertitel = `Bezirk · Tiername (Tierart)`, Rubrik `'owner'` (Meine Tiere).
- Praxis sieht `request/direct` mit `practiceId === auth.practiceId` → Rubrik `'clinic'` (Posteingang),
  Titel = ownerName, Untertitel = `Tiername (Tierart) · topic`; und `network` mit ihrer Praxis als
  practiceId oder peerPracticeId → Rubrik `'network'`, Titel = die andere Praxis.
- `unread`/`pinned` werden pro Seite gelesen (`owner` bzw. `clinic`).
- Welche Seite bin ich in einem Chat? `mySide(chat, auth)`: Tierhalter → 'owner'; Praxis → 'clinic',
  außer network mit `peerPracticeId === auth.practiceId` → 'owner'.

**Seeds** (`shared/seed.js → buildDemoSeed(now)`) — alle Zeiten **relativ zu `now`**, nie fest:
- 18 Praxen (bisherige Daten; `district` auf die 8 Kurznamen normalisiert, `districtLong` behält den Langnamen),
  Status `setAt = now − ageHours`, `expiresAt = setAt + 24 h`; die bisher grauen Praxen bekommen `setAt = now − 30 h`.
- Chats zusammengeführt: ch-o1+ch-c1 → **eine** Unterhaltung Familie Berger ↔ Drautal (Balu), ch-c2/c3/c4 → Drautal,
  ch-o2 → Feldkirchen, ch-o3 → Wörthersee, ch-n1/ch-n2 → Netzwerk Drautal ↔ Wörthersee/Viktring.
- Termine für Drautal: heute ± 7 Tage aus den bisherigen Vorlagen, `chatId` zeigt auf die echten Chat-IDs.
- `buildEmptySeed()` = saubere Version (keine Testdaten, Labels ja).

## 5. Shared-Module (öffentliche API, `shared/index.js` exportiert alles)

```js
// version.js   APP_VERSION, PROTOCOL, DATA_SCHEMA
// constants.js STATUS, STATUS_KEYS, ANIMALS, ANIMAL_LABEL, SERVICE_LABEL, SPECIALTY_LABEL, SPECIALTIES,
//              DISTRICTS, SITUATIONS, APPT_STATUS, CHAT_ROLES, LABELS_SEED, SETTINGS_DEFAULT, DEMO_OWNER, DEMO_PRACTICE_ID
// clock.js     now(), setClockOffset(ms), getClockOffset(), todayISO(now?), isoOf(y,m,d), weekdayMon0(iso), addDays(iso,n)
// format.js    fmtTime(ts), fmtRelative(ts, now), fmtDateLong(iso), fmtDayLabel(iso, now), fmtCountdown(ms), fmtBytes(n)
// status.js    effectiveStatus(p, now), statusInfo(key), confirmedLabel(p, now), expiresIn(p, now), withLiveStatus(practices, now), sortPractices(list, now)
// filters.js   applyFilters(practices, filters, now), EMPTY_FILTERS
// ids.js       uid(prefix)
// seed.js      buildDemoSeed(now), buildEmptySeed(now)
// chats.js     chatView(chat, auth, practices), mySide(chat, auth), visibleChats(state), unreadTotal(state), lastMessage(chat), newMessage({...})
// migrate.js   migrateV1({chats, labels, settings, auth, hideTestData}, now) → Schema-3-Teilzustand (alte localStorage/AsyncStorage-Werte übernehmen)
// ai.js        vetSystemPrompt(persona, practiceName), toAiMessages(messages, persona, {maxTurns:10}), createAiClient({baseUrl, fetch}) → {status(), models(), chat({messages, model, provider, stream, format, signal}), test()}
// autoreply.js shouldAutoReply(chat, lastMsg, settings), personaFor(chat, lastMsg) → 'clinic'|'owner'|'colleague',
//              generateAutoReply({chat, practices, settings, ai /*Client oder null*/, now, signal}) → { messages:[{text, source}], typingMs:number[] }
// hubclient.js createHubClient({baseUrl, fetch, EventSource?, platform, clientName, version}) → {health(), state(), request(method, path, body), subscribe(onEvent, onStatus) → stop, ...}
//              resolveHubCandidates({platform, origin?, hostUri?, envUrl?, saved?}) → string[];  probeHub(url, timeoutMs) → {ok, ms, info}
// store.js     createStore({ storage, platform, flavor:'demo'|'clean', fetch, EventSource?, hubUrl?, now? }) → Store
// bot/index.js botReply({ messages, userText, persona, practiceName, practice?, now? })
//                → { texts: string[], intent, confidence, entities, triage: {level:'none'|'urgent'|'emergency'|'poison', reason}, meta, explain }
//              botGreeting(persona, practiceName), botImageReply(persona, caption?), botConversationReply(...) (Legacy),
//              triage(text) → {level, reason, matched}  (Sicherheitsschicht, läuft VOR Bot-Intents und VOR jeder KI),
//              guardAiReply({ persona, userText, aiText, practice }) → { ok, texts, replaced, reason }  (Nachfilter für KI-Ausgaben:
//                Dosierungen, 'warm halten' bei Hitzschlag, nicht-deutsch, zu lang → durch Bot-Antwort ersetzen),
//              BOT_SUITE, runBotSuite() → { passed, failed, total, results[] }
// generateAutoReply übernimmt `meta` aus botReply in die erzeugten Nachrichten ({ text, source, meta }) und nutzt
// triage() vor der KI: bei Notfall/Gift kommt zuerst sofort die feste Sicherheitsantwort, die KI darf danach ergänzen.
```

### Store (`shared/store.js`) — gemeinsam für Web, Handy und Extension

`storage` ist ein asynchroner Adapter `{ get(key), set(key, value), remove(key), keys?() }`
(Web: localStorage/IndexedDB, Handy: AsyncStorage, Extension: chrome.storage.local, Tests: Map).
Schlüssel-Präfix `vn3:<flavor>:` (demo und clean stören sich nicht mehr). Alte v1-Schlüssel
(`vn_chats_v1`, `vn_labels_v1`, `vn_chat_settings_v2`, `vn_auth`, `vn_hide_testdata`) werden beim ersten Start
einmalig per `migrateV1` übernommen, nicht gelöscht. **Ein Lesefehler darf NIE zum Überschreiben mit Seed führen.**
Chats werden pro Chat gespeichert (`vn3:demo:chat:<id>` + Index), damit keine einzelne Zeile > 2 MB wird.

```js
store.getState() → {
  ready, flavor, mode: 'local'|'hub',
  hub: { status: 'off'|'connecting'|'online'|'offline', url, clientId, latencyMs, lastSyncAt, error, serverVersion },
  auth, settings, practices, chats, labels, appointments, blocks,
  typing: { [chatId]: 'owner'|'clinic'|null }, clockOffsetMs, lastError,
}
store.subscribe(listener) → unsubscribe          // React: useSyncExternalStore
store.actions = {
  login(auth), logout(),
  setSetting(key, value), setAiSetting(key, value),
  confirmStatus(practiceId, value, hours = 24, note?), expireStatus(practiceId), setAbsence(practiceId, absence|null), updatePractice(id, patch),
  createChat(data) → id, updateChat(id, patch), deleteChat(id), togglePin(id), markRead(id),
  sendMessage(chatId, { text, type = 'text', attachment? }) → message,   // from = mySide; löst Auto-Antwort aus
  editMessage(chatId, messageId, text), deleteMessage(chatId, messageId), toggleReaction(chatId, messageId, emoji), rateChat(chatId, messageId, stars),
  sendRequest({ practiceId, ownerName, phone, animal, petName, situation, district, message }) → chatId,
  createLabel(data) → id, updateLabel(id, patch), deleteLabel(id),
  addAppointment(data) → id, updateAppointment(id, patch), completeAppointment(id, note), cancelAppointment(id), addBlock(data),
  resetDemo(), resetEmpty(), clearAll(), exportJSON() → object, importJSON(obj),
  connectHub(url?) , disconnectHub(), probeHubs(candidates) → results[],
  injectIncoming(chatId, text, from?), forceAutoReply(chatId),       // Test-Hilfen
  setClockOffset(ms),
}
```
- **Lokaler Modus**: Aktion ändert den Zustand, speichert, und `sendMessage` plant bei `chat.autoReply` die Antwort
  über `generateAutoReply` (KI über `ai`-Client wenn erreichbar, sonst Bot) mit Tipp-Anzeige. Die Antwort wird in einer
  Warteschlange pro `messageId` ausgeführt (idempotent, StrictMode-sicher), nicht in einem Component-Effect.
- **Hub-Modus**: Aktion wird optimistisch angewendet, per REST an den Hub geschickt (`clientMsgId` zum Abgleich),
  Hub-Events werden idempotent (nach `id`) eingespielt. Auto-Antworten kommen **nur** vom Hub. Fällt der Hub aus,
  wechselt der Store auf `offline`, puffert Schreibaktionen in einer Outbox und spielt sie nach Reconnect ein.
- `unread` der jeweils anderen Seite wird beim Empfang erhöht; `markRead` setzt die eigene Seite auf 0.

## 6. VetNow Hub — HTTP-API (Protokoll 3)

Basis `/api/v1`. JSON überall (UTF-8). CORS: `Access-Control-Allow-Origin: *`, Header `content-type, x-vn-client,
x-vn-admin, x-filename`, Methoden `GET, POST, PATCH, PUT, DELETE, OPTIONS`, plus `Access-Control-Allow-Private-Network: true`.
Fehler: HTTP 4xx/5xx mit `{ error: '<deutsche Meldung>', code }`.
Header `x-vn-client: <clientId>` ordnet Anfragen einem Gerät zu.

| Methode & Pfad | Zweck |
|---|---|
| `GET /health` | `{ ok, name:'VetNow Hub', version, protocol, serverTime, clockOffsetMs, rev, uptimeS, mode:'demo'|'empty', ai:{provider, ok, model}, clients }` |
| `GET /state` | kompletter Zustand `{ rev, serverTime, practices, chats, labels, appointments, blocks, settings }` |
| `GET /events?client=&platform=&name=&version=` | **SSE**. Erstes Event `hello {clientId, rev, serverTime}`; Keep-alive-Kommentar alle 20 s |
| `GET /changes?since=<rev>&timeout=25000&client=…` | **Long-Poll** für Umgebungen ohne EventSource (React Native, Extension-SW): `{ rev, events[] }` oder `{ resync:true, rev }` |
| `GET /clients` | verbundene Geräte `[{ id, platform, name, version, via:'sse'|'poll', connectedAt, lastSeen }]` |
| `POST /clients/:id/pong` | Antwort auf `ping` (Latenzmessung) |
| `PATCH /practices/:id` | Teil-Update (Profil, Notiz) |
| `POST /practices/:id/status` | `{ value, hours=24, note? }` bestätigt Status; `{ expire:true }` lässt ihn sofort ablaufen |
| `POST /practices/:id/absence` | `{ from, to, vertretung }` oder `null` |
| `POST /chats` · `PATCH /chats/:id` · `DELETE /chats/:id` | Chats verwalten |
| `POST /chats/:id/messages` | `{ from, type, text, attachment?, clientMsgId }` → `{ message }`; plant Auto-Antwort |
| `PATCH /chats/:id/messages/:mid` | `{ text }` · `{ deleted:true }` · `{ reaction:{side, emoji} }` · `{ rating }` |
| `POST /chats/:id/read` | `{ side }` |
| `POST /chats/:id/typing` | `{ from, on }` (wird nur weitergereicht) |
| `POST /requests` | Notfall-/Terminanfrage → neuer Chat `kind:'request'` im Posteingang der Praxis + erste Nachricht → `{ chat }` |
| `POST /labels` · `PATCH /labels/:id` · `DELETE /labels/:id` | Labels |
| `GET /appointments?practiceId=&from=&to=` · `POST /appointments` · `PATCH /appointments/:id` · `DELETE /appointments/:id` | Termine; `PATCH {status:'done', note}` schreibt die Abschlussnotiz in `chatId` |
| `POST /blocks` | Blockzeit |
| `POST /files` (Roh-Body, `content-type`, `x-filename`) · `GET /files/:id` | Anhänge (max. 10 MB) → `{ id, ref:'hub:<id>', url, size, mime }` |
| `POST /bot/reply` | `{ text, persona, messages?, practiceName? }` → Bot-Ergebnis inkl. `explain` |
| `POST /bot/suite` | Regressionstest des Bots → `{ passed, failed, results[] }` |
| `GET /ai/status` · `GET /ai/models?provider=` | KI-Status aller Anbieter |
| `POST /ai/chat` | `{ messages, persona?, model?, provider?, stream?, format? }` → `{ text, provider, model, vision, ms }`; bei `stream:true` SSE `data:{delta}` … `data:{done:true, text, provider, model}` |
| `POST /ai/test` | „Sag Apfel"-Test → `{ ok, text, provider, model, ms }` |
| `POST /admin/login` | `{ password }` → `{ token }` (Standard-Passwort `vetnow2026`, änderbar per `VN_ADMIN_PASSWORD`) |
| `GET /admin/overview` | Version, Uptime, rev, Zähler, Clients, KI, letzte Log-Einträge, Fehler-Injektion aktiv? |
| `POST /admin/reset` | `{ seed:'demo'|'empty' }` |
| `POST /admin/simulate` | `{ action, ...params }` — siehe unten |
| `POST /admin/broadcast` | `{ kind:'toast'|'notify'|'reload'|'navigate', text?, route?, level?, target:'all'|clientId }` |
| `POST /admin/ping` | `{ target }` → sendet `ping`, Ergebnis per `GET /admin/overview` |
| `GET/PUT /admin/settings` | Einstellungen inkl. KI-Anbieter |
| `POST /admin/clock` | `{ offsetMs }` · `{ iso }` · `{ reset:true }` — Zeit-Simulation für alle Geräte |
| `POST /admin/fault` | `{ kind:'offline'|'slow'|'ai-offline'|'error500', durationMs }` — Fehler-Injektion |
| `GET /admin/selftest` | serverseitige Checks `[{ name, ok, ms, detail }]` |
| `GET /admin/log?since=` | Ringpuffer (Anfragen + Events) |
| `GET /admin/export` · `POST /admin/import` | Zustand als JSON |

Admin-Endpunkte brauchen Header `x-vn-admin: <token>` — **außer** die Anfrage kommt von `127.0.0.1`/`::1`
(bequemes Testen am PC; LAN-Geräte brauchen das Passwort).

`/admin/simulate`-Aktionen: `emergency-request {practiceId?}`, `owner-message {chatId?, text?}`, `clinic-message {chatId?, text?}`,
`status {practiceId, value}`, `status-all {value}`, `status-random`, `expire-status {practiceId, inMs?}`, `absence {practiceId, on}`,
`appointment-request {practiceId?}`, `burst {count, chatId?}`, `xss-message {chatId?}`, `image-message {chatId?}`, `long-message {chatId?}`.

**SSE-/Long-Poll-Events** (jedes mit `rev`): `hello`, `resync`, `practice {practice}`, `chat {chat}` (ohne `messages`),
`chat:deleted {id}`, `message {chatId, message}`, `message:update {chatId, message}`, `typing {chatId, from, on}`,
`read {chatId, side}`, `label {label}`, `label:deleted {id}`, `appointment {appointment}`, `appointment:deleted {id}`,
`block {block}`, `settings {settings}`, `clock {offsetMs}`, `broadcast {...}`, `ping {pingId, target}`, `clients {count}`.

**KI im Hub** (`hub/ai/`): Anbieter `mock` (Test-KI, deterministisch, nutzt Bot 3.0, streamt Wort für Wort, Stempel
`mock-ai`), `ollama` (`OLLAMA_URL`, Standard `http://127.0.0.1:11434`; Modell `VN_AI_MODEL`/Einstellung, Standard
`qwen2.5:7b`, Bild-Modell `VN_VISION_MODEL`), `anthropic` (nur wenn `@anthropic-ai/sdk` installiert **und**
`ANTHROPIC_API_KEY` gesetzt; Modell `VN_ANTHROPIC_MODEL`, Standard `claude-opus-5`; offizielles SDK, Streaming,
`fallbacks:"default"` mit Beta `server-side-fallback-2026-07-01`, `stop_reason:'refusal'` → Fehler `code:'refusal'`),
`openai` (OpenAI-kompatibler lokaler Server wie LM Studio, `VN_OPENAI_URL`). `auto` = ollama → anthropic → keiner
(dann Bot). Fehlercodes: `offline`, `no-model`, `no-vision`, `model-crash`, `refusal`, `timeout`, `bad-request`.

**Speicher**: `hub/data/state.json` (atomar schreiben: tmp + rename, entprellt 300 ms), Anhänge in `hub/data/files/`.
Pfad per `VN_DATA_DIR` änderbar (Studio: `/data/hub`). `hub/data/` ist in `.gitignore`.

**Einhängen ins Studio**: `import { createHub } from '../hub/hub.js'` (dynamischer `import()` aus CommonJS) →
`const hub = await createHub({ dataDir, webDist, logger })`; `app.use((req, res, next) => hub.handle(req, res, next))`
**vor** `express.json()` oder mit Beachtung von `req.body`. Standalone: `node hub/index.js` (Port `VN_HUB_PORT` oder 8787,
Host `0.0.0.0`).

## 7. Hub finden (`resolveHubCandidates`)

Reihenfolge, erster erreichbarer (`GET /api/v1/health`, 2,5 s Timeout) gewinnt:
1. Gespeicherte Einstellung (vom Nutzer im Admin/Options gesetzt).
2. Web: gleiche Herkunft (`location.origin`), außer `*.github.io` (HTTPS → kein http-LAN, Mixed Content). Im Vite-Dev
   leitet ein Proxy `/api` auf `http://localhost:8787` weiter → ebenfalls gleiche Herkunft.
3. Handy: `EXPO_PUBLIC_HUB_URL`, dann Host aus `Constants.expoConfig.hostUri` mit Port 8787, dann Port 3000 (Studio),
   dann bekannte Adresse `http://192.168.68.10:3000` (ZimaOS).
4. Extension: `http://localhost:8787`, `http://127.0.0.1:8787`.
Legacy-KI (altes Studio ohne Hub): `EXPO_PUBLIC_AI_URL` / Einstellung `aiLegacyUrl` → `/api/ai/chat` (Ollama-Format).

## 8. Web (`web/`)

- Hash-Router: `#/`, `#/suche`, `#/ergebnisse`, `#/praxis/:id`, `#/anfrage/:id`, `#/chats`, `#/chats/:chatId`,
  `#/dashboard/:tab`, `#/extension`, `#/login`, `#/registrieren/:rolle`, `#/konto`, `#/admin`, `#/admin/:tab`.
  Alte Links (`?screen=…&id=…`, `#screen=`, `#/name`, `/vetnow/name`) werden beim Start umgeleitet. Zurück-Taste funktioniert,
  Scroll pro Route oben, `document.title` pro Route.
- `base` aus `VITE_BASE` (Standard `/vetnow/`), Vite-Proxy `/api` → `VITE_HUB_URL` (Standard `http://localhost:8787`).
- React-Anbindung an den Store: `web/src/lib/store.jsx` → `<VNProvider>`, `useVN(selector)`, `useActions()`, `useHub()`.
- Theme: `document.documentElement.dataset.theme = 'light'|'dark'` bzw. ohne Attribut = System (prefers-color-scheme).
  Einstellung `vn3:theme` = 'auto'|'light'|'dark'.
- Neue CSS-Dateien: `web/src/v3.css` (neue Komponenten, web-app), Admin-Center `web/src/admin/admin.css`.
  `base.css`/`redesign.css` gehören der Design-Überarbeitung (Dark-Mode-Tokens, Kontrast, App-Shell).
- Admin-/Test-Center: `web/src/admin/AdminCenter.jsx` (Default-Export), lazy geladen für Route `#/admin`.
  Nutzt `useVN`, `useActions`, `useHub` und `createHubClient` für Admin-Endpunkte. Alle Knöpfe tragen `data-testid`.

## 9. Test-Konzept

- `npm test` im Root (`tools/test-all.mjs`): shared (node:test), hub (node:test mit echtem HTTP), Bot-Regression,
  web build + SSR-Smoke, Extension-Manifest-Check + Shared-Kopie aktuell, Mobile `expo export` iOS + Android (optional `--mobile`).
- Admin-Center → Tab „Selbsttest": klickbar im Browser, Ergebnis grün/rot, maschinenlesbar unter `window.__vnSelftest`.
- Hub `GET /admin/selftest` für automatisierte Prüfungen.
