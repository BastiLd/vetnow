# Avocado at Law 🥑⚖️

Duolingo/Brilliant für Recht — Lern-App-Prototyp (Österreich/EU, Demo, keine Rechtsberatung).

| Ordner    | Was | Start im Studio |
|-----------|-----|-----------------|
| `web/`    | Komplette App (React, ohne Build-Tool — Babel im Browser) | Karte **Avocado → Web-App**: „Bauen“ (kopiert nach `dist/`), dann öffnen unter `/avocado/` |
| `mobile/` | Expo-Go-App (WebView-Hülle, lädt `/avocado/` vom Studio) | Karte **Avocado → iPhone-App**: „Starten“, QR-Code mit Expo Go scannen (Port 8083) |

Features: Lernpfad mit wanderndem Avo, 6 Rechtsgebiete, Aufgabentypen
(Multiple Choice, Wahr/Falsch, Lücken, Zuordnen, Satzbau, **Schritte ordnen**,
**Fall-Szenarien**), Herzen/Gems/XP/Streak mit Tagesziel, Einstellungen
(Design, Dunkel-Modus, Tagesziel, Profil, Reset), Fortschritt bleibt gespeichert
(localStorage). Design-Quelle: Ordner `AvocadoatLaw` (Standalone-HTML) — Dateien
sind identisch, `Avocado at Law.html` heißt hier `index.html`.
