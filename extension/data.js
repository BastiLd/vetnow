/* VetNow Extension — kompakte, eigenständige Testdaten (plain script).
   Bewusst self-contained, damit die Extension ohne Build/Server läuft. */
window.VN_EXT_DATA = {
  WEB_URL: 'https://bastild.github.io/vetnow/',
  STATUS: {
    green:  { label: 'Erreichbar',   color: '#16a34a' },
    yellow: { label: 'Rücksprache',  color: '#e3a008' },
    red:    { label: 'Nicht da',     color: '#dc2626' },
    grey:   { label: 'Nicht bestätigt', color: '#94a39f' },
  },
  ANIMAL_EMOJI: { cat: '🐱', dog: '🐶', small: '🐰', horse: '🐴', bird: '🦜', exotic: '🐢', other: '🐾' },
  ANIMAL_LABEL: { cat: 'Katze', dog: 'Hund', small: 'Kleintier', horse: 'Pferd', bird: 'Vogel', exotic: 'Exoten', other: 'Tier' },
  APPT_STATUS: {
    open: { label: 'Offen', cls: 'tag-yellow' },
    confirmed: { label: 'Bestätigt', cls: 'tag-blue' },
    done: { label: 'Erledigt', cls: 'tag-green' },
    cancelled: { label: 'Abgesagt', cls: 'tag-red' },
  },
  APPOINTMENTS: [
    { time: '08:30', name: 'Balu (Familie Berger)', animal: 'dog', status: 'confirmed', reason: 'Lahmheit / Notfall', convoId: 'c1' },
    { time: '09:15', name: 'Mimi (Frau Wieser)', animal: 'cat', status: 'confirmed', reason: 'Jahresimpfung', convoId: 'c2' },
    { time: '10:30', name: 'Felix (Herr Painer)', animal: 'cat', status: 'open', reason: 'Kontrolle' },
    { time: '11:00', name: 'Rocky (Familie Novak)', animal: 'dog', status: 'confirmed', reason: 'Nachkontrolle', convoId: 'c4' },
    { time: '13:30', name: 'Hoppel (Hr. Tomaschitz)', animal: 'small', status: 'open', reason: 'Atemwege', convoId: 'c3' },
    { time: '15:00', name: 'Luna (Frau Egger)', animal: 'dog', status: 'cancelled', reason: 'Krallen schneiden' },
    { time: '16:15', name: 'Schnurli (Fam. Kogler)', animal: 'cat', status: 'confirmed', reason: 'Zahnkontrolle' },
  ],
  CONVERSATIONS: [
    { id: 'c1', owner: 'Familie Berger', animal: 'dog', unread: 2, messages: [
      { from: 'owner', text: 'Unser Hund Balu humpelt seit heute früh und frisst nicht. Können wir vorbeikommen?', time: '09:30' },
      { from: 'clinic', text: 'Guten Morgen! Seit wann humpelt er genau?', time: '09:36' },
      { from: 'owner', text: 'Seit dem Spaziergang heute früh, ca. 7 Uhr.', time: '09:40' },
      { from: 'owner', text: 'Sollen wir sofort kommen?', time: '09:42' },
    ] },
    { id: 'c2', owner: 'Frau Wieser', animal: 'cat', unread: 0, messages: [
      { from: 'owner', text: 'Mimi soll zur jährlichen Impfung. Haben Sie diese Woche einen Termin?', time: '08:05' },
      { from: 'clinic', text: 'Gerne! Donnerstag um 14:30 wäre frei. Passt das?', time: '08:08' },
      { from: 'owner', text: 'Perfekt, danke!', time: '08:10' },
    ] },
    { id: 'c3', owner: 'Herr Tomaschitz', animal: 'small', unread: 0, messages: [
      { from: 'owner', text: 'Mein Kaninchen niest seit ein paar Tagen. Ist das dringend?', time: 'Gestern 16:20' },
      { from: 'clinic', text: 'Bitte beobachten, ob Nasenausfluss dazukommt. Bei Atemnot sofort anrufen.', time: 'Gestern 16:45' },
    ] },
    { id: 'c4', owner: 'Familie Novak', animal: 'dog', unread: 0, messages: [
      { from: 'owner', text: 'Danke für die schnelle Hilfe gestern Abend!', time: 'Mo 19:02' },
      { from: 'clinic', text: 'Sehr gerne — gute Besserung für Rocky!', time: 'Mo 19:10' },
    ] },
  ],
};
