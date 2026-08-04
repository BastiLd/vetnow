# Bilderkennung einrichten (Vision-Modell)

> **Zuerst das Wichtigste:** Die App schickt Bilder jetzt tatsächlich an die KI —
> das war vorher **nicht** der Fall (siehe unten „Was war kaputt"). Damit eine
> Antwort zum Bild kommt, fehlen aber noch **zwei Schritte auf dem Server**, die
> nur du machen kannst: den Absturz von `llava:7b` beheben und ein Vision-Modell
> als Hintergrund-Modell setzen.

---

## Was war kaputt (zwei getrennte Ursachen)

**1. Die App hat das Bild nie mitgeschickt.**
In `toAiMessages()` wurde jedes Bild durch den Text `[Bild gesendet]` ersetzt und
`m.src` **verworfen**. Kein Modell der Welt kann dabei etwas sehen — auch ein
perfekt laufendes `llava` hätte nur geraten. **Das ist jetzt behoben:** Bilder
gehen als `images: ['<base64>']` an Ollama, verkleinert auf 1024 px.

Auf dem **Handy** kam erschwerend dazu, dass der Bild-Picker nur einen Dateipfad
(`file:///…`) liefert, in dem gar keine Bilddaten stecken. Deshalb wird das Foto
jetzt beim Auswählen verkleinert und zusätzlich als Base64 (`srcB64`) abgelegt.

**2. `llava:7b` stürzt beim Laden ab.** Aus deinen Ollama-Logs:

```
clip_ctx: CLIP using CPU backend
load_hparams: model size: 595.49 MiB
msg="waiting for server to become available" status="llm server not responding"
msg="Load failed" error="llama runner process has terminated with exit code -1"
```

Der Bild-Encoder (CLIP) lädt noch, dann stirbt der Modellprozess. **Nicht** zu
wenig RAM (15,3 GB frei) — mit hoher Wahrscheinlichkeit die **Quadro P620 mit
nur 2 GB VRAM**: Ollama versucht, Teile auf die Grafikkarte zu legen, dort passt
es nicht, der Prozess bricht ab.

---

## Schritt 1 — Absturzursache bestätigen (2 Minuten)

Per SSH auf den Server, dann das Modell **ohne** Grafikkarte starten:

```bash
sudo docker exec ollama sh -c 'CUDA_VISIBLE_DEVICES="" ollama run llava:7b "hallo"'
```

- **Antwortet es jetzt?** → Die Grafikkarte ist die Ursache. Weiter mit Schritt 2.
- **Stürzt es weiterhin ab?** → Es liegt nicht an der GPU. Dann bitte die
  vollständige Ausgabe von `sudo docker logs ollama --tail 100` sichern; die
  Fehlermeldung im Studio nennt dir seit dieser Runde ohnehin den wahrscheinlichsten
  Grund im Klartext.

## Schritt 2 — Ollama dauerhaft auf CPU-Betrieb stellen

In **ZimaOS → Ollama-App → Umgebungsvariablen** eine der beiden Zeilen eintragen
und die App neu starten:

```
OLLAMA_NUM_GPU=0
```
oder
```
CUDA_VISIBLE_DEVICES=
```

> **Ist das ein Rückschritt?** Nein. Eine 2-GB-Karte bringt für Modelle dieser
> Größe praktisch nichts — es passt schlicht nichts drauf. Sie verursacht nur
> genau diese Abstürze. Und die Entscheidung für diese Runde war ausdrücklich
> „**genau, auch wenn langsam**". Auf der CPU dauert ein Bild 20-60 Sekunden;
> die Zeitlimits sind darauf eingestellt (siehe unten).

## Schritt 3 — Ein Vision-Modell installieren und testen

Im Studio: **KI → „Modelle durchsuchen & installieren" → Filter „Kann Bilder"**.

| Modell | Größe | Einschätzung |
|--------|-------|--------------|
| `llama3.2-vision:11b` | ~7,9 GB | **Erste Wahl** — stärkstes Bildverständnis *und* bestes Deutsch der Kandidaten |
| `qwen2.5vl:7b` | ~6 GB | Passt sprachlich zum Textmodell `qwen2.5:7b`, etwas schneller |
| `llava:13b` | ~8 GB | Rückfall; erkennt viel, formuliert aber englisch-lastig |
| `moondream` | ~1,7 GB | Winzig und schnell, beschreibt nur grob, antwortet englisch |

**Bitte nicht blind festlegen — erst messen.** Im Studio unter **KI → Schnelltest**
ein echtes Tierfoto auswählen und fragen: *„Was siehst du auf diesem Bild?"*
Der Schnelltest zeigt unter der Antwort, **welches Modell** geantwortet hat und
wie lange es gedauert hat. Zwei Kandidaten vergleichen, den besseren behalten.

## Schritt 4 — Als Hintergrund-Modell setzen

Im Studio: **KI → Kachel „🖼️ Hintergrund — Bilder"** → Modell auswählen.

Ab jetzt schaltet der Server **automatisch** um:

- Nachricht **ohne** Bild → Vordergrund-Modell (`qwen2.5:7b`)
- Nachricht **mit** Bild → Hintergrund-Modell

In der App steht das klein an der Antwort: **`· KI`** bzw. **`· KI · Bild`**.

---

## Wenn etwas nicht klappt

Das Studio übersetzt Ollama-Fehler seit dieser Runde in verständliches Deutsch —
statt `exit code -1` steht dort der wahrscheinliche Grund samt Lösungsvorschlag.

Wichtig für die Fehlersuche: **Bei Bild-Problemen antwortet nicht mehr still der
Bot.** Genau diese stille Rückfalllösung war die Falle — man sah eine plausible
Antwort und erfuhr nie, dass das Foto nie angekommen war. Jetzt gilt:

| Situation | Verhalten |
|-----------|-----------|
| Ollama gar nicht erreichbar (Vorführung ohne Netz) | Bot antwortet still — wie bisher, gut für die Jury |
| Kein Hintergrund-Modell gesetzt | **Sichtbarer Hinweis** in der Nachricht |
| Bild zu groß / Server lehnt ab | **Sichtbarer Hinweis** in der Nachricht |
| Bild-Modell stürzt ab oder braucht zu lange | **Sichtbarer Hinweis** in der Nachricht |

## Eingestellte Werte (alle im Studio änderbar)

| Einstellung | Standard | Warum |
|-------------|----------|-------|
| Bild verkleinern auf | 1024 px | Reicht jedem Vision-Modell; ein 4-MB-Foto wäre als Base64 ~5,3 MB und lief vorher in ein HTTP 413 |
| Zeitlimit Text | 60 s | unverändert |
| Zeitlimit Bild | 180 s | CPU-Betrieb braucht das |
| Zeitlimit App-seitig | 45 s Text / 120 s Bild | die App gab vorher schon nach 45 s auf |
| Body-Limit des Servers | 8 MB | war 2 MB — jede Bildanfrage endete in HTTP 413 |

## Was du dafür neu bauen musst

Die Handy-App braucht wegen des neuen Pakets `expo-image-manipulator` (Bild
verkleinern + Base64) einen **neuen EAS-Build**. Die Kamera-Berechtigung aus
Runde 2 wartet ohnehin schon auf einen Build:

```bash
cd "C:/Users/basti/Documents/VetNow ALL/vetnow-app/mobile" && eas build --platform android --profile preview-demo
```

Die **Web-App** braucht nichts Zusätzliches — dort geht das Verkleinern über
`<canvas>`, ganz ohne Paket.
