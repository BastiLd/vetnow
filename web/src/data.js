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
  {
    id: 'klagenfurt-zentrum', name: 'Tierklinik Klagenfurt Zentrum', district: 'Klagenfurt', isTestData: true,
    specialties: ['chirurgie','neuro','onko','augen'],
    address: 'Bahnhofstraße 22, 9020 Klagenfurt', phone: '+43 000 000000',
    status: 'green', confirmedAt: 'heute, 07:50', hoursShort: 'Mo–Sa 7–20',
    hoursWeek: ['7–20','7–20','7–20','7–20','7–20','8–16','geschlossen'],
    emergency: 'Nimmt heute Notfälle an, eigenes Labor & OP',
    emergencyLong: 'Große Tierklinik mit eigenem Labor, Röntgen und OP-Bereich. Notfälle werden heute durchgehend angenommen, bitte kurz telefonisch ankündigen.',
    animals: ['cat','dog','small','exotic'],
    services: ['emergency','regular','euthanasia'],
    ageHours: 1,
  },
  {
    id: 'ossiach', name: 'Tierpraxis Ossiacher See', district: 'Villach', isTestData: true,
    specialties: ['haut','zahn'],
    address: 'Seeuferweg 9, 9570 Ossiach', phone: '+43 000 000000',
    status: 'green', confirmedAt: 'heute, 09:20', hoursShort: 'Mo–Fr 8–17',
    hoursWeek: ['8–17','8–17','8–17','8–17','8–17','geschlossen','geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Familiäre Praxis am Ossiacher See, nimmt heute Notfälle an und bietet Hausbesuche in der Umgebung.',
    animals: ['cat','dog','small'],
    services: ['emergency','regular','housecall'],
    ageHours: 2,
  },
  {
    id: 'millstatt', name: 'Kleintierpraxis Millstätter See', district: 'Spittal', isTestData: true,
    specialties: ['zahn','ortho'],
    address: 'Seemühlgasse 3, 9872 Millstatt', phone: '+43 000 000000',
    status: 'yellow', confirmedAt: 'heute, 10:05', hoursShort: 'Mo–Fr 8–16',
    hoursWeek: ['8–16','8–16','8–16','8–16','8–16','geschlossen','geschlossen'],
    emergency: 'Notfälle nur nach telefonischer Rücksprache',
    emergencyLong: 'Notfälle werden heute nur nach vorheriger telefonischer Rücksprache angenommen. Bitte zuerst anrufen.',
    animals: ['cat','dog','small'],
    services: ['regular','emergency'],
    ageHours: 1,
  },
  {
    id: 'koralpe', name: 'Tierarzt Koralpe', district: 'Wolfsberg', isTestData: true,
    specialties: ['ortho','chirurgie'],
    address: 'Koralmstraße 44, 9400 Wolfsberg', phone: '+43 000 000000',
    status: 'green', confirmedAt: 'heute, 08:00', hoursShort: 'Mo–Fr 7–17',
    hoursWeek: ['7–17','7–17','7–17','7–17','7–17','8–12','geschlossen'],
    emergency: 'Nimmt heute Notfälle an, auch Großtiere',
    emergencyLong: 'Landtierärztliche Praxis, betreut Klein- und Großtiere. Notfälle werden heute angenommen, Hausbesuche im Lavanttal möglich.',
    animals: ['cat','dog','horse','small'],
    services: ['emergency','regular','housecall'],
    ageHours: 3,
  },
  {
    id: 'gurktal', name: 'Vetzentrum Gurktal', district: 'St. Veit', isTestData: true,
    specialties: ['herz','neuro','zahn'],
    address: 'Gurkstraße 7, 9342 Gurk', phone: '+43 000 000000',
    status: 'green', confirmedAt: 'heute, 09:45', hoursShort: 'Mo–Fr 8–18',
    hoursWeek: ['8–18','8–18','8–18','8–18','8–18','9–13','geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Modernes Vetzentrum mit Kardiologie-Schwerpunkt. Notfälle werden heute angenommen.',
    animals: ['cat','dog','small','bird'],
    services: ['emergency','regular','euthanasia','housecall'],
    ageHours: 1,
  },
  {
    id: 'klopein', name: 'Tierpraxis Klopeiner See', district: 'Völkermarkt', isTestData: true,
    specialties: ['haut','exoten'],
    address: 'Seestraße 15, 9122 St. Kanzian', phone: '+43 000 000000',
    status: 'red', confirmedAt: 'heute, 06:30', hoursShort: 'Mo–Fr 9–16',
    hoursWeek: ['9–16','9–16','9–16','9–16','9–16','geschlossen','geschlossen'],
    emergency: 'Heute keine Notfälle – bitte Tierklinik Klagenfurt kontaktieren',
    emergencyLong: 'Diese Praxis nimmt heute keine Notfälle an. Bitte im Notfall an die Tierklinik Klagenfurt Zentrum wenden.',
    animals: ['cat','small','exotic','bird'],
    services: ['regular'],
    ageHours: 5,
  },
  {
    id: 'nassfeld', name: 'Bergtierarzt Nassfeld', district: 'Hermagor', isTestData: true,
    specialties: ['ortho'],
    address: 'Nassfeldstraße 88, 9620 Hermagor', phone: '+43 000 000000',
    status: 'yellow', confirmedAt: 'heute, 08:40', hoursShort: 'Mo–Fr 8–15',
    hoursWeek: ['8–15','8–15','8–15','8–15','8–15','geschlossen','geschlossen'],
    emergency: 'Eingeschränkt – bitte vorher anrufen',
    emergencyLong: 'Heute nur eingeschränkt erreichbar (Bergregion). Bitte vor einem Besuch telefonisch Kontakt aufnehmen.',
    animals: ['dog','cat','horse'],
    services: ['regular','housecall'],
    ageHours: 2,
  },
  {
    id: 'viktring', name: 'Pferdeklinik Viktring', district: 'Klagenfurt', isTestData: true,
    specialties: ['ortho','chirurgie'],
    address: 'Stiftweg 5, 9073 Klagenfurt-Viktring', phone: '+43 000 000000',
    status: 'green', confirmedAt: 'heute, 07:05', hoursShort: 'Mo–Sa 7–19',
    hoursWeek: ['7–19','7–19','7–19','7–19','7–19','7–15','Notdienst'],
    emergency: '24h Pferde-Notdienst, mobile Einsätze',
    emergencyLong: 'Spezialklinik für Pferde mit mobilem Notdienst in ganz Kärnten. Bei Kolik oder Verletzungen sofort anrufen.',
    animals: ['horse'],
    services: ['emergency','regular','euthanasia','housecall'],
    ageHours: 1,
  },
  {
    id: 'faak', name: 'Tierarzt Faaker See', district: 'Villach', isTestData: true,
    specialties: ['zahn','augen'],
    address: 'Seepromenade 21, 9583 Faak am See', phone: '+43 000 000000',
    status: 'grey', confirmedAt: 'vor 2 Tagen', hoursShort: 'Mo–Fr 9–17',
    hoursWeek: ['9–17','9–17','9–17','9–17','9–17','geschlossen','geschlossen'],
    emergency: 'Status nicht aktuell bestätigt – bitte unbedingt telefonisch prüfen.',
    emergencyLong: 'Der Status dieser Praxis wurde seit über 24 Stunden nicht bestätigt. Bitte telefonisch prüfen, ob heute Notfälle angenommen werden.',
    animals: ['cat','dog','small'],
    services: ['regular','emergency'],
    ageHours: 40,
  },
  {
    id: 'maria-saal', name: 'Tierarztpraxis Maria Saal', district: 'Klagenfurt', isTestData: true,
    specialties: ['zahn','haut','exoten'],
    address: 'Domplatz 2, 9063 Maria Saal', phone: '+43 000 000000',
    status: 'green', confirmedAt: 'heute, 09:10', hoursShort: 'Mo–Fr 8–17',
    hoursWeek: ['8–17','8–17','8–17','8–17','8–17','9–12','geschlossen'],
    emergency: 'Nimmt heute Notfälle an',
    emergencyLong: 'Freundliche Praxis nördlich von Klagenfurt. Notfälle werden heute angenommen, Schwerpunkt auf Zahn- und Hautbehandlungen.',
    animals: ['cat','dog','small','exotic'],
    services: ['emergency','regular','housecall'],
    ageHours: 2,
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

// ============================================================
//  CHAT-SYSTEM — freie Chats mit Labels, Farben & Icons.
//  Labels sind frei editierbar; role ist nur die Standard-Kategorie.
//  role: 'owner'   = Meine Tiere (Chat mit Praxen zu meinen Tieren)
//        'clinic'  = Praxis-Posteingang (Anfragen, die ich ALS Praxis bekomme)
//        'network' = Praxis-Netzwerk (Chats zwischen Praxen)
// ============================================================
export const CHAT_LABELS_SEED = [
  { id: 'tiere',       name: 'Meine Tiere',        color: '#0f9b8e', icon: 'paw2',     seed: true },
  { id: 'posteingang', name: 'Praxis-Posteingang', color: '#2e6f9e', icon: 'building', seed: true },
  { id: 'netzwerk',    name: 'Praxis-Netzwerk',    color: '#8a5d05', icon: 'shield',   seed: true },
  { id: 'notfall',     name: 'Notfall',            color: '#dc2626', icon: 'siren',    seed: true },
  { id: 'termin',      name: 'Termin',             color: '#16a34a', icon: 'cal',      seed: true },
  { id: 'erledigt',    name: 'Erledigt',           color: '#6c7d79', icon: 'check',    seed: true },
];

export const CHATS_SEED = [
  // ---- Meine Tiere (owner) ----
  {
    id: 'ch-o1', role: 'owner', title: 'Tierarztpraxis Drautal', sub: 'Villach · Balu (Hund)', animal: 'dog',
    color: '#0f9b8e', icon: 'paw2', labels: ['tiere', 'erledigt'], pinned: true, unread: 1, isTestData: true,
    messages: [
      { from: 'owner', text: 'Guten Morgen, unser Hund Balu humpelt seit heute früh und frisst nicht. Können wir heute vorbeikommen?', time: '09:30' },
      { from: 'clinic', text: 'Guten Morgen! Kommen Sie gerne um 08:30 vorbei, wir sehen ihn uns an.', time: '09:36' },
      { type: 'note', text: 'Behandlung verlief gut. Leichte Zerrung — Balu sollte sich 3 Tage schonen, bitte weiter beobachten. Bei Verschlechterung bitte erneut melden.', time: 'heute, 11:20' },
    ],
  },
  {
    id: 'ch-o2', role: 'owner', title: 'Vetpraxis Feldkirchen', sub: 'Feldkirchen · Luna (Hund)', animal: 'dog',
    color: '#0f9b8e', icon: 'dog', labels: ['tiere'], pinned: false, unread: 0, isTestData: true,
    messages: [
      { from: 'owner', text: 'Bietet ihr Hausbesuche im Raum Feldkirchen an?', time: 'Gestern 11:00' },
      { from: 'clinic', text: 'Ja, gerne — am Nachmittag. Bitte rufen Sie kurz an, dann vereinbaren wir einen Zeitpunkt.', time: 'Gestern 11:20' },
    ],
  },
  {
    id: 'ch-o3', role: 'owner', title: 'Tiernotdienst Wörthersee 24h', sub: 'Klagenfurt · Mimi (Katze)', animal: 'cat',
    color: '#dc2626', icon: 'siren', labels: ['tiere', 'notfall'], pinned: false, unread: 0, isTestData: true,
    messages: [
      { from: 'owner', text: 'Danke für die schnelle Hilfe gestern Nacht!', time: 'Mo 08:00' },
      { from: 'clinic', text: 'Sehr gerne. Gute Besserung für Mimi!', time: 'Mo 08:15' },
    ],
  },
  // ---- Praxis-Posteingang (clinic) ----
  {
    id: 'ch-c1', role: 'clinic', title: 'Familie Berger', sub: 'Balu (Hund) · Lahmheit', animal: 'dog',
    color: '#dc2626', icon: 'siren', labels: ['posteingang', 'notfall'], pinned: true, unread: 2, isTestData: true,
    messages: [
      { from: 'owner', text: 'Guten Morgen, unser Hund Balu humpelt seit heute früh und frisst nicht. Können wir heute vorbeikommen?', time: '09:30' },
      { from: 'clinic', text: 'Guten Morgen! Das klingt nach etwas, das wir uns ansehen sollten. Seit wann humpelt er genau?', time: '09:36' },
      { from: 'owner', text: 'Seit dem Spaziergang heute früh, ca. 7 Uhr.', time: '09:40' },
      { from: 'owner', text: 'Sollen wir sofort kommen?', time: '09:42' },
    ],
  },
  {
    id: 'ch-c2', role: 'clinic', title: 'Frau Wieser', sub: 'Mimi (Katze) · Jahresimpfung', animal: 'cat',
    color: '#16a34a', icon: 'cal', labels: ['posteingang', 'termin'], pinned: false, unread: 0, isTestData: true,
    messages: [
      { from: 'owner', text: 'Hallo, meine Katze Mimi soll zur jährlichen Impfung. Haben Sie diese Woche einen Termin?', time: '08:05' },
      { from: 'clinic', text: 'Gerne! Donnerstag um 14:30 wäre frei. Passt das?', time: '08:08' },
      { from: 'owner', text: 'Perfekt, danke!', time: '08:10' },
    ],
  },
  {
    id: 'ch-c3', role: 'clinic', title: 'Herr Tomaschitz', sub: 'Hoppel (Kleintier) · Atemwege', animal: 'small',
    color: '#2e6f9e', icon: 'building', labels: ['posteingang'], pinned: false, unread: 0, isTestData: true,
    messages: [
      { from: 'owner', text: 'Mein Kaninchen niest seit ein paar Tagen. Ist das dringend?', time: 'Gestern 16:20' },
      { from: 'clinic', text: 'Beobachten Sie bitte, ob Nasenausfluss dazukommt. Wenn ja, bitte rasch vorbeikommen. Bei Atemnot sofort anrufen.', time: 'Gestern 16:45' },
    ],
  },
  {
    id: 'ch-c4', role: 'clinic', title: 'Familie Novak', sub: 'Rocky (Hund) · Nachkontrolle', animal: 'dog',
    color: '#6c7d79', icon: 'check', labels: ['posteingang', 'erledigt'], pinned: false, unread: 0, isTestData: true,
    messages: [
      { from: 'owner', text: 'Danke für die schnelle Hilfe gestern Abend!', time: 'Mo 19:02' },
      { from: 'clinic', text: 'Sehr gerne — gute Besserung für Rocky!', time: 'Mo 19:10' },
    ],
  },
  // ---- Praxis-Netzwerk (network) ----
  {
    id: 'ch-n1', role: 'network', title: 'Tiernotdienst Wörthersee 24h', sub: 'Vertretung & Überweisung', animal: 'dog',
    color: '#8a5d05', icon: 'shield', labels: ['netzwerk'], pinned: true, unread: 1, isTestData: true,
    messages: [
      { from: 'clinic', text: 'Servus Kolleg:innen! Können wir am Wochenende einen Notfall zu euch überweisen? Wir haben Betriebsurlaub.', time: 'Fr 14:10' },
      { from: 'owner', text: 'Klar, kein Problem. Schickt uns kurz die Patientendaten vorab.', time: 'Fr 14:25' },
    ],
  },
  {
    id: 'ch-n2', role: 'network', title: 'Pferdeklinik Viktring', sub: 'Fachaustausch Orthopädie', animal: 'horse',
    color: '#0f9b8e', icon: 'horse', labels: ['netzwerk'], pinned: false, unread: 0, isTestData: true,
    messages: [
      { from: 'clinic', text: 'Habt ihr Erfahrung mit dem neuen Sedierungsprotokoll bei Kolik-Patienten?', time: 'Mi 10:00' },
      { from: 'owner', text: 'Ja, läuft bei uns sehr gut. Ich schick dir unser Schema per Mail.', time: 'Mi 10:20' },
    ],
  },
];

/* Standard-Einstellungen fürs Chat-System — alles einzeln abschaltbar. */
export const CHAT_SETTINGS_DEFAULT = {
  autoSeed: true,        // vorgefertigte Chats & Labels beim ersten Start anlegen
  showLabels: true,      // Label-Chips & Filter anzeigen
  enableOwner: true,     // Bereich "Meine Tiere"
  enablePosteingang: true, // Bereich "Praxis-Posteingang"
  enableNetwork: true,   // Bereich "Praxis-Netzwerk"
  showPinned: true,      // angepinnte Chats oben
  botEnabled: true,      // Auto-Antwort-Bot (Demo)
  botTyping: true,       // Tipp-Animation (3 Punkte), während die Gegenseite "tippt"
  botGreeting: true,     // Begrüßung beim ersten Öffnen eines leeren Chats
  botMode: 'ai',         // 'ai' = Ollama über VetNow Studio (Standard) | 'smart' = eingebauter Bot 2.0 (Fallback)
  aiModel: '',           // Ollama-Modell, leer = Standard des Studios (qwen2.5:7b)
  aiBaseUrl: '',         // KI-Proxy-URL, leer = same-origin '/api/ai' (Studio)
  agentEnabled: true,    // KI-Agent-Panel (führt sichtbar Aufgaben in der App aus)
};

/* Der eigentliche Bot lebt in bot.js (Bot 2.0: Intents, Kontext, Triage).
   Diese Re-Exports halten ältere Import-Pfade am Leben. */
export { botConversationReply, botGreetingText, botImageReply } from './bot.js';

export const CHAT_ROLES = [
  { key: 'owner',   label: 'Meine Tiere',        defaultLabel: 'tiere' },
  { key: 'clinic',  label: 'Praxis-Posteingang', defaultLabel: 'posteingang' },
  { key: 'network', label: 'Praxis-Netzwerk',    defaultLabel: 'netzwerk' },
];

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
