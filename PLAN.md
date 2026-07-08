# VetNow Kärnten — Plan: Prototyp → testbare App (Web + iPhone)

Dieses Dokument beschreibt, was gebaut wird, warum, und wie du es danach selbst
testen/ändern kannst. Es ist gleichzeitig die "Bauanleitung", nach der dieser
Ordner erstellt wurde.

## Ausgangslage

Der ursprüngliche Prototyp (`VetNow (1)/app.html` + `app/*.jsx`) ist eine reine
Frontend-Demo: React läuft direkt im Browser über CDN-Skripte, JSX wird live
per Babel übersetzt, es gibt kein Build-Tool und **keinen Server**. Alle Daten
(Praxen, Chats, Status) stehen fest programmiert in `app/data.js`.

## Zwei Zielprodukte

1. **`web/`** — Eine echte Vite+React-Website, die als PWA (Progressive Web
   App) installierbar ist. Gehostet auf GitHub Pages, kostenlos, mit HTTPS.
   Auf dem iPhone: Safari öffnen → Teilen → "Zum Home-Bildschirm" → App-Icon,
   Vollbild ohne Browserleiste.
2. **`mobile/`** — Eine echte native App mit Expo (React Native). Kostenlos
   live auf dem iPhone testbar über die **Expo Go** App (aus dem App Store,
   kostenlos) durch Scannen eines QR-Codes — kein Apple Developer Account
   (99$/Jahr) nötig, kein Mac nötig, kein App-Store-Review.

Beide nutzen dieselben Testdaten (`shared/data.js`-Inhalt, je einmal für Web
und Mobile übernommen, da beide Frameworks unterschiedliche UI-Bausteine
brauchen — HTML/CSS auf Web, View/StyleSheet auf Native).

## Admin-Konto (lokal, kein Server nötig)

Da wir uns für die **lokale** Variante entschieden haben (keine Anmeldung bei
einem Drittanbieter nötig), funktioniert der Admin-Schalter "Testdaten
ausblenden" pro Gerät/Browser:

- Login unter `/admin` (Web) bzw. Tab "Admin" (Mobile)
- Zugangsdaten (bitte nach dem Testen ändern — Ort: `web/src/lib/admin.js`
  bzw. `mobile/src/lib/admin.js`):
  - **Benutzername:** `admin`
  - **Passwort:** `vetnow2026`
- Schalter "Testdaten ausblenden" wird in `localStorage` (Web) bzw.
  `AsyncStorage` (Mobile) gespeichert. Wirkt **nur auf dem Gerät/Browser**, in
  dem er gesetzt wurde — nicht global für alle Besucher (das würde einen
  echten Server + eigenen Account bei z.B. Supabase erfordern; explizit
  abgewählt, um ohne neuen Account auszukommen).

## Schritte, die ausgeführt werden

1. `web/`: Vite-Projekt aufsetzen, bestehenden Prototyp-Code (Screens,
   Komponenten, Daten, CSS) in echte ES-Module umwandeln (`import`/`export`
   statt globaler `<script>`-Tags).
2. `web/`: PWA-Setup (`vite-plugin-pwa`) — Manifest mit Name, Icons, Theme-
   Farbe, `display: standalone`.
3. `web/`: Admin-Login-Screen + Testdaten-Filter (Praxen/Chats mit
   `isTestData: true` werden ausgeblendet, wenn Schalter aktiv ist).
4. `web/`: Lokal bauen & smoke-testen (`npm run dev`, `npm run build`).
5. `mobile/`: Expo-Projekt aufsetzen (`create-expo-app`, React Navigation).
6. `mobile/`: Kern-Screens portieren (Start, Notfall-Suche, Ergebnisse,
   Praxis-Detail, Anfrage senden, Dashboard, Nachrichten, Login/Registrierung,
   Admin) als React-Native-Komponenten im gleichen Look (Farben/Abstände aus
   `base.css`/`redesign.css` übernommen).
7. Git-Repo initialisieren, GitHub-Repo **öffentlich** anlegen (dein Account:
   `BastiLd`), Code pushen.
8. GitHub Actions Workflow, der bei jedem Push automatisch `web/` baut und
   nach GitHub Pages deployed.
9. Am Ende: Live-URL, Zugangsdaten, und genaue Schritt-für-Schritt-Anleitung
   für Expo Go auf deinem iPhone.

## Warum diese Entscheidungen (von dir bestätigt)

- **Expo statt reiner PWA:** Du wolltest eine "echte" App-Erfahrung über Expo
  Go, obwohl das mehr Aufwand bedeutet (komplette Neuentwicklung der Screens
  in React-Native-Bausteinen statt Wiederverwendung von HTML/CSS). Website
  wird zusätzlich gebaut, wie gewünscht.
- **Öffentliches Repo:** Nötig, weil GitHub Pages im kostenlosen Plan nur bei
  öffentlichen Repos funktioniert. Unproblematisch, da aktuell nur
  Platzhalter-Testdaten enthalten sind (z.B. Telefonnummer
  `+43 000 000000`).
- **Lokaler statt globaler Admin-Schalter:** Ein wirklich globaler Schalter
  (der für JEDEN Besucher gleichzeitig wirkt) braucht einen echten Server +
  Datenbank (z.B. Supabase) und damit eine Kontoanmeldung bei einem
  Drittanbieter. Das wurde bewusst abgewählt, um komplett ohne neuen Account
  auszukommen. Falls du das später doch willst, sag Bescheid — das lässt
  sich nachrüsten.
