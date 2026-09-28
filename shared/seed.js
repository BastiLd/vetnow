/* VetNow — Start-Datenbestand (Seeds), Vertrag §4 „Seeds".

   Warum Funktionen statt fester Arrays wie im alten data.js?
   In v2 war alles fest verdrahtet: TODAY_ISO = '2026-06-04', Status 'green' mit dem Text
   „heute, 08:30", Nachrichten mit time: 'Gestern 16:20'. Ab dem 05.06. war der Kalender leer,
   und „heute" stimmte nie (Web-/Projekt-Audit). Jetzt wird ALLES relativ zu `now` berechnet:
   Wer die Demo morgen startet, sieht dieselbe Geschichte — nur eben mit morgigem Datum.

   buildDemoSeed(now)  → vollständige Demo (18 Praxen, Chats, Termine, Blockzeiten, Labels)
   buildEmptySeed(now) → saubere Version: keine Testdaten, aber die Standard-Labels. */
import { DATA_SCHEMA } from './version.js';
import { DISTRICT_LONG, DEMO_OWNER, DEMO_PRACTICE_ID, defaultSettings, seedLabels } from './constants.js';
import { HOUR, MINUTE, todayISO, addDays, tsAt, weekdayMon0 } from './clock.js';

const PHONE = '+43 000 000000';

/* ---- Die 18 Praxen aus web/src/data.js ----
   Texte unverändert übernommen. Geändert:
   - district = Kurzname aus DISTRICTS, districtLong = Langname (vorher stand bei Lieser/St. Veit der
     Langname im Kurzfeld → Anfrageformular zeigte „Bitte wählen").
   - Status ist jetzt ein Objekt { value, setAt, expiresAt } statt 'green' + fester Text.
     `ageHours` (stand schon in v2 in den Daten, wurde aber nie gelesen) bestimmt setAt.
   - Die drei früher „grauen" Praxen (St. Veit, Gailtal, Faak) haben einen echten, aber
     ABGELAUFENEN Status (setAt = now − 30 h). Ihr alter Notfalltext WAR der Grau-Hinweis —
     der kommt jetzt automatisch aus STATUS.grey.notice. Deshalb bekommen sie hier einen
     normalen Notfalltext, der erscheint, sobald die Praxis ihren Status wieder bestätigt.
   - Lavanttal: „absent" mit festem Zeitraum '03.06. – 06.06.' → echte Abwesenheit von
     gestern bis übermorgen (siehe buildPractices). */
const PRACTICE_DEFS = [
  {
    id: 'drautal', name: 'Tierarztpraxis Drautal', district: 'Villach',
    specialties: ['chirurgie', 'zahn'],
    address: 'Drauweg 12, 9500 Villach',
    value: 'green', ageHours: 2, hoursShort: 'Mo–Fr 8–18, Sa 9–12',
    hoursWeek: ['8–18', '8–18', '8–18', '8–18', '8–18', '9–12', 'geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Diese Praxis nimmt heute aktiv Notfälle an. Bitte vor der Anfahrt kurz telefonisch ankündigen, damit das Team vorbereitet ist.',
    animals: ['cat', 'dog', 'small'],
    services: ['emergency', 'regular', 'housecall'],
  },
  {
    id: 'woerthersee', name: 'Tiernotdienst Wörthersee 24h', district: 'Klagenfurt',
    specialties: ['chirurgie', 'herz', 'neuro'],
    address: 'Seepromenade 4, 9020 Klagenfurt',
    value: 'green', ageHours: 3, hoursShort: '24 Stunden',
    hoursWeek: ['24 h', '24 h', '24 h', '24 h', '24 h', '24 h', '24 h'],
    emergency: '24h Notdienst, durchgehend erreichbar',
    emergencyLong: 'Durchgehender 24-Stunden-Notdienst, auch nachts und an Wochenenden erreichbar. Für akute, lebensbedrohliche Notfälle die erste Anlaufstelle in der Region.',
    animals: ['cat', 'dog', 'small'],
    services: ['emergency', 'euthanasia', 'regular'],
  },
  {
    id: 'lieser', name: 'Kleintierpraxis Lieser', district: 'Spittal',
    specialties: ['zahn', 'haut'],
    address: 'Lieserweg 8, 9800 Spittal/Drau',
    value: 'yellow', ageHours: 1, hoursShort: 'Mo–Fr 9–17',
    hoursWeek: ['9–17', '9–17', '9–17', '9–17', '9–17', 'geschlossen', 'geschlossen'],
    emergency: 'Notfälle nur nach telefonischer Rücksprache',
    emergencyLong: 'Notfälle werden heute nur nach vorheriger telefonischer Rücksprache angenommen. Bitte unbedingt zuerst anrufen, bevor Sie anfahren.',
    animals: ['cat', 'small'],
    services: ['regular', 'emergency'],
  },
  {
    id: 'lavanttal', name: 'Tierarzt Lavanttal', district: 'Wolfsberg',
    specialties: ['ortho'],
    absence: { fromDays: -1, toDays: 2, vertretung: 'Tiernotdienst Wörthersee 24h' },
    address: 'Marktstraße 21, 9400 Wolfsberg',
    value: 'red', ageHours: 4, hoursShort: 'Mo–Fr 8–16',
    hoursWeek: ['8–16', '8–16', '8–16', '8–16', '8–16', 'geschlossen', 'geschlossen'],
    emergency: 'Heute keine Notfälle, bitte Tiernotdienst Klagenfurt kontaktieren',
    emergencyLong: 'Diese Praxis nimmt heute keine Notfälle an. Bitte wenden Sie sich im Notfall an den Tiernotdienst Wörthersee 24h in Klagenfurt.',
    animals: ['dog', 'cat'],
    services: ['regular'],
  },
  {
    id: 'stveit', name: 'Tierarztpraxis St. Veit', district: 'St. Veit',
    specialties: ['augen', 'haut'],
    address: 'Hauptplatz 3, 9300 St. Veit/Glan',
    value: 'green', expired: true, hoursShort: 'Mo–Fr 8–17',
    hoursWeek: ['8–17', '8–17', '8–17', '8–17', '8–17', 'geschlossen', 'geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Diese Praxis nimmt heute Notfälle an und bietet Hausbesuche an. Bitte vor der Anfahrt kurz telefonisch ankündigen.',
    animals: ['cat', 'dog', 'small'],
    services: ['emergency', 'regular', 'housecall'],
  },
  {
    id: 'feldkirchen', name: 'Vetpraxis Feldkirchen', district: 'Feldkirchen',
    specialties: ['chirurgie', 'zahn', 'ortho', 'exoten'],
    address: 'Tiebelweg 5, 9560 Feldkirchen',
    value: 'green', ageHours: 1, hoursShort: 'Mo–Fr 8–18',
    hoursWeek: ['8–18', '8–18', '8–18', '8–18', '8–18', 'geschlossen', 'geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Diese Praxis nimmt heute aktiv Notfälle an und bietet zusätzlich Hausbesuche im Bezirk Feldkirchen an.',
    animals: ['dog', 'cat', 'small'],
    services: ['emergency', 'regular', 'euthanasia', 'housecall'],
  },
  {
    id: 'jauntal', name: 'Tierärztin Jauntal', district: 'Völkermarkt',
    specialties: ['haut', 'exoten'],
    address: 'Jauntalstraße 17, 9100 Völkermarkt',
    value: 'yellow', ageHours: 2, hoursShort: 'Mo–Do 9–16',
    hoursWeek: ['9–16', '9–16', '9–16', '9–16', 'geschlossen', 'geschlossen', 'geschlossen'],
    emergency: 'Eingeschränkt, bitte vorher anrufen',
    emergencyLong: 'Heute nur eingeschränkt erreichbar. Bitte vor einem Besuch in jedem Fall telefonisch Kontakt aufnehmen.',
    animals: ['cat', 'small'],
    services: ['regular', 'housecall'],
  },
  {
    id: 'gailtal', name: 'Tierarztpraxis Gailtal', district: 'Hermagor',
    specialties: ['ortho', 'herz'],
    address: 'Gailweg 2, 9620 Hermagor',
    value: 'yellow', expired: true, hoursShort: 'Mo–Fr 8–15',
    hoursWeek: ['8–15', '8–15', '8–15', '8–15', '8–15', 'geschlossen', 'geschlossen'],
    emergency: 'Notfälle nur nach telefonischer Rücksprache',
    emergencyLong: 'Notfälle werden heute nur nach vorheriger telefonischer Rücksprache angenommen. Bitte zuerst anrufen.',
    animals: ['dog', 'cat'],
    services: ['regular', 'emergency'],
  },
  {
    id: 'klagenfurt-zentrum', name: 'Tierklinik Klagenfurt Zentrum', district: 'Klagenfurt',
    specialties: ['chirurgie', 'neuro', 'onko', 'augen'],
    address: 'Bahnhofstraße 22, 9020 Klagenfurt',
    value: 'green', ageHours: 1, hoursShort: 'Mo–Sa 7–20',
    hoursWeek: ['7–20', '7–20', '7–20', '7–20', '7–20', '8–16', 'geschlossen'],
    emergency: 'Nimmt heute Notfälle an, eigenes Labor & OP',
    emergencyLong: 'Große Tierklinik mit eigenem Labor, Röntgen und OP-Bereich. Notfälle werden heute durchgehend angenommen, bitte kurz telefonisch ankündigen.',
    animals: ['cat', 'dog', 'small', 'exotic'],
    services: ['emergency', 'regular', 'euthanasia'],
  },
  {
    id: 'ossiach', name: 'Tierpraxis Ossiacher See', district: 'Villach',
    specialties: ['haut', 'zahn'],
    address: 'Seeuferweg 9, 9570 Ossiach',
    value: 'green', ageHours: 2, hoursShort: 'Mo–Fr 8–17',
    hoursWeek: ['8–17', '8–17', '8–17', '8–17', '8–17', 'geschlossen', 'geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Familiäre Praxis am Ossiacher See, nimmt heute Notfälle an und bietet Hausbesuche in der Umgebung.',
    animals: ['cat', 'dog', 'small'],
    services: ['emergency', 'regular', 'housecall'],
  },
  {
    id: 'millstatt', name: 'Kleintierpraxis Millstätter See', district: 'Spittal',
    specialties: ['zahn', 'ortho'],
    address: 'Seemühlgasse 3, 9872 Millstatt',
    value: 'yellow', ageHours: 1, hoursShort: 'Mo–Fr 8–16',
    hoursWeek: ['8–16', '8–16', '8–16', '8–16', '8–16', 'geschlossen', 'geschlossen'],
    emergency: 'Notfälle nur nach telefonischer Rücksprache',
    emergencyLong: 'Notfälle werden heute nur nach vorheriger telefonischer Rücksprache angenommen. Bitte zuerst anrufen.',
    animals: ['cat', 'dog', 'small'],
    services: ['regular', 'emergency'],
  },
  {
    id: 'koralpe', name: 'Tierarzt Koralpe', district: 'Wolfsberg',
    specialties: ['ortho', 'chirurgie'],
    address: 'Koralmstraße 44, 9400 Wolfsberg',
    value: 'green', ageHours: 3, hoursShort: 'Mo–Fr 7–17',
    hoursWeek: ['7–17', '7–17', '7–17', '7–17', '7–17', '8–12', 'geschlossen'],
    emergency: 'Nimmt heute Notfälle an, auch Großtiere',
    emergencyLong: 'Landtierärztliche Praxis, betreut Klein- und Großtiere. Notfälle werden heute angenommen, Hausbesuche im Lavanttal möglich.',
    animals: ['cat', 'dog', 'horse', 'small'],
    services: ['emergency', 'regular', 'housecall'],
  },
  {
    id: 'gurktal', name: 'Vetzentrum Gurktal', district: 'St. Veit',
    specialties: ['herz', 'neuro', 'zahn'],
    address: 'Gurkstraße 7, 9342 Gurk',
    value: 'green', ageHours: 1, hoursShort: 'Mo–Fr 8–18',
    hoursWeek: ['8–18', '8–18', '8–18', '8–18', '8–18', '9–13', 'geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Modernes Vetzentrum mit Kardiologie-Schwerpunkt. Notfälle werden heute angenommen.',
    animals: ['cat', 'dog', 'small', 'bird'],
    services: ['emergency', 'regular', 'euthanasia', 'housecall'],
  },
  {
    id: 'klopein', name: 'Tierpraxis Klopeiner See', district: 'Völkermarkt',
    specialties: ['haut', 'exoten'],
    address: 'Seestraße 15, 9122 St. Kanzian',
    value: 'red', ageHours: 5, hoursShort: 'Mo–Fr 9–16',
    hoursWeek: ['9–16', '9–16', '9–16', '9–16', '9–16', 'geschlossen', 'geschlossen'],
    emergency: 'Heute keine Notfälle – bitte Tierklinik Klagenfurt kontaktieren',
    emergencyLong: 'Diese Praxis nimmt heute keine Notfälle an. Bitte im Notfall an die Tierklinik Klagenfurt Zentrum wenden.',
    animals: ['cat', 'small', 'exotic', 'bird'],
    services: ['regular'],
  },
  {
    id: 'nassfeld', name: 'Bergtierarzt Nassfeld', district: 'Hermagor',
    specialties: ['ortho'],
    address: 'Nassfeldstraße 88, 9620 Hermagor',
    value: 'yellow', ageHours: 2, hoursShort: 'Mo–Fr 8–15',
    hoursWeek: ['8–15', '8–15', '8–15', '8–15', '8–15', 'geschlossen', 'geschlossen'],
    emergency: 'Eingeschränkt – bitte vorher anrufen',
    emergencyLong: 'Heute nur eingeschränkt erreichbar (Bergregion). Bitte vor einem Besuch telefonisch Kontakt aufnehmen.',
    animals: ['dog', 'cat', 'horse'],
    services: ['regular', 'housecall'],
  },
  {
    id: 'viktring', name: 'Pferdeklinik Viktring', district: 'Klagenfurt',
    specialties: ['ortho', 'chirurgie'],
    address: 'Stiftweg 5, 9073 Klagenfurt-Viktring',
    value: 'green', ageHours: 1, hoursShort: 'Mo–Sa 7–19',
    hoursWeek: ['7–19', '7–19', '7–19', '7–19', '7–19', '7–15', 'Notdienst'],
    emergency: '24h Pferde-Notdienst, mobile Einsätze',
    emergencyLong: 'Spezialklinik für Pferde mit mobilem Notdienst in ganz Kärnten. Bei Kolik oder Verletzungen sofort anrufen.',
    animals: ['horse'],
    services: ['emergency', 'regular', 'euthanasia', 'housecall'],
  },
  {
    id: 'faak', name: 'Tierarzt Faaker See', district: 'Villach',
    specialties: ['zahn', 'augen'],
    address: 'Seepromenade 21, 9583 Faak am See',
    value: 'green', expired: true, hoursShort: 'Mo–Fr 9–17',
    hoursWeek: ['9–17', '9–17', '9–17', '9–17', '9–17', 'geschlossen', 'geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Diese Praxis nimmt heute Notfälle an. Bitte vor der Anfahrt kurz telefonisch ankündigen.',
    animals: ['cat', 'dog', 'small'],
    services: ['regular', 'emergency'],
  },
  {
    id: 'maria-saal', name: 'Tierarztpraxis Maria Saal', district: 'Klagenfurt',
    specialties: ['zahn', 'haut', 'exoten'],
    address: 'Domplatz 2, 9063 Maria Saal',
    value: 'green', ageHours: 2, hoursShort: 'Mo–Fr 8–17',
    hoursWeek: ['8–17', '8–17', '8–17', '8–17', '8–17', '9–12', 'geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Freundliche Praxis nördlich von Klagenfurt. Notfälle werden heute angenommen, Schwerpunkt auf Zahn- und Hautbehandlungen.',
    animals: ['cat', 'dog', 'small', 'exotic'],
    services: ['emergency', 'regular', 'housecall'],
  },
];

/* Praxisprofil der Demo-Praxis Drautal (aus data.js CLINIC_PROFILE).
   hoursWeek (Objekte zum Bearbeiten) heißt im Vertrag `hoursEdit` — `hoursWeek` ist an der Praxis
   schon die Anzeige-Liste ['8–18', …]; zwei verschiedene Formen unter einem Namen wären eine Falle. */
export const CLINIC_PROFILE = Object.freeze({
  about: 'Wir sind eine familiäre Kleintierpraxis im Drautal und besonders erfahren bei Chirurgie, Zahnsanierungen und der Betreuung älterer Katzen. Notfälle nehmen wir nach kurzer telefonischer Ankündigung jederzeit an.',
  verification: 'verified', // verified | pending | none
  hoursEdit: [
    { day: 'Montag', open: '08:00', close: '18:00', closed: false },
    { day: 'Dienstag', open: '08:00', close: '18:00', closed: false },
    { day: 'Mittwoch', open: '08:00', close: '18:00', closed: false },
    { day: 'Donnerstag', open: '08:00', close: '18:00', closed: false },
    { day: 'Freitag', open: '08:00', close: '18:00', closed: false },
    { day: 'Samstag', open: '09:00', close: '12:00', closed: false },
    { day: 'Sonntag', open: '', close: '', closed: true },
  ],
  team: [
    { name: 'Dr. Anna Drautal', role: 'Praxisleitung', specialty: 'Chirurgie' },
    { name: 'Dr. Markus Lenz', role: 'Tierarzt', specialty: 'Zahnheilkunde' },
    { name: 'Sabine Koller', role: 'Tierärztl. Assistenz', specialty: 'Labor & Pflege' },
  ],
  notifications: { email: true, push: true, desktop: false, extension: true },
});

function cloneProfile() {
  return JSON.parse(JSON.stringify(CLINIC_PROFILE));
}

function buildPractices(now) {
  const today = todayISO(now);
  return PRACTICE_DEFS.map((d) => {
    // Früher graue Praxen: bestätigt vor 30 h → seit 6 h abgelaufen.
    const setAt = d.expired ? now - 30 * HOUR : now - d.ageHours * HOUR;
    const p = {
      id: d.id,
      name: d.name,
      district: d.district,
      districtLong: DISTRICT_LONG[d.district] || d.district,
      address: d.address,
      phone: PHONE,
      specialties: d.specialties.slice(),
      animals: d.animals.slice(),
      services: d.services.slice(),
      hoursShort: d.hoursShort,
      hoursWeek: d.hoursWeek.slice(),
      emergency: d.emergency,
      emergencyLong: d.emergencyLong,
      isTestData: true,
      status: { value: d.value, setAt, expiresAt: setAt + 24 * HOUR },
      absence: null,
    };
    if (d.absence) {
      // Ganze Kalendertage: von gestern 00:00 bis übermorgen 23:59 (lokale Zeit).
      p.absence = {
        from: tsAt(addDays(today, d.absence.fromDays), '00:00'),
        to: tsAt(addDays(today, d.absence.toDays), '23:59') + 59 * 1000 + 999,
        vertretung: d.absence.vertretung,
      };
    }
    if (d.id === DEMO_PRACTICE_ID) p.profile = cloneProfile();
    return p;
  });
}

/* ---- Chats ----
   In v2 gab es jede Unterhaltung ZWEIMAL (ch-o1 für die Tierhalter:in, ch-c1 für die Praxis) —
   eine Antwort auf der einen Seite kam auf der anderen nie an. Jetzt: EIN Datensatz pro echtem
   Paar, beide Seiten lesen ihn (chats.js → chatView). IDs sind sprechend und stabil, damit Termine
   (chatId), Tests und der Hub sich darauf verlassen können. */
export const SEED_CHAT_IDS = Object.freeze({
  c1: 'ch-berger-drautal',
  c2: 'ch-wieser-drautal',
  c3: 'ch-tomaschitz-drautal',
  c4: 'ch-novak-drautal',
  o2: 'ch-berger-feldkirchen',
  o3: 'ch-berger-woerthersee',
  n1: 'ch-net-drautal-woerthersee',
  n2: 'ch-net-drautal-viktring',
});

/* Letzter vergangener Wochentag (Mo=0) als Tages-Versatz: heute Do, gesucht Mo → −3.
   Ist heute selbst der gesuchte Tag, nimmt es den der Vorwoche (−7) — „Mo 19:02" in einem
   Chat, der heute noch gar nicht stattgefunden hat, wäre falsch. */
function prevWeekdayOffset(today, targetMon0) {
  const d = (weekdayMon0(today) - targetMon0 + 7) % 7;
  return -(d === 0 ? 7 : d);
}

/* Eine Unterhaltung an einem Tag mit festen Uhrzeiten („09:30", „09:36" …) — so lesen sich die
   Zeiten wie in v2. Liegt die letzte Nachricht NICHT mindestens 2 Minuten in der Vergangenheit
   (Demo wird z. B. um 07:00 gestartet), rutscht der ganze Block einen Tag zurück. Der Block
   verschiebt sich immer GEMEINSAM, damit die Reihenfolge der Nachrichten stimmt. */
function dayBlock(now, dayOffset, rows) {
  const today = todayISO(now);
  let off = dayOffset;
  for (let guard = 0; guard < 3; guard++) {
    const iso = addDays(today, off);
    const last = tsAt(iso, rows[rows.length - 1][0]);
    if (last <= now - 2 * MINUTE) break;
    off -= 1;
  }
  const iso = addDays(today, off);
  return rows.map((r) => ({ ts: tsAt(iso, r[0]), from: r[1], text: r[2], type: r[3] || 'text' }));
}

function finishChat(base, msgs) {
  const messages = msgs.map((m, i) => ({
    id: 'm-' + base.id.slice(3) + '-' + (i + 1),
    ts: m.ts,
    from: m.from,
    type: m.type,
    text: m.text,
  }));
  const first = messages.length ? messages[0].ts : 0;
  const last = messages.length ? messages[messages.length - 1].ts : 0;
  return {
    labels: [],
    pinned: { owner: false, clinic: false },
    unread: { owner: 0, clinic: 0 },
    autoReply: true, // Demo: die Gegenseite wird von Bot/KI gespielt
    isTestData: true,
    ...base,
    createdAt: first,
    updatedAt: last,
    messages,
  };
}

function buildChats(now) {
  const today = todayISO(now);
  const owner = DEMO_OWNER;
  const chats = [];

  // ch-o1 + ch-c1 → EINE Unterhaltung Familie Berger ↔ Drautal (Balu).
  // Die Abschlussnotiz aus ch-o1 („Leichte Zerrung … bei Verschlechterung erneut melden") ist der
  // Besuch von letzter Woche — heute humpelt Balu wieder. So passt die Geschichte zusammen, und die
  // Tierhalter:in kann die Notiz bewerten (Sterne). Der heutige Termin 08:30 ist noch „bestätigt":
  // Schließt die Praxis ihn im Kalender ab, landet die neue Notiz genau in diesem Chat.
  chats.push(finishChat({
    id: SEED_CHAT_IDS.c1, kind: 'request', practiceId: 'drautal',
    ownerId: owner.ownerId, ownerName: owner.name, petName: 'Balu', animal: 'dog', topic: 'Lahmheit',
    color: '#dc2626', icon: 'siren', labels: ['tiere', 'posteingang', 'notfall'],
    pinned: { owner: true, clinic: true }, unread: { owner: 0, clinic: 2 },
  }, [
    ...dayBlock(now, -7, [
      ['11:20', 'clinic', 'Behandlung verlief gut. Leichte Zerrung — Balu sollte sich 3 Tage schonen, bitte weiter beobachten. Bei Verschlechterung bitte erneut melden.', 'note'],
    ]),
    ...dayBlock(now, 0, [
      ['09:30', 'owner', 'Guten Morgen, unser Hund Balu humpelt seit heute früh und frisst nicht. Können wir heute vorbeikommen?'],
      ['09:36', 'clinic', 'Guten Morgen! Das klingt nach etwas, das wir uns ansehen sollten. Seit wann humpelt er genau?'],
      ['09:40', 'owner', 'Seit dem Spaziergang heute früh, ca. 7 Uhr.'],
      ['09:42', 'owner', 'Sollen wir sofort kommen?'],
    ]),
  ]));

  // ch-c2 → Frau Wieser ↔ Drautal
  chats.push(finishChat({
    id: SEED_CHAT_IDS.c2, kind: 'direct', practiceId: 'drautal',
    ownerId: 'owner-wieser', ownerName: 'Frau Wieser', petName: 'Mimi', animal: 'cat', topic: 'Jahresimpfung',
    color: '#16a34a', icon: 'cal', labels: ['posteingang', 'termin'],
  }, dayBlock(now, 0, [
    ['08:05', 'owner', 'Hallo, meine Katze Mimi soll zur jährlichen Impfung. Haben Sie diese Woche einen Termin?'],
    ['08:08', 'clinic', 'Gerne! Donnerstag um 14:30 wäre frei. Passt das?'],
    ['08:10', 'owner', 'Perfekt, danke!'],
  ])));

  // ch-c3 → Herr Tomaschitz ↔ Drautal (gestern)
  chats.push(finishChat({
    id: SEED_CHAT_IDS.c3, kind: 'direct', practiceId: 'drautal',
    ownerId: 'owner-tomaschitz', ownerName: 'Herr Tomaschitz', petName: 'Hoppel', animal: 'small', topic: 'Atemwege',
    color: '#2e6f9e', icon: 'building', labels: ['posteingang'],
  }, dayBlock(now, -1, [
    ['16:20', 'owner', 'Mein Kaninchen niest seit ein paar Tagen. Ist das dringend?'],
    ['16:45', 'clinic', 'Beobachten Sie bitte, ob Nasenausfluss dazukommt. Wenn ja, bitte rasch vorbeikommen. Bei Atemnot sofort anrufen.'],
  ])));

  // ch-c4 → Familie Novak ↔ Drautal (letzter Montag)
  chats.push(finishChat({
    id: SEED_CHAT_IDS.c4, kind: 'direct', practiceId: 'drautal',
    ownerId: 'owner-novak', ownerName: 'Familie Novak', petName: 'Rocky', animal: 'dog', topic: 'Nachkontrolle',
    color: '#6c7d79', icon: 'check', labels: ['posteingang', 'erledigt'],
  }, dayBlock(now, prevWeekdayOffset(today, 0), [
    ['19:02', 'owner', 'Danke für die schnelle Hilfe gestern Abend!'],
    ['19:10', 'clinic', 'Sehr gerne — gute Besserung für Rocky!'],
  ])));

  // ch-o2 → Familie Berger ↔ Feldkirchen (Luna). Ungelesen 1, damit die Tierhalter:in in der
  // Demo sofort ein Abzeichen sieht (in v2 kam das von der Notiz in ch-o1).
  chats.push(finishChat({
    id: SEED_CHAT_IDS.o2, kind: 'direct', practiceId: 'feldkirchen',
    ownerId: owner.ownerId, ownerName: owner.name, petName: 'Luna', animal: 'dog', topic: 'Hausbesuch',
    color: '#0f9b8e', icon: 'dog', labels: ['tiere'], unread: { owner: 1, clinic: 0 },
  }, dayBlock(now, -1, [
    ['11:00', 'owner', 'Bietet ihr Hausbesuche im Raum Feldkirchen an?'],
    ['11:20', 'clinic', 'Ja, gerne — am Nachmittag. Bitte rufen Sie kurz an, dann vereinbaren wir einen Zeitpunkt.'],
  ])));

  // ch-o3 → Familie Berger ↔ Wörthersee (Mimi)
  chats.push(finishChat({
    id: SEED_CHAT_IDS.o3, kind: 'direct', practiceId: 'woerthersee',
    ownerId: owner.ownerId, ownerName: owner.name, petName: 'Mimi', animal: 'cat', topic: 'Notfall',
    color: '#dc2626', icon: 'siren', labels: ['tiere', 'notfall'],
  }, dayBlock(now, prevWeekdayOffset(today, 0), [
    ['08:00', 'owner', 'Danke für die schnelle Hilfe gestern Nacht!'],
    ['08:15', 'clinic', 'Sehr gerne. Gute Besserung für Mimi!'],
  ])));

  // ch-n1 → Netzwerk Drautal ↔ Wörthersee. from 'clinic' = Drautal (practiceId),
  // from 'owner' = Wörthersee (peerPracticeId) — so steht es im Vertrag §4 Message.from.
  chats.push(finishChat({
    id: SEED_CHAT_IDS.n1, kind: 'network', practiceId: 'drautal', peerPracticeId: 'woerthersee',
    animal: 'dog', topic: 'Vertretung & Überweisung',
    color: '#8a5d05', icon: 'shield', labels: ['netzwerk'],
    pinned: { owner: false, clinic: true }, unread: { owner: 0, clinic: 1 },
  }, dayBlock(now, prevWeekdayOffset(today, 4), [
    ['14:10', 'clinic', 'Servus Kolleg:innen! Können wir am Wochenende einen Notfall zu euch überweisen? Wir haben Betriebsurlaub.'],
    ['14:25', 'owner', 'Klar, kein Problem. Schickt uns kurz die Patientendaten vorab.'],
  ])));

  // ch-n2 → Netzwerk Drautal ↔ Pferdeklinik Viktring
  chats.push(finishChat({
    id: SEED_CHAT_IDS.n2, kind: 'network', practiceId: 'drautal', peerPracticeId: 'viktring',
    animal: 'horse', topic: 'Fachaustausch Orthopädie',
    color: '#0f9b8e', icon: 'horse', labels: ['netzwerk'],
  }, dayBlock(now, prevWeekdayOffset(today, 2), [
    ['10:00', 'clinic', 'Habt ihr Erfahrung mit dem neuen Sedierungsprotokoll bei Kolik-Patienten?'],
    ['10:20', 'owner', 'Ja, läuft bei uns sehr gut. Ich schick dir unser Schema per Mail.'],
  ])));

  return chats;
}

/* ---- Termine (Praxis Drautal) ----
   Vorlagen = die Tage aus APPTS_BY_DATE (Juni 2026). `c` = alte convoId → echte Chat-ID. */
const T_PAST_A = [
  { time: '08:45', name: 'Rocky (Familie Novak)', animal: 'dog', status: 'done', reason: 'Nachkontrolle Pfote', c: 'c4' },
  { time: '10:15', name: 'Nala (Frau Pichler)', animal: 'cat', status: 'done', reason: 'Impfung' },
  { time: '14:00', name: 'Charly (Hr. Moser)', animal: 'dog', status: 'cancelled', reason: 'Krallenpflege' },
];
const T_PAST_B = [
  { time: '09:00', name: 'Bella (Fam. Ladinig)', animal: 'dog', status: 'done', reason: 'Ohrenentzündung' },
  { time: '11:30', name: 'Pauli (Frau Brandl)', animal: 'bird', status: 'done', reason: 'Schnabelkontrolle' },
  { time: '15:30', name: 'Minka (Hr. Ebner)', animal: 'cat', status: 'done', reason: 'Zahnstein' },
];
const T_TODAY = [
  { time: '08:30', name: 'Balu (Familie Berger)', animal: 'dog', status: 'confirmed', reason: 'Lahmheit / Notfall', c: 'c1' },
  { time: '09:15', name: 'Mimi (Frau Wieser)', animal: 'cat', status: 'confirmed', reason: 'Jahresimpfung', c: 'c2' },
  { time: '10:30', name: 'Felix (Herr Painer)', animal: 'cat', status: 'open', reason: 'Kontrolle' },
  { time: '11:00', name: 'Rocky (Familie Novak)', animal: 'dog', status: 'confirmed', reason: 'Nachkontrolle', c: 'c4' },
  { time: '13:30', name: 'Hoppel (Hr. Tomaschitz)', animal: 'small', status: 'open', reason: 'Atemwege', c: 'c3' },
  { time: '15:00', name: 'Luna (Frau Egger)', animal: 'dog', status: 'cancelled', reason: 'Krallen schneiden' },
  { time: '16:15', name: 'Schnurli (Fam. Kogler)', animal: 'cat', status: 'confirmed', reason: 'Zahnkontrolle' },
];
const T_FUT_A = [
  { time: '08:30', name: 'Pferd Sandro (Reitstall Süd)', animal: 'horse', status: 'confirmed', reason: 'Hufkontrolle / Hausbesuch', durationMin: 60 },
  { time: '10:00', name: 'Coco (Frau Stern)', animal: 'cat', status: 'open', reason: 'Kastration – Vorgespräch' },
  { time: '11:45', name: 'Bruno (Hr. Lenz)', animal: 'dog', status: 'confirmed', reason: 'Blutabnahme' },
  { time: '15:30', name: 'Schildi (Fam. Url)', animal: 'exotic', status: 'open', reason: 'Panzerkontrolle' },
];
const T_FUT_SAT = [
  { time: '09:30', name: 'Lilly (Frau Wank)', animal: 'cat', status: 'open', reason: 'Augenkontrolle' },
  { time: '11:00', name: 'Max (Fam. Url)', animal: 'dog', status: 'open', reason: 'Impfung' },
];
const T_FUT_B = [
  { time: '08:45', name: 'Emma (Hr. Gruber)', animal: 'dog', status: 'open', reason: 'Routinecheck' },
  { time: '13:00', name: 'Tweety (Frau Klein)', animal: 'bird', status: 'open', reason: 'Federverlust' },
];
const T_FUT_C = [
  { time: '10:00', name: 'Rosa (Fam. Sturm)', animal: 'small', status: 'open', reason: 'Krallen / Zähne' },
  { time: '14:30', name: 'Cleo (Frau Hofer)', animal: 'cat', status: 'open', reason: 'Nachkontrolle' },
  { time: '16:00', name: 'Aki (Hr. Wieser)', animal: 'dog', status: 'open', reason: 'Hautprobleme' },
];

/* Verteilung auf heute − 7 … heute + 7:
   - HEUTE bekommt immer die Heute-Vorlage (sie trägt die Chat-Verknüpfungen, um die sich die
     Demo dreht: Termin abschließen → Notiz im Chat). Das gilt bewusst auch an einem Sonntag,
     sonst wäre die Vorführung am Wochenende leer.
   - Sonntage (Praxis geschlossen) bleiben sonst frei.
   - Vergangene Werktage wechseln zwischen den beiden „erledigt"-Vorlagen, Samstage bekommen
     nur die ersten zwei Einträge (Praxis hat Sa nur 9–12 offen).
   - Zukünftige Werktage wechseln zwischen drei Vorlagen, Samstage bekommen die Samstags-Vorlage. */
function buildAppointments(now) {
  const today = todayISO(now);
  const out = [];
  let pastIdx = 0;
  let futIdx = 0;
  for (let off = -7; off <= 7; off++) {
    const date = addDays(today, off);
    const wd = weekdayMon0(date);
    let tpl = null;
    if (off === 0) tpl = T_TODAY;
    else if (wd === 6) tpl = null;
    else if (off < 0) {
      tpl = pastIdx++ % 2 === 0 ? T_PAST_A : T_PAST_B;
      if (wd === 5) tpl = tpl.slice(0, 2).filter((a) => a.time < '12:00');
    } else if (wd === 5) tpl = T_FUT_SAT;
    else tpl = [T_FUT_A, T_FUT_B, T_FUT_C][futIdx++ % 3];
    if (!tpl) continue;
    tpl.forEach((a, i) => {
      const ap = {
        id: 'ap-' + (off + 7 < 10 ? '0' : '') + (off + 7) + '-' + i,
        practiceId: DEMO_PRACTICE_ID,
        date,
        time: a.time,
        durationMin: a.durationMin || 30,
        name: a.name,
        animal: a.animal,
        status: a.status,
        reason: a.reason,
        note: '',
        isTestData: true,
      };
      if (a.c) ap.chatId = SEED_CHAT_IDS[a.c];
      out.push(ap);
    });
  }
  return out;
}

/* Blockzeiten Mo–Fr (aus data.js BLOCKS). Vertrag: Block { practiceId, weekday (Mo=0), time, end, label }.
   Zusätzlich eine stabile id, damit Hub-Events (block) und das Löschen eindeutig sind. */
function buildBlocks() {
  const out = [];
  for (let w = 0; w <= 4; w++) {
    out.push({ id: 'bl-drautal-' + w + '-mittag', practiceId: DEMO_PRACTICE_ID, weekday: w, time: '12:00', end: '13:00', label: 'Mittagspause', isTestData: true });
    out.push({ id: 'bl-drautal-' + w + '-op', practiceId: DEMO_PRACTICE_ID, weekday: w, time: '14:00', end: '15:00', label: 'OP-Zeit', isTestData: true });
  }
  return out;
}

export function buildDemoSeed(now) {
  const n = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  return {
    schema: DATA_SCHEMA,
    seed: 'demo',
    createdAt: n,
    practices: buildPractices(n),
    chats: buildChats(n),
    labels: seedLabels(),
    appointments: buildAppointments(n),
    blocks: buildBlocks(),
    settings: defaultSettings(),
  };
}

/* Saubere Version (Vertrag §4): keine Testdaten — alle 18 Demo-Praxen sind erfunden und
   isTestData:true, also bleibt die Liste leer, bis echte Praxen (Hub) dazukommen. Labels ja. */
export function buildEmptySeed(now) {
  const n = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  return {
    schema: DATA_SCHEMA,
    seed: 'empty',
    createdAt: n,
    practices: [],
    chats: [],
    labels: seedLabels(),
    appointments: [],
    blocks: [],
    settings: defaultSettings(),
  };
}

/* Name einer Demo-Praxis (für Migration/Fallbacks ohne geladenen Zustand). */
export function demoPracticeNames() {
  const out = {};
  PRACTICE_DEFS.forEach((d) => { out[d.id] = d.name; });
  return out;
}
