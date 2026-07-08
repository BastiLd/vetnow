/* VetNow — Testdaten & Status-Logik (ES-Modul)
   Alle Einträge mit `isTestData: true` sind Demo-Daten und werden ausgeblendet,
   wenn im Admin-Bereich der Schalter "Testdaten ausblenden" aktiv ist. */

// Status configuration (Ampel)
export const STATUS = {
  green:  { key: 'green',  label: 'Heute erreichbar',        cls: 'green',  rank: 0 },
  yellow: { key: 'yellow', label: 'Nur nach Rücksprache',    cls: 'yellow', rank: 1 },
  grey:   { key: 'grey',   label: 'Nicht aktuell bestätigt', cls: 'grey',   rank: 2 },
  red:    { key: 'red',    label: 'Heute nicht verfügbar',   cls: 'red',    rank: 3 },
};

// hoursWeek: [Mo,Di,Mi,Do,Fr,Sa,So] short labels
export const PRACTICES = [
  {
    id: 'drautal', name: 'Tierarztpraxis Drautal', district: 'Villach', isTestData: true,
    specialties: ['chirurgie','zahn'],
    address: 'Drauweg 12, 9500 Villach', phone: '+43 000 000000',
    status: 'green', confirmedAt: 'heute, 08:30', hoursShort: 'Mo–Fr 8–18, Sa 9–12',
    hoursWeek: ['8–18','8–18','8–18','8–18','8–18','9–12','geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Diese Praxis nimmt heute aktiv Notfälle an. Bitte vor der Anfahrt kurz telefonisch ankündigen, damit das Team vorbereitet ist.',
    animals: ['cat','dog','small'],
    services: ['emergency','regular','housecall'],
    ageHours: 2,
  },
  {
    id: 'woerthersee', name: 'Tiernotdienst Wörthersee 24h', district: 'Klagenfurt', isTestData: true,
    specialties: ['chirurgie','herz','neuro'],
    address: 'Seepromenade 4, 9020 Klagenfurt', phone: '+43 000 000000',
    status: 'green', confirmedAt: 'heute, 07:15', hoursShort: '24 Stunden',
    hoursWeek: ['24 h','24 h','24 h','24 h','24 h','24 h','24 h'],
    emergency: '24h Notdienst, durchgehend erreichbar',
    emergencyLong: 'Durchgehender 24-Stunden-Notdienst, auch nachts und an Wochenenden erreichbar. Für akute, lebensbedrohliche Notfälle die erste Anlaufstelle in der Region.',
    animals: ['cat','dog','small'],
    services: ['emergency','euthanasia','regular'],
    ageHours: 3,
  },
  {
    id: 'lieser', name: 'Kleintierpraxis Lieser', district: 'Spittal an der Drau', isTestData: true,
    specialties: ['zahn','haut'],
    address: 'Lieserweg 8, 9800 Spittal/Drau', phone: '+43 000 000000',
    status: 'yellow', confirmedAt: 'heute, 09:00', hoursShort: 'Mo–Fr 9–17',
    hoursWeek: ['9–17','9–17','9–17','9–17','9–17','geschlossen','geschlossen'],
    emergency: 'Notfälle nur nach telefonischer Rücksprache',
    emergencyLong: 'Notfälle werden heute nur nach vorheriger telefonischer Rücksprache angenommen. Bitte unbedingt zuerst anrufen, bevor Sie anfahren.',
    animals: ['cat','small'],
    services: ['regular','emergency'],
    ageHours: 1,
  },
  {
    id: 'lavanttal', name: 'Tierarzt Lavanttal', district: 'Wolfsberg', isTestData: true,
    specialties: ['ortho'], absent: true, vertretung: 'Tiernotdienst Wörthersee 24h', absenceRange: '03.06. – 06.06.',
    address: 'Marktstraße 21, 9400 Wolfsberg', phone: '+43 000 000000',
    status: 'red', confirmedAt: 'heute, 06:45', hoursShort: 'Mo–Fr 8–16',
    hoursWeek: ['8–16','8–16','8–16','8–16','8–16','geschlossen','geschlossen'],
    emergency: 'Heute keine Notfälle, bitte Tiernotdienst Klagenfurt kontaktieren',
    emergencyLong: 'Diese Praxis nimmt heute keine Notfälle an. Bitte wenden Sie sich im Notfall an den Tiernotdienst Wörthersee 24h in Klagenfurt.',
    animals: ['dog','cat'],
    services: ['regular'],
    ageHours: 4,
  },
  {
    id: 'stveit', name: 'Tierarztpraxis St. Veit', district: 'St. Veit an der Glan', isTestData: true,
    specialties: ['augen','haut'],
    address: 'Hauptplatz 3, 9300 St. Veit/Glan', phone: '+43 000 000000',
    status: 'grey', confirmedAt: 'vor 2 Tagen', hoursShort: 'Mo–Fr 8–17',
    hoursWeek: ['8–17','8–17','8–17','8–17','8–17','geschlossen','geschlossen'],
    emergency: 'Status nicht aktuell bestätigt – bitte unbedingt telefonisch prüfen.',
    emergencyLong: 'Der Status dieser Praxis wurde seit über 24 Stunden nicht bestätigt und ist daher nicht aktuell. Bitte unbedingt telefonisch prüfen, ob heute Notfälle angenommen werden.',
    animals: ['cat','dog','small'],
    services: ['emergency','regular','housecall'],
    ageHours: 50,
  },
  {
    id: 'feldkirchen', name: 'Vetpraxis Feldkirchen', district: 'Feldkirchen', isTestData: true,
    specialties: ['chirurgie','zahn','ortho','exoten'],
    address: 'Tiebelweg 5, 9560 Feldkirchen', phone: '+43 000 000000',
    status: 'green', confirmedAt: 'heute, 10:10', hoursShort: 'Mo–Fr 8–18',
    hoursWeek: ['8–18','8–18','8–18','8–18','8–18','geschlossen','geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Diese Praxis nimmt heute aktiv Notfälle an und bietet zusätzlich Hausbesuche im Bezirk Feldkirchen an.',
    animals: ['dog','cat','small'],
    services: ['emergency','regular','euthanasia','housecall'],
    ageHours: 1,
  },
  {
    id: 'jauntal', name: 'Tierärztin Jauntal', district: 'Völkermarkt', isTestData: true,
    specialties: ['haut','exoten'],
    address: 'Jauntalstraße 17, 9100 Völkermarkt', phone: '+43 000 000000',
    status: 'yellow', confirmedAt: 'heute, 08:50', hoursShort: 'Mo–Do 9–16',
    hoursWeek: ['9–16','9–16','9–16','9–16','geschlossen','geschlossen','geschlossen'],
    emergency: 'Eingeschränkt, bitte vorher anrufen',
    emergencyLong: 'Heute nur eingeschränkt erreichbar. Bitte vor einem Besuch in jedem Fall telefonisch Kontakt aufnehmen.',
    animals: ['cat','small'],
    services: ['regular','housecall'],
    ageHours: 2,
  },
  {
    id: 'gailtal', name: 'Tierarztpraxis Gailtal', district: 'Hermagor', isTestData: true,
    specialties: ['ortho','herz'],
    address: 'Gailweg 2, 9620 Hermagor', phone: '+43 000 000000',
    status: 'grey', confirmedAt: 'vor 3 Tagen', hoursShort: 'Mo–Fr 8–15',
    hoursWeek: ['8–15','8–15','8–15','8–15','8–15','geschlossen','geschlossen'],
    emergency: 'Status nicht aktuell bestätigt – bitte unbedingt telefonisch prüfen.',
    emergencyLong: 'Der Status dieser Praxis wurde seit über 24 Stunden nicht bestätigt und ist daher nicht aktuell. Bitte unbedingt telefonisch prüfen, ob heute Notfälle angenommen werden.',
    animals: ['dog','cat'],
    services: ['regular','emergency'],
    ageHours: 72,
  },
];

export const ANIMAL_LABEL = { cat: 'Katze', dog: 'Hund', small: 'Kleintiere', horse: 'Pferd', bird: 'Vogel', exotic: 'Reptilien/Exoten', other: 'Anderes' };
export const SERVICE_LABEL = {
  emergency: 'Notfall', regular: 'Normale Termine',
  euthanasia: 'Einschläferung', housecall: 'Hausbesuch',
};
export const SPECIALTY_LABEL = {
  chirurgie: 'Chirurgie', zahn: 'Zahnbehandlungen', ortho: 'Orthopädie',
  augen: 'Augenheilkunde', haut: 'Hautkrankheiten', herz: 'Herz / Kardiologie',
  onko: 'Onkologie', neuro: 'Neurologie', exoten: 'Exoten / Vögel / Reptilien',
};
export const SPECIALTIES = Object.entries(SPECIALTY_LABEL).map(([key, label]) => ({ key, label }));
export const DISTRICTS = ['Villach','Klagenfurt','Spittal','Wolfsberg','St. Veit','Feldkirchen','Völkermarkt','Hermagor'];
export const SITUATIONS = [
  { key: 'emergency', label: 'Notfall' },
  { key: 'regular', label: 'Normale Termine' },
  { key: 'euthanasia', label: 'Einschläferung' },
  { key: 'housecall', label: 'Hausbesuch' },
];
export const ANIMALS = [
  { key: 'cat', label: 'Katze' },
  { key: 'dog', label: 'Hund' },
  { key: 'small', label: 'Kleintiere' },
  { key: 'horse', label: 'Pferd' },
  { key: 'bird', label: 'Vogel' },
  { key: 'exotic', label: 'Reptilien/Exoten' },
  { key: 'other', label: 'Anderes' },
];

// sort: green, yellow, then grey/red to bottom (rank order)
export function sortPractices(list) {
  return [...list].sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank);
}

// ---- Chat conversations (Praxis <-> Tierhalter) ----
export const CONVERSATIONS = [
  {
    id: 'c1', owner: 'Familie Berger', animal: 'dog', date: 'heute, 09:42', unread: 2, isTestData: true,
    messages: [
      { from: 'owner', text: 'Guten Morgen, unser Hund Balu humpelt seit heute früh und frisst nicht. Können wir heute vorbeikommen?', time: '09:30' },
      { from: 'clinic', text: 'Guten Morgen! Das klingt nach etwas, das wir uns ansehen sollten. Seit wann humpelt er genau?', time: '09:36' },
      { from: 'owner', text: 'Seit dem Spaziergang heute früh, ca. 7 Uhr.', time: '09:40' },
      { from: 'owner', text: 'Sollen wir sofort kommen?', time: '09:42' },
    ],
  },
  {
    id: 'c2', owner: 'Frau Wieser', animal: 'cat', date: 'heute, 08:10', unread: 0, isTestData: true,
    messages: [
      { from: 'owner', text: 'Hallo, meine Katze Mimi soll zur jährlichen Impfung. Haben Sie diese Woche einen Termin?', time: '08:05' },
      { from: 'clinic', text: 'Gerne! Donnerstag um 14:30 wäre frei. Passt das?', time: '08:08' },
      { from: 'owner', text: 'Perfekt, danke!', time: '08:10' },
    ],
  },
  {
    id: 'c3', owner: 'Herr Tomaschitz', animal: 'small', date: 'gestern', unread: 0, isTestData: true,
    messages: [
      { from: 'owner', text: 'Mein Kaninchen niest seit ein paar Tagen. Ist das dringend?', time: 'Gestern 16:20' },
      { from: 'clinic', text: 'Beobachten Sie bitte, ob Nasenausfluss dazukommt. Wenn ja, bitte rasch vorbeikommen. Bei Atemnot sofort anrufen.', time: 'Gestern 16:45' },
    ],
  },
  {
    id: 'c4', owner: 'Familie Novak', animal: 'dog', date: 'Mo, 02.06.', unread: 0, isTestData: true,
    messages: [
      { from: 'owner', text: 'Danke für die schnelle Hilfe gestern Abend!', time: 'Mo 19:02' },
      { from: 'clinic', text: 'Sehr gerne — gute Besserung für Rocky!', time: 'Mo 19:10' },
    ],
  },
];

// ---- Tierhalter-Sicht: Meine Nachrichten (Demo) ----
export const OWNER_CONVERSATIONS = [
  {
    id: 'o1', title: 'Tierarztpraxis Drautal', sub: 'Villach · Balu (Hund)', animal: 'dog', date: 'heute, 11:20', unread: 1, isTestData: true,
    messages: [
      { from: 'owner', text: 'Guten Morgen, unser Hund Balu humpelt seit heute früh und frisst nicht. Können wir heute vorbeikommen?', time: '09:30' },
      { from: 'clinic', text: 'Guten Morgen! Kommen Sie gerne um 08:30 vorbei, wir sehen ihn uns an.', time: '09:36' },
      { type: 'note', text: 'Behandlung verlief gut. Leichte Zerrung — Balu sollte sich 3 Tage schonen, bitte weiter beobachten. Bei Verschlechterung bitte erneut melden.', time: 'heute, 11:20' },
    ],
  },
  {
    id: 'o2', title: 'Vetpraxis Feldkirchen', sub: 'Feldkirchen · Luna (Hund)', animal: 'dog', date: 'gestern', unread: 0, isTestData: true,
    messages: [
      { from: 'owner', text: 'Bietet ihr Hausbesuche im Raum Feldkirchen an?', time: 'Gestern 11:00' },
      { from: 'clinic', text: 'Ja, gerne — am Nachmittag. Bitte rufen Sie kurz an, dann vereinbaren wir einen Zeitpunkt.', time: 'Gestern 11:20' },
    ],
  },
  {
    id: 'o3', title: 'Tiernotdienst Wörthersee 24h', sub: 'Klagenfurt · Mimi (Katze)', animal: 'cat', date: 'Mo, 02.06.', unread: 0, isTestData: true,
    messages: [
      { from: 'owner', text: 'Danke für die schnelle Hilfe gestern Nacht!', time: 'Mo 08:00' },
      { from: 'clinic', text: 'Sehr gerne. Gute Besserung für Mimi!', time: 'Mo 08:15' },
    ],
  },
];

// ---- Appointments ----
export const APPT_STATUS = {
  open:      { label: 'Offen',     cls: 'yellow' },
  confirmed: { label: 'Bestätigt', cls: 'blue' },
  done:      { label: 'Erledigt',  cls: 'green' },
  cancelled: { label: 'Abgesagt',  cls: 'red' },
};
export const WEEK = [
  { day: 'Mo', date: '02.', count: 6 },
  { day: 'Di', date: '03.', count: 7 },
  { day: 'Mi', date: '04.', count: 5, today: true },
  { day: 'Do', date: '05.', count: 8 },
  { day: 'Fr', date: '06.', count: 4 },
  { day: 'Sa', date: '07.', count: 2 },
  { day: 'So', date: '08.', count: 0 },
];

// ---- Block times (Mittagspause, OP) ----
export const BLOCKS = [
  { time: '12:00', end: '13:00', label: 'Mittagspause' },
  { time: '14:00', end: '15:00', label: 'OP-Zeit' },
];

// ============================================================
//  CALENDAR — appointments keyed by ISO date (Juni 2026)
// ============================================================
export const TODAY_ISO = '2026-06-04';
export const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
export const DOW_DE = ['Mo','Di','Mi','Do','Fr','Sa','So'];

export const APPTS_BY_DATE = {
  '2026-06-02': [
    { time: '08:45', name: 'Rocky (Familie Novak)', animal: 'dog', status: 'done', reason: 'Nachkontrolle Pfote' },
    { time: '10:15', name: 'Nala (Frau Pichler)', animal: 'cat', status: 'done', reason: 'Impfung' },
    { time: '14:00', name: 'Charly (Hr. Moser)', animal: 'dog', status: 'cancelled', reason: 'Krallenpflege' },
  ],
  '2026-06-03': [
    { time: '09:00', name: 'Bella (Fam. Ladinig)', animal: 'dog', status: 'done', reason: 'Ohrenentzündung' },
    { time: '11:30', name: 'Pauli (Frau Brandl)', animal: 'bird', status: 'done', reason: 'Schnabelkontrolle' },
    { time: '15:30', name: 'Minka (Hr. Ebner)', animal: 'cat', status: 'done', reason: 'Zahnstein' },
  ],
  '2026-06-04': [
    { time: '08:30', name: 'Balu (Familie Berger)', animal: 'dog', status: 'confirmed', reason: 'Lahmheit / Notfall', convoId: 'c1' },
    { time: '09:15', name: 'Mimi (Frau Wieser)', animal: 'cat', status: 'confirmed', reason: 'Jahresimpfung', convoId: 'c2' },
    { time: '10:30', name: 'Felix (Herr Painer)', animal: 'cat', status: 'open', reason: 'Kontrolle' },
    { time: '11:00', name: 'Rocky (Familie Novak)', animal: 'dog', status: 'confirmed', reason: 'Nachkontrolle', convoId: 'c4' },
    { time: '13:30', name: 'Hoppel (Hr. Tomaschitz)', animal: 'small', status: 'open', reason: 'Atemwege', convoId: 'c3' },
    { time: '15:00', name: 'Luna (Frau Egger)', animal: 'dog', status: 'cancelled', reason: 'Krallen schneiden' },
    { time: '16:15', name: 'Schnurli (Fam. Kogler)', animal: 'cat', status: 'confirmed', reason: 'Zahnkontrolle' },
  ],
  '2026-06-05': [
    { time: '08:30', name: 'Pferd Sandro (Reitstall Süd)', animal: 'horse', status: 'confirmed', reason: 'Hufkontrolle / Hausbesuch' },
    { time: '10:00', name: 'Coco (Frau Stern)', animal: 'cat', status: 'open', reason: 'Kastration – Vorgespräch' },
    { time: '11:45', name: 'Bruno (Hr. Lenz)', animal: 'dog', status: 'confirmed', reason: 'Blutabnahme' },
    { time: '15:30', name: 'Schildi (Fam. Url)', animal: 'exotic', status: 'open', reason: 'Panzerkontrolle' },
  ],
  '2026-06-06': [
    { time: '09:30', name: 'Lilly (Frau Wank)', animal: 'cat', status: 'open', reason: 'Augenkontrolle' },
    { time: '11:00', name: 'Max (Fam. Url)', animal: 'dog', status: 'open', reason: 'Impfung' },
  ],
  '2026-06-09': [
    { time: '08:45', name: 'Emma (Hr. Gruber)', animal: 'dog', status: 'open', reason: 'Routinecheck' },
    { time: '13:00', name: 'Tweety (Frau Klein)', animal: 'bird', status: 'open', reason: 'Federverlust' },
  ],
  '2026-06-11': [
    { time: '10:00', name: 'Rosa (Fam. Sturm)', animal: 'small', status: 'open', reason: 'Krallen / Zähne' },
    { time: '14:30', name: 'Cleo (Frau Hofer)', animal: 'cat', status: 'open', reason: 'Nachkontrolle' },
    { time: '16:00', name: 'Aki (Hr. Wieser)', animal: 'dog', status: 'open', reason: 'Hautprobleme' },
  ],
};
// backward-compat: today's list
export const APPOINTMENTS = APPTS_BY_DATE[TODAY_ISO];

export function isoOf(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
export function weekdayMon0(iso) { const d = new Date(iso + 'T00:00:00'); return (d.getDay() + 6) % 7; } // Mo=0..So=6
export function blocksFor(iso) { const w = weekdayMon0(iso); return (w <= 4) ? BLOCKS : []; } // Mo–Fr
export function apptsFor(map, iso) { return map[iso] || []; }

// ---- Clinic profile seed (Über uns / hours / verification / team / notifications) ----
export const CLINIC_PROFILE = {
  about: 'Wir sind eine familiäre Kleintierpraxis im Drautal und besonders erfahren bei Chirurgie, Zahnsanierungen und der Betreuung älterer Katzen. Notfälle nehmen wir nach kurzer telefonischer Ankündigung jederzeit an.',
  verification: 'verified', // verified | pending | none
  hoursWeek: [
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
};

/* Vollständiges Datenobjekt (gleiche Form wie window.VN_DATA im Prototyp).
   `buildVNData(hideTestData)` liefert eine gefilterte Sicht: Ist der
   Admin-Schalter aktiv, werden alle isTestData-Einträge (Praxen, Chats)
   sowie die zugehörigen Demo-Termine ausgeblendet. */
export function buildVNData(hideTestData) {
  const practices = hideTestData ? PRACTICES.filter((p) => !p.isTestData) : PRACTICES;
  const conversations = hideTestData ? CONVERSATIONS.filter((c) => !c.isTestData) : CONVERSATIONS;
  const ownerConversations = hideTestData ? OWNER_CONVERSATIONS.filter((c) => !c.isTestData) : OWNER_CONVERSATIONS;
  const apptsByDate = hideTestData ? {} : APPTS_BY_DATE;
  return {
    STATUS, ANIMAL_LABEL, SERVICE_LABEL, SPECIALTY_LABEL, SPECIALTIES,
    DISTRICTS, SITUATIONS, ANIMALS, sortPractices,
    PRACTICES: practices,
    CONVERSATIONS: conversations,
    OWNER_CONVERSATIONS: ownerConversations,
    APPTS_BY_DATE: apptsByDate,
    APPOINTMENTS: hideTestData ? [] : APPOINTMENTS,
    APPT_STATUS, WEEK, BLOCKS,
    TODAY_ISO, MONTHS_DE, DOW_DE,
    isoOf, weekdayMon0, blocksFor, apptsFor, CLINIC_PROFILE,
  };
}
