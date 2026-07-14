# Avocado at Law — so bringst du es auf dein Studio 🥑

Alle Befehle in **PowerShell** ausführen (Windows-Taste → „PowerShell“ tippen → Enter).
Nicht CMD, nicht im Docker — einfach normale PowerShell auf deinem Laptop.

## Schritt 1: Design-Dateien ins Repo kopieren (PowerShell)

Der Ordner `AvocadoatLaw` ist deine Design-Quelle. Dieser Befehl kopiert immer den
aktuellen Stand ins Repo (auch später nach jeder Änderung wieder ausführen):

```powershell
Copy-Item "C:\Users\basti\Documents\AvocadoatLaw\*.jsx","C:\Users\basti\Documents\AvocadoatLaw\styles.css" -Destination "C:\Users\basti\Documents\vetnow-app\avocado\web\" -Force
Copy-Item "C:\Users\basti\Documents\AvocadoatLaw\Avocado at Law.html" -Destination "C:\Users\basti\Documents\vetnow-app\avocado\web\index.html" -Force
```

## Schritt 2: Committen & pushen (PowerShell)

```powershell
cd "C:\Users\basti\Documents\vetnow-app"
git add -A
git commit -m "Avocado at Law: Web + Expo im Studio, neue Lektionen, Einstellungen, Avo wandert den Pfad"
git push
```

## Schritt 3: Port 8083 in ZimaOS freigeben (einmalig)

1. ZimaOS im Browser öffnen → App **vetnow-studio** → ⚙️ **Einstellungen/Settings**.
2. Bei **Ports** eine neue Zeile hinzufügen: Host `8083` → Container `8083`.
   (Falls 8083 belegt ist: anderen Port nehmen, z. B. 8090 → 8090, und dann im
   Studio bei der Avocado-iPhone-App den Port auf denselben Wert ändern —
   innen und außen müssen gleich sein!)
3. Speichern → die App startet neu und zieht dabei automatisch das neue Repo.

## Schritt 4: Im Studio testen

Browser: `http://192.168.68.10:3000` (deine Server-IP)

- Neue Gruppe **🥑 Avocado at Law** erscheint automatisch (auch bei bestehender Installation).
- **Web-App**: „Bauen“ klicken (dauert 1 Sekunde) → „Öffnen“ → läuft unter `/avocado/`.
  Am Laptop anschaubar — die App zeigt sich selbst im iPhone-Rahmen. 📱
- **iPhone-App (Expo Go)**: „Starten“ klicken (erster Start installiert Pakete, dauert
  ein paar Minuten) → QR-Code mit der iPhone-Kamera scannen (Expo Go nötig,
  iPhone im selben WLAN). Die App lädt die Avocado-Web-App vom Studio.

## Was ist neu in der App?

- 🥑 **Avo wandert den Pfad entlang**: Er steht immer beim aktuellen Level und hüpft
  nach jeder Lektion sichtbar zum nächsten.
- 💾 **Fortschritt bleibt gespeichert** (XP, Gems, Herzen, Streak, Einstellungen) —
  auch nach Neuladen. Zurücksetzen geht in den Einstellungen.
- ⚙️ **Echte Einstellungs-Seite** (Profil → Einstellungen): Design-Stil, Dunkel-Modus,
  Akzentfarbe, Schrift, Avo-Stil, Tagesziel, Name/Benutzername, Sprache, Reset.
- 🎯 **Tagesziel-Karte** über dem Pfad — Ziel erreicht = Streak +1.
- ⚖️ **Neuer Abschnitt 6 „Deine Grundrechte“** mit zwei neuen Aufgabentypen:
  **Fall-Szenarien** (Brilliant-Style, Schritt für Schritt entscheiden) und
  **Schritte ordnen** (z. B. Ablauf eines Zivilprozesses).
- ❤️ **Herzen & Gems zählen echt**: Herzen bleiben zwischen Lektionen erhalten,
  Auffüllen kostet 350 Gems (nur wenn genug da sind).
- 🎭 **Maskottchen antippen** → sie hüpfen. Mehr Erfolge im Profil.
