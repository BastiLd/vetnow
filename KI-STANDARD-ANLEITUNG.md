# KI als Standard-Bot — was geändert wurde & wie du es überall aktivierst

## Was ist neu?

Die KI (Ollama, Modell **qwen2.5:7b** — schnell, schlau, sehr gutes Deutsch) ist jetzt
**überall der Standard** und ersetzt den eingebauten Regel-Bot in allen Chats:

- **Web-App**: `botMode: 'ai'` ist Standard (`web/src/data.js`). Bestehende Browser werden
  automatisch migriert (Einstellungs-Speicher v2).
- **Handy-App / APK**: komplett neue KI-Anbindung (`mobile/src/lib/ai.js`) + Umbau des
  Chat-Screens. In Expo Go findet die App den Server automatisch; fürs APK steht die
  Server-Adresse in `mobile/eas.json` (`EXPO_PUBLIC_AI_URL`).
- **Studio**: Standard-Modell ist `qwen2.5:7b`, der KI-Proxy reicht Feineinstellungen
  (Temperatur usw.) an Ollama durch.
- **„Training“**: stark verbesserter System-Prompt — antwortet **NUR auf Deutsch**
  (Sie-Form), Notfall-Triage (Vergiftung/Atemnot → sofort anrufen), keine Ferndiagnosen,
  keine Medikamenten-Dosierungen, konkrete Terminvorschläge, Beispiel-Dialoge als Vorlage.
  Dazu Feineinstellungen für konsistente Antworten (temperature 0.4, num_ctx 4096,
  repeat_penalty 1.15).
- **Fallback bleibt**: Ist Ollama nicht erreichbar (GitHub Pages, APK ohne Server),
  übernimmt automatisch der eingebaute Bot 2.0 — es bleibt nie stumm.

---

## So aktivierst du es überall (PowerShell, Schritt für Schritt)

> Alle Befehle in **PowerShell** auf deinem Windows-PC ausführen.
> `192.168.68.10` = die IP deines ZimaOS-Servers (ggf. anpassen — bei Tailscale die 100.x-Adresse).

### Schritt 1 — Modell auf dem Server installieren (~4,7 GB, dauert je nach Internet einige Minuten)

```powershell
$SERVER = "192.168.68.10"
Invoke-RestMethod -Method Post -Uri "http://${SERVER}:11434/api/pull" -ContentType "application/json" -Body '{"name":"qwen2.5:7b"}' -TimeoutSec 3600
```

Prüfen, ob es da ist:

```powershell
(Invoke-RestMethod "http://${SERVER}:11434/api/tags").models | Select-Object name, size
```

### Schritt 2 — Studio auf das neue Modell umstellen (nötig, weil deine alte Einstellung gespeichert ist)

```powershell
Invoke-RestMethod -Method Put -Uri "http://${SERVER}:3000/api/settings" -ContentType "application/json" -Body '{"ollamaModel":"qwen2.5:7b"}'
```

### Schritt 3 — Code zu GitHub pushen (damit der Server ihn beim Start zieht)

```powershell
cd "$env:USERPROFILE\Documents\vetnow-app"
git add -A
git commit -m "KI (qwen2.5:7b) ist jetzt Standard-Bot: nur Deutsch, besserer Prompt, Mobile-Anbindung, Fallback bleibt"
git push
```

### Schritt 4 — Server aktualisieren

Entweder im **Studio → System-Tab → „Update installieren & neu starten“** klicken,
oder den Container in ZimaOS neu starten (er zieht beim Start automatisch das neueste Repo).
Alternativ per PowerShell mit SSH:

```powershell
ssh DEIN-BENUTZER@$SERVER "docker restart vetnow-studio"
```

### Schritt 5 — KI direkt testen

```powershell
$body = '{"model":"qwen2.5:7b","messages":[{"role":"user","content":"Mein Hund Balu humpelt seit gestern. Was soll ich tun?"}],"stream":false}'
(Invoke-RestMethod -Method Post -Uri "http://${SERVER}:11434/api/chat" -ContentType "application/json" -Body $body -TimeoutSec 300).message.content
```

### Schritt 6 — Handy & APK

- **Expo Go (im WLAN/Tailscale)**: App im Studio neu starten, dann QR-Code neu scannen — fertig,
  keine weiteren Schritte. Die App findet den KI-Server automatisch.
- **APK**: Im Studio den **APK-Knopf** drücken (neue APK bauen), dann neu installieren.
  Nutzt du die APK **außerhalb** des Heim-WLANs (Tailscale), vorher in `mobile/eas.json`
  bei `EXPO_PUBLIC_AI_URL` die IP durch deine Tailscale-Adresse ersetzen
  (z. B. `http://100.x.y.z:3000/api/ai`) und erst dann bauen.
- Ohne erreichbaren Server antwortet in der APK automatisch der eingebaute Bot (Fallback).

---

## Falls der Server zu schwach ist (Antworten dauern > 30 s)

Kleineres Modell nehmen — auch gutes Deutsch, viel schneller auf schwacher Hardware:

```powershell
$SERVER = "192.168.68.10"
Invoke-RestMethod -Method Post -Uri "http://${SERVER}:11434/api/pull" -ContentType "application/json" -Body '{"name":"qwen2.5:3b"}' -TimeoutSec 3600
Invoke-RestMethod -Method Put -Uri "http://${SERVER}:3000/api/settings" -ContentType "application/json" -Body '{"ollamaModel":"qwen2.5:3b"}'
```

Mehr musst du nicht ändern — die Apps nutzen automatisch das Studio-Standard-Modell.

---

## Nachtrag (Runde 2): Standard-Modell auf `qwen2.5:3b` umgestellt

**Warum:** Der ZimaOS-Server hat **≤ 8 GB RAM insgesamt** — Betriebssystem, Docker,
Studio und Expo laufen davon mit. `qwen2.5:7b` braucht allein für Ollama etwa 8 GB und
ist auf dieser Maschine deshalb an der Grenze; typische Folge sind sehr lange Antwortzeiten
oder ein abgebrochener Ollama-Prozess.

Neuer Standard ist **`qwen2.5:3b`** (~1,9 GB Download, ~3 GB RAM): spürbar schneller,
sprachlich für die Chat-Antworten immer noch gut. `qwen2.5:7b` bleibt im Modell-Katalog
als Testoption — wenn er auf eurem Server flüssig läuft, jederzeit zurückschaltbar.

### Umstellen auf einer BESTEHENDEN Installation

Der neue Standard greift nur bei einer frischen Installation — eine schon gespeicherte
Einstellung gewinnt. Deshalb einmalig eines von beidem:

- **Im Studio (einfachster Weg):** Tab **KI** → bei `qwen2.5:3b` auf **„Herunterladen"**,
  danach auf **„⭐ Als Standard nutzen"**.
- **Oder per PowerShell:**

```powershell
$SERVER = "192.168.68.10"
Invoke-RestMethod -Method Post -Uri "http://${SERVER}:11434/api/pull" -ContentType "application/json" -Body '{"name":"qwen2.5:3b"}' -TimeoutSec 3600
Invoke-RestMethod -Method Put -Uri "http://${SERVER}:3000/api/settings" -ContentType "application/json" -Body '{"ollamaModel":"qwen2.5:3b"}'
```

### Danach kurz gegentesten

Im Studio unter **KI → Schnelltest** zwei, drei typische Tierarzt-Fragen auf Deutsch
stellen und die Antwortzeit mit `qwen2.5:7b` vergleichen. Behaltet das Modell mit dem
besseren Verhältnis aus Tempo und Sprachqualität.

> Die Feineinstellungen (`AI_OPTIONS` in `mobile/src/lib/ai.js` und `web/src/lib/ai.js`:
> `temperature: 0.4`, `top_p: 0.9`, `num_ctx: 4096`, `repeat_penalty: 1.15`) waren auf das
> 7B-Modell abgestimmt. Kleinere Modelle reagieren empfindlicher auf `temperature` —
> falls die Antworten sprunghaft wirken, testweise auf `0.3` senken.

### Woran erkennt man jetzt, ob die KI oder der Bot geantwortet hat?

Seit Runde 2 steht das direkt an der Nachricht: unter jeder Antwort erscheint neben der
Uhrzeit ein kleines **„· KI"** oder **„· Bot"**. Kommt bei einem Test überall „· Bot",
ist Ollama nicht erreichbar — dann Server, Port und Modell prüfen.
