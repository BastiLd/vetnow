# VetNow v3 — So testest du alles

## 1. Start am PC (einmal Doppelklick)

`00_NEU - 2026-09-25 - vetnow-v3\START-VETNOW.bat` → **[1] Normal**.
Beim ersten Mal installiert es alles und baut die Web-App (ein paar Minuten).
Danach öffnen sich automatisch:

| Was | Adresse |
|---|---|
| Web-App | http://localhost:8787/vetnow/ |
| **Kontrollzentrum (Admin & Tests)** | http://localhost:8787/konsole/ |
| Hub-API | http://localhost:8787/api/v1/health |

Im Hub-Fenster stehen zusätzlich die **WLAN-Adressen** (z. B. `http://192.168.1.23:8787`) für Handy & Co.
Windows fragt beim ersten Start evtl. nach der Firewall → „Private Netzwerke" erlauben, sonst erreicht das Handy den PC nicht.

## 2. Kontrollzentrum (`/konsole/`)

| Tab | Wofür |
|---|---|
| Übersicht | Hub-Status, KI-Status, Praxis-Ampel live, Schnellaktionen |
| Geräte & Sync | Alle verbundenen Geräte (Web, iPhone, Android, Extension) — Ping, Toast, Neu laden, Navigieren |
| Simulation | Notfall-Anfrage, Terminanfrage, Nachrichten, Bild, XSS-Test, lange Nachricht, Burst, Status setzen/zufällig/ablaufen, Abwesenheit |
| Bot & KI | Bot 3.0 direkt fragen (Intent, Triage), KI mit Streaming, Anbieter wählen (Test-KI, Ollama, Claude, LM Studio), Antwort-Modus, Regressionstest (380+ Fälle) |
| Zeit & Status | Uhr vorspulen (+1 h / +24 h / +25 h → Status wird grau), jede Praxis direkt grün/gelb/rot |
| Fehler & Last | Hub „offline", langsam, KI offline, zufällige 500er — prüfen, ob die Apps sauber reagieren |
| Daten | Demo neu laden, leer starten, Export/Import als JSON |
| Vorschau | Web-App gleichzeitig als iPhone, Android, Tablet, Desktop |
| Selbsttest | Ein Knopf → ~20 Prüfungen (Hub, Live-Sync, Anfrage → Posteingang, Bot, KI, Dateien, XSS), grün/rot |
| Live-Log | Alle Live-Ereignisse + Server-Anfragen |

Vom PC selbst brauchst du kein Passwort. Von anderen Geräten: `vetnow2026` (änderbar mit Umgebungsvariable `VN_ADMIN_PASSWORD`).

## 3. iPhone

- **Als Web-App:** Safari → `http://<PC-IP>:8787/vetnow/` → Teilen → „Zum Home-Bildschirm".
- **Als native App (Expo Go, SDK 57):** am PC `START-VETNOW.bat` → **[3] Handy-App** (Hub vorher mit [1] starten) → QR-Code mit der Kamera scannen.
  Die App findet den Hub automatisch (sie bekommt die PC-Adresse mitgegeben).

## 4. Android

- **Web-App:** Chrome → `http://<PC-IP>:8787/vetnow/` → „App installieren".
- **Native App:** Expo Go aus dem Play Store → QR-Code scannen (wie oben).
- **APK:** `cd mobile` → `npx eas build -p android --profile preview` (Expo-Konto nötig).

## 5. Extension (Praxis-Popup)

- **Chrome/Edge:** `chrome://extensions` → Entwicklermodus → „Entpackte Erweiterung laden" → Ordner `vetnow-app\extension`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → „Temporäres Add-on laden" → `extension\manifest.json`.
- Optionen der Extension: Hub-Adresse (Standard `http://localhost:8787`, ZimaOS: `http://192.168.68.10:3000`) und eigene Praxis.
- Das Symbol zeigt ungelesene Anfragen und die Status-Farbe.

## 6. Der große Live-Test (alle Geräte zusammen)

1. PC: Hub starten, Kontrollzentrum → Tab „Geräte & Sync" offen lassen.
2. Handy: Web-App oder Expo-App öffnen → erscheint in der Geräteliste.
3. Extension: Status auf **Rot** klicken → Handy zeigt bei Drautal sofort „Heute nicht verfügbar".
4. Handy: bei Drautal eine **Anfrage senden** → erscheint in der Extension im Posteingang (Zähler am Symbol).
5. Extension: antworten → steht im Hub (Kontrollzentrum → Live-Log).
6. Kontrollzentrum → Zeit +25 h → alle Status werden grau („Nicht aktuell bestätigt"), auf allen Geräten.

## 7. Automatische Tests

`TESTS-AUSFUEHREN.bat` oder im Ordner `vetnow-app`:

```bash
npm test
```

Prüft: Kern + Bot 3.0 (123 Tests inkl. 383 Bot-Fälle), Hub (63 Tests), shared-Kopien, Web-Build + SSR-Test aller Screens, Extension.
Mit Handy-Build (iOS + Android + expo-doctor): `npm run test:all`.

## 8. KI einschalten

Ohne KI antwortet Bot 3.0 (offline, sofort). Für echte KI:

- **Ollama** (kostenlos, lokal): Ollama installieren, `ollama pull qwen2.5:7b`, Hub neu starten → Anbieter „Automatisch" nimmt es.
  Anderer Server: Umgebungsvariable `OLLAMA_URL=http://192.168.68.10:11434`.
- **Claude (Anthropic)** (kostenpflichtig): `ANTHROPIC_API_KEY` setzen, im Ordner `hub` `npm install`, Hub neu starten,
  Kontrollzentrum → Bot & KI → Anbieter „anthropic" (Claude). Standard-Modell `claude-opus-5` (änderbar mit `VN_ANTHROPIC_MODEL`).
- **Test-KI** (Anbieter „mock"): tut so, als wäre sie eine KI (streamt Wort für Wort) — ideal zum Testen ohne Server.

Egal welche KI: Notfälle und Gift-Fragen beantwortet zuerst immer die feste Sicherheitsschicht von Bot 3.0.
