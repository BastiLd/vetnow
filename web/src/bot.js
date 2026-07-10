/* VetNow — Auto-Antwort-Bot 2.0 (eingebaut, ohne Server).
   Deutlich schlauer als v1: Intent-Erkennung mit Prioritäten, Gesprächskontext
   (merkt sich Tiernamen, offene Fragen, angebotene Termine), Notfall-Triage,
   Antwortvariation (nie zweimal exakt dieselbe Floskel) und mehrteilige
   Antworten. Reines JS — läuft identisch in Web (React) und Mobile (RN).

   Haupteinstieg: botConversationReply({ messages, userText, fromRole, practiceName })
   -> { texts: string[] }  (1–2 Nachrichten, in Reihenfolge zu senden) */

const ANIMAL_WORDS = {
  hund: 'dog', hündin: 'dog', rüde: 'dog', welpe: 'dog',
  katze: 'cat', kater: 'cat', kitten: 'cat', katzenbaby: 'cat',
  kaninchen: 'small', hase: 'small', meerschweinchen: 'small', hamster: 'small', ratte: 'small', maus: 'small',
  pferd: 'horse', pony: 'horse', stute: 'horse', wallach: 'horse',
  vogel: 'bird', papagei: 'bird', wellensittich: 'bird', kanarienvogel: 'bird', sittich: 'bird',
  schildkröte: 'exotic', echse: 'exotic', schlange: 'exotic', gecko: 'exotic', bartagame: 'exotic',
};

/* Tiername aus Text ziehen: "mein Hund Balu", "unsere Katze Mimi", "Balu humpelt" */
function extractPet(text) {
  const t = ' ' + text + ' ';
  // Muster: (mein|meine|unser|unsere) <Tierart> <Name>
  const m = t.match(/(?:mein(?:e|em|en)?|unser(?:e|em|en)?)\s+(\p{L}+)\s+([A-ZÄÖÜ][a-zäöüß]{2,})/u);
  if (m) {
    const kind = ANIMAL_WORDS[m[1].toLowerCase()];
    if (kind) return { name: m[2], kind };
  }
  // Muster: <Tierart> <Name> ("Hündin Luna")
  const m2 = t.match(/\b(Hund|Hündin|Kater|Katze|Kaninchen|Pferd|Welpe|Pony)\s+([A-ZÄÖÜ][a-zäöüß]{2,})/u);
  if (m2 && !['Seit', 'Und', 'Aber', 'Danke'].includes(m2[2])) {
    return { name: m2[2], kind: ANIMAL_WORDS[m2[1].toLowerCase()] || null };
  }
  return null;
}

/* Kontext aus dem bisherigen Verlauf rekonstruieren (stateless — aus messages) */
function buildContext(messages, fromRole) {
  const ctx = { pet: null, offeredSlot: null, openQuestion: null, botMsgCount: 0 };
  for (const m of messages) {
    if (m.type === 'note' || m.type === 'image') continue;
    const txt = m.text || '';
    if (m.from !== fromRole) {
      const pet = extractPet(txt);
      if (pet) ctx.pet = pet;
    } else {
      ctx.botMsgCount++;
      const slot = txt.match(/(morgen|heute|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag)[^.?!]*?(\d{1,2}[:.]\d{2})/i);
      if (slot) ctx.offeredSlot = slot[1] + ' um ' + slot[2].replace('.', ':');
      if (/\?\s*$/.test(txt)) ctx.openQuestion = txt;
      else ctx.openQuestion = null;
    }
  }
  return ctx;
}

/* Deterministische "Zufalls"-Variante: gleiche Konversation -> stabil, aber
   unterschiedliche Länge -> andere Variante. Nie rein zufällig (Tests!). */
function pick(variants, seed) {
  return variants[Math.abs(seed) % variants.length];
}

function petRef(ctx, fallback) {
  if (ctx.pet && ctx.pet.name) return ctx.pet.name;
  return fallback || 'Ihrem Tier';
}

/* ---- Intent-Definitionen (Reihenfolge = Priorität) ---- */
const GIFTE = /(schokolade|zwiebel|knoblauch|weintraube|rosine|xylit|birkenzucker|avocado|rattengift|schneckenkorn|ibuprofen|paracetamol|teebauml|lilie|frostschutz)/;

function detectIntent(t) {
  if (GIFTE.test(t) && /(gefressen|erwischt|genascht|gegessen|geschluckt|aufgenommen|geleckt)/.test(t)) return 'poison';
  if (/(notfall|dringend|sofort|lebensgefahr|kollabiert|bewusstlos|krampf|atemnot|röchelt|stark blutet|blutet stark|aufgebläht|magendrehung|hitzschlag|überfahren|unfall|vergift)/.test(t)) return 'emergency';
  if (/(erbricht|erbrochen|übergeben|durchfall|frisst nicht|frisst nichts|apathisch|humpelt|lahmt|kratzt sich|juckreiz|niest|husten|hustet|zittert|fieber|schwellung|geschwollen|augenausfluss|ohrenentzündung|verletzt|wunde|zecke)/.test(t)) return 'symptom';
  if (/(termin.*(verschieben|absagen|stornieren)|(verschieben|absagen).*termin|kann nicht kommen)/.test(t)) return 'reschedule';
  if (/(passt|geht klar|nehmen wir|ja gerne|ja,? das passt|einverstanden|perfekt|super,? dann)/.test(t)) return 'confirm';
  if (/(termin|uhrzeit|wann.*(frei|zeit|möglich)|vorbeikommen|vorbei kommen|diese woche|nächste woche|hätten sie.*zeit|einen slot)/.test(t)) return 'appointment';
  if (/(öffnungszeit|geöffnet|offen.*(heute|morgen|samstag|sonntag)|wann.*(auf|zu)|feiertag)/.test(t)) return 'hours';
  if (/(kosten|preis|was kostet|wie teuer|gebühr|honorar|bezahlen|ratenzahlung|versicherung)/.test(t)) return 'price';
  if (/(impf|tollwut|booster|auffrischung)/.test(t)) return 'vaccination';
  if (/(kastr|sterilis)/.test(t)) return 'castration';
  if (/(zahn|zähne|zahnstein|maulgeruch|mundgeruch)/.test(t)) return 'dental';
  if (/(wurmkur|entwurm|floh|flöhe|zecken(schutz|mittel)|parasit|spot.?on)/.test(t)) return 'parasites';
  if (/(futter|fütter|ernährung|diät|übergewicht|barf|leckerli)/.test(t)) return 'nutrition';
  if (/(medikament|tablette|dosier|schmerzmittel|antibiotik|globuli|geben.*darf|darf.*geben)/.test(t)) return 'medication';
  if (/(chip|kennzeichnung|heimtierausweis|reisen|ausland|urlaub.*(mitnehmen|tier))/.test(t)) return 'travel';
  if (/(adresse|wo (sind|finde)|anfahrt|parkplatz|wie komme ich)/.test(t)) return 'address';
  if (/(hausbesuch|zu uns kommen|nach hause kommen|mobil)/.test(t)) return 'housecall';
  if (/(danke|dankeschön|vielen dank|super|toll|lieben dank)/.test(t)) return 'thanks';
  if (/(hallo|guten tag|guten morgen|guten abend|servus|grüß)/.test(t)) return 'greeting';
  if (/(tschüss|auf wiedersehen|bis bald|schönen tag|lg|liebe grüße)$/.test(t.trim())) return 'bye';
  if (/\?\s*$/.test(t)) return 'question';
  return 'fallback';
}

/* ---- Antworten je Intent (mit Varianten und Kontext) ---- */
function answer(intent, { t, ctx, seed, practiceName }) {
  const pet = petRef(ctx);
  const P = practiceName || 'unsere Praxis';
  switch (intent) {
    case 'poison':
      return [
        'Das kann giftig sein — bitte NICHT selbst Erbrechen auslösen und nichts füttern!',
        `Kommen Sie bitte sofort zu uns oder rufen Sie an. Wichtig: Wenn möglich, Verpackung/Reste mitbringen und uns sagen, wie viel ${pet} ungefähr erwischt hat und wann.`,
      ];
    case 'emergency':
      return [
        pick([
          'Das klingt nach einem Notfall — bitte kommen Sie SOFORT vorbei, wir bereiten alles vor.',
          'Das ist dringend! Bitte sofort losfahren oder direkt anrufen — wir machen den Behandlungsraum frei.',
        ], seed),
        `Für die Vorbereitung: Seit wann bestehen die Symptome, und ist ${pet} ansprechbar? Bitte während der Fahrt warm halten und Ruhe bewahren.`,
      ];
    case 'symptom': {
      const q = pick([
        `Seit wann beobachten Sie das bei ${pet}? Und frisst und trinkt ${pet} normal?`,
        `Wie lange geht das schon, und hat sich das Verhalten von ${pet} sonst verändert (Müdigkeit, Appetit)?`,
        `Ist das plötzlich aufgetreten oder schleichend? Und wirkt ${pet} sonst munter?`,
      ], seed);
      return [
        pick([
          'Danke für die Beschreibung — das sollten wir uns ansehen.',
          'Gut, dass Sie sich melden — das klären wir am besten bei einer kurzen Untersuchung.',
        ], seed) + ' ' + q,
      ];
    }
    case 'reschedule':
      return [pick([
        'Kein Problem, das verschieben wir. Wann würde es Ihnen stattdessen passen — eher vormittags oder nachmittags?',
        'Alles klar, ich storniere den Termin. Sollen wir gleich einen neuen ausmachen? Ich hätte morgen 09:30 oder 15:00 Uhr frei.',
      ], seed)];
    case 'confirm':
      if (ctx.offeredSlot) {
        return [
          `Wunderbar — der Termin ${ctx.offeredSlot} ist für ${pet} eingetragen. ✅`,
          'Bitte bringen Sie, falls vorhanden, den Impfpass mit. Bis dann!',
        ];
      }
      return [pick(['Perfekt, das notiere ich so. 👍', 'Super, dann machen wir es genau so.'], seed)];
    case 'appointment':
      return [pick([
        `Gerne! Ich hätte morgen um 09:30 Uhr oder um 14:00 Uhr einen Termin frei — was passt Ihnen besser für ${pet}?`,
        `Da finden wir etwas: Donnerstag 10:15 Uhr oder Freitag 16:30 Uhr wären frei. Welcher Termin passt für ${pet}?`,
        'Sehr gerne. Wie dringend ist es — noch diese Woche, oder reicht Anfang nächster Woche? Morgen um 11:00 Uhr hätte ich z. B. etwas frei.',
      ], seed)];
    case 'hours':
      return [pick([
        `Wir sind Mo–Fr von 8 bis 18 Uhr für Sie da, Samstag 9–12 Uhr. In dringenden Fällen außerhalb der Zeiten bitte anrufen — ${P} hilft, wo es geht.`,
        'Unsere Öffnungszeiten: Montag bis Freitag 8–18 Uhr, Samstag 9–12 Uhr, Sonntag geschlossen. Notfälle nach telefonischer Ankündigung jederzeit.',
      ], seed)];
    case 'price':
      return [
        pick([
          'Die Kosten hängen von der Behandlung ab — eine allgemeine Untersuchung liegt meist bei ca. 45–70 €, Impfungen bei ca. 50–90 €.',
          'Das kann ich pauschal schwer sagen: Erstuntersuchung ca. 45–70 €, weitere Leistungen je nach Aufwand.',
        ], seed),
        'Wir besprechen die voraussichtlichen Kosten aber immer VOR der Behandlung transparent mit Ihnen — keine Überraschungen.',
      ];
    case 'vaccination':
      return [pick([
        `Impfungen machen wir laufend. Wann war die letzte Impfung von ${pet}? Bringen Sie zum Termin bitte den Impfpass mit — ich hätte diese Woche noch freie Termine.`,
        'Gern! Für die Grundimmunisierung bzw. Auffrischung planen wir ca. 15 Minuten ein. Donnerstag 14:30 Uhr wäre z. B. frei — passt das?',
      ], seed)];
    case 'castration':
      return [
        `Eine Kastration ist bei uns Routine. Wir machen vorab ein kurzes Vorgespräch mit Untersuchung von ${pet} und besprechen Ablauf, Narkose und Nachsorge.`,
        'Soll ich Ihnen einen Termin fürs Vorgespräch anbieten? Das dauert ca. 20 Minuten.',
      ];
    case 'dental':
      return [pick([
        `Zahnprobleme sind häufig und werden oft unterschätzt. Starker Maulgeruch oder Zahnstein bei ${pet} sollten wir uns ansehen — meist reicht zuerst ein kurzer Kontrolltermin.`,
        'Das klingt nach einem Fall für unsere Zahnsprechstunde. Wir schauen uns das Gebiss an und besprechen dann, ob eine Zahnsteinentfernung nötig ist.',
      ], seed)];
    case 'parasites':
      return [pick([
        `Bei Zecken- und Flohschutz beraten wir Sie gern zu Spot-ons, Tabletten oder Halsbändern — was am besten passt, hängt von ${pet} ab (Gewicht, Freigang).`,
        'Entwurmung empfehlen wir je nach Lebensstil 2–4× pro Jahr. Sie können die Wurmkur bei uns abholen oder wir geben sie beim nächsten Termin direkt.',
      ], seed)];
    case 'nutrition':
      return [pick([
        `Ernährungsberatung machen wir gerne — am besten bringen Sie ${pet} einmal zum Wiegen vorbei, dann erstellen wir einen konkreten Futterplan.`,
        'Gute Frage! Futter ist sehr individuell (Alter, Gewicht, Vorerkrankungen). Sollen wir das bei einem kurzen Beratungstermin durchgehen?',
      ], seed)];
    case 'medication':
      return [
        'Bitte geben Sie KEINE Medikamente aus der Hausapotheke — vieles, was für Menschen harmlos ist (z. B. Ibuprofen oder Paracetamol), ist für Tiere giftig!',
        `Rufen Sie uns kurz an oder kommen Sie vorbei, dann verordnen wir etwas Passendes für ${pet}.`,
      ];
    case 'travel':
      return [
        'Für Reisen brauchen Sie in der EU: Mikrochip, gültige Tollwutimpfung (mind. 21 Tage alt) und den EU-Heimtierausweis.',
        'Beides können wir bei uns machen. Wann geht die Reise los? Dann planen wir rechtzeitig.',
      ];
    case 'address':
      return [pick([
        `Sie finden ${P} an der in der App angegebenen Adresse — Parkplätze sind direkt vor der Praxis. Über „Route öffnen" startet die Navigation.`,
        'Die genaue Adresse steht auf unserer Praxisseite in der App — mit einem Tipp auf „Route" öffnet sich die Karten-App mit Navigation.',
      ], seed)];
    case 'housecall':
      return [pick([
        'Hausbesuche bieten wir an — vor allem für Tiere, die der Transport stark stresst. Sagen Sie uns Adresse und Wunschzeit, wir melden uns mit einem Terminvorschlag.',
        'Ja, wir kommen auch zu Ihnen! Hausbesuche machen wir meist am Nachmittag. Wo wohnen Sie ungefähr?',
      ], seed)];
    case 'thanks':
      return [pick([
        `Sehr gerne — gute Besserung für ${pet}! 🐾`,
        'Gern geschehen! Melden Sie sich jederzeit wieder. 🐾',
        `Dafür sind wir da! Alles Gute für ${pet} und bis bald.`,
      ], seed)];
    case 'greeting':
      return [pick([
        `Hallo und willkommen bei ${P}! 👋 Wie können wir Ihnen und Ihrem Tier helfen?`,
        'Guten Tag! 👋 Schön, dass Sie sich melden — worum geht es denn?',
      ], seed)];
    case 'bye':
      return [pick(['Bis bald und alles Gute! 🐾', 'Auf Wiedersehen — kommen Sie gut durch den Tag!'], seed)];
    case 'question':
      return [pick([
        'Gute Frage — ja, das ist grundsätzlich möglich. Am besten klären wir die Details kurz telefonisch oder bei einem Termin. Soll ich Ihnen einen vorschlagen?',
        'Das hängt vom Einzelfall ab. Beschreiben Sie mir kurz mehr Details, dann kann ich Ihnen konkreter antworten.',
      ], seed)];
    default:
      return [pick([
        'Danke für Ihre Nachricht! Können Sie mir noch kurz sagen, um welches Anliegen es geht — Termin, Symptome oder eine allgemeine Frage?',
        `Alles klar, notiert. Wenn es um ${pet} geht: Beschreiben Sie gern kurz, was los ist, dann helfe ich sofort weiter.`,
        'Verstanden! Wir melden uns gleich ausführlicher. Bei akuten Notfällen bitte zusätzlich immer telefonisch anrufen.',
      ], seed)];
  }
}

/* ---- Haupteinstieg ---- */
export function botConversationReply({ messages = [], userText = '', fromRole = 'clinic', practiceName = '' }) {
  const t = (userText || '').toLowerCase();
  const ctx = buildContext(messages, fromRole);
  const seed = messages.length + t.length;

  // Gegenseite ist Tierhalter (Bot antwortet im Praxis-Posteingang als "Kunde")
  if (fromRole === 'owner') {
    if (/(notfall|dringend|sofort)/.test(t)) return { texts: ['Oh je — wir machen uns sofort auf den Weg! Danke für die schnelle Antwort.'] };
    if (/(termin|uhr|frei|passt)/.test(t)) return { texts: [pick(['Ja, das passt uns super. Vielen Dank!', 'Perfekt, den Termin nehmen wir. Danke!'], seed)] };
    if (/\?\s*$/.test(t)) return { texts: [pick(['Gute Frage — ich schaue kurz nach und melde mich gleich!', 'Moment, das kläre ich schnell und schreibe zurück.'], seed)] };
    return { texts: [pick(['Alles klar, vielen Dank für die Info! 🐾', 'Danke Ihnen — bis später!', 'Super, danke für die schnelle Rückmeldung!'], seed)] };
  }

  // Kurze Antwort auf eine offene Bot-Frage ("Seit wann...?" -> "seit gestern")
  if (ctx.openQuestion && t.length < 40 && !/\?/.test(t) && detectIntent(t) === 'fallback') {
    return {
      texts: [pick([
        `Danke, das hilft mir weiter. Am besten schauen wir uns ${petRef(ctx)} zeitnah an — soll ich Ihnen einen Termin für morgen Vormittag reservieren?`,
        'Alles klar, danke! Damit können wir gut planen. Ich würde einen zeitnahen Kontrolltermin empfehlen — morgen 09:30 oder 14:00 Uhr?',
      ], seed)],
    };
  }

  const intent = detectIntent(t);
  return { texts: answer(intent, { t, ctx, seed, practiceName }) };
}

/* Begrüßung beim ersten Öffnen eines leeren Chats */
export function botGreetingText(fromRole, practiceName) {
  if (fromRole === 'owner') return 'Hallo! 👋 Danke für Ihre Rückmeldung — wie geht es dem Tier denn heute?';
  const P = practiceName || 'unserer Praxis';
  return `Hallo und willkommen bei ${P}! 👋 Wie können wir Ihnen und Ihrem Tier helfen? Bei akuten Notfällen rufen Sie uns bitte zusätzlich direkt an.`;
}

/* Antwort auf ein Bild */
export function botImageReply(fromRole) {
  return fromRole === 'owner'
    ? 'Danke für das Bild! Das sieht schon besser aus.'
    : 'Danke für das Bild — das hilft bei der Einschätzung! Wir sehen es uns gleich genau an. Falls es akut schlimmer wird, bitte sofort anrufen.';
}
