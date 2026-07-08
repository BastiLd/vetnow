# VetNow Kärnten

Notfall-Tierarzt-Finder für Kärnten, Österreich — Praxen nach Bezirk/Tierart/Situation
filtern, Status-Ampel (grün/gelb/grau/rot), Chat zwischen Tierhalter:innen und Praxen,
Praxis-Dashboard, Login/Registrierung. **Alle enthaltenen Daten sind Platzhalter-Testdaten**
(Telefonnummern `+43 000 000000` usw.).

Zwei Apps, gleicher Funktionsumfang, gleiche Testdaten:

| Ordner    | Was | Technik |
|-----------|-----|---------|
| `web/`    | Website + installierbare PWA | Vite, React, vite-plugin-pwa |
| `mobile/` | iPhone-/Android-App | Expo (React Native), React Navigation |

**Live:** https://bastild.github.io/vetnow/

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

- `web/src/data.js` bzw. `mobile/src/data.js` — alle Testdaten (Praxen, Chats,
  Termine) als reine JS-Module, Einträge tragen `isTestData: true`.
- `web/src/screens-*.jsx` — Screens, 1:1 aus dem ursprünglichen Prototyp portiert
  (globale Script-Funktionen → ES-Module).
- `mobile/src/screens/*.js` — React-Native-Portierung der Screens im gleichen
  Design (Farben/Abstände aus `base.css`/`redesign.css`).
