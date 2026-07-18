# App außerhalb des WLANs nutzen — Anleitung

Ziel: Die VetNow-App soll auch dann laufen, wenn man **nicht** im selben WLAN
wie der ZimaOS-Server ist. Genau das war bisher das Problem.

---

## Warum ging es bisher nicht?

Dein Studio startet die App über **Expo/Metro** auf der Adresse
`192.168.68.10:8081`. Der QR-Code für Expo Go zeigt auf genau diese Adresse
(`exp://192.168.68.10:8081`).

Diese Adresse (`192.168.68.x`) ist eine **private Heimnetz-Adresse** — sie
existiert nur in deinem WLAN. Sobald das Handy in einem anderen WLAN oder auf
mobilen Daten ist, kann es `192.168.68.10` **nicht erreichen**. Expo Go kann
die App dann nicht laden → genau die Fehler auf den Bildern deines Freundes:

> Failed to download remote update / Something went wrong.

Es ist also kein Fehler in der App selbst, sondern nur die **Adresse**, unter
der die App bereitgestellt wird.

---

## Die Lösung — zwei Wege, je nach Person

| Für wen | Weg | Braucht Server / WLAN? |
|--------|-----|------------------------|
| **Deine Freunde (Android, z. B. Pixel)** | **Fertige APK** zum Installieren | Nein — läuft komplett eigenständig |
| **Du selbst (iPhone)** | **Tailscale** (privates Netz) | Server ja, aber von überall erreichbar |

Zusätzlich gibt es eine **Sofort-Option ohne jede Einrichtung** (siehe unten) —
gut zum sofortigen Weitergeben, während du die APK einrichtest.

---

## Sofort-Option (0 Aufwand): die Web-App / PWA

Deine saubere Web-Version liegt öffentlich im Netz und funktioniert **überall**,
ohne Server, ohne Expo Go:

**https://bastild.github.io/vetnow/**

Dein Freund kann das auf dem Pixel so als App installieren:
1. Link in **Chrome** öffnen.
2. Menü (drei Punkte) → **„Zum Startbildschirm hinzufügen"**.
3. Startet danach wie eine echte App (ohne Browserleiste), von überall.

Das ist die **saubere** Version (ohne Testdaten). Für die volle Demo mit
Testdaten + Bot nimm die APK unten.

---

# Teil A — Android-APK für deine Freunde

Eine APK ist eine fertige, installierbare Android-App. Einmal installiert,
braucht dein Freund **weder Expo Go noch dein WLAN noch deinen Server** — die
App läuft immer, überall.

Gebaut wird die APK kostenlos in der **EAS-Cloud** von Expo (kein Mac, kein
Android Studio nötig). Ich habe das Projekt dafür schon vorbereitet
(`mobile/eas.json`, Paketname in `mobile/app.json`).

## A1) Einmalig: Expo-Konto anlegen

1. Auf **https://expo.dev** ein kostenloses Konto erstellen.
2. Merke dir Benutzernamen und Passwort.

## A2) Einmalig auf deinem Windows-PC (dauert ~15 Min, nur beim ersten Mal)

Der allererste Build muss einmal „von Hand" laufen, weil dabei der
**Signatur-Schlüssel** (Keystore) erzeugt wird — das geht aus
Sicherheitsgründen nur interaktiv. Danach nie wieder.

Öffne die **Eingabeaufforderung** (Windows-Taste → „cmd") und tippe Zeile für
Zeile:

```bat
:: 1. EAS-Werkzeug installieren (einmalig; Node.js muss installiert sein: https://nodejs.org)
npm install -g eas-cli

:: 2. In den App-Ordner wechseln
cd "C:\Users\basti\Documents\vetnow-app\mobile"

:: 3. Bei Expo anmelden (Konto aus A1)
eas login

:: 4. Projekt mit deinem Expo-Konto verknüpfen (schreibt die projectId in app.json)
eas init

:: 5. WICHTIG: erst alles committen & pushen — EAS baut nur committete Dateien!
::    (das bringt auch den APK-Knopf ins Studio; siehe A4)
cd "C:\Users\basti\Documents\vetnow-app"
git add -A
git commit -m "APK-Build im Studio + Tailscale-Fernzugriff + Anleitung"
git push
cd mobile

:: 6. Ersten APK-Build starten (Demo-Version mit Testdaten + Bot)
eas build --platform android --profile preview
```

Bei Schritt 6 fragt EAS: **„Generate a new Android Keystore?"** → mit **Yes**
bestätigen. Dann baut Expo die App in der Cloud (ca. 10–20 Min). Am Ende
bekommst du einen **Link** und einen **QR-Code** zum Herunterladen der APK.

> Sauber statt Demo? Dann in Schritt 6 `--profile preview-clean` verwenden.

## A3) Die APK an deinen Freund geben

- Öffne den Link/QR aus Schritt 6 auf dem **Pixel** deines Freundes (oder
  schick ihm die heruntergeladene `.apk`-Datei per Messenger).
- Android fragt beim Öffnen einer APK nach der Erlaubnis
  **„Unbekannte Apps installieren"** → erlauben.
- Installieren, fertig. Die App läuft ab jetzt **überall**, auch offline.

## A4) Ab jetzt bequem: APK per Knopf im Studio bauen

Damit du für neue Versionen nicht jedes Mal den PC brauchst, gibt es jetzt im
Studio einen Knopf **„📦 APK bauen"** (auf jeder iPhone-/Expo-App-Karte).

Dafür einmalig:
1. Auf **expo.dev** → dein Profil → **Settings → Access Tokens** →
   **„Create token"** → den langen Text kopieren.
2. In der `docker-compose.yml` (bzw. in ZimaOS bei der App unter „Environment")
   die Zeile eintragen bzw. die Raute entfernen:
   ```yaml
   EXPO_TOKEN: "hier-dein-expo-token-einfuegen"
   ```
3. Studio-App in ZimaOS neu starten.

Danach: im Studio auf **„📦 APK bauen"** klicken → der Build läuft in der
Cloud, der Fortschritt steht in den **Logs**, und am Ende erscheint dort der
**Installations-Link**. Diesen an deine Freunde weitergeben.

> Wichtig: Der Knopf funktioniert erst **nach** der einmaligen Einrichtung in
> A2 (dadurch entstehen projectId + Keystore, die die Cloud dann wiederverwendet).

---

# Teil B — Tailscale für dein iPhone

Für dich als „Besitzer" ist eine eigene APK für iPhone teuer (Apple verlangt
99 €/Jahr). Einfacher: **Tailscale**. Das ist ein kostenloses, privates Netz —
dein iPhone und dein ZimaOS-Server sind damit so verbunden, als wärst du zu
Hause im WLAN, **egal wo du gerade bist**. Dein normaler Studio-Ablauf (Expo
starten → QR scannen) bleibt gleich.

## B1) Was ich vorbereitet habe

Die Datei **`docker-compose.remote.yml`** im Projekt ist eine fertige
Fernzugriff-Variante: Studio **+** ein kleiner Tailscale-Container in einem.
Deine bisherige `docker-compose.yml` bleibt unangetastet und funktioniert
weiter im LAN.

## B2) Einrichtung (einmalig)

1. Kostenloses Konto auf **https://tailscale.com** anlegen.
2. **Auth-Key** erzeugen: Admin-Konsole → **Settings → Keys** →
   **„Generate auth key"**. Den Key kopieren.
3. In `docker-compose.remote.yml` den Key bei `TS_AUTHKEY` einsetzen.
4. In **ZimaOS**: App Store → **„+"** → **„Install a customized app"** → den
   Inhalt von `docker-compose.remote.yml` einfügen → installieren.
   (Tipp: die alte VetNow-Studio-App vorher entfernen, damit sich die Ports
   3000/8081/8082/8083 nicht doppeln.)
5. **Tailscale-App** auf dem iPhone installieren (App Store) und mit
   **demselben Konto** anmelden.
6. In der Tailscale-Admin-Konsole unter **Machines** die Adresse deines
   Servers ablesen (beginnt mit `100.…`). Diese bei `HOST_IP` in
   `docker-compose.remote.yml` eintragen und die App in ZimaOS **einmal neu
   starten**.

## B3) Nutzen

- Studio öffnen: **http://100.x.y.z:3000** (die 100-er Adresse aus B2/6).
- Wie gewohnt **Expo starten** → **QR** in Expo Go scannen.
- Läuft jetzt von **überall** — im Zug, bei Freunden, auf mobilen Daten.
  Voraussetzung: Tailscale ist auf dem iPhone an (ein Schalter in der App).

> Zu Hause funktioniert es weiterhin, weil Tailscale automatisch den direkten
> WLAN-Weg nimmt, wenn möglich.

---

## Was ich im Projekt geändert habe

| Datei | Änderung |
|-------|----------|
| `mobile/eas.json` *(neu)* | Build-Profile für Android-APK (preview = Demo, preview-clean = sauber) |
| `mobile/app.json` | Android-Paketname `at.vetnow.kaernten` + versionCode |
| `avocado/mobile/eas.json` *(neu)* | dasselbe für Avocado at Law |
| `avocado/mobile/app.json` | Paketname `at.avocado.law` + versionCode |
| `studio/server.js` | neue Aktion **build-apk** (baut APK in der EAS-Cloud) |
| `studio/public/app.js` | neuer Knopf **„📦 APK bauen"** auf Expo-Karten |
| `docker-compose.yml` | Platz für `EXPO_TOKEN` (für den APK-Knopf) |
| `docker-compose.remote.yml` *(neu)* | Fernzugriff-Variante mit Tailscale |

## Änderungen zu GitHub bringen

Dein Studio zieht seinen Code beim Start von GitHub. Damit die neuen
Studio-Funktionen (APK-Knopf, Tailscale-Hinweise) auf dem Server ankommen,
müssen die Änderungen zu GitHub gepusht werden.

- Hast du **Teil A / A2** schon gemacht, ist das mit **Schritt 5** bereits erledigt.
- Willst du **nur** den APK-Knopf oder Tailscale (ohne den PC-Build), reicht
  einmalig, auf deinem PC im Ordner `vetnow-app`:

```bat
git add -A
git commit -m "APK-Build im Studio + Tailscale-Fernzugriff + Anleitung"
git push
```

Danach die Studio-App in ZimaOS neu starten (zieht automatisch den neuen Stand).

---

## Kurz-Empfehlung

- **Freund (Pixel) sofort:** PWA-Link schicken (Sofort-Option oben).
- **Freund (Pixel) richtig:** einmal APK bauen (Teil A) und weitergeben.
- **Du (iPhone):** Tailscale einrichten (Teil B) — dann läuft dein
  gewohntes Expo-Go-Setup von überall.
