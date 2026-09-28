// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* Bot 3.0 — Lexikon für die Sicherheits-Triage (Deutsch, österreichischer Dialekt, Englisch).

   Alle Begriffe stehen schon in GEFALTETER Form (ä→ae, ö→oe, ü→ue, ß→ss, klein), weil der Text
   vor dem Vergleich genauso gefaltet wird. Muster-Syntax: siehe match.js.

   Grundsätze aus dem Audit (Bot 2.2 hat 17 von 22 Notfällen übersehen):
   - Red Flags sind PHRASEN, nicht Einzelwörter („atmet schwer", „bekommt keine Luft").
   - Wo die Verneinung selbst das Symptom ist („atmet nicht", „kann nicht pinkeln"), steht sie im
     Muster und das Muster ist mit neg:'self' von der Verneinungsprüfung ausgenommen.
   - „dringend", „Notfall" sind nur schwache Signale: „nicht dringend"/„kein Notfall" heben NUR
     diese auf, nie eine Symptom-Phrase im selben Text.
   - Jede Einnahme-Zeitform zählt: frisst / gefressen / gegessen / gegeben / gefuttert / geknabbert /
     erwischt / ate … */

/* ---------- Gifte ----------
   cls: food | chem | plant | drug-human (Humanmedizin, IMMER gefährlich) | drug (allgemein: nur bei
   eindeutiger Einnahme giftig — „Tablette bekommen" vom Tierarzt ist normal) | other */
export const POISONS = [
  { key: 'choco', name: 'Schokolade', cls: 'food', p: 'schokolad*|schoko*|schoki|kakao*|nutella|pralin*|chocolate|choc|brownie*' },
  { key: 'grapes', name: 'Trauben und Rosinen', cls: 'food', p: 'weintraube*|traube|trauben|rosine*|sultanine*|grape|grapes|raisin*|korinthe*' },
  { key: 'allium', name: 'Zwiebeln und Knoblauch', cls: 'food', p: 'zwiebel*|knoblauch*|baerlauch|schnittlauch|onion*|garlic' },
  { key: 'xylit', name: 'Xylit (Birkenzucker)', cls: 'food', p: 'xylit*|birkenzucker*|kaugummi*|xylitol|gum' },
  { key: 'avocado', name: 'Avocado', cls: 'food', p: 'avocado*|guacamole' },
  { key: 'macadamia', name: 'Macadamianüsse', cls: 'food', p: 'macadamia*' },
  { key: 'alcohol', name: 'Alkohol', cls: 'food', p: 'alkohol|schnaps|likoer|alcohol|vodka|wodka' },
  { key: 'caffeine', name: 'Koffein', cls: 'food', p: 'kaffee|kaffeebohne*|koffein*|energydrink*|coffee' },
  { key: 'dough', name: 'roher Hefeteig', cls: 'food', p: 'hefeteig|germteig' },
  { key: 'rat', name: 'Rattengift', cls: 'chem', p: 'rattengift*|maeusegift*|mausgift|rodentizid*|rattenkoeder*' },
  { key: 'bait', name: 'Giftköder', cls: 'chem', p: 'giftkoeder*|koeder' },
  { key: 'gift', name: 'Gift', cls: 'chem', p: '=gift|=giftig|=giftiges|poison' },
  { key: 'slug', name: 'Schneckenkorn', cls: 'chem', p: 'schneckenkorn*|schneckengift|metaldehyd' },
  { key: 'antifreeze', name: 'Frostschutzmittel', cls: 'chem', p: 'frostschutz*|kuehlerfluessigkeit|kuehlmittel|glykol|antifreeze' },
  { key: 'chem', name: 'Haushaltschemie', cls: 'chem', p: 'putzmittel|reinigungsmittel|bleiche|=chlor|chlorreiniger|entkalker|abflussreiniger|spuelmaschinentab*|waschmittel|weichspueler|insektizid*|pflanzenschutz*|unkrautvernichter|duenger|pestizid*|mottenkugel*|permethrin' },
  { key: 'teatree', name: 'Teebaumöl', cls: 'chem', p: 'teebaum*|aetherische*|duftoel*|teatree' },
  { key: 'nsaid', name: 'Schmerzmittel aus der Humanmedizin', cls: 'drug-human', p: 'ibuprofen*|paracetamol*|aspirin*|acetylsalicyl*|diclofenac*|voltaren*|naproxen*|thomapyrin*|dolormin*|mexalen*|parkemed*|seractil*|ibu|schmerztablette*|kopfschmerztablette*|tylenol|advil' },
  { key: 'drug', name: 'Medikamente', cls: 'drug', p: 'tablette|tabletten|pille|pillen|medikament*|antibabypille*|beruhigungsmittel|schlaftablette*|antidepressiv*|blutdrucktablette*|herztablette*|pills|medication' },
  { key: 'lily', name: 'Lilien', cls: 'plant', p: 'lilie|lilien|lily|lilies' },
  { key: 'plant', name: 'Giftpflanzen', cls: 'plant', p: 'oleander|eibe|maigloeckchen|dieffenbachia|weihnachtsstern|narzisse*|osterglocke*|tulpenzwiebel*|azalee*|rhododendron|goldregen|fingerhut|herbstzeitlose|thuja|efeu|eisenhut|tollkirsche*' },
  { key: 'nicotine', name: 'Nikotin', cls: 'other', p: 'nikotin*|zigarette*|zigarre*|zigarettenkippe*|kippe|tabak|nicotine|cigarette*' },
  { key: 'cannabis', name: 'Cannabis', cls: 'other', p: 'cannabis|marihuana|haschisch|thc|kiffen' },
];

/* Einnahme — Vergangenheit/Perfekt (eindeutig passiert). */
export const INGEST_PAST = 'gefressen|gefresen|gfressn|gefressn|gegessen|gessen|erwischt|genascht|geschluckt|verschluckt|runtergeschluckt|hinuntergeschluckt|aufgenommen|geleckt|abgeleckt|aufgeleckt|angeleckt|ausgeleckt|geknabbert|angeknabbert|gefuttert|verputzt|verdrueckt|geklaut|stibitzt|gekaut|zerkaut|angekaut|zerbissen|getrunken|ausgetrunken|gesoffen|ate|eaten|swallowed|chewed|licked|drank|gobbled';
/* Einnahme durch Menschen („ich habe ihm … gegeben") — bei Humanmedizin/Lebensmitteln giftig. */
export const INGEST_GIVEN = 'gegeben|verabreicht|gefuettert|bekommen|gekriegt|given|gave|fed';
/* Gegenwart — nur als Einnahme gewertet, wenn der Satz keine Frage/Bedingung ist. */
export const INGEST_NOW = 'frisst|isst|kaut|leckt|knabbert|schluckt|eating|eats|chewing|frisstgerade';
/* Stoffe, die auch ohne Verb eine Vergiftung melden. */
export const POISON_STANDALONE = 'vergiftet|vergiftung|vergiftungen|vergiftungserscheinung*|poisoned|poisoning';

/* Frage-/Sorgen-Wörter, die eine Gift-FRAGE anzeigen („Darf ich … geben?", „Ist … giftig?"). */
export const POISON_QUESTION = 'darf|duerfen|kann|koennen|soll|sollte|giftig|gefaehrlich|schaedlich|schadet|schlimm|vertraeglich|vertraegt|erlaubt|ok|okay|geben|fuettern|verfuettern|essen|fressen|toxic|safe|can';

/* ---------- Red Flags → Notfall ----------
   r = Grund (steuert die Erste-Hilfe-Zeile), level = 'emergency' (Standard) oder 'urgent',
   neg:'self' = Verneinung gehört zum Symptom, scope:'sentence' = darf über Kommas gehen. */
export const RED = [
  // Atmung
  { r: 'breathing', p: 'atemnot|luftnot|atemstillstand|atemaussetzer|atemprobleme|atembeschwerden|erstickt|erstickungsanfall|roechelt|roecheln|japst|schnappatmung|dyspnoe' },
  { r: 'breathing', p: 'atmet|atmen|atmete|atmung|atmend ~2 schwer|schwerer|kaum|flach|schnell|hastig|stossweise|angestrengt|pfeifend|rasselnd|komisch|muehsam|schlecht|heftig' },
  // „atmet nicht schwer" ist KEIN Atemstillstand: folgt ein Eigenschaftswort, gilt die normale Verneinung
  { r: 'breathing', neg: 'self', unless: 'schwer|schwerer|schnell|stark|hastig|flach|heftig|angestrengt|so|komisch|laut', p: 'atmet|atmen|atmete|atmung ~2 nicht|nimmer|net|ned' },
  { r: 'breathing', neg: 'self', p: 'keine|kaum|schlecht|schwer|wenig|koa ~1 luft' },
  { r: 'breathing', p: 'schnappt|ringt|japst ~2 luft|atem' },
  { r: 'breathing', p: 'atmet|atmen|hechelt|hecheln ~3 offenem|offenen ~1 maul' },
  { r: 'breathing', p: 'maulatmung|mundatmung' },
  { r: 'breathing', neg: 'self', p: 'aufgehoert|aufhoert ~2 atmen' },
  { r: 'breathing', neg: 'self', p: 'hoert ~1 auf ~2 atmen' },
  { r: 'breathing', p: 'blau|blaue|blauer|blaues|blaeulich|blaeuliche ~1 zunge|lippen|schleimhaeute|zahnfleisch' },
  { r: 'breathing', p: 'zunge|lippen|schleimhaeute|zahnfleisch ~2 blau|blaeulich|lila' },
  { r: 'breathing', p: 'breathing ~2 heavily|hard|fast|trouble' },
  { r: 'breathing', neg: 'self', p: 'not ~1 breathing' },
  { r: 'breathing', neg: 'self', p: 'cant|can ~2 breathe' },
  { r: 'breathing', p: 'trouble|difficulty ~1 breathing' },
  // Kreislauf, Schock, Bewusstsein
  { r: 'shock', p: 'blass|blasse|blasses|blassen|weiss|weisse|weisses|graue ~1 schleimhaeute|zahnfleisch|schleimhaut' },
  { r: 'shock', p: 'schleimhaeute|zahnfleisch|schleimhaut ~2 blass|weiss|grau|kreidebleich' },
  { r: 'collapse', p: 'zusammengebrochen|zusammengeklappt|zusammengesackt|kollabiert|kollabiere|kollaps|umgekippt|umgefallen|umgfoin|umgfalln|bewusstlos|ohnmaechtig|ohnmacht|kreislaufkollaps|collapsed|unconscious|fainted' },
  { r: 'collapse', p: 'bricht|brach|klappt|sackt ~1 zusammen' },
  { r: 'collapse', p: 'kippt|kippte|faellt ~1 um' },
  { r: 'collapse', neg: 'self', p: 'reagiert|reagiere ~2 nicht|kaum|nimmer' },
  { r: 'collapse', neg: 'self', p: 'nicht|kaum ~1 ansprechbar' },
  { r: 'collapse', p: 'stirbt|verstirbt|dying|lebensgefahr|lebensbedrohlich|verblutet' },
  { r: 'collapse', p: 'liegt ~2 sterben' },
  { r: 'neuro', p: 'gelaehmt|laehmung|laehmungen|paralysed|paralyzed' },
  { r: 'neuro', level: 'urgent', neg: 'self', p: 'kann ~3 nicht|nimmer ~2 aufstehen|stehen' },
  // Krampf
  { r: 'seizure', p: 'krampf*|kraempf*|epilep*|anfall|anfaelle|krampfanfall|seizure*|convuls*|fitting' },
  { r: 'seizure', p: 'zuckt|zucken|zuckungen ~3 unkontrolliert|ganzen|staendig|heftig' },
  // Blutung
  { r: 'bleeding', p: 'blutet|blutete|bluten|blutend ~2 stark|sehr|heftig|viel|ununterbrochen|staendig|dauernd|extrem|massiv|stark' },
  { r: 'bleeding', p: 'starke|starker|starken|massive|heftige|heftigen ~1 blutung|blutungen' },
  { r: 'bleeding', neg: 'self', p: 'blutung ~2 nicht|kaum ~1 auf|stoppen|stillen' },
  { r: 'bleeding', p: 'blut ~1 spritzt|pulsiert' },
  { r: 'bleeding', p: 'spritzt ~1 blut' },
  { r: 'bleeding', p: 'erbricht|erbrechen|kotzt|spuckt|speibt|erbrach|hustet|bricht ~2 blut|blutig' },
  { r: 'bleeding', p: 'blut ~2 erbrochen|gespuckt|erbricht|gehustet|gekotzt' },
  { r: 'bleeding', p: 'blutiges|blutigen|blutigem ~1 erbrechen|erbrochenes|erbrochen' },
  { r: 'bleeding', p: 'blutiger|blutigen|blutig ~1 durchfall' },
  { r: 'bleeding', p: 'bleeding ~2 heavily|lot|badly' },
  { r: 'bleeding', p: 'vomiting ~1 blood' },
  // Unfall / Sturz
  { r: 'trauma', p: '=unfall|=unfalls|angefahren|angfahrn|ueberfahren|autounfall|verkehrsunfall|zusammenstoss|zusammengestossen' },
  { r: 'trauma', p: 'auto|fahrzeug|traktor|zug|motorrad|fahrrad|lkw|bus ~3 angefahren|erwischt|erfasst|ueberrollt|ueberfahren|gerammt' },
  { r: 'trauma', p: 'hit ~1 by ~1 car|truck|vehicle' },
  { r: 'trauma', p: 'car ~1 accident' },
  { r: 'trauma', p: 'offener|offenen ~1 bruch' },
  { r: 'trauma', level: 'urgent', p: 'gebrochen|knochenbruch|beinbruch|fraktur' },
  { r: 'fall', p: 'stock|stockwerk|fenster|balkon|dach|baum|mauer|treppe|hochbett|leiter ~3 gefallen|gestuerzt|gesprungen|runtergefallen|abgestuerzt|gefoin' },
  { r: 'fall', p: 'fenstersturz|balkonsturz|abgestuerzt|hochhaussyndrom' },
  // Bauch (Magendrehung), Kolik
  { r: 'bloat', p: 'magendrehung|magendrehung*|magentorsion|aufgeblaeht|aufgeblaehter|aufgeblaehten|aufgeblasen|trommelbauch|bloat|bloated' },
  { r: 'bloat', p: 'bauch ~3 hart|aufgeblaeht|gespannt|aufgetrieben|trommelhart|prall' },
  { r: 'bloat', p: 'harter|harten|praller|aufgetriebener|aufgetriebenen ~1 bauch' },
  { r: 'bloat', scope: 'sentence', neg: 'self', p: 'wuergt|wuergen|wuergreiz|brechreiz|wuergend ~6 nichts|kommt' },
  { r: 'colic', p: 'kolik|koliken|kolikt|kolikanfall|colic' },
  { r: 'colic', p: 'waelzt|waelzen|waelzte ~2 sich|staendig|dauernd' },
  { r: 'colic', p: 'schlaegt|tritt|tritt ~3 bauch' },
  // Harnabsatz
  { r: 'urinary', neg: 'self', p: 'kann|konnte|koennen ~4 nicht|kaum|nimmer ~2 pinkeln|urinieren|harnen|pieseln|pullern|lulu|pipi|koten|kacken|strullen|brunzen|wasserlassen' },
  { r: 'urinary', neg: 'self', p: 'kein|keinen|koa ~1 urin|harn|pipi|lulu' },
  { r: 'urinary', neg: 'self', p: 'setzt ~3 kein|keinen|nichts ~2 urin|harn|ab' },
  { r: 'urinary', p: 'presst ~3 staendig|dauernd|ohne|vergeblich|immer|nichts|erfolglos' },
  { r: 'urinary', p: 'harnverhalt*|harnstau|harnroehrenverschluss|blasenverschluss|harnwegsverschluss|blockiert' },
  { r: 'urinary', neg: 'self', p: 'cant|can ~2 pee|urinate' },
  { r: 'urinary', neg: 'self', p: 'not ~1 peeing' },
  // Hitze
  { r: 'heat', p: 'hitzschlag|hitzeschlag|sonnenstich|ueberhitzt|ueberhitzung|hitzekollaps|heatstroke|hitzschlag*' },
  { r: 'heat', p: 'heat ~1 stroke' },
  { r: 'heat', level: 'urgent', p: 'auto ~4 gelassen|vergessen|eingesperrt|zurueckgelassen' },
  { r: 'heat', level: 'urgent', p: 'hechelt ~3 stark|extrem|heftig|staendig|dauernd' },
  // Schlangen, Stiche, Strom
  { r: 'snake', p: 'kreuzotter|kreuzottern|viper|schlangenbiss|snakebite|hornotter' },
  { r: 'snake', p: 'schlange ~2 gebissen|biss|erwischt' },
  { r: 'snake', p: 'snake ~2 bite|bitten' },
  { r: 'allergy', scope: 'sentence', p: 'wespe*|biene*|hornisse*|insekt* ~6 maul|hals|rachen|zunge|gesicht|schwillt|zugeschwollen|kopf' },
  { r: 'allergy', p: 'hals|rachen|zunge|kehle ~3 schwillt|zugeschwollen|geschwollen|dick' },
  { r: 'allergy', p: 'schwillt ~2 zu' },
  { r: 'allergy', p: 'anaphyla*|allergischer|allergischen ~1 schock' },
  { r: 'allergy', level: 'urgent', p: 'gesicht|kopf|maul|schnauze|hals|lefzen ~3 schwillt|zugeschwollen|geschwollen' },
  { r: 'electric', p: 'stromschlag|elektroschock' },
  { r: 'electric', p: 'kabel ~3 angeknabbert|durchgebissen|gebissen|zerbissen' },
  // Fremdkörper
  { r: 'foreign', p: 'socke|socken|spielzeug|stein|steine|knochen|angelhaken|haken|faden|schnur|gummiband|batterie|knopfzelle|magnet|magnete|nadel|ball|kastanie|kastanien|maiskolben|stock|holz|plastik|korken|tampon|strumpf|haargummi|schnuller|pfirsichkern|zahnstocher ~4 verschluckt|gefressen|geschluckt|runtergeschluckt|steckt|gschluckt' },
  { r: 'foreign', p: 'steckt ~3 hals|rachen|maul|speiseroehre|kehle' },
  { r: 'foreign', p: 'hals|rachen|kehle ~3 steckt' },
  // Geburt
  { r: 'birth', p: 'geburt ~4 stockt|haengt|seit|dauert|fest' },
  { r: 'birth', p: 'presswehen|wehen ~4 seit|nichts|stunden' },
  { r: 'birth', p: 'welpe|kitten|fohlen|junges|lamm|kalb ~3 steckt|haengt|fest' },
  // Auge
  { r: 'eye', p: 'auge|augapfel ~3 herausgetreten|vorgefallen|rausgefallen|raus|hervorgetreten|hervor' },
];

/* ---------- Dringend (heute ansehen), aber kein akuter Notfall ---------- */
export const URGENT = [
  { r: 'weak', p: 'dringend|dringende|dringender|dringendes|eilig|eilt|asap|urgent|sos' },
  { r: 'blood', p: 'blut ~2 urin|harn|pipi|kot|stuhl|haufen|kacke' },
  { r: 'blood', p: 'blutiger|blutigen|blutig ~1 urin|harn|kot|stuhl' },
  { r: 'blood', p: 'nasenbluten' },
  { r: 'vomit', p: 'erbricht|kotzt|speibt|spuckt|erbrechen|uebergibt|bricht|kotzen ~3 staendig|dauernd|mehrmals|mehrfach|oft|stuendlich|alles|andauernd|laufend|wiederholt' },
  { r: 'apathy', p: 'apathisch|teilnahmslos|reglos|lethargisch|lethargic' },
  { r: 'fever', p: 'hohes|hohem ~1 fieber' },
  { r: 'lameness', neg: 'self', p: 'belastet ~3 nicht|kaum|gar' },
  { r: 'lameness', p: 'haelt ~3 bein|pfote|lauf ~2 hoch' },
  { r: 'eye', p: 'augenverletzung|hornhautverletzung' },
  { r: 'eye', p: 'auge ~3 verletzt|zugekniffen|zugeschwollen' },
  { r: 'bite', p: 'bisswunde|bissverletzung|beisserei|rauferei|gerauft' },
  { r: 'bite', p: 'wurde|ist|worden ~3 gebissen' },
  { r: 'foreign', p: 'verschluckt' },
  { r: 'burn', p: 'verbrannt|verbrennung|verbrueht|verbruehung|veraetzt|veraetzung' },
  { r: 'shiver', p: 'zittert ~3 stark|ganzen|heftig|unkontrolliert' },
  { r: 'pain', p: 'schreit|jault|winselt|jammert ~3 schmerz*|staendig|vor|dauernd' },
  { r: 'pain', p: 'starke|starken|heftige|heftigen ~1 schmerzen' },
  { r: 'pyometra', p: 'eitriger|eitrigen ~1 ausfluss' },
  { r: 'appetite', neg: 'self', p: 'seit ~2 tagen|tag ~3 nichts|nicht ~3 gefressen|getrunken|gegessen' },
  { r: 'appetite', neg: 'self', p: 'frisst|trinkt|fressen ~2 seit ~2 tagen ~2 nichts|nicht' },
  { r: 'cold', p: 'unterkuehlt|unterkuehlung|erfroren' },
];

/* Wörter, die ein Notfall-Wort als Info-Frage/Bedingung ausweisen („im Notfall", „was tun bei …"). */
export const EMERGENCY_WORD = 'notfall|notfal|notfaelle|emergency';
export const EMERGENCY_WORD_INFO = 'im|fuer|bei|falls|wenn';

/* Vergangenheits-Marker: „letzte Woche", „vor 2 Jahren", „damals" → kein akuter Fall.
   ACHTUNG: „seit letzter Woche" ist NICHT vergangen, sondern anhaltend (wird im Code geprüft). */
export const PAST = [
  'letzte|letzten|letztes|letzter|vorige|vorigen|voriges|vergangene|vergangenen|vergangenes ~1 woche|jahr|monat|sommer|winter|herbst|fruehling|mal|jahres',
  'vor ~2 wochen|monaten|jahren|jahr|monat',
  '=damals|=frueher|=einst',
  'war|hatte|hatten ~3 mal|einmal',
  'als ~1 welpe|kitten|junghund|jungtier',
];
/* Vorbeugung: „wie schütze ich ihn vor Hitzschlag" → Info, kein Notfall. */
export const PREVENTION = 'schuetzen|schuetze|schuetzt|vorbeugen|vorbeugung|vermeiden|verhindern|verhindere|praevention|verhueten';
/* Bedingung/Hypothese: „was mache ich, wenn er krampft?" */
export const HYPOTHETICAL = 'wenn|falls|sollte|angenommen|if|bei';

/* ---------- Tierarten, Geschlecht, Rassen ---------- */
export const SPECIES = {
  hund: ['dog', 'm'], hunde: ['dog', null], huendin: ['dog', 'f'], ruede: ['dog', 'm'], welpe: ['dog', 'm'], welpen: ['dog', null],
  hundi: ['dog', null], hunderl: ['dog', null], junghund: ['dog', 'm'], hundebaby: ['dog', null], dog: ['dog', null], puppy: ['dog', null],
  katze: ['cat', 'f'], katzen: ['cat', null], kater: ['cat', 'm'], kaetzchen: ['cat', null], kitten: ['cat', null], katzenbaby: ['cat', null],
  mieze: ['cat', 'f'], katz: ['cat', 'f'], kaetzin: ['cat', 'f'], cat: ['cat', null], kitty: ['cat', null], buesi: ['cat', null],
  kaninchen: ['small', null], hase: ['small', 'm'], haeschen: ['small', null], zwergkaninchen: ['small', null], meerschweinchen: ['small', null],
  meeri: ['small', null], hamster: ['small', 'm'], ratte: ['small', 'f'], maus: ['small', 'f'], frettchen: ['small', null],
  chinchilla: ['small', null], degu: ['small', null], rabbit: ['small', null], hasi: ['small', null],
  pferd: ['horse', null], pony: ['horse', null], stute: ['horse', 'f'], wallach: ['horse', 'm'], hengst: ['horse', 'm'],
  fohlen: ['horse', null], esel: ['horse', 'm'], horse: ['horse', null], haflinger: ['horse', null],
  vogel: ['bird', 'm'], papagei: ['bird', 'm'], wellensittich: ['bird', 'm'], nymphensittich: ['bird', 'm'], kanarienvogel: ['bird', 'm'],
  sittich: ['bird', 'm'], huhn: ['bird', null], henne: ['bird', 'f'], taube: ['bird', 'f'], bird: ['bird', null], wellensittiche: ['bird', null],
  schildkroete: ['exotic', 'f'], echse: ['exotic', 'f'], schlange: ['exotic', 'f'], gecko: ['exotic', 'm'], bartagame: ['exotic', 'f'],
  leguan: ['exotic', 'm'], chamaeleon: ['exotic', null], python: ['exotic', null],
};

/* Rassen → Tierart. Zweiwort-Rassen („golden retriever") werden im Namensmodul zusammengezogen. */
export const BREEDS = {
  labrador: 'dog', retriever: 'dog', schaeferhund: 'dog', dackel: 'dog', mops: 'dog', bulldogge: 'dog', beagle: 'dog',
  pudel: 'dog', chihuahua: 'dog', husky: 'dog', collie: 'dog', terrier: 'dog', dalmatiner: 'dog', boxer: 'dog',
  rottweiler: 'dog', dobermann: 'dog', malteser: 'dog', havaneser: 'dog', spitz: 'dog', labradoodle: 'dog', aussie: 'dog',
  sennenhund: 'dog', schnauzer: 'dog', setter: 'dog', spaniel: 'dog', windhund: 'dog', greyhound: 'dog', whippet: 'dog',
  bernhardiner: 'dog', neufundlaender: 'dog', dogge: 'dog', mischling: 'dog', pekinese: 'dog', shih: 'dog', westie: 'dog',
  jack: 'dog', russell: 'dog', yorkie: 'dog', yorkshire: 'dog', corgi: 'dog', samojede: 'dog', akita: 'dog', shiba: 'dog',
  perser: 'cat', siam: 'cat', siamkatze: 'cat', bengal: 'cat', ragdoll: 'cat', norweger: 'cat', sphynx: 'cat', kartaeuser: 'cat',
  maine: 'cat', coon: 'cat', bkh: 'cat', britisch: 'cat', kurzhaar: 'cat', hauskatze: 'cat', europaeisch: 'cat',
  noriker: 'horse', araber: 'horse', lipizzaner: 'horse', friese: 'horse', warmblut: 'horse', quarter: 'horse', isi: 'horse', islaender: 'horse',
  widder: 'small', loewenkopf: 'small',
};
/* Grammatisches Geschlecht der Rassebezeichnung (für „er/sie" ohne Namen) */
export const BREED_GENDER = { dogge: 'f', bulldogge: 'f', hauskatze: 'f', siamkatze: 'f' };

/* Wörter, die NIE Tiernamen sind (Audit: „Durchfall", „Hat", „Frisst", „Nicht" wurden Namen). */
export const NAME_STOP = (
  'hat|hatte|haben|ist|war|sind|wird|wurde|kann|konnte|muss|soll|will|darf|mag|frisst|fressen|trinkt|trinken|nicht|kein|keine|keinen|nichts|'
  + 'seit|und|oder|aber|auch|noch|schon|mal|nur|sehr|ganz|so|wie|was|wann|wo|wer|warum|heute|gestern|morgen|jetzt|gerade|immer|oft|'
  + 'danke|bitte|hallo|hilfe|notfall|durchfall|fieber|husten|schmerzen|blut|erbrechen|erbricht|hustet|humpelt|hinkt|lahmt|blutet|atmet|'
  + 'niest|zittert|kratzt|leckt|beisst|bellt|schlaeft|liegt|steht|geht|laeuft|springt|hechelt|jault|schreit|krampft|kotzt|speibt|'
  + 'ein|eine|einen|einem|einer|der|die|das|den|dem|des|mein|meine|meinen|meinem|meiner|unser|unsere|unseren|unserem|'
  + 'er|sie|es|ihm|ihr|ihn|wir|ich|du|ihr|mit|bei|von|vom|zum|zur|im|in|an|am|auf|aus|nach|vor|fuer|ueber|unter|um|zu|'
  + 'probleme|problem|termin|impfung|frage|fragen|futter|wurm|wuermer|zecke|zecken|floh|floehe|wunde|auge|augen|ohr|ohren|pfote|bein|'
  + 'bauch|haut|fell|zahn|zaehne|maul|nase|kopf|schwanz|krank|muede|schlapp|alt|jung|klein|gross|dick|duenn|lieb|brav|'
  + 'wieder|mehr|weniger|viel|wenig|etwas|alles|beide|zwei|drei|vier|heisst|namens|name|juckreiz|ausschlag|beule|schwellung|'
  + 'mir|mich|uns|euch|ihnen|dir|dich|sich|dass|weil|wenn|ob|als|dann|denn|doch|ja|nein|okay|ok|gut|schlecht|toll|super|'
  + 'tag|tage|tagen|woche|wochen|monat|monate|jahr|jahre|jahren|stunde|stunden|minuten|uhr|frueh|abend|nacht|mittag|'
  + 'montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|kolik|appetit|verletzt|geschwollen|rattengift|schokolade|'
  + 'the|and|is|my|our|has|not|with|dog|cat|'
  // Satzanfänge, die vor einem Verb stehen können („Seitdem hustet …") — nie Namen
  + 'seitdem|danach|dann|trotzdem|deshalb|deswegen|daher|zuerst|vorher|nachher|abends|morgens|mittags|leider|endlich|ploetzlich|'
  + 'irgendwie|eigentlich|natuerlich|sonst|ausserdem|dies|dieser|diese|dieses|jemand|keiner|man|ihre|ihren|ihrem|ihrer|dort|hier|'
  + 'da|also|nun|zudem|anfangs|zuletzt|inzwischen|mittlerweile|manchmal|selten|kaum|fast|bald|alle|jeder|jede|welche|welcher|'
  + 'wasser|essen|trinken|fressen|medikament|tablette|tabletten|salbe|spritze|operation|narkose|praxis|tierarzt|tieraerztin|team'
).split('|');

/* Echte Wörter, die nie per Stamm/Tippfehler auf einen Lexikon-Begriff abgebildet werden dürfen. */
export const FUZZY_BLOCK = (
  'taube|tauben|frist|fristen|hilft|helfen|notfalls|kampf|kaempfe|linie|linien|karte|karten|welle|wellen|rasen|rasse|rassen|'
  + 'masse|klasse|nachts|sicher|sichern|stuecke|bitten|bitter|wurst|kaese|kekse|spielen|gespielt|leben|lieben|tragen|fragen|'
  + 'sagen|klagen|wagen|lagen|drehen|nehmen|machen|lachen|sachen|wachen|zimmer|monster|leicht|leichte|kasse|tasse|flasche|'
  + 'wache|sache|nichte|lichte|leichter|schlecht|schlechter|richtig|wichtig|kraeftig|tabelle|kabine|kabel|nabel|gabel|'
  + 'trauer|traum|traeume|kater|katern|hunden|stunde|stunden|runde|kunde|kunden|munde|wunder|wunsch|wuensche'
).split('|');
