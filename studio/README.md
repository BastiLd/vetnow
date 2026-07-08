# VetNow Studio — Control-Panel

Ein einziger Docker-Container mit schöner Oberfläche, um die VetNow-Apps (und
weitere) zu **bauen, previewen, starten und zu gruppieren** — läuft dauerhaft
auf einem Heimserver (z. B. ZimaOS), Laptop kann aus sein.

## Was es kann

- **Web-App / PWA:** bauen (`npm ci && npm run build`), live im **iPhone-Rahmen**
  previewen, in voller Größe öffnen, **QR-Code** fürs Handy.
- **Expo / iPhone-App:** Metro-Server **starten/stoppen**, **QR (exp://)** für
  Expo Go, **Expo-SDK-Version umschalten** (passt alle Pakete automatisch an),
  Live-Logs.
- **Chrome-Extension:** als **ZIP herunterladen** + Installationsanleitung.
- **Apps gruppieren:** Gruppen mit Name/Farbe, mehrere Apps nebeneinander,
  neue Apps (eigene Repos/Ordner) hinzufügen, Farbe/Icon/Typ frei wählen.

Alles wird in einem Daten-Volume (`/data/apps.json`) gespeichert.

## Auf ZimaOS installieren (empfohlener Weg)

1. LAN-IP deines Servers merken (steht in der Adressleiste von ZimaOS, z. B.
   `192.168.68.10`).
2. ZimaOS öffnen → **App Store** → oben rechts das **„+"** → **„Install a
   customized app"** → das **Import-/Compose-Symbol** wählen.
3. Den Inhalt der Datei **`docker-compose.yml`** (im Repo-Root) einfügen und
   **eine Zeile anpassen:** bei `HOST_IP` deine Server-IP eintragen.
4. Installieren/Starten. Der **erste Start dauert einige Minuten** (klont Repo,
   installiert, baut Web-App vor).
5. Studio öffnen: **`http://SERVER-IP:3000`**

### iPhone-Vorschau

- **Web-App (sofort):** im Studio bei der Web-App auf **„Handy-Vorschau"** oder
  **QR** — am iPhone (gleiches WLAN) scannen bzw. `http://SERVER-IP:3000/vetnow/`
  öffnen. Per Safari-Teilen → „Zum Home-Bildschirm" als PWA installierbar.
- **Expo (nativ):** bei der iPhone-App auf **„Expo starten"**, dann **QR (exp://)**
  in **Expo Go** scannen (oder „Enter URL manually" → `exp://SERVER-IP:8081`).

## Lokal starten (ohne Docker, zum Entwickeln)

```bash
cd studio
npm install
# Repo-Root wird automatisch als übergeordneter Ordner erkannt
HOST_IP=127.0.0.1 npm start
# -> http://localhost:3000
```

## Technik

- `server.js` — Express-Backend (Registry, Build, Web-Vorschau statisch,
  Expo-Prozess, QR, Extension-ZIP)
- `lib/store.js` — App-Registry (`apps.json`), `lib/proc.js` — Prozess-Manager
- `public/` — Dashboard (vanilla JS, kein Build)
- `apps.default.json` — Start-Registry (VetNow Web/Mobile/Extension)
- `Dockerfile` / `entrypoint.sh` — optionaler Image-Build-Weg

### Wichtige Umgebungsvariablen

| Variable | Zweck | Default |
|----------|-------|---------|
| `HOST_IP` | LAN-IP für QR/exp-URLs | Auto-Erkennung |
| `REPO_ROOT` | Wurzel der App-Ordner | übergeordneter Ordner |
| `STUDIO_PORT` | Port der Oberfläche | `3000` |
| `STUDIO_DATA_DIR` | Ablage für `apps.json` | `studio/data` |
