/* Bot 3.0 — Anliegen (Intents) mit gewichteter Bewertung statt fester Reihenfolge.

   Bot 2.2 prüfte ~45 Regexe der Reihe nach, der erste Treffer gewann: „Termin und Preis?" bekam nur
   eine Antwort, „Danke, aber jetzt krampft er wieder" wurde ein Dank. Jetzt sammelt jedes Anliegen
   Punkte (Gewicht × Trefferqualität). Beantwortet werden die zwei besten INHALTLICHEN Anliegen;
   soziale (Hallo/Danke/Tschüss) zählen nur, wenn sonst nichts erkannt wurde.

   Muster-Einträge: [muster, gewicht, flags]
     flags 'self'  = Verneinung gehört zum Muster („frisst nicht") → keine Verneinungsprüfung
     flags 'recov' = verneint + „mehr" („kein Durchfall mehr") zählt als Entwarnung
     flags 'any'   = Verneinung egal (z. B. Fragen nach Preisen)
     flags 'sent'  = darf über Kommas/„und" hinweg passen (Satz statt Teilsatz) */
import { compilePattern, findAll, isNegated, matchText } from './match.js';

const C = 'content';
const S = 'social';

export const INTENTS = [
  { id: 'euthanasia', kind: C, p: [
    ['einschlaefer*|euthanas*|erloesen|erloesung|einschlaefern', 2],
    ['einschlafen|sterben|gehen ~1 lassen', 1.6],
    ['letzter|letzten ~1 weg', 1.6], ['abschied ~2 nehmen', 1.4], ['put ~1 down', 1.6], ['leidet ~3 so|sehr|nur', 0.6],
  ] },
  { id: 'microchip', kind: C, p: [
    ['entlaufen|weggelaufen|ausgebuext|ausgebuechst|vermisst|vermisse|abgehauen|zugelaufen|missing|runaway', 1.8],
    ['hund|katze|kater|tier|huendin|er|sie|es ~3 verschwunden|weg|abgehauen', 1.5, 'any'],
    ['seit ~3 verschwunden', 1.5, 'any'], ['nicht ~2 nach ~1 hause ~2 gekommen', 1.5, 'self'],
    ['chipnummer|mikrochip|chip|chippen|gechippt|registrier*|tasso|animaldata|haustierdatenbank|heimtierdatenbank', 1.2],
    ['gefunden|fundtier|zugelaufen', 1.0],
  ] },
  { id: 'fireworks', kind: C, suppress: ['behaviour'], p: [
    ['silvester|feuerwerk|boeller|raketen|knallerei|gewitter|donner|fireworks|thunder', 1.8],
    ['angst|panik ~3 laerm|knall|knallen|geraeuschen|geraeusche', 1.6],
  ] },
  { id: 'heat', kind: C, p: [
    ['hitze|hitzewelle|sommerhitze|heiss|heisse|heissen|hitzetage|tropennacht|heat', 1.2],
    ['auto ~3 lassen|warten|gelassen', 0.8], ['abkuehl*|kuehlmatte|kuehlen|schatten|kuehl', 0.7],
    ['hitzschlag|sonnenstich|hitzeschlag', 1.2, 'any'], ['warm|warmen ~2 wetter|tagen', 1.0], ['sommer', 0.4],
  ] },
  { id: 'anesthesia', kind: C, p: [['narkose*|vollnarkose|betaeubung|sedierung|sedier*|narkoserisiko|anesthesia|anaesthesie', 1.8], ['aufwachen', 0.5]] },
  { id: 'postop', kind: C, p: [
    ['halskrause|trichter|leckschutz|body|naht|naehte|opwunde|wundheilung|faeden|klammern|operationswunde', 1.6],
    ['nach ~2 op|operation|eingriff|kastration|narkose', 1.6], ['op ~1 wunde', 1.6],
  ] },
  { id: 'samples', kind: C, p: [
    ['kotprobe|stuhlprobe|urinprobe|harnprobe|sammelkot|sammelprobe|kotuntersuchung|harnuntersuchung', 2],
    ['probe|proben ~3 abgeben|mitbringen|vorbeibringen|sammeln|bringen|abgeben', 1.8],
  ] },
  { id: 'emergencyservice', kind: C, p: [
    ['notdienst|notdienste|bereitschaft|bereitschaftsdienst|notfallnummer|notrufnummer|notfalldienst|notfallsprechstunde|notfallpraxis|tiernotdienst|notfallambulanz|notruf', 2],
    ['notfaelle|notfall ~3 annehmen|an|behandeln|uebernehmen', 1.6, 'any'], ['nehmen ~4 notfaelle|notfall', 1.6, 'any'],
    ['nachts|nacht|wochenende|feiertag|feiertags|feiertagen|sonntag|sonntags|abends ~5 erreichbar|hilfe|dienst|notfall|jemand|notfaelle|bereitschaft', 1.3],
    ['ausserhalb ~3 oeffnungszeiten|zeiten', 1.6], ['im|fuer|bei ~1 notfall|notfaellen', 1.2, 'any'], ['wer|wohin|wen ~4 notfall|nachts|wochenende', 1.2],
  ] },
  { id: 'referral', kind: C, p: [
    ['spezialist*|ueberweisung|ueberweisen|facharzt|fachtierarzt|tierklinik|klinik|mrt|ct|computertomograf*|kardiolog*|onkolog*|neurolog*|dermatolog*|orthopaed*|augenarzt|specialist', 1.4],
  ] },
  { id: 'newpet', kind: C, p: [
    ['neues|neuen|neue ~1 tier|hund|katze|kater|welpen|mitbewohner', 1.2], ['zweitkatze|zweithund|neuzugang|adoptiert|adoptieren|tierheim', 1.3],
    ['zweite ~1 katze', 1.4], ['zweiter ~1 hund', 1.4], ['eingewoehn*|vergesellschaft*|zusammenfuehr*|zusammengewoehnen', 1.6],
  ] },
  { id: 'puppy', kind: C, p: [
    ['welpe|welpen|kitten|kaetzchen|junghund|jungtier|katzenbaby|hundebaby|puppy ~5 impf*|entwurm*|braucht|checkliste|erste|ersten|neu|geholt|bekommen|untersuch*|wurmkur|beratung', 1.6],
    ['erstimpfung|welpenimpfung|welpenschutz|grundimmunisierung', 1.5],
  ] },
  { id: 'joints', kind: C, p: [
    ['arthrose|gelenk*|steif|steifheit|hueftdysplasie|kreuzband*|bandscheibe*|dackellaehme|hueft*|ellbogen*|patella*', 1.5],
    ['springt ~2 nicht ~1 mehr', 1.5, 'self'], ['treppe|treppen ~4 nicht|schwer|muehe|hoch', 1.3, 'self'],
    ['aufstehen ~3 schwer|faellt|muehe', 1.4], ['lahmt|humpelt ~2 seit ~2 wochen|monaten', 1.0],
  ] },
  { id: 'weight', kind: C, p: [
    ['abnehmen|uebergewicht*|untergewicht*|diaetfutter|zunehmen|moppelig|pummelig|overweight|adipositas', 1.5],
    ['zu ~1 dick|fett|duenn|mager|schwer', 1.4], ['gewicht|idealgewicht|figur', 0.9],
  ] },
  { id: 'payment', kind: C, p: [
    ['raten|ratenzahlung|teilzahlung|anzahlung|kartenzahlung|bankomat|zahlungsmoeglichkeit*|zahlungsart*|bar', 1.5], ['karte|bar|raten|bankomatkarte|kreditkarte ~2 zahlen|bezahlen', 1.5],
    ['zahlen|bezahlen ~3 karte|bar|raten|spaeter|teile', 1.5],
  ] },
  { id: 'insurance', kind: C, p: [
    ['versicherung*|versichert|tierversicherung|unfallversicherung|krankenversicherung|tierkrankenversicherung|haftpflicht*|kostenvoranschlag|kostenuebernahme|selbstbehalt|insurance', 1.6],
    ['rechnung ~3 einreichen|schicken|fuer', 1.3],
  ] },
  { id: 'secondopinion', kind: C, p: [['zweitmeinung', 2], ['zweite ~1 meinung', 2], ['andere ~1 praxis|meinung', 1.2], ['nochmal ~3 ansehen|anschauen|draufschauen', 1.0], ['second ~1 opinion', 2]] },
  { id: 'eyes', kind: C, p: [
    ['auge|augen|bindehaut*|traent|traenen|traenende|traenenden|trueb|truebe|lidkrampf|augenausfluss|blinzelt|zugekniffen|augenentzuendung|augenlid|eye|eyes', 1.4, 'recov'],
  ] },
  { id: 'skin', kind: C, p: [
    ['haut|juckreiz|juckt|schuppen|kahle|kahl|hotspot|allergie|allergisch|ekzem|pilz|hautpilz|milben|ausschlag|pusteln|haarausfall|raude|itchy|itching|rash', 1.4, 'recov'],
    ['kratzt|kratzen|leckt|beisst ~2 sich', 1.4, 'recov'], ['hot ~1 spot', 1.4], ['fell ~3 aus|stumpf|schuppig', 1.0],
  ] },
  { id: 'symptom', kind: C, p: [
    ['erbricht|erbrechen|erbrochen|erbrach|uebergibt|uebergeben|kotzt|kotzen|gekotzt|speibt|speim|speibn|gspieben|gespieben|spuckt|vomit*|throwing', 1.4, 'recov'],
    ['durchfall|durchfaelle|duennpfiff|duennschiss|scheisserei|diarrhea|diarrhoea|matschig|breiig|waessrig', 1.4, 'recov'],
    ['frisst|fressen|isst ~2 nicht|nichts|nix|kaum|schlecht|wenig|nimmer', 1.4, 'self'],
    ['will|mag ~2 nicht|nichts ~2 fressen|essen|trinken', 1.4, 'self'],
    ['appetitlos|appetitlosigkeit|futterverweigerung', 1.4], ['kein|keinen|wenig ~1 appetit', 1.4, 'self'],
    ['aufgehoert|aufhoert ~2 fressen|trinken|essen', 1.4, 'self'], ['nicht|nichts ~2 gegessen|gefressen|getrunken', 1.4, 'self'], ['nicht|nichts|kaum ~1 fressen|essen|trinken', 1.3, 'self'],
    ['trinkt ~2 nicht|nichts|nix|kaum', 1.4, 'self'], ['not ~1 eating|drinking', 1.4, 'self'],
    ['humpelt|hinkt|lahmt|lahm|hatscht|humpeln|hinken|lahmheit|limping|limp', 1.4, 'recov'],
    ['niest|niesen|hustet|husten|hustenanfall|schnupfen|nasenausfluss|cough*|sneez*|wuergt|wuergen', 1.3, 'recov'],
    ['apathisch|schlapp|muede|lustlos|matt|antriebslos|fieber|zittert|zittern|schmerz*|jault|winselt|schreit|lethargic', 1.2, 'recov'],
    ['schwellung|geschwollen|beule|knubbel|knoten|tumor|geschwulst|abszess|dellen', 1.3, 'recov'],
    ['wunde|verletzt|verletzung|schnitt|schnittwunde|kratzer|riss|blutet', 1.3, 'recov'], ['pfote ~2 blutet', 1.3],
    ['abgenommen|gewichtsverlust', 1.2], ['nimmt ~2 ab', 1.0], ['trinkt ~2 viel|staendig|sehr|mehr', 1.3],
    ['blut|blutig|blutiger', 1.0, 'recov'], ['pinkelt|uriniert ~2 oft|staendig|haeufig|daneben', 1.2],
    ['blasenentzuendung|harnwegsinfekt|nierenprobleme|niere|nieren|leber|zucker|diabetes|schilddruese', 1.1],
    ['ohr|ohren|ohrenentzuendung|kopfschuetteln|ohrmilben', 1.3, 'recov'], ['schuettelt ~2 kopf', 1.3],
    ['verstopfung|verstopft', 1.3], ['kotet ~2 nicht', 1.3, 'self'],
    ['krank|unwohl|sick|ill|komisch|ungewoehnlich|seltsam', 0.9], ['stimmt ~3 nicht', 0.9, 'self'],
    ['zecke|zecken ~3 kopf|steckt|entzuendet', 0.8],
  ] },
  { id: 'behaviour', kind: C, p: [
    ['beisst|beissen|aggressiv|aggression|unsauber|markiert|stubenrein|trennungsangst|verhalten*|zerstoert|knurrt|faucht|aengstlich|bellt|bellen|jagt', 1.3],
    ['pinkelt|kotet|macht ~3 wohnung|haus|ueberall|bett|teppich', 1.4], ['angst|panik', 0.8],
  ] },
  { id: 'pregnancy', kind: C, p: [
    ['traechtig|traechtigkeit|schwanger|deckakt|gedeckt|wurf|laeufig|laeufigkeit|rollig|scheinschwanger*|pregnant|geburtstermin', 1.5],
    ['welpen|kitten|junge ~2 bekommen|erwartet|kriegt', 0.8], ['geburt', 0.9],
  ] },
  { id: 'senior', kind: C, p: [
    ['senior*|vorsorge*|gesundheitscheck|checkup|blutbild|jahresuntersuchung|geriatr*|jahrescheck|vorsorgeuntersuchung', 1.3],
    ['alt|alter|alte|alten|aelter|aeltere|aelteren ~1 hund|katze|kater|tier|dame|herr|huendin', 1.2], ['check ~1 up', 1.2],
  ] },
  { id: 'activity', kind: C, p: [['wieder ~3 spazieren|laufen|springen|baden|toben|rennen|joggen|gassi|belasten|reiten|schwimmen', 1.6], ['wann ~4 spazieren|laufen|springen|baden|toben|rennen|gassi|reiten|schwimmen', 1.3]] },
  { id: 'recheck', kind: C, p: [
    ['nachkontrolle|kontrolltermin|nachsorge|nachuntersuchung|verbandswechsel|kontrolluntersuchung|faedenziehen', 1.6],
    ['faeden|faden ~2 ziehen', 1.7], ['verband ~2 wechseln', 1.6], ['kontrolle', 0.8], ['wie ~2 geht ~2 weiter', 1.0],
    ['spazieren ~2 gehen', 0.7],
  ] },
  { id: 'reschedule', kind: C, p: [
    ['verschieben|verlegen|absagen|stornieren|umbuchen|canceln|cancel|absage|reschedule', 2],
    ['kann|koennen|schaffe|schaffen ~3 nicht ~2 kommen', 2, 'self'], ['passt|geht|klappt ~3 nicht', 1.6, 'self'],
    ['anderen|neuen|spaeteren|frueheren ~1 termin', 1.6], ['lieber ~3 spaeter|frueher|anderen', 1.0],
  ] },
  { id: 'appointment', kind: C, p: [
    ['termin|terminvereinbarung|terminanfrage|appointment|zeitfenster|slot', 1.5],
    ['vorbeikommen|vorbeischauen|vorbeikomma|vorbeischaun', 1.3], ['vorbei ~1 kommen|schauen', 1.3],
    ['heute|morgen|diese|naechste|dieser ~3 zeit|frei|moeglich|platz|was', 1.1], ['wann ~3 zeit|frei|moeglich', 1.1],
    ['ansehen|anschauen|untersuchen|anschaun ~2 lassen', 0.9], ['kommen ~3 heute|morgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag', 0.9],
    ['untersuchung|durchsicht|durchchecken', 0.5],
  ] },
  { id: 'hours', kind: C, p: [
    ['oeffnungszeit*|oeffnungszeiten|geoeffnet|aufgesperrt|ordinationszeit*|sprechzeit*|opening', 1.6],
    ['haben|habt ~3 offen|auf|geoeffnet|zu', 1.3], ['sind|seid ~2 sie|ihr ~3 offen|da|erreichbar', 1.2],
    ['praxis|ordination ~3 offen|auf|zu|geoeffnet', 1.3], ['wann ~4 offen|auf|zu|oeffnen|schliessen|aufmachen|zumachen|oeffnet|schliesst', 1.2],
    ['bis ~1 wann', 0.7], ['open', 0.8],
  ] },
  { id: 'price', kind: C, p: [
    ['kosten|kostet|preis|preise|teuer|gebuehr*|honorar|tarif|tarife|price|cost|costs|euro|kostenpunkt|guenstig|billig|kostn', 1.5, 'any'],
    ['was|wieviel|viel ~3 zahlt|zahle|zahlen|bezahlen|kost', 1.2, 'any'],
  ] },
  { id: 'vaccination', kind: C, p: [['impf*|tollwut*|booster|auffrischung|auffrischungsimpfung|grundimmunisierung|vakzin*|vaccin*|shots', 1.5]] },
  { id: 'castration', kind: C, p: [['kastr*|kastration|kastrieren|sterilis*|neuter*|spay*', 1.6]] },
  { id: 'dental', kind: C, p: [
    ['zahn*|zaehne|zahnstein|maulgeruch|mundgeruch|zahnfleisch|zahnreinigung|zahnsanierung|gebiss|teeth|tooth|zahnwechsel', 1.5],
    ['futter ~3 faellt ~3 maul', 1.2],
  ] },
  { id: 'parasites', kind: C, p: [
    ['wurmkur|entwurm*|wuermer|wurm|bandwurm|spulwurm|lungenwurm|herzwurm*|floh|floehe|flohbefall|flohmittel|zecke|zecken|zeckenschutz|zeckenmittel|zeckenhalsband|parasit*|giardien|spot|spoton|deworm*|flea*|tick|ticks', 1.5],
  ] },
  { id: 'grooming', kind: C, p: [
    ['krallen*|kralle|fellpflege|scheren|schur|trimmen|buersten|verfilzt|filz*|hufe|hufpflege|krallenschneiden', 1.3],
    ['fell ~2 schneiden|kuerzen', 1.3], ['baden|bad', 0.9],
  ] },
  { id: 'nutrition', kind: C, p: [
    ['futter|fuettern|fuetterung|ernaehrung|diaet|barf|leckerli*|trockenfutter|nassfutter|futtermenge|futterumstellung|hundefutter|katzenfutter|food|feed', 1.3],
    ['darf|kann|duerfen ~5 essen|fressen|fuettern', 0.8], ['milch|reis|fleisch|gemuese|obst|karotte*|apfel|banane', 0.4],
  ] },
  { id: 'medication', kind: C, p: [
    ['medikament*|tablette*|pille*|dosis|dosierung|dosieren|schmerzmittel|antibiotik*|globuli|metacam|rimadyl|novalgin|metamizol|cortison|kortison|meloxicam|carprofen|previcox|onsior|entzuendungshemmer|salbe|spritze|medicine|medication|mg|ml|milligramm|beruhigungsmittel', 1.5],
    ['wieviel|viel ~4 geben|eingeben|verabreichen|dosieren', 1.2],
  ] },
  { id: 'travel', kind: C, p: [
    ['reise*|reisen|urlaub|ausland|heimtierausweis|heimtierpass|einreise*|flug|flugzeug|kroatien|italien|slowenien|ungarn|spanien|frankreich|griechenland|schweiz|england|grenze|travel|fliegen|tierpass', 1.4],
    ['eu', 0.8], ['mitnehmen', 0.5],
  ] },
  { id: 'address', kind: C, p: [
    ['adresse|anschrift|anfahrt|parkplatz|parkplaetze|parken|route|navi|navigation|haltestelle|address', 1.6],
    ['wo ~3 finde|sind|seid|liegt|praxis|euch|ihnen', 1.4], ['wie ~2 komme|kommen|finde ~3 zu|hin|euch|ihnen', 1.4], ['where', 1.0],
  ] },
  { id: 'housecall', kind: C, p: [['hausbesuch*|hausbesuche|homevisit', 2], ['kommen|kommt ~3 zu ~1 uns|mir', 1.4], ['nach ~1 hause ~2 kommen', 1.4], ['mobil|mobile', 0.8]] },
  { id: 'contact', kind: C, p: [
    ['telefonnummer|nummer|rufnummer|telefonisch|phone|whatsapp|email|mail', 1.3], ['anrufen|telefonieren|erreiche|erreichen', 0.9],
  ] },
  { id: 'botinfo', kind: C, p: [['bist|sind ~2 sie|du ~3 bot|roboter|ki|mensch|computer|maschine|echt', 1.8], ['chatbot|bot', 1.0]] },
  { id: 'complaint', kind: C, p: [
    ['nicht ~2 toll|zufrieden|schoen|okay|gut|freundlich', 1.0, 'self'],
    ['enttaeuscht|aergerlich|unzufrieden|beschwerde|frechheit|unfreundlich|unverschaemt|sauer|veraergert', 1.4],
  ] },
  { id: 'recovery', kind: C, p: [
    ['frisst|trinkt|laeuft|spielt|springt|geht|kotet|pinkelt|isst|tobt ~2 wieder', 1.5],
    ['wieder ~2 gut|normal|besser|fit|munter|top|gesund|ganz|fitter|aktiv|topfit|ok|okay|beim|alte', 1.5],
    ['geht ~3 besser|gut', 1.2], ['besser ~1 geworden', 1.2], ['deutlich|viel|schon|etwas ~1 besser', 1.2],
    ['erholt|beschwerdefrei|symptomfrei|geheilt|abgeklungen|verheilt|ueberstanden', 1.5],
    ['alles ~2 gut|ok|okay|paletti|bestens', 1.0], ['alles ~1 in ~1 ordnung', 1.0],
    ['nicht ~2 mehr ~2 schlimm', 1.2, 'self'],
    ['ausschlag|schwellung|durchfall|husten|juckreiz|beule|roetung|symptome|erbrechen|fieber ~3 verschwunden|weg|abgeklungen|aufgehoert|vorbei', 1.5],
  ] },
  // ---- soziale Anliegen (nur, wenn nichts Inhaltliches erkannt wurde) ----
  { id: 'greeting', kind: S, p: [
    ['hallo|hi|hey|servus|gruess|gruezi|moin|hello|griass|griasdi|mahlzeit|huhu|heyho|hallihallo|grias', 1.2],
    ['guten ~1 morgen|tag|abend', 1.2], ['gruess ~1 gott|sie|dich', 1.2],
  ] },
  { id: 'thanks', kind: S, p: [
    ['danke|dankeschoen|merci|thanks|thank|thx|dankschoen|vergelts|dankesehr', 1.4], ['vielen|herzlichen|lieben|besten ~1 dank', 1.4],
  ] },
  { id: 'bye', kind: S, p: [
    ['tschuess|tschuss|tschau|ciao|baba|pfiat|wiedersehen|wiederhoeren|bye|lg|servas', 1.4],
    ['bis ~1 bald|dann|morgen|spaeter|gleich', 1.2], ['schoenen ~2 tag|abend|wochenende|sonntag', 1.3], ['liebe|viele|beste ~1 gruesse', 1.3],
  ] },
  { id: 'ack', kind: S, p: [
    ['ok|okay|oki|verstanden|passt|jo|alright|fein|aha|achso|jawohl|ja|gut|super|prima|perfekt|toll|genau|klar|einverstanden', 1.0],
    ['alles ~1 klar', 1.0], ['in ~1 ordnung', 1.0],
  ] },
];

/* ---- Tierhalter:in-Persona (Bot spielt die Tierhalterin im Praxis-Posteingang) ---- */
export const OWNER_INTENTS = [
  { id: 'o-notemergency', kind: C, p: [['kein|keinen ~1 notfall', 2.2, 'self'], ['nicht ~1 dringend', 2.2, 'self'], ['kein ~1 grund ~2 sorge', 2, 'self']] },
  { id: 'o-comenow', kind: C, p: [
    ['kommen|kommt ~3 sofort|gleich|direkt|umgehend|jetzt|schnell', 2], ['sofort|umgehend|schnellstmoeglich ~3 vorbei|kommen|herkommen|vorbeikommen|losfahren', 2],
    ['fahren ~2 sie|ihr ~2 los', 2], ['notfall|dringend', 0.6],
  ] },
  { id: 'o-canyoucome', kind: C, p: [['vorbeibringen|vorbeikommen|herbringen|herkommen|vorbeischauen|reinschauen', 1.5], ['kommen|bringen ~4 heute|morgen|nachmittag|vormittag|nochmal', 1.2]] },
  { id: 'o-calloffer', kind: C, p: [['rufen|melden ~3 an|sich', 1.6], ['bei ~2 fragen', 1.0]] },
  { id: 'o-howis', kind: C, p: [['wie ~1 geht|gehts|laeuft', 1.8], ['geht ~3 besser', 1.4], ['gebessert|verbessert|besserung', 1.0]] },
  { id: 'o-since', kind: C, p: [['seit ~1 wann', 2], ['wie ~1 lange ~2 schon', 1.8], ['wann ~3 angefangen|begonnen|zuletzt', 1.6]] },
  { id: 'o-eating', kind: C, p: [['frisst|trinkt|appetit|gefressen|getrunken|fressen|trinken|futter|isst', 1.4, 'any']] },
  { id: 'o-slotoffer', kind: C, p: [
    ['passt|passen ~2 ihnen|euch|es', 1.6], ['termin|terminvorschlag|uhr|vormittag|nachmittag', 1.2], ['haetten|haben ~3 zeit|frei', 1.2],
  ] },
  { id: 'o-noslot', kind: C, p: [['kein|keinen ~2 termin|platz ~2 frei|mehr', 2.2, 'self'], ['ausgebucht|voll|belegt', 1.8]] },
  { id: 'o-price', kind: C, p: [['kostet|kosten|euro|preis|rechnung|kostenvoranschlag|zahlen|betrag|eur', 1.5, 'any']] },
  { id: 'o-docs', kind: C, p: [['impfpass|mitbringen|unterlagen|befunde|papiere|heimtierausweis|versicherungskarte', 1.6]] },
  { id: 'o-fasting', kind: C, p: [['nuechtern', 2], ['nichts|nicht|kein ~2 fuettern|futter|fressen', 1.2, 'self']] },
  { id: 'o-meds', kind: C, p: [['tablette*|medikament*|eingeben|tropfen|salbe|spritze|antibiotik*|kapsel*', 1.6, 'any'], ['geben ~2 sie', 1.0]] },
  { id: 'o-rest', kind: C, p: [['leine|schonen|schonung|ruhe|boxenruhe|ruhig|toben', 1.6, 'any'], ['nicht ~2 springen|baden|laufen', 1.6, 'self']] },
  { id: 'o-exam', kind: C, p: [['roentgen*|blutbild|blutabnahme|labor|ultraschall|untersuchung|ct|mrt|biopsie|test', 1.4, 'any'], ['wuerden|moechten|sollten ~4 machen', 0.8]] },
  { id: 'o-resultok', kind: C, p: [['unauffaellig|negativ|bestens|ohne ~1 befund', 2.2, 'any'], ['alles ~2 ordnung|gut|normal', 1.8], ['gute ~1 nachrichten|nachricht', 2]] },
  { id: 'o-resultbad', kind: C, p: [['leider ~4 befund|ergebnis|auffaellig|nicht|positiv|bruch|gebrochen|tumor|entzuendung|infektion', 2, 'any'], ['auffaellig|erhoeht|entzuendung|bruch|fraktur|tumor', 1.2]] },
  { id: 'o-vaccstatus', kind: C, p: [['geimpft|impfung|impfschutz|tollwut*|impfstatus', 1.6, 'any']] },
  { id: 'o-operation', kind: C, p: [['operation|operieren|op|eingriff|narkose', 1.4]] },
  { id: 'o-bye', kind: S, p: [['gute ~1 heimfahrt|besserung|nacht', 2], ['kommen ~3 gut ~2 hause|heim', 2], ['schoenen|schoenes ~2 tag|abend|wochenende', 1.6], ['bis ~1 bald|dann|morgen', 1.4], ['tschuess|wiedersehen|wiederhoeren', 1.6]] },
  { id: 'o-greeting', kind: S, p: [['hallo|guten|gruess|servus|hi', 1.2], ['hier ~1 ist|spricht', 1.6]] },
  { id: 'o-thanks', kind: S, p: [['danke|dankeschoen|vielen', 1.4]] },
];

/* ---- Kolleg:innen-Persona (andere Praxis im Netzwerk-Chat) ---- */
export const COLLEAGUE_INTENTS = [
  { id: 'c-transfer', kind: C, p: [
    ['ueberweisen|ueberweisung|uebernehmen|uebernehmt|schicken|rueberschicken|abgeben|zuweisen|zuweisung', 1.6, 'any'],
    ['patient|patientin|patienten|fall', 1.0], ['zu ~1 euch|ihnen', 1.0],
  ] },
  { id: 'c-opslot', kind: C, p: [['opfenster|optermin|opzeit|operieren|kapazitaet|kapazitaeten|oplan', 1.8], ['op ~2 fenster|termin|slot|frei|zeit', 1.8], ['frei|platz ~3 op', 1.4]] },
  { id: 'c-records', kind: C, p: [
    ['befund|befunde|roentgen*|bilder|laborwerte|labor|akte|unterlagen|krankengeschichte|anamnese|pdf|datei|ultraschallbilder|werte', 1.5, 'any'],
    ['per ~1 mail|email', 1.4], ['zuschicken|geschickt|schicken|gesendet|senden|mailen', 0.8, 'any'],
  ] },
  { id: 'c-coverage', kind: C, p: [
    ['notdienst|vertretung|urlaub|betriebsurlaub|bereitschaft|dienstplan|feiertage', 1.4, 'any'], ['dienst ~2 tauschen', 1.6],
    ['wochenende|feiertag ~5 uebernehmen|dienst|notfall|notfaelle|vertreten|bereitschaft|offen|da|aushelfen', 1.4, 'any'],
  ] },
  { id: 'c-supply', kind: C, p: [['aushelfen|leihen|impfstoff|impfstoffe|vorrat|lieferengpass|nachschub|ampullen|medikament*|narkosemittel|blutkonserve*', 1.6, 'any']] },
  { id: 'c-consult', kind: C, p: [
    ['meinung|einschaetzung|zweitmeinung|rat|idee|ideen|erfahrung|erfahrungen|kniffliger|knifflig|konsil', 1.4, 'any'], ['was ~2 meint|denkt|haltet', 1.6],
  ] },
  { id: 'c-equipment', kind: C, p: [['geraet|ultraschall|ct|mrt|endoskop|endoskopie|roentgengeraet|narkosegeraet', 1.2, 'any']] },
  { id: 'c-thanks', kind: S, p: [['danke|dankeschoen|merci|vielen', 1.4]] },
  { id: 'c-greeting', kind: S, p: [['hallo|servus|hi|gruess|moin|liebe|kolleg*', 1.2], ['guten ~1 morgen|tag|abend', 1.2]] },
  { id: 'c-bye', kind: S, p: [['tschuess|baba|pfiat|ciao|gruesse|lg', 1.4], ['bis ~1 bald|dann|montag', 1.2], ['schoenes|schoenen ~2 wochenende|tag|abend', 1.4]] },
];

/* ---- Häufige Irrtümer: werden höflich richtiggestellt (Texte in responses.de.js).
   Früher Regexe mit verschachteltem .* (Audit: 18 s bei 18k Zeichen) — jetzt Wortfolgen. ---- */
export const MYTHS = [
  { key: 'indoorvacc', p: [['braucht|brauchen|muss|muessen|sollte|sollen ~4 wohnungskatze*|wohnungskater|hauskatze|indoor ~4 impf*|impfung', 1, 'sent'], ['wohnungskatze|wohnungskatzen|wohnungskater|hauskatze|indoor ~6 keine|nicht|unnoetig|sinnlos|braucht|brauchen|muss ~4 impf*|impfung', 1, 'sent'], ['impf* ~6 wohnungskatze*|wohnungskater', 1, 'sent']], need: 'keine|nicht|unnoetig|sinnlos|braucht|brauchen|muss|oder|wirklich' },
  { key: 'milk', p: [['katze|kater|kaetzchen|kitten|katzen|mieze ~6 milch|kuhmilch', 1, 'sent'], ['milch|kuhmilch ~6 katze|kater|kaetzchen|kitten|katzen', 1, 'sent']] },
  { key: 'bones', p: [['knochen ~5 fuettern|geben|fressen|gut|kauen|gekocht|gekochte|gekochten|erlaubt|essen', 1, 'sent'], ['fuettern|geben ~4 knochen', 1, 'sent']] },
  { key: 'nose', p: [['warme|trockene|heisse ~1 nase', 1], ['nase ~3 warm|trocken|heiss', 1, 'sent']] },
  { key: 'colors', p: [['schwarz ~1 weiss', 1], ['farbenblind', 1], ['farben ~3 sehen', 1]] },
  { key: 'grass', p: [['gras ~2 fressen|frisst|gefressen|frass|essen', 1], ['frisst|fressen ~2 gras', 1]] },
  { key: 'litter', p: [['einmal|ein ~6 wurf|werfen|welpen|jungen|nachwuchs|junge', 1, 'sent']], need: 'gesund|gut|besser|sollte|muss|soll|wichtig|einmal' },
  { key: 'bitpoison', p: [['bisschen|etwas|wenig|stueckchen|kleines|klein|bissl|paar ~4 schokolad*|schoko*|zwiebel*|traube*|trauben|rosine* ~4 schadet|macht|geht|ok|okay|schlimm', 1, 'sent'], ['schokolad*|trauben|traube*|zwiebel* ~3 schadet ~2 nicht', 1, 'sent']] },
  { key: 'neuterfat', p: [['kastr* ~6 dick|fett|zunehmen|uebergewicht|figur', 1, 'sent'], ['dick|fett ~6 kastr*', 1, 'sent']] },
  { key: 'ticksummer', p: [['zecke*|floh|floehe|zeckenschutz ~6 nur ~2 sommer|warm|waerme', 1, 'sent'], ['winter ~4 keine|nicht|kein ~3 zecke*|zeckenschutz|floh', 1, 'sent']] },
  { key: 'catsland', p: [['katzen|katze ~6 landen|fallen ~3 fuesse|pfoten|immer|nie', 1, 'sent'], ['neun|sieben ~1 leben', 1]] },
  { key: 'garlic', p: [['knoblauch ~6 zecke*|floh|floehe|parasit*|wurm|wuermer|gegen', 1, 'sent']] },
  { key: 'alone', p: [['kaninchen|meerschweinchen|meeris ~6 allein|einzeln|alleine|einzelhaltung', 1, 'sent']] },
  { key: 'purr', p: [['schnurrt|schnurren ~5 gesund|gluecklich|immer|zufrieden|gut', 1, 'sent']] },
];

/* ---- Kompilieren (einmal beim Laden) ---- */
function compileDefs(defs) {
  return defs.map((d) => ({
    ...d,
    id: d.id || d.key,
    cp: d.p.map((e) => ({ src: e[0], els: compilePattern(e[0]), w: e[1], flags: e[2] || '' })),
    needEls: d.need ? compilePattern(d.need) : null,
  }));
}
export const C_INTENTS = compileDefs(INTENTS);
export const C_OWNER = compileDefs(OWNER_INTENTS);
export const C_COLLEAGUE = compileDefs(COLLEAGUE_INTENTS);
// Mythen sind oft selbst verneint („braucht keine Impfung") — dort ist die Verneinung der Inhalt
export const C_MYTHS = compileDefs(MYTHS.map((d) => ({ ...d, p: d.p.map((e) => [e[0], e[1], (e[2] || '') + ' any']) })));

/* Alle Begriffe (für den gemeinsamen Index). */
export function intentKeys() {
  const keys = [];
  for (const list of [C_INTENTS, C_OWNER, C_COLLEAGUE, C_MYTHS]) {
    for (const d of list) {
      for (const c of d.cp) for (const el of c.els) for (const a of el.alts) keys.push(a);
      if (d.needEls) for (const el of d.needEls) for (const a of el.alts) keys.push(a);
    }
  }
  return keys;
}

/* Bewertung: je Muster zählt der beste Treffer einmal. Verneinte Treffer zählen nicht; mit Flag
   'recov' und „mehr" in der Nähe werden sie als Entwarnung gebucht. */
export function scoreDefs(an, defs) {
  const scores = {};
  const matched = [];
  let recovery = 0;
  for (const d of defs) {
    let total = 0;
    for (const c of d.cp) {
      const scope = c.flags.indexOf('sent') >= 0 ? 'sentence' : 'clause';
      const ms = findAll(c.els, an, scope);
      let best = 0;
      for (const m of ms) {
        const self = c.flags.indexOf('self') >= 0 || c.flags.indexOf('any') >= 0;
        const neg = !self && isNegated(an, m);
        if (neg) {
          if (c.flags.indexOf('recov') >= 0 && hasMehrNear(an, m)) recovery = Math.max(recovery, 1.5);
          matched.push({ intent: d.id, text: matchText(an, m), negated: true });
          continue;
        }
        const v = c.w * m.q;
        if (v > best) best = v;
        matched.push({ intent: d.id, text: matchText(an, m), q: m.q });
      }
      total += best;
    }
    if (total > 0 && d.needEls) {
      // „need": ein Signalwort muss im selben Text vorkommen (z. B. Mythos nur bei Zweifel/Verneinung)
      let ok = false;
      for (const el of d.needEls) for (const a of el.alts) if (an.pos.has(a)) ok = true;
      if (!ok) total = 0;
    }
    if (total > 0) scores[d.id] = Math.round(total * 100) / 100;
  }
  if (recovery > 0) scores.recovery = Math.round(((scores.recovery || 0) + recovery) * 100) / 100;
  return { scores, matched };
}

function hasMehrNear(an, m) {
  const c = an.toks[m.start].c;
  for (let i = Math.max(0, m.start - 3); i <= Math.min(an.toks.length - 1, m.end + 3); i++) {
    const t = an.toks[i];
    if (t.c === c && (t.t === 'mehr' || t.t === 'nimmer' || t.t === 'anymore')) return true;
  }
  return false;
}

/* Rangfolge bei Gleichstand = Reihenfolge in INTENTS (spezifischere Anliegen stehen vorne). */
export function rank(scores, defs) {
  const order = {};
  defs.forEach((d, i) => { order[d.id] = i; });
  return Object.keys(scores)
    .map((id) => ({ intent: id, score: scores[id], kind: (defs.find((d) => d.id === id) || {}).kind || C }))
    .sort((a, b) => (b.score - a.score) || ((order[a.intent] ?? 99) - (order[b.intent] ?? 99)));
}

export const THRESHOLD = 0.7;
