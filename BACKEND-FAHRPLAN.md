# Fahrplan: echtes Backend mit Supabase

> **Status: nur geplant, NICHT umgesetzt.** Dieses Dokument beschreibt, wie VetNow von
> „alles lokal auf einem Gerät" auf echte Konten und geräteübergreifende Chats umgestellt
> würde. Es ist bewusst eine Vorbereitung für später — z. B. nach der Einreichung bei
> Jugend Innovativ. Vor einer Deadline sollte man das nicht anfangen.

## Warum überhaupt?

Der heutige Stand ist eine bewusste Entscheidung (kein Server, kein Konto, nichts zu
bezahlen) — hat aber drei klare Grenzen:

1. **Zwei Personen sehen nicht denselben Chat.** Alles liegt in `AsyncStorage` (Handy) bzw.
   `localStorage` (Browser). Ein Chat auf dem Handy deines Freundes und ein Chat auf deinem
   Laptop sind zwei völlig getrennte Datensätze.
2. **Die Anmeldung ist eine Attrappe.** `auth` ist nur `{ role, name }`; geprüft wird beim
   Login nur, dass die Felder nicht leer sind (`AuthScreens.js`, `screens-d.jsx`). Es gibt
   kein Passwort, das irgendwo gegengeprüft würde.
3. **Anhänge sprengen den Speicher.** Bilder und Dateien werden als Base64-Text direkt in
   den Chat gelegt. Deshalb gibt es die 4-MB-Grenze und die sichtbare Warnung, wenn der
   Speicher voll ist — technisch eine Notbremse, keine Lösung.

## Was kostet das? (Die eigentliche Frage)

**Wahrscheinlich nichts.** Der kostenlose Supabase-Tarif enthält:

| Leistung | Kostenloser Tarif | Braucht VetNow realistisch |
|----------|-------------------|----------------------------|
| Postgres-Datenbank | 500 MB | ein paar MB |
| Dateispeicher | 1 GB | für Demo-Bilder mehr als genug |
| Anmeldung (Auth) | inklusive | ✔ |
| Echtzeit-Sync | inklusive | ✔ |
| Aktive Nutzer:innen | 50.000 / Monat | zweistellig |

**Das Preisgeld wird dafür also gar nicht gebraucht.** Die eigentliche Hürde ist die
**Zeit für den Umbau**, nicht das Geld. Ein kostenloses Projekt pausiert allerdings nach
einer Woche ohne Zugriff — vor einer Vorführung also einmal kurz öffnen.

## Datenmodell (Entwurf)

```
profiles          id (= auth.users.id), role ('owner'|'clinic'), name, created_at
chats             id, role ('owner'|'clinic'|'network'), title, sub, animal,
                  color, icon, labels[], pinned, created_by, created_at
chat_members      chat_id, user_id            ← wer darf diesen Chat sehen
messages          id, chat_id, sender_id, from_role, text, type ('text'|'image'|'file'|'note'),
                  attachment_path, file_name, file_mime, reactions (jsonb),
                  source ('ai'|'bot'|null), edited_at, deleted_at, created_at
```

Wichtig: **`chat_members` ist der Kern der Zugriffsregeln.** Heute ist `chat.role` nur eine
Rubrik („Meine Tiere" / „Posteingang" / „Netzwerk") und keine Besitzangabe. Mit einem echten
Backend muss geregelt sein, wer welchen Chat lesen darf — dafür sind in Postgres
Row-Level-Security-Regeln (RLS) da: „lesen darf, wer in `chat_members` steht".

## Umbau in Schritten

1. **Projekt anlegen** (kostenlos, ~5 Minuten). Kann ich direkt übernehmen — ich habe
   Zugriff auf ein Supabase-Werkzeug.
2. **Tabellen + RLS-Regeln** wie oben anlegen. Ohne RLS wären alle Daten öffentlich lesbar —
   dieser Schritt darf nicht übersprungen werden.
3. **Echte Anmeldung**: `supabase.auth.signUp` / `signInWithPassword` ersetzt die
   Nicht-leer-Prüfung. Die bestehende Persistenz (`vn_auth`) fällt weg, das übernimmt
   Supabase selbst.
4. **Chat-Store umstellen** — `mobile/src/lib/ChatContext.js` und `web/src/lib/chats.jsx`.
   Statt `AsyncStorage`/`localStorage` Abfragen gegen Supabase, plus
   `supabase.channel(...).on('postgres_changes', ...)` für Live-Updates.
   Die vorhandenen Funktionen (`addMessage`, `editMessage`, `deleteMessage`,
   `toggleReaction`) bleiben von außen gleich — nur ihr Innenleben ändert sich. Das ist der
   Grund, warum der Umbau überhaupt machbar ist.
5. **Anhänge in einen Storage-Bucket** hochladen statt als Base64 einzubetten. Damit
   verschwindet die 4-MB-Grenze samt Warnung.
6. **Reihenfolge beim Testen:** erst Web (schneller Reload), dann Mobile.

## Realistische Einschätzung

- Betroffen ist fast jede Datei in `lib/` — aber **kaum eine Bildschirmansicht**, weil die
  Oberfläche nur die Store-Funktionen aufruft.
- Der Bot-Fallback (`bot.js`) und die KI-Anbindung (`ai.js`) sind davon **nicht** betroffen.
- Das ist eine **eigene Projektphase**, kein Nebenbei-Schritt. Wer es zwischen zwei anderen
  Aufgaben versucht, hat am Ende beides halb fertig.
- **Empfehlung:** erst nach der Einreichung. Das lokale Konzept ist für eine Vorführung
  sogar im Vorteil — es funktioniert garantiert ohne Netz.

## Was heute schon dafür vorbereitet ist

- Nachrichten haben seit Runde 1 eine eigene `id` (`m-…`), auch wenn intern noch über den
  Array-Index adressiert wird — beim Umzug in eine Datenbank wird daraus der Primärschlüssel.
- Optionale Felder (`editedAt`, `deleted`, `reactions`, `source`, `fileName`, `fileMime`)
  entsprechen bereits genau den geplanten Spalten.
- Rollen sind sauber getrennt (`rolesForAuth` in beiden Apps) — daraus werden später die
  RLS-Regeln.
