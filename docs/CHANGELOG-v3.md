# VetNow v3 — Änderungen (Runde 4, September 2026)

Fortsetzung der Nummerierung aus CHANGELOG.md.

## Architektur: alles spricht miteinander
268. Neuer **gemeinsamer Kern `shared/`** (reines JavaScript, läuft in Browser, Hermes/Handy, Extension, Node): Daten-Seed relativ zum echten Datum, 24-Stunden-Status-Engine, Filter, Chat-Modell, Store mit Hub-Sync, KI-Client, Auto-Antwort, Versionen. 123 Tests.
269. Neuer **VetNow Hub** (`hub/`, ohne Pflicht-Abhängigkeiten, Port 8787): REST-API `/api/v1`, Live-Events (SSE + Long-Poll für Handy/Extension), Dateien, Admin-/Test-Endpunkte, Fehler-Injektion, Zeit-Simulation, Selbsttest, liefert Web-App und Kontrollzentrum aus. 63 Tests (~495 Prüfungen).
270. Studio hängt den Hub ein (`http://<Server>:3000/api/v1`, `/konsole/`), gibt Expo `EXPO_PUBLIC_HUB_URL` mit.
271. `npm run sync:shared` kopiert den Kern in Extension und Handy-App; `npm test` prüft, dass die Kopien aktuell sind.

## Bot 3.0 & KI
272. **Sicherheits-Triage vor allem anderen** (auch vor der KI): Notfälle (Atemnot, „hat aufgehört zu atmen", angefahren, Kolik, erbricht Blut …) und Vergiftungen werden erkannt — vorher wurden 17 von 22 Notfällen verpasst.
273. Gift-/Medikamentenfragen („Kann ich Paracetamol geben?") werden nie mehr bejaht — die alte Antwort „ja, das ist grundsätzlich möglich" ist weg.
274. Tippfehler, Dialekt („mei hund speibt"), Umlaute ohne Punkte, Englisch, Verneinung („keine Schokolade gegessen"), keine Fehlalarme mehr bei „Unfallversicherung".
275. Termin-Gedächtnis repariert (zweiter Vorschlag wählbar, „passt nicht" → neuer Vorschlag, bucht nur einmal), Tiernamen-Erkennung ohne „Durchfall" als Namen, Kolleg:innen-Persona fürs Praxis-Netzwerk, Hitzschlag → nie „warm halten".
276. KI-Nachfilter: Dosierungen, falsche Erste Hilfe, fremdsprachige Antworten werden durch die sichere Bot-Antwort ersetzt.
277. KI-Anbieter im Hub: Test-KI (mock, streamt), Ollama, Anthropic Claude (offizielles SDK, Streaming, serverseitige Fallbacks), OpenAI-kompatibel (LM Studio). Auswahl im Kontrollzentrum.
278. Regressionstest mit 383 deutschen Fällen (läuft in 0,5 s, auch im Kontrollzentrum und per Hub-Endpunkt).

## Kontrollzentrum (neu)
279. `/konsole/`: Übersicht, Geräte & Sync (Ping/Toast/Neu laden je Gerät), Simulation, Bot & KI, Zeit & Status, Fehler & Last, Daten, Geräte-Vorschau, Selbsttest (20 Prüfungen), Live-Log, Hilfe. Jeder Knopf mit `data-testid`, Ergebnis in `window.__vnSelftest`.

## Web-App
280. Live-Status vom Hub (Extension/Handy setzen Status → Web zeigt es sofort), Dashboard-Status und Anfragen gehen an den Hub.
281. „Heute" ist das echte Datum; Demo-Termine liegen immer um heute; Detailseite markiert den richtigen Wochentag.
282. Abschlussnotiz landet wieder im Chat (ID-Fehler c1 ↔ ch-c1 behoben).
283. Untere Tab-Leiste bleibt am Bildschirmrand; Seiten öffnen oben statt halb gescrollt.
284. „Route"-Knöpfe öffnen Google/Apple Karten statt nur einer Meldung.
285. Anzeige „Live"/„Lokal" im Kopf; Link zum Kontrollzentrum im Fußbereich; Vite-Proxy zum Hub.

## Handy-App (iPhone + Android)
286. **Expo SDK 57** (React Native 0.86) — läuft wieder in der aktuellen Expo-Go-App; expo-doctor 21/21.
287. KI-/Hub-Adresse wird über `expo-constants` gefunden (die alte Methode war unter der New Architecture tot → KI am Handy ging nie).
288. Live-Status vom Hub per Long-Poll, Anfragen und Status gehen an den Hub.
289. APK darf wieder http (ungültiger `usesCleartextTraffic`-Schlüssel ersetzt durch expo-build-properties), iOS: Bundle-ID, lokales Netzwerk erlaubt, Berechtigungstexte in Sie-Form. Kaputtes `development`-Profil und Platzhalter-IP aus eas.json entfernt.

## Extension 3.0
290. Live mit dem Hub: Status, Termine (Bestätigen/Abschließen mit Notiz/Absagen), Posteingang mit Antworten; ohne Hub Demo-Modus.
291. Sicherheitslücke geschlossen (Texte nie mehr per innerHTML), doppelter Chat nach jeder Antwort behoben, kein leeres Popup bei unbekanntem Status, Countdown baut nicht mehr jede Sekunde alles neu.
292. Optionen-Seite (Hub-Adresse mit Verbindungstest, eigene Praxis), Symbol zeigt ungelesene Anfragen + Status-Farbe, Firefox-tauglich (gecko-ID), Dunkelmodus.

## Werkzeuge
293. `START-VETNOW.bat` (Menü: Normal / Entwicklung / Handy / Tests), `TESTS-AUSFUEHREN.bat`, `npm run dev|hub|mobile|test|test:all`.
