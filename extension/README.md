# VetNow Kärnten – Chrome-Extension

Eine eigenständige Praxis-Mini-App als Browser-Popup: Status pflegen, Termine
ansehen, Nachrichten beantworten. Kein Build, keine Abhängigkeiten — reines
HTML/CSS/JS (Manifest V3).

## Installieren (Chrome / Edge / Brave)

1. Browser öffnen und zu `chrome://extensions` gehen (bei Edge: `edge://extensions`).
2. Oben rechts **Entwicklermodus** einschalten.
3. **„Entpackte Erweiterung laden"** klicken.
4. Diesen Ordner (`extension/`) auswählen.
5. Das VetNow-Icon erscheint in der Toolbar → anklicken öffnet das Popup.

Zum Aktualisieren nach Code-Änderungen: auf der Extensions-Seite bei VetNow auf
das **Neu-laden-Symbol** (↻) klicken.

## Enthalten

- `manifest.json` – MV3-Manifest (Popup + Icons, Berechtigung `storage`)
- `popup.html/.css/.js` – die Mini-App (Status / Termine / Nachrichten)
- `data.js` – kompakte, eigenständige Testdaten
- `icons/` – App-Icons (16/48/128)

Der gewählte Status wird in `chrome.storage.local` gespeichert. Über
„Vollansicht öffnen" gelangt man zur kompletten Web-App
(Standard: https://bastild.github.io/vetnow/ — anpassbar in `data.js`, Feld `WEB_URL`).
