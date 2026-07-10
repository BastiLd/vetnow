# VetNow Kärnten

Notfall-Tierarzt-Finder für Kärnten, Österreich — Praxen nach Bezirk/Tierart/Situation
filtern, Status-Ampel (grün/gelb/grau/rot), Chat zwischen Tierhalter:innen und Praxen,
Praxis-Dashboard, Login/Registrierung. **Alle enthaltenen Daten sind Platzhalter-Testdaten**
(Telefonnummern `+43 000 000000` usw.).

Vier Bausteine, gleicher Funktionsumfang, gleiche Testdaten:

| Ordner       | Was | Technik |
|--------------|-----|---------|
| `web/`       | Website + installierbare PWA | Vite, React, vite-plugin-pwa |
| `mobile/`    | iPhone-/Android-App | Expo (React Native), React Navigation |
| `extension/` | Chrome-Extension (Praxis-Popup) | Manifest V3, vanilla JS |
| `studio/`    | Control-Panel (bauen/previewen/starten, gruppierbar) | Node/Express, Docker |

**Live (saubere Version, ohne Testdaten):** https://bastild.github.io/vetnow/

### Vier Versionen (Web + iPhone, je sauber & Demo)

| Version | Wo | Inhalt |
|---------|-----|--------|
| Web **sauber** | GitHub Pages + Studio `/vetnow/` | keine Testdaten — zum Weitergeben |
| Web **Demo + Bot** | Studio `/vetnow-demo/` | 18 Praxen, Chats, Auto-Antwort-Bot, KI-Agent |
| iPhone **sauber** | Studio, Expo Port 8081 | `EXPO_PUBLIC_VN_CLEAN=true` |
| iPhone **Demo + Bot** | Studio, Expo Port 8082 | volle Testdaten + Bot |

Alle vier sind im **VetNow Studio** getrennte Karten — einzeln baubar/startbar,
je mit QR-Code. Supabase lässt sich später anbinden
(Seam in [web/src/lib/backend.js](web/src/lib/backend.js)).

### Auto-Antwort-Bot & echte KI (Ollama)

Der Chat-Bot (Demo-Versionen) versteht 20+ Anliegen (Notfall/Gift-Triage,
Termine mit Slot-Gedächtnis, Symptome, Preise, Impfung …), merkt sich
Tiernamen und tippt mit „…"-Animation. Optional antwortet eine **echte KI**:
Ollama auf dem Server installieren, im **Studio → KI** ein Modell laden
(z. B. `gemma2:2b`), in der App unter Admin „Echte KI-Antworten" einschalten.
Nicht erreichbar? Der eingebaute Bot übernimmt automatisch.

Dazu gibt es einen **KI-Agenten** (🤖-Button in der Demo-App): Aufgabe eingeben
(z. B. „Simuliere einen Tag als Praxis"), der Agent navigiert sichtbar durch
die App und liefert am Ende einen Bericht.

### Chat-System (Web + Mobile)

Freie Chats wie WhatsApp-Gruppen: **Labels mit eigener Farbe & Icon**, Chats
**erstellen / umbenennen / anpinnen / löschen**, nach Label filtern. Beim ersten
Start werden **vorgefertigte Chats** in drei Bereichen angelegt
(*Meine Tiere*, *Praxis-Posteingang*, *Praxis-Netzwerk*) — alles in den
Einstellungen abschaltbar. Gespeichert lokal (localStorage/AsyncStorage).

## Web (`web/`)

```bash
cd web
npm install
npm run dev      # Entwicklung: http://localhost:5173/vetnow/
npm run build    # Produktion (dist/), inkl. 404.html-SPA-Fallback
```

- **PWA:** Auf dem iPhone in Safari öffnen → Teilen → „Zum Home-Bildschirm" →
  startet ohne Browserleiste wie eine echte App.
- **Deployment:** Jeder Push auf `main` baut `web/` automatisch und deployed nach
  GitHub Pages (`.github/workflows/deploy.yml`).

## Mobile (`mobile/`)

```bash
cd mobile
npm install
npx expo start   # QR-Code mit der iPhone-Kamera scannen (Expo Go nötig)
```

Voraussetzungen: kostenlose **Expo Go**-App aus dem App Store; PC und iPhone im
selben WLAN. Kein Apple Developer Account, kein Mac nötig.
Hinweis: Das Projekt läuft auf **Expo SDK 54** (passend zur Expo-Go-Version im App Store).

## Chrome-Extension (`extension/`)

Eigenständiges Praxis-Popup (Status/Termine/Nachrichten), kein Build nötig.
`chrome://extensions` → Entwicklermodus → „Entpackte Erweiterung laden" →
Ordner `extension/` wählen. Details: [extension/README.md](extension/README.md).

## VetNow Studio 2.0 — Control-Panel (`studio/`)

Ein Docker-Container mit Oberfläche, um alles zu **bauen, previewen, starten und
zu gruppieren** — dauerhaft auf ZimaOS, Laptop kann aus sein. Funktioniert für
**beliebige Projekte** (eigene Apps per Git-Repo-URL hinzufügen), nicht nur VetNow.

**Studio-Funktionen:** klickbare Projekt-Gruppen · durchsuchbare Einstellungen
(findet auch die *Funktion*, nicht nur den Namen) · **KI-Tab** mit
Ollama-Modell-Shop (Download mit Fortschritt, Standard-Modell, Test-Chat) ·
**System-Tab** mit 1-Klick-Update · Hell/Dunkel-Theme + Akzentfarbe.

**Auto-Update:** Bei jedem Container-(Neu-)Start zieht das Studio automatisch
den neuesten Code von GitHub — App in ZimaOS neu starten = Update. Alternativ
im Studio: System → „Update installieren & neu starten".

`docker-compose.yml` im Repo-Root startet Studio über ein **fertiges Image**
(`ghcr.io/bastild/vetnow-studio`), das bei jedem Start selbst das neueste
Repo klont/aktualisiert. Bewusst kein Mehrzeilen-Startbefehl in der Compose-
Datei — ZimaOS/CasaOS' Compose-Importer verstümmelt solche Befehle beim
Parsen (Zeilenumbrüche gehen verloren, siehe „Problembehebung" unten).

1. In der Compose-Datei `HOST_IP` auf die LAN-IP des Servers setzen
   (dieselbe wie in der ZimaOS-Adressleiste, z. B. `192.168.68.10`).
2. In ZimaOS: App Store → **„+"** → **„Install a customized app"** →
   Compose importieren, Inhalt einfügen, installieren. (Erster Start dauert
   einige Minuten — das Image muss geladen und das Repo geklont werden.)
3. Studio öffnen: **`http://SERVER-IP:3000`**
   - Web-App **bauen** → **Handy-Vorschau** / **QR** / **Web öffnen**
   - iPhone-App: **Expo starten** → **QR (exp://)** in Expo Go scannen;
     **Expo-Version** jederzeit umschaltbar
   - Extension als **ZIP** herunterladen

**Problembehebung „Dienst nicht verfügbar" / Container startet nicht:**
Logs in ZimaOS/Portainer ansehen (Container `vetnow-studio` → Logs). Zeigt
`fatal: repository '' does not exist` wiederholt → `REPO_URL` kam leer im
Container an, meist weil eine ältere/manuell bearbeitete Compose-Version mit
Mehrzeilen-Befehl importiert wurde. Fix: App entfernen, aktuelle
`docker-compose.yml` von GitHub neu einfügen (nutzt das fertige Image, kein
Mehrzeilen-Befehl mehr) und neu installieren.

Mehr: [studio/README.md](studio/README.md).

## Admin-Bereich

- Web: Route `/admin` (bzw. `#/admin` oder Link „Admin" im Footer)
- Mobile: Link „Admin" unten auf dem Start-Screen
- Zugangsdaten (bitte nach dem Testen ändern — `web/src/lib/admin.js` bzw.
  `mobile/src/lib/admin.js`): Benutzername `admin`, Passwort `vetnow2026`
- Schalter **„Testdaten ausblenden"**: blendet alle Einträge mit `isTestData: true`
  (aktuell: alle Praxen, Chats und Demo-Termine) aus Suche/Ergebnissen/Dashboard/
  Nachrichten aus. Gespeichert in `localStorage` (Web) bzw. `AsyncStorage` (Mobile) —
  wirkt **nur im jeweiligen Browser/Gerät**, nicht global. Ein globaler Schalter für
  alle Besucher würde ein Backend (z. B. Supabase, kostenloser Tarif, eigenes Konto
  nötig) erfordern und wurde bewusst nicht eingebaut.

## Struktur

- `web/src/data.js` bzw. `mobile/src/data.js` — alle Testdaten (18 Praxen, Chats
  mit Labels, Termine) als reine JS-Module, Einträge tragen `isTestData: true`.
- `web/src/screens-*.jsx` — Screens, 1:1 aus dem ursprünglichen Prototyp portiert.
- `web/src/lib/chats.jsx`, `mobile/src/lib/ChatContext.js` — Chat-Store (Labels,
  Farben, Icons, Persistenz).
- `mobile/src/screens/*.js` — React-Native-Portierung im gleichen Design.
- `extension/` — Chrome-Extension (MV3). `studio/` — Control-Panel (Node/Express).
