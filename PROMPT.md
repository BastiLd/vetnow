# Auftrag für Fable: VetNow Kärnten — Prototyp → Web-App + iPhone-App (alles kostenlos)

Du bist ein Coding-Agent mit Zugriff auf Terminal/Bash, Dateisystem und das
`gh` CLI (bereits bei GitHub als `BastiLd` eingeloggt). Führe den kompletten
Auftrag unten eigenständig aus, ohne Rückfragen zu stellen — triff sinnvolle
Entscheidungen selbst, außer bei Dingen, die explizit ein neues Konto/Login
des Nutzers erfordern (dann anhalten und fragen).

## Ausgangslage

Es existiert ein reiner Frontend-Prototyp unter
`c:\Users\basti\Documents\VetNow (1)\`:

- `app.html` lädt React/ReactDOM/Babel von einem CDN und führt JSX **live im
  Browser** aus (kein Build-Tool, kein Server, kein npm).
- `app/data.js` — alle Testdaten (Praxen, Chats, Status) als reine JS-Objekte,
  ohne Abhängigkeiten. In eine IIFE gewrappt, hängt Ergebnisse an
  `window.VN_DATA`.
- `app/components.jsx`, `app/screens-a.jsx` … `app/screens-f.jsx`,
  `app/screens-ext.jsx` — React-Function-Components als globale Funktionen
  (kein `import`/`export`), rendern reines HTML (divs, buttons) mit CSS-Klassen.
- `app/app.jsx` — Router/App-Root (State-basiertes Screen-Switching über
  `route.name`, kein echtes URL-Routing).
- `app/base.css`, `app/redesign.css` — das komplette Design-System
  (Farbvariablen, Spacing, Komponenten-Klassen).
- App-Name: "VetNow Kärnten" — ein Notfall-Tierarzt-Finder für Kärnten,
  Österreich (Praxen nach Bezirk/Tierart/Situation filtern, Status-Ampel
  grün/gelb/grau/rot, Chat zwischen Tierhalter und Praxis, Tierarzt-Dashboard,
  Login/Registrierung für Tierhalter und Praxen).

Alle Telefonnummern/Adressen in `data.js` sind Platzhalter (z.B.
`+43 000 000000`) — unbedenklich für ein öffentliches Repo.

## Ziel

Baue in einem **neuen Ordner** `c:\Users\basti\Documents\vetnow-app\` zwei
vollständige, eigenständige Apps, die denselben Funktionsumfang wie der
Prototyp abbilden:

### 1. `web/` — Website (Vite + React + PWA)

- Vite-React-Projekt aufsetzen (`npm create vite@latest web -- --template react`).
- Bestehenden Prototyp-Code migrieren: aus globalen Script-Funktionen echte
  ES-Module machen (`import`/`export`), `data.js` als Modul statt
  `window.VN_DATA`, CSS-Dateien 1:1 übernehmen.
- **PWA-Setup** mit `vite-plugin-pwa`: Manifest (Name "VetNow Kärnten", Icons
  — einfaches generiertes Icon reicht, Theme-Farbe aus dem Design
  `#0c7d72`), `display: "standalone"`. Ziel: Auf dem iPhone in Safari
  öffnen → Teilen → "Zum Home-Bildschirm" → App startet ohne Browserleiste,
  wie eine echte App.
- **Admin-Bereich (lokal, kein Server/Konto nötig):**
  - Route `/admin` mit Login-Formular.
  - Feste Zugangsdaten in `web/src/lib/admin.js`:
    Benutzername `admin`, Passwort `vetnow2026` (Kommentar im Code: "Nach
    dem Testen ändern!").
  - Nach Login: Schalter "Testdaten ausblenden", gespeichert in
    `localStorage`. Wenn aktiv: alle Einträge aus `data.js`, die
    `isTestData: true` haben (das sind aktuell **alle** vorhandenen Praxen
    und Chats), werden aus Suche/Ergebnissen/Dashboard/Nachrichten
    herausgefiltert, sodass ein Betrachter eine leere/echte App ohne
    Fake-Daten sieht. Dieser Schalter wirkt **nur im Browser, in dem er
    gesetzt wurde** (kein globaler Server-Zustand, das war eine bewusste
    Entscheidung um ohne Drittanbieter-Konto auszukommen — siehe
    "Mögliche spätere Erweiterung" unten).
- Lokal testen: `npm run dev`, `npm run build` müssen fehlerfrei laufen.

### 2. `mobile/` — iPhone-App (Expo / React Native)

- `npx create-expo-app@latest mobile` (managed workflow, JavaScript).
- React Navigation (`@react-navigation/native` + native-stack) für die
  Screens: Start, Notfall-Suche (Tierart/Situation/Bezirk/Fachgebiet-Filter),
  Ergebnisse, Praxis-Detail, Anfrage senden, Praxis-Dashboard, Meine
  Nachrichten, Login/Registrierung (Tierhalter + Praxis), Admin.
- Gleiche Testdaten wie im Web (`mobile/src/data.js`, als reines JS-Modul
  portiert, keine DOM-Abhängigkeiten in `data.js` — kann fast 1:1
  übernommen werden).
- UI mit `View`/`Text`/`TouchableOpacity`/`ScrollView`/`StyleSheet` aus den
  Farben/Abständen von `base.css`/`redesign.css` nachbauen (gleiche
  Teal-Markenfarbe `#0c7d72`, gleiche Statusfarben grün/gelb/grau/rot).
- Gleicher lokaler Admin-Schalter wie im Web, aber mit `AsyncStorage`
  (`@react-native-async-storage/async-storage`) statt `localStorage`.
- Sicherstellen, dass `npx expo start` fehlerfrei einen QR-Code ausgibt.

### 3. GitHub + Hosting

- Git-Repo in `vetnow-app/` initialisieren.
- Öffentliches GitHub-Repo anlegen: `gh repo create vetnow-app --public --source=. --remote=origin`.
- `.gitignore` für `node_modules`, `dist`, `.expo`, etc.
- Initialen Commit erstellen und pushen.
- GitHub Actions Workflow (`.github/workflows/deploy.yml`), der bei jedem
  Push auf `main` automatisch `web/` baut (`npm ci && npm run build`) und
  per `actions/deploy-pages` nach GitHub Pages deployed. Pages in den
  Repo-Settings aktivieren (Source: GitHub Actions) — falls das per `gh api`
  nicht direkt möglich ist, die genauen manuellen Klick-Schritte in der
  finalen Antwort auflisten.
- Vite `base` Pfad korrekt auf `/vetnow-app/` setzen (GitHub Pages Project
  Page), damit Assets nach dem Deploy korrekt laden.

### 4. Abschlussbericht (am Ende deiner Arbeit ausgeben)

- Die fertige GitHub-Pages-URL (Format
  `https://bastild.github.io/vetnow-app/`).
- Admin-Zugangsdaten (Benutzername/Passwort wie oben).
- Schritt-für-Schritt-Anleitung für den Nutzer, um die Mobile-App auf dem
  iPhone zu previewen:
  1. "Expo Go" kostenlos aus dem App Store installieren.
  2. Auf dem PC im Ordner `mobile/`: `npx expo start` ausführen.
  3. PC und iPhone müssen im selben WLAN sein.
  4. QR-Code aus dem Terminal mit der iPhone-Kamera scannen → öffnet
     automatisch in Expo Go.
- Kurzer Hinweis, was noch fehlt/vereinfacht wurde (z.B. welche Screens im
  Mobile-Teil ggf. nicht 1:1 übernommen wurden, falls Zeit/Umfang das
  erfordert hat — nichts stillschweigend weglassen, sondern explizit
  auflisten).

## Wichtige Leitplanken

- **Alles muss 100% kostenlos bleiben** — keine kostenpflichtigen Dienste,
  keine Abos, kein Apple Developer Account, keine Kreditkarte.
- Keine Datenbank/kein Backend-Login-System einbauen, das eine Anmeldung bei
  einem Drittanbieter (Supabase, Firebase, etc.) erfordert — das wurde
  bewusst abgewählt (siehe unten).
- Bestehenden Code so weit wie möglich wiederverwenden/portieren statt neu zu
  erfinden — Struktur, Screen-Namen und Datenmodell aus dem Prototyp
  beibehalten.
- Kleine, klare Commits; keine Secrets/Tokens im Repo.

## Mögliche spätere Erweiterung (jetzt NICHT umsetzen, nur erwähnen)

Falls der Nutzer später einen **echten globalen** Admin-Schalter will (wirkt
für ALLE Besucher gleichzeitig, nicht nur lokal), bräuchte es ein echtes
Backend, z.B. Supabase (kostenloser Tarif, aber eigener Account/E-Mail-Signup
nötig). Das wurde für jetzt bewusst nicht gebaut.
