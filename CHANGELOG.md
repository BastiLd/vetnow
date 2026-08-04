# VetNow — Changelog „Großausbau 2.0"

Alle Änderungen dieser Ausbaustufe, durchnummeriert. (Web = `web/`, Mobile = `mobile/`, Studio = `studio/`)

## 🤖 Bot 2.0 — komplett neuer Auto-Antwort-Bot (Web + Mobile)

1. Neues eigenständiges Bot-Modul `bot.js` — identische Logik in Web und Mobile
2. Intent-Erkennung mit Prioritäten (Notfall schlägt alles)
3. Gift-Erkennung: Schokolade, Zwiebel, Knoblauch, Weintrauben/Rosinen, Xylit, Avocado, Rattengift, Schneckenkorn, Ibuprofen, Paracetamol, Lilien, Frostschutzmittel
4. Vergiftungs-Antwort: „NICHT Erbrechen auslösen" + Verpackung mitbringen + Mengen-Rückfrage
5. Notfall-Triage: Sofort-Anweisung + zweite Nachricht mit Vorbereitungs-Rückfragen
6. Symptom-Intent: erbricht, Durchfall, frisst nicht, humpelt, kratzt sich, niest, Husten, Fieber, Schwellung, Ohrenentzündung, Wunde, Zecke u. v. m.
7. Symptom-Rückfragen variieren („Seit wann?", „Frisst und trinkt er normal?", „Plötzlich oder schleichend?")
8. Termin-Intent mit konkreten Zeitvorschlägen (z. B. „morgen 09:30 oder 14:00 Uhr")
9. Slot-Gedächtnis: Bot merkt sich den angebotenen Termin — „passt" → „Termin morgen um 09:30 ist eingetragen ✅"
10. Nach Terminbestätigung: Erinnerung „Impfpass mitbringen"
11. Termin-verschieben/absagen-Intent mit neuen Vorschlägen
12. Öffnungszeiten-Intent (inkl. Feiertags-/Notfall-Hinweis)
13. Preis-Intent mit realistischen Spannen + „Kosten werden VOR Behandlung besprochen"
14. Impf-Intent (Impfpass, Auffrischung, freie Termine)
15. Kastrations-Intent mit Vorgespräch-Angebot
16. Zahn-Intent (Zahnstein, Maulgeruch → Zahnsprechstunde)
17. Parasiten-Intent (Zecken, Flöhe, Wurmkur, Spot-on — inkl. Frequenz-Empfehlung)
18. Ernährungs-Intent (Futterplan, Wiegen, Beratungstermin)
19. Medikamenten-Warnung: „KEINE Menschen-Medikamente — Ibuprofen/Paracetamol sind giftig!"
20. Reise-Intent: EU-Heimtierausweis, Mikrochip, Tollwutimpfung 21-Tage-Regel
21. Adresse/Anfahrt-Intent (verweist auf Route-Button)
22. Hausbesuch-Intent (Adresse + Wunschzeit erfragen)
23. Danke-/Begrüßungs-/Verabschiedungs-Intents mit je mehreren Varianten
24. Generische Fragen-Erkennung („…?") mit hilfreicher Rückfrage
25. **Tiernamen-Extraktion**: „mein Hund Balu humpelt" → Bot spricht Balu mit Namen an
26. Tierart-Erkennung aus 25+ deutschen Wörtern (Hündin, Kater, Welpe, Kaninchen, Bartagame, Wellensittich …)
27. Gesprächskontext wird aus dem Verlauf rekonstruiert (kein State nötig)
28. Offene-Frage-Erkennung: kurze Antworten wie „seit gestern" → passendes Follow-up mit Terminvorschlag
29. Antwortvariation: 2–3 Formulierungen je Intent, deterministisch gewählt (nie zweimal exakt dieselbe Floskel hintereinander)
30. **Mehrteilige Antworten**: Bot sendet bei Bedarf 2 Nachrichten nacheinander (wie echte Menschen)
31. Praxisname wird in Antworten eingewoben („willkommen bei Tierarztpraxis Drautal")
32. Eigene Tierhalter-Persona, wenn der Bot im Praxis-Posteingang antwortet
33. Bild-Antworten (`botImageReply`) je nach Rolle
34. Kontextbezogene Begrüßung beim ersten Öffnen (mit Praxisname + Notfall-Hinweis)
35. Tipp-Dauer wächst realistisch mit der Textlänge (lange Antwort = längeres „tippt…")
36. Sauberes Abbrechen: Verlassen des Chats stoppt laufende Bot-Timer

## 🧠 Echte KI: Ollama-Anbindung (Web)

37. Neues Modul `lib/ai.js`: KI-Client mit Timeout + AbortController
38. `aiStatus()` — prüft Studio-Proxy + Ollama-Verbindung
39. `aiModels()` — listet auf dem Server installierte Modelle
40. `aiChat()` — holt echte Modell-Antworten
41. Tierarzt-System-Prompt mit Sicherheitsregeln (keine Dosierungen, Notfall → sofort anrufen, kurz + deutsch)
42. Chat-Verlauf wird ins KI-Format übersetzt (letzte 10 Nachrichten, inkl. Bilder/Notizen als Markierung)
43. KI-Modus im Chat: Antworten kommen vom lokalen Ollama-Modell statt vom Template-Bot
44. **Automatischer Fallback**: KI nicht erreichbar (z. B. auf GitHub Pages) → eingebauter Bot übernimmt nahtlos
45. Admin: Schalter „Echte KI-Antworten verwenden"
46. Admin: KI-Adresse konfigurierbar (leer = automatisch übers Studio)
47. Admin: Modell-Auswahl als Dropdown (lädt installierte Modelle vom Server)
48. Admin: „Verbindung testen"-Button mit Erfolgs-/Fehler-Anzeige und Erklärung
49. Chat-Einstellungen erweitert: `botMode`, `aiModel`, `aiBaseUrl`, `agentEnabled`

## 🕹️ KI-Agent — bedient die App sichtbar (Web)

50. Neues Agent-Panel (`agent.jsx`) mit schwebendem 🤖-Button
51. Agent **navigiert wirklich sichtbar** durch die App (Start → Dashboard → Suche → Ergebnisse …)
52. Agent wechselt sichtbar die Dashboard-Tabs (Status/Termine/Posteingang/Profil)
53. Agent setzt sichtbar Suchfilter (z. B. Hund + Notfall + Villach + nur grün)
54. 3 Aufgaben-Vorlagen: „Tag als Praxis simulieren", „Notfall-Durchlauf", „Praxis-Check"
55. Freitext-Aufgaben („Simuliere einen Tag aus Sicht der Ambulanz…") mit automatischer Zuordnung
56. Live-Log: jeder Schritt erscheint als animierte Zeile
57. Tempo wählbar: 🐢 langsam (zum Zusehen) / 🚶 normal / 🐇 schnell
58. Stopp-Knopf bricht jederzeit ab
59. **Abschlussbericht aus echten App-Daten** (Termine heute, ungelesene Anfragen, Praxis-Ampel-Verteilung)
60. Bericht wird von der KI frei formuliert, wenn Ollama verbunden ist (sonst strukturiertes Template)
61. Puls-Animation + Glühen am Button, solange der Agent arbeitet
62. Agent im Admin ein-/ausschaltbar
63. Event-System (`vn:agent`): App und Dashboard reagieren auf Agent-Befehle
64. Agent-Design: Panel, Log-Zeilen-Animation, Berichts-Karte (CSS)

## 📐 Design-Fixes: nichts wird mehr verdeckt (Web)

65. Auth-/Login-Seite: Logo respektiert Notch/Statusleiste (Safe-Area oben)
66. Untere Tab-Bar respektiert Home-Indikator (Safe-Area unten)
67. Sticky-Suchleiste („Ergebnisse anzeigen") über dem Home-Indikator
68. Sticky-Aktionsleiste (Praxis-Detail) über dem Home-Indikator
69. Chat-Eingabezeile über dem Home-Indikator
70. Modale Dialoge mit Safe-Area-Abstand oben/unten
71. Toasts erscheinen über Tab-Bar + Home-Indikator (nie verdeckt)
72. Extension-Vorschau mit Safe-Area oben
73. Chat-Kontextmenü (Bearbeiten/Anpinnen/Löschen) wird nicht mehr abgeschnitten

## 📱 Mobile: zwei Versionen + Bot 2.0

74. Neues `lib/config.js`: `EXPO_PUBLIC_VN_CLEAN`-Flag
75. **Saubere Mobile-Version**: keine Testdaten, kein Chat-Seed — zum Weitergeben
76. Kein „Aufblitzen" von Testdaten beim Start der sauberen Version
77. Standard-Labels bleiben auch in der sauberen Version verfügbar
78. `isClean` im App-Context für alle Screens abfragbar
79. Admin (clean): erklärender Hinweis statt wirkungslosem Testdaten-Schalter
80. Bot 2.0 im Mobile-Chat (gleiche Intents/Kontext/Triage wie Web)
81. Mehrteilige Bot-Antworten mit gestaffelter Tipp-Animation (Mobile)
82. Auth-Hero: Logo nie mehr von der Notch verdeckt (`useSafeAreaInsets`)
83. Zwei vorkonfigurierte Expo-Apps im Studio: sauber (Port 8081) + Demo (Port 8082)

## 🎛️ VetNow Studio 2.0 — Backend

84. Einstellungs-API: `GET/PUT /api/settings`, persistiert in `/data/settings.json`
85. Nur bekannte Einstellungs-Schlüssel werden gespeichert (keine Datei-Verschmutzung)
86. Ollama-Proxy: `GET /api/ai/status` (Version + Erreichbarkeit)
87. Ollama-Proxy: `GET /api/ai/models` (Name, Größe in GB, Familie, Parameter)
88. Ollama-Proxy: `POST /api/ai/pull` — **streamt den Download-Fortschritt live durch** (bis 1 h)
89. Ollama-Proxy: `DELETE /api/ai/models/:name`
90. Ollama-Proxy: `POST /api/ai/chat` mit Standard-Modell + konfigurierbarem Timeout
91. Ollama-Adresse: Einstellung → Umgebungsvariable → Auto (`HOST_IP:11434`)
92. Selbst-Update: `GET /api/update/check` (git fetch, Anzahl neuer Commits, neueste Nachricht)
93. Selbst-Update: `POST /api/update/apply` — git pull; **im Container: automatischer Neustart**, Entrypoint baut den neuesten Stand
94. Docker-Erkennung (`IN_DOCKER` + `/.dockerenv`)
95. `/api/status` erweitert: Studio-Version, Uptime, Git-Commit/-Branch/-Nachricht/-Datum
96. **Apps aus fremden Git-Repos**: `repoUrl` je App — Studio klont/aktualisiert automatisch (z. B. „Duolingo für Recht")
97. Externe Repos landen sauber unter `/data/ext-repos/<app-id>`
98. Web-Vorschau + Extension-ZIP funktionieren auch für externe Repos
99. **Eigene Umgebungsvariablen je Expo-App** (so laufen saubere + Demo-Variante parallel)
100. App-Duplizieren-Endpoint (Expo-Port automatisch +1, eigener Vorschau-Pfad)
101. `clone`-Aktion zum manuellen Klonen externer Repos
102. Log-Puffergröße pro App aus den Einstellungen (50–5000 Zeilen)
103. Gruppen mit Icon + Beschreibung
104. Fünf Standard-Apps: Web sauber, Web Demo+Bot, iPhone sauber, iPhone Demo+Bot, Extension

## 🖥️ VetNow Studio 2.0 — Oberfläche

105. Komplett neue Navigation: 4 Tabs — 🗂️ Apps · 🧠 KI · ⚙️ Einstellungen · 🖥️ System
106. **Klickbare Gruppen-Kacheln** mit Icon, Farbe, Beschreibung, App-Anzahl und „läuft"-Zähler
107. Farbiger Seitenstreifen je Gruppe
108. Hover-Effekt hebt Kachel mit der Gruppenfarbe an
109. Gruppen-Detailseite mit „‹ Alle Projekte"-Zurück-Navigation
110. „+ App in dieser Gruppe"-Button im Gruppen-Detail
111. Klick aufs Logo führt immer zur Übersicht
112. **Einstellungs-Suche über Titel + Beschreibung + Stichwörter** — man findet Einstellungen auch, wenn man nur weiß, WAS sie tun („wie oft aktualisieren", „dunkel", „port")
113. Mehrwort-Suche: alle Suchwörter müssen vorkommen
114. Suchtreffer werden gelb hervorgehoben (auch in der Beschreibung)
115. Kategorie-Chips: Alle · Darstellung · Verhalten · KI · Updates · Info
116. Einstellung „Farbschema" (Dunkel/Hell) — wirkt sofort
117. Einstellung „Akzentfarbe" — färbt Buttons/Tabs/Highlights live um
118. Einstellung „Kartendichte" (Normal/Kompakt)
119. Einstellung „Typ-Anzeige auf Karten" (Web/Expo/Extension-Badges)
120. Einstellung „Gruppen-Ansicht" (Kacheln/Liste)
121. Einstellung „Auto-Aktualisierung" (Sekunden, 0 = aus)
122. Einstellung „Log-Zeilen pro App"
123. Einstellung „Logs automatisch öffnen" bei Build/Start
124. Einstellung „Löschen bestätigen"
125. Einstellung „Ollama-Adresse"
126. Einstellung „Standard-KI-Modell"
127. Einstellung „KI-Antwortzeit-Limit"
128. Einstellung „Update-Prüfung (Minuten)" mit gelbem Hinweis-Punkt
129. Info-Eintrag „Auto-Update beim Start" (erklärt die Update-Kette, durchsuchbar)
130. Info-Eintrag „Ports des Studios" (3000/8081/8082, durchsuchbar)
131. Info-Eintrag „Wo liegen meine Daten?" (Volumes, durchsuchbar)
132. Info-Eintrag „Eigene Projekte hinzufügen" (fremde Repos, durchsuchbar)
133. Einstellungen speichern automatisch (entprellt) mit Bestätigungs-Toast
134. Theme/Farbe/Dichte werden ohne Neuladen angewendet
135. Vollständiges **Light-Theme** (alle Flächen, Linien, Eingaben, Modals)
136. Akzentfarbe über CSS-Variablen im gesamten Studio
137. **KI-Tab**: Status-Karte mit grünem/rotem Verbindungs-Punkt + Ollama-Version
138. KI-Tab: Liste installierter Modelle mit Größe (GB) und Parametern
139. „⭐ Als Standard nutzen" je Modell (setzt das Bot-Modell)
140. Modell vom Server löschen (mit Bestätigung)
141. **Modell-Shop**: 10 kuratierte Modelle mit deutscher Beschreibung + Downloadgröße
142. Empfehlungs-Stern für `gemma2:2b`
143. „installiert"-Kennzeichnung im Shop
144. **Download mit Live-Fortschritt** (Prozent + geladene GB, Balken)
145. „↻ Erneut laden" für schon installierte Modelle
146. **Schnelltest-Chat**: Frage eintippen → Antwort des Standard-Modells direkt im Studio
147. **System-Tab**: 6 Info-Kacheln (Version, Commit, letzte Änderung, Laufzeit, Server-IP, Umgebung)
148. „🔍 Auf Updates prüfen" mit Ergebnisanzeige („2 Updates verfügbar — Neuestes: …")
149. **„⬆ Update installieren & neu starten"** — ein Klick, Seite lädt automatisch neu
150. Gelber Update-Punkt am System-Tab bei verfügbaren Updates (periodische Prüfung)
151. Schnellzugriff-Links: GitHub-Repo + öffentliche Web-App
152. App-Formular: Feld „Git-Repo-URL" mit Erklärung (fremde Projekte)
153. App-Formular: Umgebungsvariablen-Editor (eine `KEY=VALUE` pro Zeile)
154. App-Formular: Hilfetexte unter den Feldern (Vorschau-Pfad, Ports, Env)
155. App-Karten: ⧉ Duplizieren-Button
156. App-Karten: „Env ✓"-Badge, wenn eigene Variablen gesetzt sind
157. App-Karten: „externes Repo"-Kennzeichnung
158. Log-Fenster öffnet automatisch bei Build/Start (abschaltbar)
159. Host-Chip in der Kopfzeile zeigt jetzt auch den Code-Stand (Commit)
160. Gruppen-Verwaltung: eigenes Icon je Gruppe
161. Gruppen-Verwaltung: Beschreibungsfeld je Gruppe
162. Gruppen-Verwaltung: nativer Farbwähler
163. Leere-Zustände mit gestricheltem Rahmen und Hinweistext
164. Alle dynamischen Ausgaben XSS-sicher escaped
165. Toast-Einblende-Animation
166. Responsive: Tabs nehmen auf Handys die volle Breite ein
167. QR-Fenster mit Hinweistext je Kontext (Kamera vs. Expo Go)
168. Auto-Refresh pausiert, solange ein Dialog offen ist

## 🐳 Docker & Auto-Update

169. **Auto-Update-Kette**: App in ZimaOS neu starten = Container zieht automatisch den neuesten Code von GitHub und baut die Web-App frisch
170. Zusätzlich 1-Klick-Update direkt im Studio (System-Tab), ohne ZimaOS anzufassen
171. Periodischer Update-Check mit Hinweis-Punkt (Intervall einstellbar)
172. `IN_DOCKER=1` im Image (aktiviert den Neustart-Mechanismus)
173. Port 8082 im Image freigegeben (zweiter Expo-Server)
174. Compose: Port-Mapping 8082 (iPhone-Demo)
175. Compose: `OLLAMA_URL` vorkonfiguriert auf den ZimaOS-Server
176. Compose-Kommentare erklären jede Zeile auf Deutsch
177. Studio-Version 2.0.0

## 🧩 Zwei Versionen überall

178. Web sauber (`/vetnow/`, GitHub Pages) — ohne Testdaten, zum Weitergeben
179. Web Demo + Bot (`/vetnow-demo/`) — 18 Praxen, Chats, Bot, Agent
180. **iPhone sauber** (Expo Port 8081, `EXPO_PUBLIC_VN_CLEAN=true`)
181. **iPhone Demo + Bot** (Expo Port 8082)
182. Alle 4 als getrennte Karten im Studio — einzeln bau-/startbar mit eigenem QR
183. Demo-Karten klar benannt („Demo + Bot") und farblich unterschieden

## 📄 Doku & Qualität

184. CHANGELOG.md (diese Datei) mit nummerierten Änderungen
185. README: Studio 2.0, KI/Ollama und 4-Versionen-Setup dokumentiert
186. Alle neuen Module mit deutschen Erklär-Kommentaren im Kopf
187. Getestet: Web-Build sauber + Demo (Vite)
188. Getestet: alle 13 Web-Screens per SSR-Smoke-Test
189. Getestet: Mobile-Bundle sauber + Demo (expo export)
190. Getestet: Studio-Boot + alle neuen Endpunkte (Settings, Update-Check, KI-Status, Duplizieren, App-Env)
191. Getestet: Ollama-Fehlerpfade (nicht erreichbar → verständliche Meldung, App fällt auf Bot zurück)

## 🔧 Feinschliff (Kleinigkeiten, die auffallen)

192. Bot: Notfall-Nachrichten kommen als Doppel-Nachricht (Dringlichkeit + Anweisungen)
193. Bot: „Danke"-Antworten enthalten den Tiernamen, wenn bekannt
194. Chat: Tipp-Blase erscheint NIE für die eigene Seite (nur wenn die Gegenseite tippt)
195. Chat: KI-Antworten zeigen die Tipp-Animation während der gesamten Modell-Laufzeit
196. Agent: Berichte enthalten konkrete Handlungsempfehlung als letzten Satz
197. Agent: bricht KI-Berichtserstellung sauber ab, wenn Ollama nicht antwortet
198. Studio: Expo-Port-Kollision beim Duplizieren automatisch vermieden (+1)
199. Studio: „Bauen"-Button während laufendem Build gesperrt (⏳)
200. Studio: Modell-Namen in Monospace (bessere Lesbarkeit von Tags wie `gemma2:2b`)
201. Studio: Update-Neustart lädt die Seite nach 15 s automatisch neu
202. Studio: Einstellungs-Suchfeld bekommt beim Öffnen automatisch den Fokus
203. Web: `.convo-list` overflow-Fix (Menüs ragen nicht mehr aus der Karte)
204. Mobile: Bot-Timer werden beim Verlassen des Threads aufgeräumt (keine Geister-Nachrichten)
205. Datenspiegelung Web ↔ Mobile automatisiert im Commit-Prozess (bot.js + data.js identisch)
206. KI ist jetzt STANDARD: `botMode: 'ai'` in Web & Mobile — Ollama (qwen2.5:7b) antwortet in allen Chats, der eingebaute Bot 2.0 bleibt als automatischer Fallback (z. B. GitHub Pages / APK ohne Server)
207. Mobile: eigene KI-Anbindung (`mobile/src/lib/ai.js`) — findet den Studio-Proxy automatisch über den Metro-Host (Expo Go), per `EXPO_PUBLIC_AI_URL` (APK, in eas.json gesetzt) oder per App-Einstellung
208. KI „trainiert": deutlich besserer System-Prompt (NUR Deutsch, Sie-Form, Notfall-Triage, keine Dosierungen, Beispiel-Dialoge) + Feineinstellungen (temperature 0.4, num_ctx 4096, repeat_penalty 1.15) — Studio-Proxy reicht `options` jetzt an Ollama durch
209. Studio: Standard-Modell `qwen2.5:7b` (sehr gutes Deutsch), Modell-Katalog & Platzhalter aktualisiert; Chat-Einstellungen auf v2 migriert (KI-Standard greift auch bei bestehenden Installationen)
210. NUR NOCH KI im Chat: alter Regel-Bot komplett entfernt (Web + Mobile) — bei nicht erreichbarer KI erscheint eine sichtbare ⚠️-Fehlermeldung im Chat statt stillem Zurückfallen; Test-Befehle („Sag ‚…‘“) werden befolgt
211. KI-Agent 2.0: Die KI liest die Aufgabe und plant die Schritte SELBST (JSON-Modus, validierter Aktions-Katalog: Navigation, Dashboard-Tabs, Filter, Detailseiten) — nicht mehr drei feste Schablonen; Bericht immer per KI
212. docker-compose.yml neu: Ollama-Container gleich integriert (Modelle überleben Neustarts, Port 11434 offen zum Testen), fester EXPO_TOKEN-Platz, Anleitung für Neuinstallation im Datei-Kopf; Admin-Seite zeigt „KI immer aktiv“ statt totem Schalter

---

## 🐛 Fehlerbehebung & Nachrichten-Ausbau (vor Jugend Innovativ)

213. **Mobile: Praxis-Dashboard stürzte beim Öffnen ab** — `DashboardScreen.js` benutzte eine nirgends definierte Variable `clinicChats` (ReferenceError beim Rendern). Jetzt korrekt aus `visibleChats` gefiltert (`role === 'clinic'`)
214. **Mobile: Admin-Bereich stürzte in der sauberen Version ab** — `AdminScreen.js` verwendete `Text` ohne Import (nur im `IS_CLEAN`-Zweig sichtbar). Import ergänzt
215. **Chat zeigt keine Fehlermeldung mehr, wenn die KI fehlt** — der eingebaute Regel-Bot (`bot.js`) ist in Web und Mobile wieder als Fallback angeschlossen. Ohne Server/Netz antwortet der Bot statt „⚠️ KI NICHT ERREICHBAR"; mehrteilige Bot-Antworten werden nacheinander gesendet
216. Neues EAS-Build-Profil `preview-demo` für Vorführungen außerhalb des Heim-WLANs (Tailscale-Adresse eintragen; Anleitung ergänzt)
217. **Anmeldung überlebt den Neustart** — `auth` wird jetzt persistiert (Mobile: AsyncStorage `vn_auth`, Web: localStorage `vn_auth`). Mobile zeigt bis zum Laden eine leere Fläche statt kurz „abgemeldet"
218. Web: `auth` liegt jetzt im `AdminProvider` (über dem `ChatProvider`) — Voraussetzung für den Rollen-Filter
219. **Web: Abmelden-Button** — der `AccountChip` hat ein Menü mit „Abmelden" (vorher gab es gar keinen Weg hinaus)
220. **Rollen-Filter für Chats** (Web + Mobile): Tierhalter:innen sehen nur „Meine Tiere", Praxen Posteingang + Netzwerk, abgemeldet nichts. Statt leerer Liste erscheint ein Anmelde-Hinweis
221. Praxen bekommen zusätzliche Filter-Chips „Posteingang" / „Netzwerk"; der Chat-Editor bietet nur noch Rubriken an, die die eigene Rolle auch sehen kann
222. **Web: doppeltes Chat-System aufgelöst** — der Nachrichten-Tab des Praxis-Dashboards lief auf einem zweiten, nicht persistierten Datensatz (`D.CONVERSATIONS`). Er nutzt jetzt dieselbe Komponente `ChatsPanel` und denselben Store wie die Chats-Seite. `ChatView`, `MessagesPanel`, `clinicConvosMeta` und `ScreenOwnerMessages` entfernt; Abschlussnotizen aus dem Kalender landen im echten Chat-Store
223. **Nachrichten bearbeiten, löschen und mit Emoji reagieren** (Web + Mobile) — neue Store-Funktionen `editMessage` / `deleteMessage` / `toggleReaction`; Löschen ist weich (Platzhalter „Nachricht gelöscht", Inhalt wird wirklich entfernt), Bearbeiten zeigt „(bearbeitet)". Alte Demo-Nachrichten laufen unverändert weiter (keine Migration)
224. Mobile: langes Drücken auf eine Blase öffnet das Nachrichten-Menü; Web: kleiner „…"-Knopf je Nachricht
225. Gelöschte Nachrichten werden nicht mehr an die KI geschickt (`toAiMessages`)
226. **Anhänge: Kamera, Galerie und Dateien** — Mobile mit `expo-image-picker` (Kamera) und neuem `expo-document-picker`; Kamera-Berechtigung als Config-Plugin in `app.json` (wirkt erst nach neuem EAS-Build). Web mit drei Datei-Dialogen (Bild / Kamera via `capture` / beliebige Datei)
227. Web: Anhänge über 4 MB werden abgelehnt, und ein fehlgeschlagener localStorage-Schreibvorgang meldet sich jetzt sichtbar — vorher wären die Chats stillschweigend verloren gegangen
228. **Bot 2.1**: neue Anliegen (Augen, Haut/Allergie, Verhalten, Trächtigkeit, Senior-Vorsorge, Nachkontrolle, Versicherung/Kostenvoranschlag, Zweitmeinung, Abschied, Krallen-/Fellpflege), Entwarnungs-Erkennung („frisst wieder normal" ist kein Symptom mehr), tierartspezifische Zusätze, 4–5 Varianten je Anliegen, konkrete Preisantworten und eine deutlich ausgebaute Tierhalter-Persona

---

## 🎨 Runde 2 — Layout-Fehler, WhatsApp-Reaktionen, KI/Bot-Kennzeichnung, Bot 2.2

229. **Überlauf-Fehler behoben: Text lief aus der Chat-Karte heraus** — `.convo-snippet` war ein reines `<span>` (`display: inline`), auf dem `overflow`/`text-overflow` laut CSS-Spezifikation **wirkungslos** sind. Die bereits vorhandene Ellipsis-Regel greift jetzt (`display: block`); zusätzlich wird der Chat-Titel in `.convo-title` gekürzt statt umzubrechen
230. **Blasen der Gegenseite wurden künstlich breit gezogen** — `.bubble-row` fehlte das Gegenstück zu `.me`: ohne `align-self: flex-start` streckt der Flex-Container (`align-items: stretch`) die Zeile bis auf die volle `max-width: 78%`. Kurze Antworten sind jetzt textbreit
231. Chat-Panel auf `max-width: 720px` begrenzt — im breiten Praxis-Dashboard sah der Chat vorher völlig anders aus als auf der Chats-Seite (1180px statt 640px)
232. Weitere Überlauf-Härtung: `overflow-wrap: anywhere` auf Blasen (lange Links/Dateinamen sprengen die Karte nicht mehr), `min-width: 0` in allen Flex-Ketten, Kopfzeile des Threads kürzt Titel und Untertitel, Datei-Chip kürzt lange Dateinamen, Labels im Thread-Kopf auf schmalen Bildschirmen ausgeblendet
233. Handy: Blasenbreite sitzt jetzt am Wrapper statt an der Blase, Thread-Kopf kürzt mit `numberOfLines`, `Meta` unterstützt `numberOfLines`
234. **Geprüft:** 12 Seiten × 2 Breiten (375 px und 1440 px) im echten Browser vermessen, inkl. Extremfall mit 170 Zeichen ohne Leerzeichen und 62-Zeichen-Chattitel — **0 px Überlauf**
235. **Reaktionen wie bei WhatsApp** — statt einer eigenen Zeile unter der Blase sitzt jetzt ein kleines rundes Emoji-Badge auf der unteren Blasenkante (11 px Überlappung, 2 px Rand in Hintergrundfarbe für den „ausgestanzten" Effekt). Web per `position: absolute`, Handy analog mit `paddingBottom` am Wrapper, damit Android das Badge nicht abschneidet
236. **Antworten sind jetzt als „· KI" oder „· Bot" gekennzeichnet** — neues optionales Feld `source` an beiden Antwortpfaden in beiden Apps, angezeigt klein hinter der Uhrzeit. Damit ist bei einer Vorführung sofort erkennbar, ob wirklich die KI geantwortet hat
237. **Bot 2.2: 594 → 951 Zeilen, 33 → 47 Anliegen, 272 Antwortvarianten** — neu: Entlaufen/Mikrochip, Silvester & Gewitter, Hitzevorbeugung, Narkose-Angst, OP-Nachsorge, Proben abgeben, Notdienst, Überweisung an Spezialist:in, Mehrtier-Haushalt, Welpen/Kitten, Gelenke/Arthrose, Gewichtsmanagement, Ratenzahlung
238. Bot: eigene Tabelle für **häufige Irrtümer** (`MYTHS`) — Wohnungskatzen-Impfung, Milch für Katzen, Knochen füttern, warme Nase, Schwarz-Weiß-Sehen, Grasfressen, „einmal werfen ist gesünder", „ein bisschen Schokolade schadet nicht", Kastration macht dick, Zecken nur im Sommer, Katzen landen immer auf den Pfoten. Der Bot widerspricht höflich **und begründet** — bei akuten Beschwerden hat die Symptom-Antwort weiterhin Vorrang
239. Bot: tierartspezifische Zusätze jetzt in **12 statt 5** Anliegen (Haut, Augen, Senior, Verhalten, Gewicht, Fellpflege, Gelenke, Hitze zusätzlich) — dieselbe Frage bekommt für Katze, Hund, Kleintier, Pferd, Vogel und Reptil eine andere Antwort
240. Bot: Grammatik-Fehler behoben — der Platzhalter ohne bekannten Tiernamen war fest „Ihrem Tier" (Dativ) und landete dadurch in Sätzen wie „Wie viel wiegt Ihrem Tier?". Jetzt zwei Varianten (`petRef` / `petDat`), 12 Stellen korrigiert
241. Bot: Tierhalter-Persona reagiert auf deutlich mehr Praxis-Nachfragen (Zustand, Nüchternheit, Medikamentengabe, Schonung, Untersuchungen, Kosten, Unterlagen)
242. **Studio: Standard-Modell auf `qwen2.5:3b`** — `qwen2.5:7b` braucht allein für Ollama ~8 GB RAM, der Server hat ≤ 8 GB insgesamt. Stern im Katalog verschoben, RAM-Hinweise in beiden Beschreibungen, Platzhalter und Doku angepasst. `qwen2.5:7b` bleibt als Testoption im Katalog. **Achtung:** auf bestehenden Installationen einmalig umstellen (Studio → KI → „⭐ Als Standard nutzen"), der Standard greift sonst nur bei Neuinstallation
243. `ANLEITUNG-AUSSERHALB-WLAN.md`: Tailscale **direkt auf dem Server per SSH** als empfohlener Weg ergänzt (inkl. Tabelle „was muss wo installiert werden"). Grund: Ollama läuft als eigene ZimaOS-App außerhalb des bisher dokumentierten Docker-Sidecars und wäre über diesen möglicherweise gar nicht erreichbar. Der Sidecar-Weg bleibt als Alternative ohne SSH bestehen
244. `BACKEND-FAHRPLAN.md` *(neu)*: vollständiger Fahrplan für ein echtes Supabase-Backend (Datenmodell, RLS, Umbauschritte, Kosten) — **bewusst nicht umgesetzt**, gedacht für die Zeit nach der Einreichung. Kernaussage: Der kostenlose Tarif reicht bei Weitem, die Hürde ist Zeit, nicht Geld

---

## 🖼️ Runde 3 — Echte Bilderkennung + Studio-Generalüberholung

245. **Der eigentliche Grund, warum Bilderkennung nie funktionierte:** `toAiMessages()` ersetzte jedes Bild durch den Text `[Bild gesendet]` und **verwarf `m.src`**. Es kam also nie ein Bild bei der KI an — auch ein perfekt laufendes `llava` hätte nur geraten. Bilder gehen jetzt als `images: ['<base64>']` an Ollama (Web + Mobile)
246. Mobile: Der Bild-Picker liefert nur einen Dateipfad (`file:///…`) **ohne Bilddaten**. Fotos werden jetzt beim Auswählen über `expo-image-manipulator` auf 1024 px verkleinert und zusätzlich als Base64 (`srcB64`) abgelegt — `src` bleibt der Pfad für die Anzeige
247. Web: Bilder werden vor dem Speichern per `<canvas>` auf 1024 px heruntergerechnet und als JPEG (0,7) neu kodiert — aus einem 4-MB-Foto werden typisch 150-400 KB. Ohne das endete jede Bildanfrage in einem **HTTP 413**
248. `studio/server.js`: `express.json`-Limit von **2 MB auf 8 MB** angehoben (Bild + Verlauf + Prompt)
249. Nur das **letzte** Bild des Verlaufs wird mitgeschickt — alle Bilder der letzten zehn Nachrichten hätten Request und Antwortzeit gesprengt
250. **Automatisches Umschalten Vorder-/Hintergrundmodell:** Enthält eine Nachricht ein Bild und ist ein Vision-Modell gesetzt, antwortet dieses statt des Textmodells. Neue Einstellungen `ollamaVisionModel` und `aiAutoVision`. Die Antwort trägt jetzt `vnModel`/`vnVision`, die Apps zeigen das als **`· KI`** bzw. **`· KI · Bild`**
251. Zeitlimits angehoben: Client 45 s Text / **120 s Bild**, Server 60 s Text / **180 s Bild** — ein Vision-Modell auf der CPU braucht 20-60 s, vorher brach die App vorher ab
252. **Stille Fehler beseitigt (der Kern der Falle):** Bisher fing `catch {}` jeden Fehler ab und ließ den Bot antworten — bei einem 413 oder Modellabsturz sah man also eine plausible Antwort und erfuhr **nie**, dass das Bild nie ankam. Jetzt unterscheidet der Server per Fehlercode: `offline` → Bot antwortet weiterhin **still** (Vorführung ohne Netz bleibt sauber), alles andere → **sichtbarer Hinweis** an der Nachricht
253. **Download-Abbruch behoben (der gemeldete Fehler):** `render()` setzt `#view.innerHTML = ''` und warf damit die Fortschrittsbalken aus dem DOM — `pullModel()` schrieb danach in abgehängte Knoten, der Download lief unsichtbar weiter. Der Zustand liegt jetzt in einer modul-globalen Registry `activePulls`, die Anzeige in einem schwebenden Panel **außerhalb** von `#view`. Getestet: Tabwechsel, zweiter fertiger Download, mehrere parallele Downloads
254. `renderAi()` ist `async`, wurde aber ohne Sequenzprüfung aufgerufen → ein Rerender während der Ladephase befüllte abgehängte Knoten und der Shop blieb leer. Jede Seite hat jetzt eine Rendernummer und bricht ab, wenn sie überholt wurde
255. `studio/server.js` Modell-Download: `res.on('close')` ergänzt (der Server pumpte weiter, wenn der Browser wegbrach) und `res.status()` nach begonnenem Stream vermieden (warf `ERR_HTTP_HEADERS_SENT`) — Fehler kommen jetzt als letzte NDJSON-Zeile an
256. **Neue Proxy-Endpunkte** `GET /api/ai/model/:name` (Ollama `/api/show`, gecacht) und `GET /api/ai/running` (`/api/ps`). Damit kommt „Kann Bilder" aus den echten `capabilities` des Modells statt aus einer Hardcoding-Liste; dazu Kontextlänge, Quantisierung und Parameterzahl
257. `/api/ai/models` wirft `quantization_level`, `families` und `modified_at` nicht mehr weg
258. **Neue KI-Seite:** Statusleiste, zwei Kacheln für Vorder-/Hintergrundmodell mit Direktauswahl, Anzeige der gerade geladenen Modelle samt Speicherverbrauch, und ein **schwebender Modell-Browser** mit Mehrwort-Suche über Name *und* Beschreibung plus Filter-Chips (*Alle · Empfohlen · Installiert · Kann Bilder · Klein < 2 GB*)
259. **Schnelltest kann jetzt Bilder:** Foto auswählen, Frage stellen — die Antwort nennt darunter, welches Modell geantwortet hat. Damit lässt sich die Bilderkennung ohne App prüfen
260. **Modell-Katalog strukturiert** statt „alles in einen Satz": Download-Größe, RAM-Bedarf, Sterne-Eignung für den VetNow-Chat, Kategorie, Vision-Flag. Fünf Bild-Modelle ergänzt. Die **falschen „≤ 8 GB RAM"-Texte aus Runde 2 korrigiert** — der Server hat 15,3 GB, Standard ist wieder `qwen2.5:7b`
261. **Neun neue Einstellungen** (alle in `SETTINGS_DEFAULT`, sonst würden sie nicht gespeichert): Hintergrund-Modell, Auto-Vision, Zeitlimit Bild, maximale Bildkante, sowie `temperature`/`top_p`/`num_ctx`/`repeat_penalty` — die waren bisher in beiden Apps fest verdrahtet. Die Apps schicken keine eigenen Optionen mehr, damit die Studio-Einstellung wirklich greift
262. Einstellungs-Zahlenfelder verstehen jetzt **Kommazahlen** — mit `parseInt` wäre `temperature: 0.4` beim Speichern zu `0` geworden
263. **Verständliche Fehlermeldungen:** Übersetzungstabelle für die häufigsten Ollama-Fehler. Aus `llama runner process has terminated with exit code -1` wird „Das Modell konnte nicht geladen werden. Häufigste Ursache: Es passt nicht auf die Grafikkarte. Tipp: Ollama auf reinen CPU-Betrieb stellen (OLLAMA_NUM_GPU=0)."
264. **Handy-tauglich:** Bisher gab es genau einen Breakpoint. Jetzt brechen Modell-Raster, Gruppen, App-Karten und Kennzahlen auf einspaltig um, Modals nutzen die volle Höhe, Einstellungszeilen stapeln, Filter-Chips scrollen seitlich. Geprüft bei 375 px auf allen Seiten: **0 px Überlauf**
265. **App-Karten** zeigen den Zustand als Farbstreifen (läuft / gestoppt / arbeitet gerade, letzterer pulsierend) statt nur als Pill-Sammlung
266. **Logs**: Suche mit Treffer-Hervorhebung, „Nur Fehler"-Filter mit Zähler, und farbige Zeilen (Fehler rot, Warnungen gelb, Erfolg grün) — vorher war alles gleich grau
267. `BILDERKENNUNG-EINRICHTEN.md` *(neu)*: erklärt beide Ursachen, den `llava:7b`-Absturz (CLIP auf CPU, dann `exit code -1` — vermutlich die 2-GB-Quadro), den CPU-Fix per SSH, die Modellauswahl und was bei Problemen jetzt sichtbar wird
