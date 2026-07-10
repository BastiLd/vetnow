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
