/* VetNow — Auto-Antwort-Bot 2.2 (eingebaut, ohne Server).
   KEIN KI-Modell, sondern regelbasiert: Textmuster (RegExp) erkennen ein
   Anliegen, dazu gibt es vorformulierte Antwort-Varianten. „Verbessern"
   heißt hier also: Regeln und Antworten erweitern — kein Training, kein Build.

   Gegenüber 2.1 neu (Runde 2):
   - 14 weitere Anliegen: Entlaufen/Mikrochip, Silvester & Gewitter, Hitze-
     vorbeugung, Narkose-Angst, OP-Nachsorge, Proben abgeben, Notdienst,
     Überweisung an Spezialist:in, Mehrtier-Haushalt, Welpen/Kitten,
     Gelenke/Arthrose, Gewicht, Ratenzahlung — plus eine eigene Tabelle für
     häufige Irrtümer, die der Bot höflich richtigstellt (MYTHS)
   - tierartspezifische Zusätze jetzt in 12 statt 5 Anliegen
   - Tierhalter-Persona reagiert auf deutlich mehr Praxis-Nachfragen

   Gegenüber 2.0:
   - deutlich mehr Anliegen (Haut/Augen, Verhalten, Trächtigkeit, Senior,
     Nachkontrolle, Versicherung/Kostenvoranschlag, Zweitmeinung, Abschied,
     Krallen-/Fellpflege)
   - Entwarnungen werden erkannt („frisst wieder normal" ist KEIN Symptom mehr)
   - tierartspezifische Zusätze (Katze/Hund/Kleintier/Pferd/Vogel/Reptil)
   - 4–5 Formulierungsvarianten je Anliegen statt 2–3
   - deutlich ausgebaute Tierhalter-Persona (Praxis-Posteingang)
   Reines JS — läuft identisch in Web (React) und Mobile (RN).

   Haupteinstieg: botConversationReply({ messages, userText, fromRole, practiceName })
   -> { texts: string[] }  (1–2 Nachrichten, in Reihenfolge zu senden)

   ACHTUNG: mobile/src/bot.js und web/src/bot.js sind Zeile für Zeile
   identisch. Änderungen immer in BEIDEN Dateien. */

const ANIMAL_WORDS = {
  hund: 'dog', hündin: 'dog', rüde: 'dog', welpe: 'dog', hundi: 'dog',
  katze: 'cat', kater: 'cat', kitten: 'cat', katzenbaby: 'cat', büsi: 'cat',
  kaninchen: 'small', hase: 'small', meerschweinchen: 'small', hamster: 'small', ratte: 'small', maus: 'small',
  frettchen: 'small', chinchilla: 'small', degu: 'small',
  pferd: 'horse', pony: 'horse', stute: 'horse', wallach: 'horse', hengst: 'horse', fohlen: 'horse',
  vogel: 'bird', papagei: 'bird', wellensittich: 'bird', kanarienvogel: 'bird', sittich: 'bird', huhn: 'bird',
  schildkröte: 'exotic', echse: 'exotic', schlange: 'exotic', gecko: 'exotic', bartagame: 'exotic', leguan: 'exotic',
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
  const m2 = t.match(/\b(Hund|Hündin|Kater|Katze|Kaninchen|Pferd|Welpe|Pony|Meerschweinchen|Papagei)\s+([A-ZÄÖÜ][a-zäöüß]{2,})/u);
  if (m2 && !['Seit', 'Und', 'Aber', 'Danke', 'Heute', 'Gestern', 'Morgen'].includes(m2[2])) {
    return { name: m2[2], kind: ANIMAL_WORDS[m2[1].toLowerCase()] || null };
  }
  return null;
}

/* Tierart auch ohne Namen erkennen ("meine Katze frisst nicht") */
function extractKind(text) {
  const t = text.toLowerCase();
  for (const w of Object.keys(ANIMAL_WORDS)) {
    if (new RegExp('\\b' + w).test(t)) return ANIMAL_WORDS[w];
  }
  return null;
}

/* Kontext aus dem bisherigen Verlauf rekonstruieren (stateless — aus messages) */
function buildContext(messages, fromRole) {
  const ctx = { pet: null, kind: null, offeredSlot: null, openQuestion: null, botMsgCount: 0 };
  const lastIdx = messages.length - 1;
  messages.forEach((m, i) => {
    if (m.deleted || m.type === 'note' || m.type === 'image' || m.type === 'file') return;
    const txt = m.text || '';
    if (m.from !== fromRole) {
      const pet = extractPet(txt);
      if (pet) { ctx.pet = pet; if (pet.kind) ctx.kind = pet.kind; }
      const k = extractKind(txt);
      if (k) ctx.kind = k;
      // Eine beantwortete Frage ist erledigt — die GERADE eingegangene
      // Nachricht (lastIdx) ist aber genau die Antwort, auf die wir reagieren.
      if (i !== lastIdx) ctx.openQuestion = null;
    } else {
      ctx.botMsgCount++;
      const slot = txt.match(/(morgen|heute|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag)[^.?!]*?(\d{1,2}[:.]\d{2})/i);
      if (slot) ctx.offeredSlot = slot[1] + ' um ' + slot[2].replace('.', ':');
      // Nur setzen, nie löschen: eine mehrteilige Antwort endet oft mit einem
      // Hinweissatz ohne Fragezeichen — die Frage davor gilt trotzdem noch.
      if (/\?\s*$/.test(txt)) ctx.openQuestion = txt;
    }
  });
  return ctx;
}

/* Deterministische "Zufalls"-Variante: gleiche Konversation -> stabil, aber
   unterschiedliche Länge -> andere Variante. Nie rein zufällig (Tests!). */
function pick(variants, seed) {
  return variants[Math.abs(seed) % variants.length];
}

/* Zwei Varianten, weil der Platzhalter sonst grammatikalisch falsch landet:
   „Wie viel wiegt Ihr Tier?" (Nominativ/Akkusativ) vs. „bei Ihrem Tier"
   (Dativ). Ist der Tiername bekannt, sind beide identisch. */
function petRef(ctx, fallback) {
  if (ctx.pet && ctx.pet.name) return ctx.pet.name;
  return fallback || 'Ihr Tier';
}
function petDat(ctx) {
  if (ctx.pet && ctx.pet.name) return ctx.pet.name;
  return 'Ihrem Tier';
}

/* ---- Intent-Definitionen (Reihenfolge = Priorität) ---- */
const GIFTE = /(schokolade|zwiebel|knoblauch|weintraube|rosine|xylit|birkenzucker|avocado|rattengift|schneckenkorn|ibuprofen|paracetamol|teebauml|teebaumöl|lilie|frostschutz|macadamia|nikotin|zigarette)/;

/* Entwarnung: „geht wieder", „frisst wieder normal", „keine Beschwerden mehr".
   Ohne diesen Check würde „frisst wieder normal" als Symptom gelesen — genau
   die Art Fehlantwort, die bei einer Vorführung peinlich wird. */
const ENTWARNUNG = /(wieder (gut|normal|besser|fit|munter|top)|geht (es |ihm |ihr )?(wieder )?(gut|besser)|(viel |schon |deutlich )?besser geworden|nicht mehr so schlimm|keine (beschwerden|schmerzen|probleme|symptome) mehr|hat aufgehört|frisst wieder|trinkt wieder|läuft wieder|alles (wieder )?(gut|in ordnung|ok|okay|paletti)|erholt sich|hat sich erholt|beschwerdefrei|ist geheilt|abgeklungen|verschwunden)/;

/* ---- Häufige Irrtümer freundlich richtigstellen ----
   Fachlich das stärkste Argument vor einer Jury: Der Bot widerspricht höflich
   und begründet, statt einfach mitzugehen. Jeder Eintrag liefert die
   Richtigstellung gleich mit. */
const MYTHS = [
  {
    re: /(wohnungskatze|reine wohnungs|nur in der wohnung|wohnungs.?katze)[^.?!]*(keine impf|nicht impf|braucht.*impf)|(keine impf|nicht impf)[^.?!]*wohnung/,
    texts: [
      'Das ist ein weit verbreiteter Irrtum — auch reine Wohnungskatzen sollten geimpft sein.',
      'Katzenschnupfen- und Seuche-Erreger tragen wir selbst an Schuhen und Kleidung herein. Der Impfschutz ist bei Wohnungskatzen nur etwas schlanker als bei Freigängern, ganz weglassen sollte man ihn nicht.',
    ],
  },
  {
    re: /(katze|kater|kätzchen|kitten)[^.?!]*milch|milch[^.?!]*(katze|kater|kitten)/,
    texts: [
      'Kuhmilch ist für die meisten erwachsenen Katzen leider nicht geeignet — sie können den Milchzucker nicht abbauen, das führt oft zu Durchfall.',
      'Frisches Wasser ist immer die beste Wahl. Wenn Sie etwas Besonderes geben möchten, gibt es spezielle Katzenmilch ohne Laktose — aber wirklich nur als seltene Leckerei.',
    ],
  },
  {
    re: /knochen[^.?!]*(füttern|geben|fressen|gut)|(füttern|geben)[^.?!]*knochen/,
    texts: [
      'Bei Knochen bin ich vorsichtig: Gekochte oder gebratene Knochen splittern und können den Darm ernsthaft verletzen — die bitte nie füttern.',
      'Rohe, fleischige Knochen sind für manche Hunde in Ordnung, aber nicht für jeden. Sagen Sie mir kurz Alter und Gebisszustand, dann sage ich Ihnen, ob es in Ihrem Fall passt.',
    ],
  },
  {
    re: /(warme|trockene) nase|nase.*(warm|trocken).*(krank|fieber)/,
    texts: [
      'Die warme oder trockene Nase ist tatsächlich kein verlässliches Krankheitszeichen — sie schwankt über den Tag völlig normal.',
      'Aussagekräftiger sind Fressverhalten, Trinkmenge, Aktivität und Atmung. Wenn davon etwas auffällig ist, schauen wir gern nach.',
    ],
  },
  {
    re: /(schwarz.?weiß|farbenblind|sehen keine farben)/,
    texts: [
      'Kleiner Irrtum, den viele kennen: Hunde und Katzen sehen nicht schwarz-weiß, sondern eingeschränkt farbig — Blau und Gelb erkennen sie gut, Rot dagegen kaum.',
      'Dafür sehen sie bei Dämmerung deutlich besser als wir und nehmen Bewegungen viel schneller wahr.',
    ],
  },
  {
    re: /gras (fressen|frisst|gefressen)/,
    texts: [
      'Grasfressen allein ist meist harmlos und kein sicheres Zeichen für Übelkeit — viele Tiere machen das einfach gern.',
      'Auffällig wird es erst, wenn Ihr Tier danach regelmäßig erbricht oder sehr gierig große Mengen frisst. Kommt das öfter vor, schauen wir es uns an.',
    ],
  },
  {
    re: /(einmal|ein mal)[^.?!]*(wurf|werfen|welpen|jungen|nachwuchs)[^.?!]*(ges[uü]nd|gut|besser)|sollte.*einmal.*(werfen|welpen)/,
    texts: [
      'Das hört man oft, es stimmt aber nicht: Ein Wurf „für die Gesundheit" bringt medizinisch keinen Vorteil.',
      'Im Gegenteil — eine frühzeitige Kastration senkt bei Hündinnen das Risiko für Gesäugetumore deutlich. Gern besprechen wir, was für Ihr Tier sinnvoll ist.',
    ],
  },
  {
    re: /(bisschen|etwas|wenig|klein wenig)[^.?!]*(schokolade|zwiebel|traube)[^.?!]*(schadet|macht nichts|geht schon|ok)/,
    texts: [
      'Da muss ich widersprechen: Auch kleine Mengen können je nach Körpergewicht schon Beschwerden auslösen — bei Schokolade zählt der Kakaoanteil, dunkle Sorten sind besonders gefährlich.',
      'Wenn tatsächlich etwas gefressen wurde, rufen Sie uns bitte an und nennen Sie Menge, Sorte und Zeitpunkt. Abwarten ist hier die schlechteste Option.',
    ],
  },
  {
    re: /kastr[^.?!]*(dick|fett|übergewicht)|(dick|fett)[^.?!]*kastr/,
    texts: [
      'Halb richtig: Nach der Kastration sinkt der Energiebedarf um etwa 20-30 %, dick wird davon aber niemand automatisch.',
      'Wenn man die Futtermenge nach dem Eingriff anpasst und regelmäßig wiegt, bleibt das Gewicht stabil. Wir helfen Ihnen gern mit einem konkreten Plan.',
    ],
  },
  {
    re: /(zecken?|flöhe?|floh)[^.?!]*(nur im sommer|nur sommer|nur bei wärme|im winter (keine|nicht))/,
    texts: [
      'Das galt früher einmal — inzwischen sind Zecken schon ab etwa 7 Grad aktiv, also auch an milden Wintertagen.',
      'Deshalb empfehlen wir den Schutz mittlerweile fast ganzjährig. Wie es bei Ihrem Tier konkret aussieht, besprechen wir gern.',
    ],
  },
  {
    re: /(katzen?)[^.?!]*(landen immer auf|fallen nie|können nicht fallen)|katzen.*neun leben/,
    texts: [
      'Leider ein gefährlicher Mythos: Katzen drehen sich im Fall zwar geschickt, verletzen sich bei Stürzen aus dem Fenster aber trotzdem schwer.',
      'Wir sehen das jedes Frühjahr, wenn die Fenster wieder aufgehen. Kippfenster sind besonders riskant — Schutznetze verhindern das zuverlässig.',
    ],
  },
];

function detectMyth(t) {
  // Bei akuten Beschwerden hat die Symptom-Antwort Vorrang vor der Aufklärung.
  if (/(erbricht|erbrochen|blut|notfall|dringend|kollabiert|atemnot)/.test(t)) return null;
  return MYTHS.find((m) => m.re.test(t)) || null;
}

function detectIntent(t) {
  if (GIFTE.test(t) && /(gefressen|erwischt|genascht|gegessen|geschluckt|aufgenommen|geleckt|erbrochen)/.test(t)) return 'poison';
  if (/(notfall|dringend|sofort|lebensgefahr|kollabiert|bewusstlos|krampf|atemnot|röchelt|stark blutet|blutet stark|aufgebläht|magendrehung|hitzschlag|überfahren|unfall|vergift)/.test(t)) return 'emergency';
  if (/(einschläfer|einschlafen lassen|erlösen|abschied|euthanas|letzter weg|sterben lassen)/.test(t)) return 'euthanasia';
  if (ENTWARNUNG.test(t) && !/(aber|trotzdem|leider|dennoch)/.test(t)) return 'recovery';
  if (detectMyth(t)) return 'myth';
  if (/(entlaufen|weggelaufen|ausgebüxt|vermisst|nicht nach hause|verschwunden seit|chip auslesen|chipnummer|registrier)/.test(t)) return 'microchip';
  if (/(silvester|feuerwerk|böller|rakete|knallerei|gewitter|angst vor (lärm|geräusch|knall))/.test(t)) return 'fireworks';
  if (/(hitzewelle|sonnenstich|im auto (lassen|gelassen)|bei (der )?hitze|hitze.*(spaziergang|gassi|tier)|(spaziergang|gassi).*hitze|zu warm für|abkühl)/.test(t)) return 'heat';
  if (/(narkose|vollnarkose|betäubung|narkoserisiko|aufwachen nach)/.test(t)) return 'anesthesia';
  if (/(nach der op|nach dem eingriff|halskrause|trichter|leckschutz|\bbody\b|naht|nähte|op.?wunde|wundheilung)/.test(t)) return 'postop';
  if (/(kotprobe|stuhlprobe|urinprobe|harnprobe|probe (abgeben|mitbringen|sammeln)|sammelkot)/.test(t)) return 'samples';
  if (/(notdienst|bereitschaftsdienst|außerhalb der (zeiten|öffnungszeiten)|(nachts|in der nacht|am sonntag|am wochenende|feiertag)[^.?!]*(erreichbar|offen|geöffnet|hilfe|anrufen|kommen|dienst|wer))/.test(t)) return 'emergencyservice';
  if (/(spezialist|überweisung|facharzt|fachtierarzt|tierklinik|\bmrt\b|computertomograf|kardiolog|onkolog|neurolog)/.test(t)) return 'referral';
  if (/(neues tier|zweite katze|zweiter hund|noch (eine katze|einen hund)|eingewöhn|vergesellschaft|aus dem tierheim|dazu geholt|zusammenführ)/.test(t)) return 'newpet';
  if (/((welpe|welpen|kitten|junghund|jungtier)[^.?!]*(impf|entwurm|braucht|checkliste|beratung|erste|neu|geholt|bekommen)|erstimpfung|wann.*erste impfung)/.test(t)) return 'puppy';
  if (/(arthrose|gelenk|steif|springt nicht mehr|treppen[^.?!]*(schwer|nicht|mühe)|aufstehen (fällt|schwer)|hüfte|lahmt seit)/.test(t)) return 'joints';
  if (/(abnehmen|zu dick|zu fett|übergewicht|diätfutter|zunehmen|untergewicht|zu dünn|zu mager)/.test(t)) return 'weight';
  if (/(in raten|ratenzahlung|nicht auf einmal (zahlen|bezahlen)|bar oder karte|zahlungsmöglichkeit|anzahlung)/.test(t)) return 'payment';
  if (/(auge|augen|bindehaut|tränt|trübe pupille|lidkrampf|augenausfluss)/.test(t)) return 'eyes';
  if (/(haut|fell|juckreiz|kratzt sich|schuppen|kahle stelle|hot ?spot|allergie|ekzem|pilz|milben)/.test(t)) return 'skin';
  if (/(erbricht|erbrochen|übergeben|durchfall|frisst nicht|frisst nichts|apathisch|humpelt|lahmt|niest|husten|hustet|zittert|fieber|schwellung|geschwollen|ohrenentzündung|verletzt|wunde|zecke|abgenommen|trinkt viel)/.test(t)) return 'symptom';
  if (/(beißt|aggressiv|unsauber|pinkelt in|markiert|bellt ständig|angst vor|panik|stubenrein|verhalten(sproblem|s?therap)|trennungsangst|silvester)/.test(t)) return 'behaviour';
  if (/(trächtig|schwanger|deckakt|wurf|geburt|welpen bekommen|kitten bekommen|läufig|rollig)/.test(t)) return 'pregnancy';
  if (/(alt(er)? (hund|katze|tier)|senior|vorsorge|gesundheitscheck|check.?up|blutbild|jahresuntersuchung|geriatr)/.test(t)) return 'senior';
  if (/(nachkontrolle|kontrolltermin|fäden ziehen|faden ziehen|nachsorge|wie geht es weiter|nachuntersuchung|verband wechseln)/.test(t)) return 'recheck';
  if (/(versicherung|kostenvoranschlag|kosten.?übernahme|ratenzahlung|selbstbehalt|rechnung.*(einreichen|schicken))/.test(t)) return 'insurance';
  if (/(zweitmeinung|zweite meinung|andere praxis|nochmal ansehen|second opinion)/.test(t)) return 'secondopinion';
  if (/(termin.*(verschieben|absagen|stornieren)|(verschieben|absagen).*termin|kann nicht kommen)/.test(t)) return 'reschedule';
  if (/(passt|geht klar|nehmen wir|ja gerne|ja,? das passt|einverstanden|perfekt|super,? dann)/.test(t)) return 'confirm';
  if (/(termin|uhrzeit|wann.*(frei|zeit|möglich)|vorbeikommen|vorbei kommen|diese woche|nächste woche|hätten sie.*zeit|einen slot)/.test(t)) return 'appointment';
  if (/(öffnungszeit|geöffnet|offen.*(heute|morgen|samstag|sonntag)|wann.*(auf|zu)|feiertag)/.test(t)) return 'hours';
  if (/(kosten|preis|was kostet|wie teuer|gebühr|honorar|bezahlen)/.test(t)) return 'price';
  if (/(impf|tollwut|booster|auffrischung)/.test(t)) return 'vaccination';
  if (/(kastr|sterilis)/.test(t)) return 'castration';
  if (/(zahn|zähne|zahnstein|maulgeruch|mundgeruch)/.test(t)) return 'dental';
  if (/(wurmkur|entwurm|floh|flöhe|zecken(schutz|mittel)|parasit|spot.?on)/.test(t)) return 'parasites';
  if (/(kralle|krallen|schneiden|fellpflege|scheren|baden|trimmen|bürsten)/.test(t)) return 'grooming';
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

/* ---- Tierartspezifische Zusätze ----
   Die Tierart wurde bisher zwar erkannt, aber kaum genutzt. Katze, Hund,
   Kleintier, Pferd, Vogel und Reptil unterscheiden sich medizinisch deutlich —
   ein passender Zusatz wirkt sofort kompetenter. */
const SPECIES_HINT = {
  symptom: {
    cat: 'Bei Katzen ist wichtig: Wie oft war sie zuletzt am Katzenklo, und trinkt sie normal?',
    dog: 'Bitte achten Sie zusätzlich auf Trinkmenge, Kotabsatz und darauf, ob der Bauch hart wirkt — das hilft uns bei der Einschätzung.',
    small: 'Bei Kleintieren zählt jede Stunde: Fressen sie länger als 12 Stunden nichts, ist das immer ein Fall für uns.',
    horse: 'Bitte prüfen Sie zusätzlich Kotabsatz und Darmgeräusche — bei Kolikverdacht bitte sofort anrufen.',
    bird: 'Vögel verbergen Krankheit sehr lange. Aufgeplustertes Sitzen und Schläfrigkeit sind bereits Warnzeichen.',
    exotic: 'Bitte nennen Sie uns auch Temperatur und Beleuchtung im Terrarium — das ist häufig die Ursache.',
  },
  nutrition: {
    cat: 'Bei Katzen achten wir besonders auf ausreichend Nassfutter — das entlastet die Nieren.',
    dog: 'Bei Hunden schauen wir vor allem auf die Menge und auf Leckerlis zwischendurch.',
    small: 'Bei Kleintieren ist Heu die Grundlage — mindestens so viel wie das Tier selbst groß ist, jeden Tag.',
    horse: 'Bei Pferden schauen wir uns Raufutter-Menge und Fresspausen genau an.',
    bird: 'Reine Körnermischungen führen oft zu Mangel — wir besprechen gern eine passende Ergänzung.',
    exotic: 'Bei Reptilien hängt fast alles an Beleuchtung, UV und Kalzium — das gehen wir gemeinsam durch.',
  },
  dental: {
    cat: 'Bei Katzen sehen wir außerdem oft schmerzhafte Zahnhalsläsionen — die erkennt man nur im Röntgen.',
    dog: 'Bei Hunden kontrollieren wir zusätzlich die Backenzähne, dort sitzt der Zahnstein meist am stärksten.',
    small: 'Bei Kaninchen und Meerschweinchen wachsen die Zähne lebenslang — Backenzahnspitzen sind eine häufige Ursache fürs Nichtfressen.',
    horse: 'Beim Pferd steht die jährliche Zahnkontrolle mit Maulgatter an — Haken an den Backenzähnen sind häufig.',
  },
  parasites: {
    cat: 'Bei Freigänger-Katzen empfehlen wir Entwurmung etwa 4× im Jahr, bei reinen Wohnungskatzen deutlich seltener.',
    dog: 'Für Hunde gibt es je nach Gewicht Tabletten oder Spot-ons — Zeckenschutz wirkt meist 4 Wochen bzw. 12 Wochen.',
    small: 'Bei Kleintieren nehmen wir bewusst nur speziell zugelassene Mittel — Hunde- oder Katzenpräparate können giftig sein.',
    horse: 'Beim Pferd arbeiten wir gern mit Kotproben statt starrer Intervalle — das schont und wirkt gezielter.',
  },
  vaccination: {
    cat: 'Für Katzen sind Katzenschnupfen und Katzenseuche Standard, für Freigänger zusätzlich Leukose.',
    dog: 'Für Hunde sind Staupe, Hepatitis, Parvovirose und Leptospirose Standard, dazu Tollwut fürs Reisen.',
    small: 'Bei Kaninchen impfen wir gegen Myxomatose und RHD — gerade im Sommer wichtig.',
    horse: 'Beim Pferd stehen Tetanus und Influenza im Vordergrund, für Turniere gelten eigene Fristen.',
    bird: 'Bei Ziervögeln impfen wir nur in besonderen Fällen — sagen Sie mir kurz, um welche Art es geht.',
  },
  skin: {
    cat: 'Bei Katzen steckt hinter Juckreiz sehr oft eine Flohspeichel-Allergie — auch wenn Sie selbst keinen einzigen Floh sehen.',
    dog: 'Bei Hunden sind Ohren und Pfoten die typischen Problemstellen — schauen Sie dort bitte auch nach Rötung.',
    small: 'Bei Kleintieren denken wir zuerst an Milben und an zu feuchte oder staubige Einstreu.',
    horse: 'Beim Pferd prüfen wir zusätzlich Mauke an den Fesseln und Sommerekzem an Mähne und Schweifansatz.',
    bird: 'Bei Vögeln ist Federrupfen oft auch ein Stress- oder Haltungsthema — dazu würde ich Ihnen ein paar Fragen stellen.',
    exotic: 'Bei Reptilien hängen Hautprobleme fast immer an Luftfeuchte und Häutungsbedingungen im Terrarium.',
  },
  eyes: {
    cat: 'Bei Katzen steckt hinter tränenden Augen häufig ein Katzenschnupfen-Infekt — der gehört behandelt, nicht abgewartet.',
    dog: 'Bei kurznasigen Rassen (Mops, Bulldogge) sind die Augen besonders empfindlich — da schauen wir immer zeitnah.',
    small: 'Bei Kaninchen und Meerschweinchen hängen Augenprobleme oft mit den Zähnen zusammen — das prüfen wir gleich mit.',
    horse: 'Beim Pferd ist ein zugekniffenes, tränendes Auge immer ein dringender Fall — bitte gleich anrufen.',
  },
  senior: {
    cat: 'Bei älteren Katzen schauen wir besonders auf Nieren und Schilddrüse — beides ist früh gut behandelbar.',
    dog: 'Bei älteren Hunden stehen Gelenke, Herz und Zahngesundheit im Vordergrund.',
    small: 'Bei Kleintieren achten wir vor allem auf Zähne und Gewicht — beides verändert sich im Alter schnell.',
    horse: 'Beim Senior-Pferd sind Zähne, Gewicht und das Thema Cushing die wichtigsten Punkte.',
  },
  behaviour: {
    cat: 'Unsauberkeit bei Katzen ist fast immer ein Hilferuf — Blasenentzündung, Stress oder ein Problem mit dem Katzenklo. Bitte nie schimpfen.',
    dog: 'Bei Hunden schauen wir zuerst, ob Schmerzen dahinterstecken, und dann auf Auslastung und klare Regeln im Alltag.',
    small: 'Bei Kleintieren steckt hinter „aggressivem" Verhalten meist Angst oder Schmerz — das klären wir zuerst medizinisch.',
    horse: 'Beim Pferd prüfen wir zuerst Sattel, Zähne und Rücken, bevor wir über Training sprechen.',
  },
  weight: {
    cat: 'Bei Katzen gehen wir behutsam vor: Zu schnelles Abnehmen kann die Leber ernsthaft schädigen, deshalb immer mit Plan und Kontrolle.',
    dog: 'Bei Hunden bringt schon das genaue Abwiegen der Tagesration statt Schätzen erstaunlich viel.',
    small: 'Bei Kleintieren regelt sich das Gewicht meist über die Heumenge — Trockenfutter ist häufig der eigentliche Dickmacher.',
    horse: 'Beim Pferd arbeiten wir mit Maßband und Body-Condition-Score statt mit dem Blick allein.',
  },
  grooming: {
    cat: 'Bei Katzen bitte nie scheren, ohne dass wir vorher draufgeschaut haben — plötzliche Fellpflege-Verweigerung ist oft ein Schmerzzeichen.',
    dog: 'Bei Hunden mit dichter Unterwolle hilft regelmäßiges Ausbürsten mehr als jedes Bad.',
    small: 'Bei Langhaar-Kleintieren bitte täglich bürsten — verfilztes Fell zieht auf der Haut und wird schnell schmerzhaft.',
    horse: 'Beim Pferd bitte nicht zu viel scheren, wenn es viel draußen steht — sonst fehlt der Kälteschutz.',
  },
  joints: {
    cat: 'Katzen zeigen Arthrose kaum durch Humpeln — eher dadurch, dass sie nicht mehr auf ihre Lieblingsplätze springen.',
    dog: 'Bei Hunden helfen kontrollierte, kurze Runden oft mehr als ein langer Spaziergang am Wochenende.',
    small: 'Bei Kleintieren achten wir auf rutschfesten Untergrund und leicht erreichbare Futterstellen.',
    horse: 'Beim Pferd gehören Hufbearbeitung und gleichmäßige Bewegung zur Behandlung dazu.',
  },
  heat: {
    cat: 'Katzen suchen sich Schatten meist selbst — wichtig sind mehrere Wasserstellen und ein kühler Rückzugsort.',
    dog: 'Bei Hunden bitte Asphalt mit dem Handrücken testen: Ist er für Sie zu heiß, ist er für die Pfoten viel zu heiß.',
    small: 'Kleintiere vertragen Hitze sehr schlecht — Ställe niemals in die pralle Sonne, ab etwa 28 Grad wird es kritisch.',
    horse: 'Beim Pferd bitte Arbeit in die kühlen Tagesrandzeiten legen und nach dem Schwitzen Elektrolyte anbieten.',
    bird: 'Vögel bitte nie in die direkte Sonne stellen — im Käfig gibt es keinen Ausweichplatz.',
  },
};

function speciesHint(intent, kind) {
  const m = SPECIES_HINT[intent];
  return (m && kind && m[kind]) || '';
}

/* ---- Antworten je Intent (mit Varianten und Kontext) ---- */
function answer(intent, { t, ctx, seed, practiceName }) {
  const pet = petRef(ctx);
  const petD = petDat(ctx);
  const P = practiceName || 'unsere Praxis';
  const hint = speciesHint(intent, ctx.kind);
  switch (intent) {
    case 'poison':
      return [
        'Das kann giftig sein — bitte NICHT selbst Erbrechen auslösen, nichts füttern und nichts eingeben!',
        `Kommen Sie bitte sofort zu uns oder rufen Sie an. Wichtig: Wenn möglich, Verpackung/Reste mitbringen und uns sagen, wie viel ${pet} ungefähr erwischt hat und wann.`,
      ];
    case 'emergency':
      return [
        pick([
          'Das klingt nach einem Notfall — bitte kommen Sie SOFORT vorbei, wir bereiten alles vor.',
          'Das ist dringend! Bitte sofort losfahren oder direkt anrufen — wir machen den Behandlungsraum frei.',
          'Bitte warten Sie damit nicht ab: Rufen Sie uns jetzt an und fahren Sie los, wir nehmen Sie sofort dran.',
          'Das gehört umgehend angesehen. Bitte gleich telefonisch melden, damit wir vorbereitet sind, wenn Sie ankommen.',
        ], seed),
        `Für die Vorbereitung: Seit wann bestehen die Symptome, und ist ${pet} ansprechbar? Bitte während der Fahrt warm halten und Ruhe bewahren.`,
      ];
    case 'euthanasia':
      return [
        pick([
          `Das ist eine sehr schwere Entscheidung — es tut mir leid, dass Sie gerade davorstehen. Sie müssen das nicht allein entscheiden.`,
          `Danke, dass Sie das ansprechen. Solche Gedanken kommen aus Fürsorge, nicht aus Aufgeben — wir begleiten Sie dabei.`,
          `Es tut mir leid. Für ${pet} das Richtige zu finden, besprechen wir gern in Ruhe und ohne Zeitdruck mit Ihnen.`,
          `Dafür nehmen wir uns Zeit. Wichtig ist, wie es ${pet} an den guten und an den schlechten Tagen geht — daran orientieren wir uns gemeinsam.`,
          'Sie machen sich Gedanken, weil Sie Verantwortung übernehmen. Wir schauen uns das in Ruhe an und entscheiden nichts über Ihren Kopf hinweg.',
        ], seed),
        'Wir nehmen uns dafür einen eigenen, ruhigen Termin — auf Wunsch auch als Hausbesuch. Wenn Sie mögen, schildern Sie mir kurz, wie es ihm/ihr aktuell geht.',
      ];
    case 'recovery':
      return [pick([
        `Das freut mich sehr zu hören — danke für die Rückmeldung! Wenn es ${pet} wieder gut geht, ist kein Termin nötig.`,
        `Schön, dass es besser läuft! Beobachten Sie ${pet} noch ein bis zwei Tage; sollte es wieder kippen, melden Sie sich einfach.`,
        'Sehr gut! Dann belassen wir es dabei. Bei einem Rückfall bitte kurz melden, dann schauen wir uns das an.',
        `Das klingt gut. Falls Sie mögen, machen wir in ein paar Tagen trotzdem eine kurze Kontrolle für ${pet} — ganz wie Sie möchten.`,
      ], seed)];
    case 'myth': {
      const m = detectMyth(t);
      return m ? m.texts.slice() : ['Da bin ich anderer Meinung — sagen Sie mir kurz mehr dazu, dann erkläre ich es Ihnen genauer.'];
    }
    case 'microchip':
      return [
        pick([
          `Das tut mir leid — bitte melden Sie ${pet} sofort als vermisst, dann kann die Chipnummer sofort zugeordnet werden.`,
          'Erste Schritte: Nachbarschaft absuchen, Fundtier-Meldung bei Polizei und Tierheim, und die Chipnummer in der Haustierdatenbank auf „vermisst" setzen.',
          'Sehr wichtig ist, dass der Chip auch registriert ist — der Chip allein hilft nicht, erst der Datenbank-Eintrag verbindet ihn mit Ihnen.',
          'Bitte auch bei den umliegenden Tierarztpraxen und im Tierheim anrufen — gefundene Tiere werden meist zuerst dorthin gebracht.',
        ], seed),
        'Wenn Sie mir die Chipnummer schicken, prüfen wir gern, ob die Registrierung aktuell ist. Gefundene Tiere lesen wir jederzeit kostenlos aus.',
      ];
    case 'fireworks':
      return [
        pick([
          'Angst vor Feuerwerk und Gewitter ist sehr häufig — und gut in den Griff zu bekommen, wenn man rechtzeitig anfängt.',
          `Das kennen wir gut. Wichtig ist, dass ${pet} einen sicheren Rückzugsort hat und Sie selbst betont ruhig bleiben.`,
          'Da können wir einiges tun. Am besten beginnen wir einige Wochen vorher, nicht erst am Tag selbst.',
          'Sehr gern. Wichtig vorweg: Bitte niemals beruhigende Mittel aus der Humanmedizin geben — manche davon lähmen nur die Bewegung, die Angst bleibt.',
        ], seed),
        'Konkret: Rückzugshöhle vorbereiten, Fenster und Rollläden schließen, Radio oder Fernseher leise laufen lassen, an Silvester früh und angeleint Gassi gehen. Wenn das nicht reicht, besprechen wir bei einem Termin ruhig weitere Möglichkeiten — bitte nichts aus der Hausapotheke geben.',
      ];
    case 'heat':
      return [
        pick([
          'Hitze wird bei Tieren oft unterschätzt — ein Hitzschlag entsteht schneller, als die meisten denken.',
          'Gut, dass Sie fragen. Die wichtigste Regel: Bei Hitze niemals im geparkten Auto lassen, auch nicht „nur kurz" und auch nicht im Schatten.',
          `Bei warmem Wetter gilt für ${pet}: Bewegung in die kühlen Morgen- und Abendstunden legen, immer Schatten und Wasser anbieten.`,
          'Danke fürs Nachfragen — bei Hitze sehen wir jedes Jahr vermeidbare Notfälle. Ein paar einfache Regeln reichen aber schon aus.',
        ], seed),
        hint || 'Warnzeichen sind starkes Hecheln, Taumeln, dunkelrote Zunge und Erbrechen. Dann bitte langsam abkühlen (Beine und Bauch, nicht eiskalt) und uns SOFORT anrufen.',
      ];
    case 'anesthesia':
      return [
        pick([
          'Die Sorge verstehe ich gut — die stellen fast alle. Modern durchgeführt ist eine Narkose heute ein sehr kontrollierter Vorgang.',
          'Danke, dass Sie fragen. Wir klären vorher ab, ob etwas gegen die Narkose spricht, und überwachen währenddessen durchgehend.',
          `Berechtigte Frage. Vor jeder Narkose untersuchen wir ${pet} gründlich und besprechen mit Ihnen das individuelle Risiko.`,
          'Ehrliche Antwort: Ein Restrisiko gibt es immer, es ist aber sehr klein — und wir wägen es immer gegen den Nutzen des Eingriffs ab.',
        ], seed),
        'Bei älteren Tieren oder Vorerkrankungen empfehlen wir vorher ein Blutbild. Am OP-Tag bitte nüchtern kommen — Wasser darf bleiben. Nach dem Aufwachen bleibt Ihr Tier bei uns unter Beobachtung, bis alles stabil ist.',
      ];
    case 'postop':
      return [
        pick([
          `Nach einem Eingriff ist Ruhe das Wichtigste — bitte kein Toben, kein Springen und kein Baden, bis wir die Wunde freigeben.`,
          `Für ${pet} gilt jetzt: Wunde täglich anschauen, sauber und trocken halten, und den Leckschutz konsequent drauflassen.`,
          'Gute Frage. Die Wunde sollte trocken und geschlossen sein, leichte Schwellung in den ersten Tagen ist normal.',
          'Alles klar. Die Fäden ziehen wir in der Regel nach 10 bis 14 Tagen — bis dahin bitte nicht baden und nicht toben lassen.',
        ], seed),
        'Bitte melden Sie sich sofort, wenn die Wunde nässt, stark gerötet ist, riecht oder aufgeht — und wenn Ihr Tier apathisch wird oder nicht frisst. Halskrause oder Body bitte wirklich durchgehend, ein paar Minuten Lecken reichen aus, um die Naht zu öffnen.',
      ];
    case 'samples':
      return [
        pick([
          'Sehr gern — Proben untersuchen wir zeitnah, oft schon am selben Tag.',
          'Machen wir. Für ein aussagekräftiges Ergebnis kommt es allerdings auf die richtige Entnahme an.',
          'Das können Sie einfach vorbeibringen, dafür brauchen Sie keinen Termin.',
          'Gern. Sagen Sie uns bitte kurz dazu, worauf wir schauen sollen — dann setzen wir gleich die richtige Untersuchung an.',
        ], seed),
        'Kotprobe: am besten eine Sammelprobe von drei aufeinanderfolgenden Tagen, kühl gelagert. Urin: möglichst Morgenurin, sauberes Gefäß, innerhalb von zwei Stunden bei uns. Bitte beschriften Sie das Gefäß mit Namen und Datum.',
      ];
    case 'emergencyservice':
      return [
        pick([
          'Außerhalb unserer Öffnungszeiten gibt es in Kärnten einen tierärztlichen Notdienst — die aktuelle Bereitschaft erfahren Sie über unsere Ansage am Telefon.',
          'Nachts, an Wochenenden und Feiertagen übernimmt der Notdienst. Bitte immer vorher anrufen, damit dort jemand vorbereitet ist.',
          'Für akute Fälle außerhalb der Zeiten gilt: erst anrufen, dann losfahren — dann weiß die Bereitschaft, dass Sie kommen.',
          'Speichern Sie sich unsere Nummer am besten gleich ein — im Ernstfall sucht man ungern.',
        ], seed),
        'Wenn es um Leben geht (Atemnot, starke Blutung, Krämpfe, Vergiftung, aufgeblähter harter Bauch), fahren Sie bitte sofort los und rufen unterwegs an.',
      ];
    case 'referral':
      return [
        pick([
          'Sehr gern — wenn ein Fall Spezialdiagnostik braucht, überweisen wir offen und ohne Umwege weiter.',
          'Das ist ganz normal und kein Zeichen dafür, dass etwas schiefgelaufen ist. Manche Untersuchungen wie MRT oder CT gibt es nur an der Klinik.',
          'Machen wir gerne. Wir stellen die Überweisung aus und geben alle bisherigen Befunde mit, damit dort nichts doppelt gemacht wird.',
          'Wir bleiben dabei Ihre Ansprechpartner: Die Nachsorge übernehmen wir anschließend wieder hier vor Ort.',
        ], seed),
        `Sagen Sie mir kurz, worum es bei ${petD} geht, dann sage ich Ihnen, welche Fachrichtung passt und wo die Wartezeit gerade am kürzesten ist.`,
      ];
    case 'newpet':
      return [
        pick([
          'Schön! Damit das gut startet, planen wir am besten zwei Dinge: einen Gesundheitscheck für den Neuzugang und eine ruhige Eingewöhnung.',
          'Herzlichen Glückwunsch! Vor dem ersten direkten Kontakt sollte der Neuzugang einmal bei uns gewesen sein — wegen Parasiten und Infektionen.',
          'Das freut mich. Wichtig ist, dass beide Tiere anfangs getrennte Bereiche mit eigener Toilette, eigenem Napf und eigenem Rückzugsort haben.',
          'Bei Katzen gilt die Faustregel: eine Katzentoilette pro Tier plus eine zusätzliche — das verhindert die meisten Konflikte.',
        ], seed),
        'Zusammenführen bitte langsam über Tage: erst Geruch tauschen, dann Sichtkontakt, dann kurze gemeinsame Zeit unter Aufsicht. Zu schnell ist der häufigste Fehler — und der ärgerlichste, weil er sich schwer korrigieren lässt.',
      ];
    case 'puppy':
      return [
        pick([
          `Schön, dass es ${pet} gibt! Der erste Termin sollte in den ersten Tagen nach dem Einzug stattfinden — Durchcheck, Impfplan und Entwurmung.`,
          'Für junge Tiere machen wir einen festen Fahrplan: Grundimmunisierung in mehreren Schritten, regelmäßige Entwurmung und Gewichtskontrolle.',
          'Sehr gern. Bringen Sie bitte den Impfpass und die Papiere vom Vorbesitzer mit, dann sehen wir, was schon gemacht wurde.',
          'Gern. Neben Impfung und Entwurmung besprechen wir auch Futter, Zahnwechsel, Kastrationszeitpunkt und die Frage, wann welche Sozialkontakte sinnvoll sind.',
        ], seed),
        hint || 'Die Grundimmunisierung startet meist mit 8 Wochen und wird bis etwa 16 Wochen mehrfach wiederholt — dazwischen bitte keine großen Lücken lassen, sonst beginnt der Schutz von vorn.',
      ];
    case 'joints':
      return [
        pick([
          `Gelenkbeschwerden sind gut behandelbar, wenn man früh anfängt. Fällt ${pet} vor allem das Aufstehen nach dem Liegen schwer?`,
          'Danke für die Beschreibung — das klingt nach einem Gelenkthema. Wir schauen uns den Gang an und tasten die Gelenke durch, oft ergänzt durch ein Röntgen.',
          'Wichtig zu wissen: Steifheit ist Schmerz, auch wenn Ihr Tier nicht jammert. Tiere zeigen das kaum.',
          'Bei Gelenken bringt eine Kombination am meisten: passendes Gewicht, gleichmäßige Bewegung, rutschfeste Böden und bei Bedarf Medikamente.',
        ], seed),
        hint || 'Bitte geben Sie keine Schmerzmittel aus der Hausapotheke — für Tiere sind viele davon giftig. Wir finden etwas Passendes und besprechen dazu Gewicht, Bewegung und rutschfeste Böden.',
      ];
    case 'weight':
      return [
        pick([
          `Gewicht ist der wichtigste Hebel für ein langes, beschwerdefreies Leben — schön, dass Sie es angehen. Wie viel wiegt ${pet} aktuell?`,
          'Da helfen wir gern. Am besten kommen Sie zum Wiegen vorbei, dann legen wir ein realistisches Zielgewicht und einen Zeitrahmen fest.',
          'Sehr gute Idee. Wir rechnen die Tagesration konkret aus — inklusive Leckerlis, die machen oft ein Drittel der Kalorien aus.',
          `Machen wir gemeinsam. Wichtig: langsam abnehmen, nicht hungern lassen. Bei ${pet} planen wir Kontrollen alle zwei bis vier Wochen ein.`,
        ], seed),
        hint,
      ];
    case 'payment':
      return [
        pick([
          'Sprechen Sie uns da bitte offen an — wir finden fast immer eine Lösung, und niemand muss deswegen auf Behandlung verzichten.',
          'Das lässt sich regeln. Bei größeren Beträgen können wir über eine Anzahlung und Teilzahlungen sprechen.',
          'Danke, dass Sie das ansprechen. Wir sagen Ihnen die Kosten vorher, damit Sie planen können — keine Überraschungen auf der Rechnung.',
          'Wenn es eng ist, sagen Sie es uns bitte VOR der Behandlung — dann können wir gemeinsam überlegen, was jetzt wirklich nötig ist und was warten kann.',
        ], seed),
        'Bezahlen können Sie bei uns bar oder mit Karte. Für Ratenzahlung brauchen wir nur eine kurze Absprache vorab — bitte nicht erst an der Kasse.',
      ];
    case 'eyes':
      return [
        pick([
          `Augen sind heikel — da schauen wir lieber einmal zu früh als zu spät. Ist das Auge zugekniffen, und reibt sich ${pet} daran?`,
          `Bei Augenveränderungen sollten wir ${pet} zeitnah ansehen. Ist der Ausfluss klar oder eitrig, und ist ein oder sind beide Augen betroffen?`,
          'Das sehen wir uns bitte bald an — am Auge kann sich vieles innerhalb eines Tages verschlechtern. Wann hat es begonnen?',
          'Danke für die Beschreibung. Ist das Auge trüb geworden oder blinzelt Ihr Tier auffällig viel? Beides wäre ein Grund, heute noch zu kommen.',
        ], seed),
        hint || 'Bitte nichts eintropfen, was noch von früher da ist — manche Augentropfen verschlimmern bestimmte Verletzungen deutlich.',
      ];
    case 'skin':
      return [
        pick([
          `Juckreiz und Hautprobleme haben viele Ursachen — Parasiten, Allergie, Futter, Pilz. Seit wann kratzt sich ${pet}, und gibt es kahle Stellen?`,
          `Das sehen wir uns am besten direkt an. Ist die Haut gerötet, schuppig oder nässend? Und ist ${pet} auf Floh-/Zeckenschutz?`,
          'Hautsachen klären wir meist mit einem kurzen Abklatsch oder Hautgeschabsel — das geht gleich beim Termin.',
          `Wichtig für uns: Hat sich am Futter, an Waschmitteln oder an der Umgebung etwas geändert, seit es bei ${petD} begonnen hat?`,
        ], seed),
        hint || 'Bitte nichts Menschliches auftragen — vieles davon wird abgeleckt und ist für Tiere nicht geeignet.',
      ];
    case 'symptom': {
      const q = pick([
        `Seit wann beobachten Sie das bei ${petD}? Und frisst und trinkt ${pet} normal?`,
        `Wie lange geht das schon, und hat sich das Verhalten von ${petD} sonst verändert (Müdigkeit, Appetit)?`,
        `Ist das plötzlich aufgetreten oder schleichend? Und wirkt ${pet} sonst munter?`,
        `Können Sie mir sagen, wie oft das seit gestern vorgekommen ist? Und wirkt ${pet} dabei schmerzhaft?`,
      ], seed);
      const open = pick([
        'Danke für die Beschreibung — das sollten wir uns ansehen.',
        'Gut, dass Sie sich melden — das klären wir am besten bei einer kurzen Untersuchung.',
        'Danke, das hilft schon einmal weiter. Eine Ferndiagnose wäre hier unseriös, ansehen ist besser.',
        'Verstanden. So etwas schauen wir uns lieber einmal zu früh an als zu spät.',
      ], seed);
      return hint ? [open + ' ' + q, hint] : [open + ' ' + q];
    }
    case 'behaviour':
      return [
        pick([
          `Verhaltensprobleme haben oft eine körperliche Ursache — Schmerzen zum Beispiel. Deshalb schauen wir ${pet} zuerst einmal gründlich an.`,
          `Danke, dass Sie das ansprechen — das lässt sich meist gut in den Griff bekommen. Seit wann zeigt ${pet} das, und in welchen Situationen genau?`,
          'Das gehen wir strukturiert an: erst Gesundheitscheck, dann Beratung zum Alltag. Bitte schildern Sie mir kurz eine typische Situation.',
          'Verhalten ändert sich selten grundlos. Hat sich zu Hause etwas verändert — Umzug, neues Tier, anderer Tagesablauf?',
        ], seed),
        hint || 'Bitte auf keinen Fall mit Strafe arbeiten — das verstärkt Angstverhalten meist. Wir besprechen gern konkrete Alternativen.',
      ];
    case 'pregnancy':
      return [
        pick([
          `Herzlichen Glückwunsch! Wir begleiten das gern — mit Ultraschall lässt sich der Stand gut einschätzen und die Geburt planen.`,
          `Da schauen wir am besten frühzeitig einmal nach ${petD}: Trächtigkeitskontrolle, Ernährung und Vorbereitung auf die Geburt.`,
          'Sehr gern. Wichtig ist der ungefähre Deckzeitpunkt — dann können wir den Termin für die Ultraschallkontrolle festlegen.',
          'Gern begleiten wir das. Ab der zweiten Trächtigkeitshälfte steigt der Futterbedarf deutlich — dazu beraten wir Sie beim Termin.',
        ], seed),
        'Bitte melden Sie sich sofort, wenn die Geburt länger als zwei Stunden ohne Fortschritt dauert oder deutlich Blut kommt.',
      ];
    case 'senior':
      return [
        pick([
          `Sehr gute Idee. Bei älteren Tieren empfehlen wir einmal jährlich einen Check mit Blutbild — vieles lässt sich dann früh und günstig abfangen.`,
          `Vorsorge lohnt sich gerade bei Senioren. Für ${pet} planen wir Untersuchung, Blutdruck und Blutbild ein, das dauert etwa 30 Minuten.`,
          'Gern! Beim Senior-Check schauen wir besonders auf Nieren, Schilddrüse, Gelenke und Zähne.',
          'Viele Alterserkrankungen verlaufen lange unauffällig. Genau deshalb lohnt sich der jährliche Check — je früher, desto einfacher und günstiger.',
        ], seed),
        hint || 'Soll ich Ihnen dafür einen Termin vorschlagen? Nüchtern ist ideal, also bitte morgens nichts füttern.',
      ];
    case 'recheck':
      return [pick([
        `Sehr gern — für die Nachkontrolle von ${petD} planen wir etwa 15 Minuten ein. Passt Ihnen morgen 10:00 oder 15:30 Uhr?`,
        'Fäden ziehen wir in der Regel 10–14 Tage nach dem Eingriff. Wann war die Operation genau?',
        `Klar, das machen wir. Wie sieht die Wunde bei ${petD} aus — trocken und geschlossen, oder gerötet und feucht?`,
        'Kommen Sie gern zur Kontrolle vorbei. Bringen Sie bitte den bisherigen Befund oder die Medikamentenliste mit.',
      ], seed)];
    case 'insurance':
      return [
        pick([
          'Einen Kostenvoranschlag stellen wir Ihnen gern schriftlich aus — den können Sie direkt bei Ihrer Versicherung einreichen.',
          'Das machen wir oft: Wir schätzen die Kosten vorab realistisch ein und Sie holen die Zusage Ihrer Versicherung ein.',
          'Gern. Für den Kostenvoranschlag brauchen wir nur, um welchen Eingriff es geht und die Daten Ihrer Versicherung.',
          'Wichtig für Sie: Viele Versicherungen wollen den Kostenvoranschlag VOR der Behandlung sehen — melden Sie sich also lieber zu früh als zu spät.',
        ], seed),
        'Und falls es finanziell knapp wird: Sprechen Sie uns bitte offen an. Wir finden meist eine Lösung — verzichten Sie nicht auf Behandlung.',
      ];
    case 'secondopinion':
      return [
        pick([
          'Eine Zweitmeinung ist völlig legitim — das nehmen wir niemandem übel. Bringen Sie gern alle bisherigen Befunde mit.',
          'Sehr gern schauen wir noch einmal drauf. Am hilfreichsten sind Röntgen-/Laborbefunde und die aktuelle Medikamentenliste.',
          'Klar, dafür sind wir da. Sagen Sie mir kurz, worum es geht, dann planen wir genug Zeit für ein ausführliches Gespräch ein.',
          'Kein Problem. Falls die Vorbefunde noch nicht bei Ihnen sind: Sie haben ein Recht auf eine Kopie, wir helfen Ihnen gern beim Anfordern.',
        ], seed),
      ];
    case 'reschedule':
      return [pick([
        'Kein Problem, das verschieben wir. Wann würde es Ihnen stattdessen passen — eher vormittags oder nachmittags?',
        'Alles klar, ich storniere den Termin. Sollen wir gleich einen neuen ausmachen? Ich hätte morgen 09:30 oder 15:00 Uhr frei.',
        'Danke fürs Bescheidgeben! Ich trage den Termin aus. Welcher Tag wäre Ihnen nächste Woche am liebsten?',
        'Machen wir. Ich hätte Donnerstag 11:00 oder Freitag 14:30 Uhr frei — passt eines davon?',
      ], seed)];
    case 'confirm':
      if (ctx.offeredSlot) {
        return [
          `Wunderbar — der Termin ${ctx.offeredSlot} ist für ${pet} eingetragen. ✅`,
          'Bitte bringen Sie, falls vorhanden, den Impfpass mit. Bis dann!',
        ];
      }
      return [pick([
        'Perfekt, das notiere ich so. 👍',
        'Super, dann machen wir es genau so.',
        'Alles klar, ist vermerkt. Bis bald!',
      ], seed)];
    case 'appointment':
      return [pick([
        `Gerne! Ich hätte morgen um 09:30 Uhr oder um 14:00 Uhr einen Termin frei — was passt Ihnen besser für ${pet}?`,
        `Da finden wir etwas: Donnerstag 10:15 Uhr oder Freitag 16:30 Uhr wären frei. Welcher Termin passt für ${pet}?`,
        'Sehr gerne. Wie dringend ist es — noch diese Woche, oder reicht Anfang nächster Woche? Morgen um 11:00 Uhr hätte ich z. B. etwas frei.',
        `Klar. Für ${pet} hätte ich heute noch 16:45 Uhr oder morgen früh 08:30 Uhr — was wäre Ihnen lieber?`,
        'Machen wir. Sagen Sie mir kurz, worum es geht, dann plane ich die passende Dauer ein — und ich hätte Mittwoch 13:00 Uhr frei.',
      ], seed)];
    case 'hours':
      return [pick([
        `Wir sind Mo–Fr von 8 bis 18 Uhr für Sie da, Samstag 9–12 Uhr. In dringenden Fällen außerhalb der Zeiten bitte anrufen — ${P} hilft, wo es geht.`,
        'Unsere Öffnungszeiten: Montag bis Freitag 8–18 Uhr, Samstag 9–12 Uhr, Sonntag geschlossen. Notfälle nach telefonischer Ankündigung jederzeit.',
        'Geöffnet haben wir werktags 8–18 Uhr und samstags vormittags. An Feiertagen ist die Praxis geschlossen, der Notdienst ist dann telefonisch erreichbar.',
        'Wochentags 8–18 Uhr, Samstag 9–12 Uhr. Zwischen 12 und 14 Uhr ist bei uns meist OP-Zeit — da bitte vorher kurz anrufen.',
      ], seed)];
    case 'price':
      /* Preisfrage zu einer konkreten Leistung direkt beantworten, statt
         allgemein auszuweichen — das wirkt sonst schnell nach Ausrede. */
      if (/impf/.test(t)) return ['Eine Impfung liegt bei uns je nach Impfstoff meist zwischen 50 und 90 € inklusive Untersuchung.', 'Sagen Sie mir gern, um welches Tier und welche Impfung es geht, dann nenne ich Ihnen den genauen Preis.'];
      if (/(kastr|sterilis)/.test(t)) return ['Eine Kastration kostet je nach Tierart, Geschlecht und Gewicht meist zwischen 120 und 350 € inklusive Narkose.', 'Den genauen Betrag nennen wir Ihnen verbindlich beim Vorgespräch — vor der OP, nicht danach.'];
      if (/(zahn|zahnstein)/.test(t)) return ['Eine Zahnsanierung in Narkose beginnt bei etwa 180 € und hängt stark davon ab, wie viel gemacht werden muss.', 'Wir sehen uns das Gebiss vorher an und geben Ihnen dann einen realistischen Kostenrahmen.'];
      return [
        pick([
          'Die Kosten hängen von der Behandlung ab — eine allgemeine Untersuchung liegt meist bei ca. 45–70 €, Impfungen bei ca. 50–90 €.',
          'Das kann ich pauschal schwer sagen: Erstuntersuchung ca. 45–70 €, weitere Leistungen je nach Aufwand.',
          'Grober Rahmen: Untersuchung 45–70 €, Impfung 50–90 €, Zahnsanierung je nach Umfang deutlich mehr. Genaueres nach dem Ansehen.',
          'Für eine verlässliche Zahl müssten wir wissen, worum es geht. Die reine Untersuchung liegt bei ca. 45–70 €.',
        ], seed),
        'Wir besprechen die voraussichtlichen Kosten aber immer VOR der Behandlung transparent mit Ihnen — keine Überraschungen.',
      ];
    case 'vaccination':
      return [
        pick([
          `Impfungen machen wir laufend. Wann war die letzte Impfung von ${petD}? Bringen Sie zum Termin bitte den Impfpass mit — ich hätte diese Woche noch freie Termine.`,
          'Gern! Für die Grundimmunisierung bzw. Auffrischung planen wir ca. 15 Minuten ein. Donnerstag 14:30 Uhr wäre z. B. frei — passt das?',
          `Sehr gerne. Wichtig: ${pet} sollte am Impftag gesund und fieberfrei sein. Wann würde es Ihnen passen?`,
          'Machen wir. Sagen Sie mir kurz Alter und Impfstatus, dann sage ich Ihnen genau, was jetzt ansteht.',
        ], seed),
        hint,
      ];
    case 'castration':
      return [
        `Eine Kastration ist bei uns Routine. Wir machen vorab ein kurzes Vorgespräch mit Untersuchung von ${petD} und besprechen Ablauf, Narkose und Nachsorge.`,
        pick([
          'Soll ich Ihnen einen Termin fürs Vorgespräch anbieten? Das dauert ca. 20 Minuten.',
          'Wichtig zu wissen: Am OP-Tag muss das Tier nüchtern sein. Wann würde Ihnen ein Vorgespräch passen?',
          'Wenn Sie mögen, planen wir gleich beides — Vorgespräch diese Woche, OP dann kommende Woche.',
        ], seed),
      ];
    case 'dental':
      return [
        pick([
          `Zahnprobleme sind häufig und werden oft unterschätzt. Starker Maulgeruch oder Zahnstein bei ${petD} sollten wir uns ansehen — meist reicht zuerst ein kurzer Kontrolltermin.`,
          'Das klingt nach einem Fall für unsere Zahnsprechstunde. Wir schauen uns das Gebiss an und besprechen dann, ob eine Zahnsteinentfernung nötig ist.',
          `Gern. Frisst ${pet} noch normal, oder fällt Futter aus dem Maul? Das sagt uns schon viel über die Dringlichkeit.`,
          'Zähne schauen wir uns gern an. Eine gründliche Beurteilung geht allerdings nur in Narkose — das besprechen wir vorher in Ruhe.',
        ], seed),
        hint,
      ];
    case 'parasites':
      return [
        pick([
          `Bei Zecken- und Flohschutz beraten wir Sie gern zu Spot-ons, Tabletten oder Halsbändern — was am besten passt, hängt von ${petD} ab (Gewicht, Freigang).`,
          'Entwurmung empfehlen wir je nach Lebensstil 2–4× pro Jahr. Sie können die Wurmkur bei uns abholen oder wir geben sie beim nächsten Termin direkt.',
          'Zeckenschutz sollte lückenlos sein — die meisten Präparate wirken 4 Wochen, manche länger. Sagen Sie mir das Gewicht, dann passt die Dosis.',
          'Gern. Wichtig ist, dass wir das passende Präparat für die Tierart wählen — da gibt es gefährliche Verwechslungen.',
        ], seed),
        hint,
      ];
    case 'grooming':
      if (/kralle/.test(t)) {
        return [pick([
          `Krallenschneiden machen wir gern nebenbei mit — das dauert nur wenige Minuten. Soll ich das beim nächsten Termin für ${pet} einplanen?`,
          'Kein Problem, das übernehmen wir. Wenn Ihr Tier dabei sehr unruhig ist, sagen Sie uns bitte vorher Bescheid.',
          'Machen wir gern. Bitte vorher nicht selbst zu kurz schneiden — in der Kralle sitzen Nerv und Gefäß, das blutet sonst stark.',
        ], seed)];
      }
      return [
        pick([
          'Fellpflege besprechen wir gern — bei starker Verfilzung ist Scheren manchmal die schonendste Lösung.',
          'Baden ist bei Tieren selten nötig und trocknet die Haut aus. Wenn es sein muss, nur mit tiergeeignetem Shampoo.',
          `Regelmäßiges Bürsten hilft am meisten. Wenn ${pet} dabei empfindlich reagiert, schauen wir uns die Haut lieber einmal an.`,
          'Sehr gern. Beim Trimmen und Scheren achten wir darauf, dass die Haut geschützt bleibt — zu kurz ist selten gut.',
        ], seed),
        hint,
      ];
    case 'nutrition':
      return [
        pick([
          `Ernährungsberatung machen wir gerne — am besten bringen Sie ${pet} einmal zum Wiegen vorbei, dann erstellen wir einen konkreten Futterplan.`,
          'Gute Frage! Futter ist sehr individuell (Alter, Gewicht, Vorerkrankungen). Sollen wir das bei einem kurzen Beratungstermin durchgehen?',
          `Gern. Wichtig ist zuerst: Wie viel wiegt ${pet} aktuell, und was bekommt er/sie derzeit genau — inklusive Leckerlis?`,
          'Da helfen wir gern weiter. Futterumstellungen machen wir immer langsam über etwa eine Woche, sonst gibt es Durchfall.',
        ], seed),
        hint,
      ];
    case 'medication':
      return [
        'Bitte geben Sie KEINE Medikamente aus der Hausapotheke — vieles, was für Menschen harmlos ist (z. B. Ibuprofen oder Paracetamol), ist für Tiere giftig!',
        pick([
          `Rufen Sie uns kurz an oder kommen Sie vorbei, dann verordnen wir etwas Passendes für ${pet}.`,
          `Dosierungen kann ich im Chat grundsätzlich nicht nennen — das hängt an Gewicht, Alter und Vorerkrankungen von ${petD}. Kommen Sie bitte kurz vorbei.`,
          'Wenn Sie ein Medikament von uns haben und unsicher sind: Rufen Sie an, wir schauen in die Akte und sagen Ihnen die richtige Menge.',
        ], seed),
      ];
    case 'travel':
      return [
        'Für Reisen brauchen Sie in der EU: Mikrochip, gültige Tollwutimpfung (mind. 21 Tage alt) und den EU-Heimtierausweis.',
        pick([
          'Beides können wir bei uns machen. Wann geht die Reise los? Dann planen wir rechtzeitig.',
          'Für einzelne Länder gelten Zusatzregeln (z. B. Bandwurmbehandlung). Sagen Sie mir das Reiseziel, dann prüfe ich das.',
          'Bitte rechtzeitig planen — die Tollwutimpfung muss 21 Tage vor Abreise erfolgt sein. Wann fahren Sie?',
        ], seed),
      ];
    case 'address':
      return [pick([
        `Sie finden ${P} an der in der App angegebenen Adresse — Parkplätze sind direkt vor der Praxis. Über „Route öffnen" startet die Navigation.`,
        'Die genaue Adresse steht auf unserer Praxisseite in der App — mit einem Tipp auf „Route" öffnet sich die Karten-App mit Navigation.',
        'Am einfachsten über die Praxisseite in der App: Dort gibt es Adresse, Telefonnummer und den Knopf für die Navigation.',
      ], seed)];
    case 'housecall':
      return [pick([
        'Hausbesuche bieten wir an — vor allem für Tiere, die der Transport stark stresst. Sagen Sie uns Adresse und Wunschzeit, wir melden uns mit einem Terminvorschlag.',
        'Ja, wir kommen auch zu Ihnen! Hausbesuche machen wir meist am Nachmittag. Wo wohnen Sie ungefähr?',
        'Grundsätzlich gern. Bitte beachten Sie: Untersuchungen wie Röntgen oder Labor gehen nur in der Praxis. Worum geht es denn?',
      ], seed)];
    case 'thanks':
      return [pick([
        `Sehr gerne — gute Besserung für ${pet}! 🐾`,
        'Gern geschehen! Melden Sie sich jederzeit wieder. 🐾',
        `Dafür sind wir da! Alles Gute für ${pet} und bis bald.`,
        'Sehr gern! Wenn noch etwas unklar ist, schreiben Sie einfach.',
      ], seed)];
    case 'greeting':
      return [pick([
        `Hallo und willkommen bei ${P}! 👋 Wie können wir Ihnen und Ihrem Tier helfen?`,
        'Guten Tag! 👋 Schön, dass Sie sich melden — worum geht es denn?',
        `Hallo! Hier ist das Team von ${P}. Was können wir für Sie tun?`,
        'Grüß Sie! 👋 Erzählen Sie gern kurz, worum es geht, dann helfen wir weiter.',
      ], seed)];
    case 'bye':
      return [pick([
        'Bis bald und alles Gute! 🐾',
        'Auf Wiedersehen — kommen Sie gut durch den Tag!',
        'Schönen Tag noch und gute Besserung! 🐾',
      ], seed)];
    case 'question':
      return [pick([
        'Gute Frage — ja, das ist grundsätzlich möglich. Am besten klären wir die Details kurz telefonisch oder bei einem Termin. Soll ich Ihnen einen vorschlagen?',
        'Das hängt vom Einzelfall ab. Beschreiben Sie mir kurz mehr Details, dann kann ich Ihnen konkreter antworten.',
        'Dazu sage ich lieber nichts ins Blaue — schildern Sie mir kurz die Situation, dann antworte ich konkret.',
        'Kann ich Ihnen beantworten, brauche aber noch etwas Kontext: Um welches Tier geht es, und seit wann?',
      ], seed)];
    default:
      return [pick([
        'Danke für Ihre Nachricht! Können Sie mir noch kurz sagen, um welches Anliegen es geht — Termin, Symptome oder eine allgemeine Frage?',
        `Alles klar, notiert. Wenn es um ${pet} geht: Beschreiben Sie gern kurz, was los ist, dann helfe ich sofort weiter.`,
        'Verstanden! Wir melden uns gleich ausführlicher. Bei akuten Notfällen bitte zusätzlich immer telefonisch anrufen.',
        'Danke Ihnen! Damit ich richtig helfen kann: Geht es um einen Termin, um Beschwerden oder um eine Frage zu Kosten?',
      ], seed)];
  }
}

/* ---- Tierhalter-Persona (Bot antwortet im Praxis-Posteingang als „Kunde") ----
   War bisher deutlich dünner als die Praxis-Seite und wirkte dadurch in einer
   Vorführung schnell hölzern. */
function ownerAnswer(t, ctx, seed) {
  const pet = ctx.pet && ctx.pet.name ? ctx.pet.name : null;
  /* Ohne bekannten Namen bewusst geschlechtsneutral formulieren — sonst
     schreibt der Bot „er", obwohl es um eine Hündin geht. */
  const mine = pet || 'unser Tier';
  if (/(notfall|sofort|dringend|kommen sie|fahren sie los|rufen sie)/.test(t)) {
    return [pick([
      'Oh je — wir machen uns sofort auf den Weg! Danke für die schnelle Antwort.',
      'Okay, wir fahren gleich los. Vielen Dank, dass Sie so schnell reagieren!',
      'Wir sind in etwa 15 Minuten bei Ihnen. Danke!',
    ], seed)];
  }
  if (/(wie geht|geht es (ihm|ihr|dem)|wie läuft|besser geworden)/.test(t)) {
    return [pick([
      `Danke der Nachfrage! Heute wirkt ${mine} schon deutlich munterer als gestern.`,
      'Es geht langsam bergauf, ganz beim Alten sind wir aber noch nicht.',
      `Ganz ehrlich: viel besser ist es noch nicht. ${mine} ist weiter sehr ruhig.`,
    ], seed)];
  }
  if (/(seit wann|wie lange|wann hat|wann begann)/.test(t)) {
    return [pick([
      'Seit gestern Abend ungefähr. Vorher war alles ganz normal.',
      'Das geht jetzt schon zwei Tage so, gestern war es aber noch nicht so schlimm.',
      'Heute früh ist es mir zum ersten Mal aufgefallen.',
    ], seed)];
  }
  if (/(frisst|trinkt|appetit|futter)/.test(t)) {
    return [pick([
      `Trinken tut ${mine} normal, gefressen hat ${mine} seit gestern aber fast nichts.`,
      'Der Appetit ist deutlich weniger als sonst, Wasser wird aber gut getrunken.',
      'Gefressen wird wieder etwas, aber lange nicht so viel wie sonst.',
    ], seed)];
  }
  if (/(termin|uhr|frei|passt|vormittag|nachmittag)/.test(t)) {
    return [pick([
      'Ja, das passt uns super. Vielen Dank!',
      'Perfekt, den Termin nehmen wir. Danke!',
      'Der zweite Termin wäre uns lieber, geht das?',
      'Vormittags wäre besser, falls noch etwas frei ist.',
    ], seed)];
  }
  if (/(kosten|preis|euro|rechnung|kostenvoranschlag|zahlen)/.test(t)) {
    return [pick([
      'Alles klar, danke für die Info — das ist in Ordnung für uns.',
      'Danke, gut zu wissen. Dann machen wir das so.',
      'Puh, das ist schon einiges. Aber Hauptsache, es geht ihm wieder gut.',
      'Passt, danke für die offene Auskunft vorab. Das rechne ich mir kurz durch.',
    ], seed)];
  }
  if (/(impfpass|mitbringen|unterlagen|befund|papiere)/.test(t)) {
    return [pick([
      'Den Impfpass bringen wir mit, danke für den Hinweis!',
      'Alles klar, ich suche die Unterlagen gleich heraus.',
      'Ich glaube, der Impfpass ist noch beim Vorbesitzer. Ich frage nach und melde mich.',
    ], seed)];
  }
  if (/(nüchtern|nichts füttern|nicht füttern|kein futter)/.test(t)) {
    return [pick([
      'Verstanden, ab wann genau nichts mehr? Am Abend vorher oder erst ab Mitternacht?',
      'Alles klar, dann gibt es am Morgen nichts mehr. Wasser darf bleiben, oder?',
    ], seed)];
  }
  if (/(medikament|tablette|geben sie|eingeben|tropfen|salbe)/.test(t)) {
    return [pick([
      'Das mit der Tablette klappt leider gar nicht — sie spuckt sie jedes Mal wieder aus. Haben Sie einen Tipp?',
      'Alles klar, ich gebe es wie besprochen. Danke!',
      'Verstanden. Und wie lange sollen wir das geben?',
    ], seed)];
  }
  if (/(ruhe|leine|nicht springen|schonen|nicht baden)/.test(t)) {
    return [pick([
      'Okay, dann bleibt er die nächsten Tage an der Leine. Danke!',
      'Ruhig halten ist bei ihr gar nicht so einfach, aber wir geben unser Bestes.',
    ], seed)];
  }
  if (/(untersuchung|röntgen|blut|labor|ultraschall)/.test(t)) {
    return [pick([
      'Ja, machen Sie bitte alles, was nötig ist.',
      'In Ordnung. Wie lange dauert das ungefähr, und sollen wir warten?',
      'Klingt vernünftig. Wann bekommen wir das Ergebnis?',
    ], seed)];
  }
  if (/(sofort|dringend|notfall|nicht warten)/.test(t)) {
    return [pick([
      'Oh nein, das klingt ernst. Wir kommen sofort.',
      'Wir sind schon unterwegs, danke!',
    ], seed)];
  }
  if (/\?\s*$/.test(t)) {
    return [pick([
      'Gute Frage — ich schaue kurz nach und melde mich gleich!',
      'Moment, das kläre ich schnell und schreibe zurück.',
      'Da bin ich mir ehrlich gesagt nicht sicher — ich frage kurz zu Hause nach.',
      'Hmm, das weiß ich gerade nicht auswendig. Ich sehe nach und antworte gleich.',
    ], seed)];
  }
  return [pick([
    'Alles klar, vielen Dank für die Info! 🐾',
    'Danke Ihnen — bis später!',
    'Super, danke für die schnelle Rückmeldung!',
    'Das beruhigt mich, danke!',
    'Verstanden, danke für die ausführliche Erklärung.',
  ], seed)];
}

/* ---- Haupteinstieg ---- */
export function botConversationReply({ messages = [], userText = '', fromRole = 'clinic', practiceName = '' }) {
  const t = (userText || '').toLowerCase();
  const ctx = buildContext(messages, fromRole);
  if (!ctx.kind) { const k = extractKind(t); if (k) ctx.kind = k; }
  const seed = messages.length + t.length;

  // Gegenseite ist Tierhalter (Bot antwortet im Praxis-Posteingang als "Kunde")
  if (fromRole === 'owner') return { texts: ownerAnswer(t, ctx, seed) };

  // Kurze Antwort auf eine offene Bot-Frage ("Seit wann...?" -> "seit gestern")
  if (ctx.openQuestion && t.length < 40 && !/\?/.test(t) && detectIntent(t) === 'fallback') {
    return {
      texts: [pick([
        `Danke, das hilft mir weiter. Am besten schauen wir uns ${petRef(ctx)} zeitnah an — soll ich Ihnen einen Termin für morgen Vormittag reservieren?`,
        'Alles klar, danke! Damit können wir gut planen. Ich würde einen zeitnahen Kontrolltermin empfehlen — morgen 09:30 oder 14:00 Uhr?',
        `Verstanden, danke. Ich würde ${petRef(ctx)} gern kurz ansehen — hätten Sie heute Nachmittag oder morgen früh Zeit?`,
      ], seed)],
    };
  }

  const intent = detectIntent(t);
  return { texts: answer(intent, { t, ctx, seed, practiceName }).filter(Boolean) };
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
    : 'Danke für das Bild — das hilft bei der Einschätzung! Wir sehen es uns gleich genau an. Eine sichere Beurteilung ist nur vor Ort möglich; falls es akut schlimmer wird, bitte sofort anrufen.';
}
