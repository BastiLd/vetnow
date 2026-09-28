// GENERIERT aus vetnow-app/shared — nicht hier bearbeiten (npm run sync:shared)
/* Bot 3.0 — alle Antworttexte der Praxis-Persona (Deutsch, Sie-Form, warm und kurz).

   Übernommen aus Bot 2.2 (Varianten, Tierart-Zusätze, Mythen), aber mit den Korrekturen aus dem Audit:
   - KEINE Zustimmung zu Medikamenten-/Futter-/Giftfragen („ja, das ist grundsätzlich möglich" ist weg).
   - Notfall-Antworten beginnen IMMER mit der Handlungsaufforderung (sofort anrufen / losfahren) und
     nennen die Telefonnummer der Praxis, wenn bekannt. Ist die Praxis nicht grün/24h, kommt der
     Hinweis auf den nächsten 24h-Notdienst (practice.fallbackEmergency).
   - Erste Hilfe passend zur Ursache: Hitzschlag = langsam mit lauwarmem Wasser im Schatten kühlen
     (NIE „warm halten"); Gift = KEIN Erbrechen auslösen, Verpackung mitnehmen.
   - Öffnungszeiten, Telefon und Preise kommen aus facts.js statt fest verdrahtet.
   - Keine Dosierungen, keine Ferndiagnosen.
   Jede Funktion bekommt ctx (siehe index.js → makeCtx) und liefert { texts, asked?, offer? }. */
import { PRICES, PRICE_NOTE, priceSubjects, hoursSummary, dayHours, weekdayOf, DAYS_LONG, DAYS_FOLD } from './facts.js';

/* ---------- Tierart-Zusätze (aus Bot 2.2) ---------- */
export const SPECIES_HINT = {
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
    small: 'Bei Kleintieren ist Heu die Grundlage — jeden Tag reichlich und frisch.',
    horse: 'Bei Pferden schauen wir uns Raufutter-Menge und Fresspausen genau an.',
    bird: 'Reine Körnermischungen führen oft zu Mangel — wir besprechen gern eine passende Ergänzung.',
    exotic: 'Bei Reptilien hängt fast alles an Beleuchtung, UV und Kalzium — das gehen wir gemeinsam durch.',
  },
  dental: {
    cat: 'Bei Katzen sehen wir außerdem oft schmerzhafte Zahnhalsläsionen — die erkennt man nur im Röntgen.',
    dog: 'Bei Hunden kontrollieren wir zusätzlich die Backenzähne, dort sitzt der Zahnstein meist am stärksten.',
    small: 'Bei Kaninchen und Meerschweinchen wachsen die Zähne lebenslang — Backenzahnspitzen sind eine häufige Ursache fürs Nichtfressen.',
    horse: 'Beim Pferd steht die jährliche Zahnkontrolle an — Haken an den Backenzähnen sind häufig.',
  },
  parasites: {
    cat: 'Bei Freigänger-Katzen empfehlen wir die Entwurmung etwa viermal im Jahr, bei reinen Wohnungskatzen deutlich seltener.',
    dog: 'Für Hunde gibt es Tabletten oder Spot-ons — welches Mittel passt, hängt von Gewicht und Lebensstil ab.',
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

/* Stoffnamen in der Mehrzahl („Trauben und Rosinen sind …") */
const PLURAL = { grapes: 1, allium: 1, macadamia: 1, nsaid: 1, drug: 1, lily: 1, plant: 1 };

const SPECIES_PLURAL = { dog: 'Hunde', cat: 'Katzen', small: 'Kleintiere', horse: 'Pferde', bird: 'Vögel', exotic: 'Reptilien' };

/* ---------- Erste Hilfe je Notfall-Ursache ---------- */
export const FIRST_AID = {
  heat: 'Bei Hitzschlag: sofort in den Schatten, mit lauwarmem (nicht eiskaltem) Wasser langsam kühlen — Pfoten, Bauch und Leisten. Wasser anbieten, aber nicht einflößen; während der Fahrt Fenster öffnen oder Klimaanlage an.',
  poison: 'Bitte KEIN Erbrechen selbst auslösen und nichts eingeben — auch keine Milch oder Hausmittel. Nehmen Sie Verpackung oder Reste mit.',
  breathing: 'Bitte Halsband und Geschirr abnehmen, das Maul nicht zuhalten und ruhig bleiben. Unterwegs für frische Luft sorgen, nicht auf den Rücken legen.',
  shock: 'Bitte ruhig und flach transportieren, Kopf nicht höher als den Körper lagern und nichts eingeben.',
  collapse: 'Bitte Atemwege freihalten (Halsband ab), in stabiler Seitenlage ruhig transportieren und nichts eingeben.',
  neuro: 'Bitte möglichst flach und ohne Verdrehen der Wirbelsäule transportieren, z. B. auf einem Brett oder einer festen Decke.',
  seizure: 'Während eines Krampfes bitte nicht festhalten und nichts ins Maul geben — Gegenstände wegräumen, Raum abdunkeln und die Dauer auf die Uhr schauen.',
  bleeding: 'Drücken Sie ein sauberes Tuch oder eine Kompresse fest auf die Blutung und halten Sie den Druck bis zu uns.',
  trauma: 'Bitte möglichst flach und ruhig transportieren (z. B. auf einer Decke als Trage) — auch wenn äußerlich wenig zu sehen ist, innere Verletzungen sind häufig.',
  fall: 'Bitte möglichst flach und ruhig transportieren (z. B. in einer Box oder auf einer Decke) — nach Stürzen sind innere Verletzungen häufig, auch wenn das Tier wieder aufsteht.',
  bloat: 'Bitte nichts füttern oder trinken lassen und nicht mehr spazieren gehen — eine Magendrehung wird innerhalb weniger Stunden lebensgefährlich.',
  colic: 'Bitte Futter wegnehmen. Wenn es gefahrlos geht, im Schritt führen und auf sich selbst achten, falls sich das Pferd heftig wälzt.',
  urinary: 'Ein Harnverhalt ist lebensgefährlich — bitte nicht bis morgen warten und nicht auf den Bauch drücken.',
  heat_urgent: 'Bei Hitze bitte sofort in den Schatten bringen und mit lauwarmem Wasser langsam kühlen — nicht eiskalt.',
  snake: 'Bitte ruhig halten und nach Möglichkeit tragen statt laufen lassen. Die Bissstelle nicht aufschneiden, nicht aussaugen und nichts abbinden.',
  allergy: 'Bei Schwellungen an Kopf, Maul oder Hals kann die Atmung eng werden — bitte nicht abwarten. Einen sichtbaren Stachel vorsichtig wegstreichen, nicht quetschen.',
  electric: 'Erst den Strom abschalten, dann das Tier anfassen. Auch wenn es danach munter wirkt: Probleme an der Lunge kommen oft erst Stunden später.',
  foreign: 'Bitte kein Erbrechen auslösen und nichts füttern — Fremdkörper können dabei mehr Schaden anrichten. Nicht selbst an Fäden oder Schnüren ziehen.',
  birth: 'Bitte notieren Sie, seit wann die Wehen bzw. das Pressen laufen und wann das letzte Junge kam — und transportieren Sie die Mutter ruhig.',
  eye: 'Bitte das Auge mit einem sauberen, feuchten Tuch schützen und nicht reiben lassen — nichts eintropfen.',
  generic: 'Bitte ruhig und sicher transportieren und nichts eingeben.',
};

/* Gift-Details (Frage- und Notfallantwort) */
export const POISON_INFO = {
  choco: 'Das enthaltene Theobromin können Hunde und Katzen kaum abbauen — je dunkler die Schokolade, desto gefährlicher.',
  grapes: 'Schon wenige Trauben oder Rosinen können bei manchen Hunden ein Nierenversagen auslösen — die Menge ist nicht vorhersehbar.',
  allium: 'Zwiebeln und Knoblauch schädigen die roten Blutkörperchen — roh, gekocht und als Pulver.',
  xylit: 'Xylit (Birkenzucker, oft in zuckerfreiem Kaugummi) löst bei Hunden schon in kleinen Mengen eine gefährliche Unterzuckerung aus.',
  avocado: 'Der Inhaltsstoff Persin ist für viele Tiere gefährlich — besonders für Vögel, Kaninchen und Pferde.',
  macadamia: 'Macadamianüsse führen bei Hunden zu Schwäche, Zittern und Fieber.',
  alcohol: 'Alkohol wirkt bei Tieren schon in kleinen Mengen stark und gefährlich.',
  caffeine: 'Koffein (Kaffee, Energydrinks) ist für Tiere giftig und belastet Herz und Nerven.',
  dough: 'Roher Hefeteig geht im Magen auf und bildet dabei Alkohol — beides ist gefährlich.',
  rat: 'Rattengift stört die Blutgerinnung — Beschwerden kommen oft erst nach Tagen, behandelt werden muss aber sofort.',
  bait: 'Bei Giftködern weiß man nie, was drin ist — deshalb gilt immer: sofort behandeln lassen.',
  gift: 'Bei Verdacht auf eine Vergiftung zählt jede Minute.',
  slug: 'Schneckenkorn kann schwere Krämpfe auslösen — auch kleine Mengen sind gefährlich.',
  antifreeze: 'Frostschutzmittel schmeckt süß und ist lebensgefährlich für die Nieren — hier zählt jede Minute.',
  chem: 'Reinigungs- und Pflanzenschutzmittel können Verätzungen und Vergiftungen verursachen.',
  teatree: 'Teebaumöl und andere ätherische Öle sind besonders für Katzen giftig — auch über die Haut.',
  nsaid: 'Schmerzmittel aus der Humanmedizin wie Ibuprofen, Paracetamol oder Aspirin sind für Tiere giftig — Paracetamol ist für Katzen schon in kleinsten Mengen lebensgefährlich. Schmerzmittel bekommt Ihr Tier bitte nur von uns, passend zur Untersuchung.',
  drug: 'Medikamente für Menschen können für Tiere schon in kleinen Mengen gefährlich sein.',
  lily: 'Für Katzen sind alle Teile der Lilie giftig — schon Pollen, die sie sich aus dem Fell lecken, können die Nieren schädigen.',
  plant: 'Viele Zier- und Gartenpflanzen sind für Tiere giftig.',
  nicotine: 'Nikotin (Zigaretten, Kippen, Nikotinkaugummi, Liquids) ist für Tiere hochgiftig.',
  cannabis: 'Cannabis ist für Tiere giftig und führt zu Taumeln, Unterkühlung und im schlimmsten Fall zu Bewusstlosigkeit.',
  vomit: 'Salzwasser, Senf oder der Finger im Hals können gefährlicher sein als das Gift selbst.',
};

/* ---------- Häufige Irrtümer (Texte aus Bot 2.2 + neue) ---------- */
export const MYTH_TEXTS = {
  indoorvacc: ['Das ist ein weit verbreiteter Irrtum — auch reine Wohnungskatzen sollten geimpft sein.', 'Katzenschnupfen- und Seuche-Erreger tragen wir selbst an Schuhen und Kleidung herein. Der Impfschutz ist bei Wohnungskatzen nur etwas schlanker als bei Freigängern, ganz weglassen sollte man ihn nicht.'],
  milk: ['Kuhmilch ist für die meisten erwachsenen Katzen leider nicht geeignet — sie können den Milchzucker nicht abbauen, das führt oft zu Durchfall.', 'Frisches Wasser ist immer die beste Wahl. Spezielle laktosefreie Katzenmilch wäre höchstens eine seltene Leckerei.'],
  bones: ['Bei Knochen bin ich vorsichtig: Gekochte oder gebratene Knochen splittern und können den Darm ernsthaft verletzen — die bitte nie füttern.', 'Ob rohe, fleischige Knochen für Ihr Tier infrage kommen, hängt von Alter und Gebiss ab — das besprechen wir gern persönlich.'],
  nose: ['Die warme oder trockene Nase ist tatsächlich kein verlässliches Krankheitszeichen — sie schwankt über den Tag völlig normal.', 'Aussagekräftiger sind Fressverhalten, Trinkmenge, Aktivität und Atmung. Wenn davon etwas auffällig ist, schauen wir gern nach.'],
  colors: ['Kleiner Irrtum, den viele kennen: Hunde und Katzen sehen nicht schwarz-weiß, sondern eingeschränkt farbig — Blau und Gelb erkennen sie gut, Rot dagegen kaum.', 'Dafür sehen sie bei Dämmerung deutlich besser als wir und nehmen Bewegungen viel schneller wahr.'],
  grass: ['Grasfressen allein ist meist harmlos und kein sicheres Zeichen für Übelkeit — viele Tiere machen das einfach gern.', 'Auffällig wird es erst, wenn Ihr Tier danach regelmäßig erbricht oder sehr gierig große Mengen frisst. Kommt das öfter vor, schauen wir es uns an.'],
  litter: ['Das hört man oft, es stimmt aber nicht: Ein Wurf „für die Gesundheit" bringt medizinisch keinen Vorteil.', 'Im Gegenteil — eine frühzeitige Kastration senkt bei Hündinnen das Risiko für Gesäugetumore deutlich. Gern besprechen wir, was für Ihr Tier sinnvoll ist.'],
  bitpoison: ['Da muss ich widersprechen: Auch kleine Mengen können je nach Körpergewicht schon gefährlich sein — bei Schokolade zählt der Kakaoanteil, bei Trauben ist die Menge gar nicht vorhersehbar.', 'Wenn tatsächlich etwas gefressen wurde, rufen Sie uns bitte sofort an und nennen Sie Menge, Sorte und Zeitpunkt. Abwarten ist hier die schlechteste Option.'],
  neuterfat: ['Halb richtig: Nach der Kastration sinkt der Energiebedarf spürbar, dick wird davon aber niemand automatisch.', 'Wenn man die Futtermenge nach dem Eingriff anpasst und regelmäßig wiegt, bleibt das Gewicht stabil. Wir helfen Ihnen gern mit einem konkreten Plan.'],
  ticksummer: ['Das galt früher einmal — inzwischen sind Zecken schon ab etwa 7 Grad aktiv, also auch an milden Wintertagen.', 'Deshalb empfehlen wir den Schutz mittlerweile fast ganzjährig. Wie es bei Ihrem Tier konkret aussieht, besprechen wir gern.'],
  catsland: ['Leider ein gefährlicher Mythos: Katzen drehen sich im Fall zwar geschickt, verletzen sich bei Stürzen aus dem Fenster aber trotzdem schwer.', 'Wir sehen das jedes Frühjahr, wenn die Fenster wieder aufgehen. Kippfenster sind besonders riskant — Schutznetze verhindern das zuverlässig.'],
  garlic: ['Bitte nicht: Knoblauch schützt nicht zuverlässig vor Zecken oder Würmern — und er ist für Hunde und Katzen giftig, weil er die roten Blutkörperchen schädigt.', 'Für einen wirksamen Parasitenschutz beraten wir Sie gern zu geeigneten Mitteln für Ihr Tier.'],
  alone: ['Kaninchen und Meerschweinchen sind sehr soziale Tiere — allein gehalten leiden sie, auch wenn man es ihnen nicht ansieht.', 'Am besten hält man sie mindestens zu zweit mit Artgenossen. Bei der Vergesellschaftung helfen wir gern.'],
  purr: ['Schnurren bedeutet nicht immer Wohlbefinden — Katzen schnurren auch, wenn sie Schmerzen haben oder gestresst sind.', 'Wenn Ihre Katze viel schnurrt, sich aber zurückzieht oder schlecht frisst, schauen wir sie uns lieber einmal an.'],
};

/* ---------- Helfer ---------- */
function hint(ctx, intent) {
  const m = SPECIES_HINT[intent];
  return (m && ctx.species && m[ctx.species]) || '';
}

export function telPart(ctx) {
  return ctx.facts.phone ? ' (Tel. ' + ctx.facts.phone + ')' : '';
}

function fallbackHint(ctx) {
  const f = ctx.facts;
  if (!f.fallback || f.is24h || !f.status || f.status === 'green') return '';
  const tel = f.fallback.phone ? ' (Tel. ' + f.fallback.phone + ')' : '';
  if (f.status === 'red') return ' Wir sind heute leider nicht erreichbar — bitte wenden Sie sich direkt an ' + f.fallback.name + tel + ', dort ist rund um die Uhr Notdienst.';
  return ' Falls wir nicht sofort abheben: ' + f.fallback.name + tel + ' hat rund um die Uhr Notdienst.';
}

/* ---------- Notfall ---------- */
export function emergencyReply(ctx, tri) {
  const tel = telPart(ctx);
  const fb = fallbackHint(ctx);
  const f = ctx.facts;
  const redNoFallback = f.status === 'red' && !f.is24h && !f.fallback;
  let cta = ctx.pick([
    `Das klingt nach einem Notfall — bitte rufen Sie SOFORT an${tel} und fahren Sie los. Warten Sie nicht ab.`,
    `Bitte nicht abwarten: Rufen Sie jetzt sofort an${tel} und kommen Sie direkt — wir bereiten alles vor.`,
    `Das ist dringend! Bitte sofort anrufen${tel} und losfahren — wir nehmen ${ctx.T} gleich dran.`,
    `Das gehört sofort angesehen. Bitte rufen Sie jetzt an${tel} und machen Sie sich sofort auf den Weg.`,
  ]);
  if (f.status === 'red' && f.fallback && !f.is24h) {
    const ftel = f.fallback.phone ? ' (Tel. ' + f.fallback.phone + ')' : '';
    cta = `Das klingt nach einem Notfall — bitte fahren Sie SOFORT zu ${f.fallback.name}${ftel} und rufen Sie unterwegs an. Wir können heute leider keine Notfälle annehmen.`;
  } else if (redNoFallback) {
    cta = `Das klingt nach einem Notfall — bitte rufen Sie SOFORT den tierärztlichen Notdienst an und fahren Sie los. Unsere Praxis ist heute leider nicht verfügbar.`;
  } else cta += fb;
  if (tri.lang === 'en') cta += ' (English: this sounds like an emergency — please call and come in immediately.)';
  const r = tri.reason && FIRST_AID[tri.reason] ? tri.reason : (tri.reasons && tri.reasons.find((x) => FIRST_AID[x])) || 'generic';
  const heat = tri.heat || r === 'heat';
  const aid = heat ? FIRST_AID.heat : FIRST_AID[r];
  const prep = ctx.pick([
    `Kurz für die Vorbereitung: Seit wann ist das so, und ist ${ctx.T} ansprechbar?`,
    `Damit wir vorbereitet sind: Seit wann besteht das, und wie wirkt ${ctx.T} gerade?`,
    `Schreiben Sie mir gern noch kurz, seit wann das so ist — aber bitte zuerst losfahren.`,
  ]);
  const texts = [cta, aid + ' ' + prep];
  if (tri.poisonQuestion) texts.push('Bitte geben Sie in dieser Situation nichts aus der Hausapotheke.');
  return { texts, asked: 'emergency-details' };
}

export function poisonReply(ctx, tri) {
  const tel = telPart(ctx);
  const f = ctx.facts;
  const p = tri.poison || { key: 'gift', name: 'Gift' };
  let cta = ctx.pick([
    `Das kann giftig sein — bitte rufen Sie SOFORT an${tel} und kommen Sie direkt zu uns.`,
    `Bitte nicht abwarten: ${p.name} ${PLURAL[p.key] ? 'können' : 'kann'} für Tiere gefährlich sein. Rufen Sie jetzt sofort an${tel} und fahren Sie los.`,
    `Das ist ein Notfall — bitte sofort anrufen${tel} und losfahren, auch wenn ${ctx.T} noch munter wirkt.`,
  ]);
  if (f.status === 'red' && f.fallback && !f.is24h) {
    const ftel = f.fallback.phone ? ' (Tel. ' + f.fallback.phone + ')' : '';
    cta = `Das kann giftig sein — bitte fahren Sie SOFORT zu ${f.fallback.name}${ftel} und rufen Sie unterwegs an. Wir können heute leider keine Notfälle annehmen.`;
  } else cta += fallbackHint(ctx);
  if (tri.lang === 'en') cta += ' (English: this may be poisonous — please call and come in immediately, do not induce vomiting.)';
  const info = POISON_INFO[p.key] ? ' ' + POISON_INFO[p.key] : '';
  const second = FIRST_AID.poison + info;
  const third = `Kurz für uns: Was genau, wie viel ungefähr und wann hat ${ctx.T} das erwischt?`;
  const texts = [cta, second, third];
  if (tri.heat) texts[1] += ' ' + FIRST_AID.heat;
  return { texts, asked: 'poison-details' };
}

/* Dringend (heute ansehen): CTA vorne, danach das eigentliche Anliegen. */
export function urgentLead(ctx, tri) {
  const tel = telPart(ctx);
  if (tri.info) {
    const r = (tri.reason || '').replace('info:', '');
    const aid = r === 'heat' ? FIRST_AID.heat : FIRST_AID[r] || '';
    return `Falls das gerade akut passiert: bitte sofort anrufen${tel} und losfahren. ${aid}`.trim();
  }
  if (tri.reason === 'heat') return `Bitte behalten Sie ${ctx.T} gut im Blick und rufen Sie uns sofort an${tel}, wenn es nicht rasch besser wird. ${FIRST_AID.heat_urgent}`;
  if (tri.reason === 'emergency-word' || tri.reason === 'wait') return `Wenn Sie unsicher sind, ob es ein Notfall ist: bitte nicht abwarten, sondern jetzt anrufen${tel} — wir sagen Ihnen sofort, ob Sie kommen sollten.`;
  return ctx.pick([
    `Das sollten wir uns heute noch ansehen — bitte rufen Sie uns an${tel}, dann finden wir sofort einen Termin.`,
    `Bitte warten Sie damit nicht bis morgen: Rufen Sie uns an${tel}, wir schauen uns ${ctx.T} heute noch an.`,
    `Das klingt so, dass ${ctx.T} heute noch zu uns sollte — bitte kurz anrufen${tel}, dann planen wir Sie gleich ein.`,
  ]);
}

/* Gift-/Medikamenten-FRAGE: nie bestätigen. */
export function poisonQuestionReply(ctx, tri) {
  const p = tri.poison || tri.poisonQuestion || { key: 'gift', name: 'Das' };
  const tel = telPart(ctx);
  const plural = ctx.species && SPECIES_PLURAL[ctx.species] ? SPECIES_PLURAL[ctx.species] : 'Tiere';
  if (p.key === 'vomit') {
    return { texts: [
      `Nein, bitte nicht selbst Erbrechen auslösen — ${POISON_INFO.vomit}`,
      `Rufen Sie uns bitte sofort an${tel}: Ob Erbrechen sinnvoll ist, entscheiden wir je nach Stoff und Zeitpunkt — und dann machen wir das sicher in der Praxis.`,
    ], asked: 'poison-details' };
  }
  const isQ = !p.mention;
  const verb = PLURAL[p.key] ? 'sind' : 'ist';
  const info = POISON_INFO[p.key] || '';
  const first = isQ
    ? ctx.pick([
      `Nein, bitte nicht — ${p.name} ${verb} für ${plural} giftig bzw. gefährlich, auch schon in kleinen Mengen.`,
      `Nein, bitte nicht geben: ${p.name} ${verb} für ${plural} giftig — da gibt es keine „sichere" Menge.`,
    ])
    : `Bitte aufpassen: ${p.name} ${verb} für ${plural} giftig — bitte nicht füttern und gut wegräumen.`;
  const second = `${info ? info + ' ' : ''}Falls ${ctx.T} schon etwas davon gefressen hat, rufen Sie bitte sofort an${tel}.`;
  const texts = [first, second];
  if (p.induce) texts.push('Und bitte kein Erbrechen selbst auslösen — das machen wir, wenn nötig, sicher in der Praxis.');
  return { texts, asked: 'poison-question' };
}

/* ---------- Öffnungszeiten ---------- */
function askedDay(ctx) {
  const toks = ctx.an.toks.map((t) => t.t);
  for (let i = 0; i < 7; i++) if (toks.indexOf(DAYS_FOLD[i]) >= 0 || toks.indexOf(DAYS_FOLD[i] + 's') >= 0) return i;
  if (toks.indexOf('heute') >= 0) { const w = weekdayOf(ctx.now); return w === null ? 'heute' : w; }
  if (toks.indexOf('morgen') >= 0) { const w = weekdayOf(ctx.now); return w === null ? 'morgen' : (w + 1) % 7; }
  if (toks.indexOf('wochenende') >= 0) return 5;
  return null;
}
export function hoursReply(ctx) {
  const f = ctx.facts;
  const tel = telPart(ctx);
  if (f.is24h) {
    return { texts: [ctx.pick([
      `Wir sind rund um die Uhr für Sie da — 24 Stunden, auch am Wochenende und an Feiertagen.`,
      `${f.display} ist rund um die Uhr geöffnet, Tag und Nacht. Bitte kündigen Sie sich kurz telefonisch an${tel}, dann sind wir vorbereitet.`,
    ])] };
  }
  if (!f.hasHours) {
    return { texts: [`Die aktuellen Öffnungszeiten finden Sie auf unserer Praxisseite in der App — am schnellsten erreichen Sie uns telefonisch${tel}.`, 'In dringenden Fällen außerhalb der Zeiten bitte immer zuerst anrufen.'] };
  }
  const day = askedDay(ctx);
  const sum = hoursSummary(f);
  const texts = [];
  if (typeof day === 'number' && f.hoursWeek) {
    const h = dayHours(f, day);
    const isToday = weekdayOf(ctx.now) === day && ctx.an.toks.some((t) => t.t === 'heute');
    const dname = isToday ? 'Heute (' + DAYS_LONG[day] + ')' : 'Am ' + DAYS_LONG[day];
    // „Notdienst" o. Ä. ohne Uhrzeit nicht in „… haben wir Notdienst geöffnet" pressen
    texts.push(h === 'geschlossen' ? `${dname} haben wir leider geschlossen. Unsere Zeiten: ${sum}.`
      : /\d|rund um/.test(h) ? `${dname} haben wir ${h} geöffnet. Unsere Zeiten insgesamt: ${sum}.`
        : `${dname} gilt bei uns: ${h}. Unsere Zeiten insgesamt: ${sum}.`);
  } else {
    texts.push(ctx.pick([`Unsere Öffnungszeiten: ${sum}.`, `Sie erreichen uns ${sum}.`, `Geöffnet haben wir ${sum}.`]));
  }
  texts.push(`Notfälle bitte immer vorher telefonisch ankündigen${tel} — außerhalb der Zeiten hilft der tierärztliche Notdienst.`);
  return { texts };
}

/* ---------- Preise ---------- */
export function priceReply(ctx) {
  const subs = priceSubjects(ctx.an.norm).filter((k) => PRICES[k]);
  const list = subs.length ? subs.slice(0, 2) : ['exam', 'vacc'];
  const parts = list.map((k) => `${PRICES[k].label}: ${PRICES[k].range}`);
  const first = subs.length
    ? ctx.pick([`Gern: ${parts.join('; ')}.`, `Zur Orientierung: ${parts.join('; ')}.`])
    : ctx.pick([
      `Die Kosten hängen von der Behandlung ab — zur Orientierung: ${parts.join('; ')}.`,
      `Grober Rahmen: ${parts.join('; ')}. Genaueres, sobald wir wissen, worum es geht.`,
    ]);
  // Eine Blase: Preisrahmen + Hinweis, dass Kosten vorher besprochen werden
  return { texts: [first + ' ' + PRICE_NOTE] };
}

/* ---------- Anliegen ---------- */
export const R = {
  euthanasia: (c) => ({ texts: [
    c.pick([
      'Das ist eine sehr schwere Entscheidung — es tut mir leid, dass Sie gerade davorstehen. Sie müssen das nicht allein entscheiden.',
      'Danke, dass Sie das ansprechen. Solche Gedanken kommen aus Fürsorge, nicht aus Aufgeben — wir begleiten Sie dabei.',
      `Es tut mir leid. Was für ${c.T} jetzt richtig ist, besprechen wir gern in Ruhe und ohne Zeitdruck mit Ihnen.`,
      `Dafür nehmen wir uns Zeit. Wichtig ist, wie es ${c.D} an den guten und an den schlechten Tagen geht — daran orientieren wir uns gemeinsam.`,
    ]),
    `Wir nehmen uns dafür einen eigenen, ruhigen Termin — auf Wunsch auch als Hausbesuch. Wenn Sie mögen, schildern Sie mir kurz, wie es ${c.D} gerade geht. Hat ${c.T} starke Schmerzen oder Atemnot, rufen Sie bitte sofort an${telPart(c)}.`,
  ], asked: 'details' }),
  recovery: (c) => ({ texts: [c.pick([
    `Das freut mich sehr zu hören — danke für die Rückmeldung! Beobachten Sie ${c.T} bitte noch ein, zwei Tage.`,
    `Schön, dass es ${c.D} besser geht! Sollte es wieder schlechter werden, melden Sie sich einfach.`,
    `Sehr gut, dass es ${c.D} besser geht! Dann belassen wir es dabei. Bei einem Rückfall bitte kurz melden, dann schauen wir uns das an.`,
    `Das klingt gut. Falls Sie mögen, machen wir in ein paar Tagen trotzdem eine kurze Kontrolle für ${c.T} — ganz wie Sie möchten.`,
  ])] }),
  microchip: (c) => ({ texts: [
    c.pick([
      `Das tut mir leid — bitte melden Sie ${c.T} gleich als vermisst, dann kann die Chipnummer zugeordnet werden, sobald jemand ${c.T} findet.`,
      'Erste Schritte: Nachbarschaft absuchen, Fundtier-Meldung bei Gemeinde, Polizei und Tierheim, und die Chipnummer in der Haustierdatenbank auf „vermisst" setzen.',
      'Sehr wichtig ist, dass der Chip auch registriert ist — der Chip allein hilft nicht, erst der Datenbank-Eintrag verbindet ihn mit Ihnen.',
      'Bitte auch bei den umliegenden Tierarztpraxen und im Tierheim anrufen — gefundene Tiere werden meist zuerst dorthin gebracht.',
    ]),
    'Wenn Sie mir die Chipnummer schicken, prüfen wir gern, ob die Registrierung aktuell ist. Gefundene Tiere lesen wir jederzeit kostenlos aus.',
  ] }),
  fireworks: (c) => ({ texts: [
    c.pick([
      'Angst vor Feuerwerk und Gewitter ist sehr häufig — und gut in den Griff zu bekommen, wenn man rechtzeitig anfängt.',
      `Das kennen wir gut. Wichtig ist, dass ${c.T} einen sicheren Rückzugsort hat und Sie selbst betont ruhig bleiben.`,
      'Da können wir einiges tun. Am besten beginnen wir einige Wochen vorher, nicht erst am Tag selbst.',
      'Sehr gern. Wichtig vorweg: Bitte niemals beruhigende Mittel aus der Humanmedizin geben — manche davon lähmen nur die Bewegung, die Angst bleibt.',
    ]),
    'Konkret: Rückzugshöhle vorbereiten, Fenster und Rollläden schließen, Radio leise laufen lassen, an Silvester früh und angeleint Gassi gehen. Reicht das nicht, besprechen wir bei einem Termin weitere Möglichkeiten — bitte nichts aus der Hausapotheke geben.',
  ] }),
  heat: (c) => ({ texts: [
    c.pick([
      'Hitze wird bei Tieren oft unterschätzt — ein Hitzschlag entsteht schneller, als die meisten denken.',
      'Gut, dass Sie fragen. Die wichtigste Regel: Bei Wärme niemals im geparkten Auto lassen, auch nicht „nur kurz" und auch nicht im Schatten.',
      `Bei warmem Wetter gilt für ${c.T}: Bewegung in die kühlen Morgen- und Abendstunden legen, immer Schatten und Wasser anbieten.`,
      'Danke fürs Nachfragen — bei Hitze sehen wir jedes Jahr vermeidbare Notfälle. Ein paar einfache Regeln reichen aber schon aus.',
    ]),
    (hint(c, 'heat') ? hint(c, 'heat') + ' ' : '') + `Warnzeichen sind starkes Hecheln, Taumeln, dunkelrote Zunge und Erbrechen. Dann bitte langsam mit lauwarmem Wasser im Schatten kühlen (nicht eiskalt) und uns SOFORT anrufen${telPart(c)}.`,
  ] }),
  anesthesia: (c) => ({ texts: [
    c.pick([
      'Die Sorge verstehe ich gut — die stellen fast alle. Modern durchgeführt ist eine Narkose heute ein sehr kontrollierter Vorgang.',
      'Danke, dass Sie fragen. Wir klären vorher ab, ob etwas gegen die Narkose spricht, und überwachen währenddessen durchgehend.',
      `Berechtigte Frage. Vor jeder Narkose untersuchen wir ${c.T} gründlich und besprechen mit Ihnen das individuelle Risiko.`,
      'Ehrliche Antwort: Ein Restrisiko gibt es immer, es ist aber sehr klein — und wir wägen es immer gegen den Nutzen des Eingriffs ab.',
    ]),
    'Bei älteren Tieren oder Vorerkrankungen empfehlen wir vorher ein Blutbild. Am OP-Tag bitte nüchtern kommen — Wasser darf bleiben. Nach dem Aufwachen bleibt Ihr Tier bei uns unter Beobachtung, bis alles stabil ist.',
  ] }),
  postop: (c) => ({ texts: [
    c.pick([
      'Nach einem Eingriff ist Ruhe das Wichtigste — bitte kein Toben, kein Springen und kein Baden, bis wir die Wunde freigeben.',
      `Für ${c.T} gilt jetzt: Wunde täglich anschauen, sauber und trocken halten, und den Leckschutz konsequent drauflassen.`,
      'Gute Frage. Die Wunde sollte trocken und geschlossen sein, leichte Schwellung in den ersten Tagen ist normal.',
      'Alles klar. Die Fäden ziehen wir in der Regel nach 10 bis 14 Tagen — bis dahin bitte nicht baden und nicht toben lassen.',
    ]),
    `Halskrause oder Body bitte durchgehend drauflassen, bis wir die Wunde freigeben — ein paar Minuten Lecken reichen, um die Naht zu öffnen. Wenn die Wunde nässt, stark gerötet ist, riecht oder aufgeht, melden Sie sich bitte sofort${telPart(c)}.`,
  ] }),
  samples: (c) => ({ texts: [
    c.pick([
      'Sehr gern — Proben untersuchen wir zeitnah, oft schon am selben Tag.',
      'Machen wir. Für ein aussagekräftiges Ergebnis kommt es allerdings auf die richtige Entnahme an.',
      'Das können Sie einfach vorbeibringen, dafür brauchen Sie keinen Termin.',
      'Gern. Sagen Sie uns bitte kurz dazu, worauf wir schauen sollen — dann setzen wir gleich die richtige Untersuchung an.',
    ]),
    'Kotprobe: am besten eine Sammelprobe von drei aufeinanderfolgenden Tagen, kühl gelagert. Urin: möglichst Morgenurin in einem sauberen Gefäß, innerhalb von zwei Stunden bei uns. Bitte das Gefäß mit Namen und Datum beschriften.',
  ] }),
  emergencyservice: (c) => {
    const f = c.facts;
    const tel = telPart(c);
    const status = f.is24h ? 'Wir haben rund um die Uhr Notdienst — Sie können jederzeit kommen, bitte kurz vorher anrufen' + tel + '.'
      : f.status === 'green' ? 'Heute nehmen wir Notfälle an — bitte vor der Anfahrt kurz anrufen' + tel + ', damit wir vorbereitet sind.'
        : f.status === 'yellow' ? 'Heute nehmen wir Notfälle nur nach telefonischer Rücksprache an — bitte unbedingt zuerst anrufen' + tel + '.'
          : f.status === 'red' ? 'Heute können wir leider keine Notfälle annehmen.' + (f.fallback ? ' Bitte wenden Sie sich an ' + f.fallback.name + (f.fallback.phone ? ' (Tel. ' + f.fallback.phone + ')' : '') + '.' : ' Bitte wenden Sie sich an den tierärztlichen Notdienst.')
            : c.pick([
              'Außerhalb unserer Öffnungszeiten gibt es in Kärnten einen tierärztlichen Notdienst — die aktuelle Bereitschaft erfahren Sie über unsere Ansage am Telefon' + tel + '.',
              'Nachts, an Wochenenden und Feiertagen übernimmt der Notdienst. Bitte immer vorher anrufen, damit dort jemand vorbereitet ist.',
              'Für akute Fälle außerhalb der Zeiten gilt: erst anrufen, dann losfahren — dann weiß die Bereitschaft, dass Sie kommen.',
            ]);
    const fb = !f.is24h && f.fallback && f.status !== 'red' ? ` Rund um die Uhr erreichbar ist außerdem ${f.fallback.name}${f.fallback.phone ? ' (Tel. ' + f.fallback.phone + ')' : ''}.` : '';
    return { texts: [status + fb, 'Wenn es um Leben geht (Atemnot, starke Blutung, Krämpfe, Vergiftung, aufgeblähter harter Bauch), fahren Sie bitte sofort los und rufen unterwegs an.'] };
  },
  referral: (c) => ({ texts: [
    c.pick([
      'Sehr gern — wenn ein Fall Spezialdiagnostik braucht, überweisen wir offen und ohne Umwege weiter.',
      'Das ist ganz normal und kein Zeichen dafür, dass etwas schiefgelaufen ist. Manche Untersuchungen wie MRT oder CT gibt es nur an der Klinik.',
      'Machen wir gerne. Wir stellen die Überweisung aus und geben alle bisherigen Befunde mit, damit dort nichts doppelt gemacht wird.',
      'Wir bleiben dabei Ihre Ansprechpartner: Die Nachsorge übernehmen wir anschließend wieder hier vor Ort.',
    ]),
    `Sagen Sie mir kurz, worum es bei ${c.D} geht, dann sage ich Ihnen, welche Fachrichtung passt.`,
  ], asked: 'details' }),
  newpet: (c) => ({ texts: [
    c.pick([
      'Schön! Damit das gut startet, planen wir am besten zwei Dinge: einen Gesundheitscheck für den Neuzugang und eine ruhige Eingewöhnung.',
      'Herzlichen Glückwunsch! Vor dem ersten direkten Kontakt sollte der Neuzugang einmal bei uns gewesen sein — wegen Parasiten und Infektionen.',
      'Das freut mich. Wichtig ist, dass beide Tiere anfangs getrennte Bereiche mit eigener Toilette, eigenem Napf und eigenem Rückzugsort haben.',
      'Bei Katzen gilt die Faustregel: eine Katzentoilette pro Tier plus eine zusätzliche — das verhindert die meisten Konflikte.',
    ]),
    'Zusammenführen bitte langsam über Tage: erst Geruch tauschen, dann Sichtkontakt, dann kurze gemeinsame Zeit unter Aufsicht. Zu schnell ist der häufigste Fehler.',
  ] }),
  puppy: (c) => ({ texts: [
    c.pick([
      `Schön, dass ${c.T} bei Ihnen ist! Der erste Termin sollte in den ersten Tagen nach dem Einzug stattfinden — Durchcheck, Impfplan und Entwurmung.`,
      'Für junge Tiere machen wir einen festen Fahrplan: Grundimmunisierung in mehreren Schritten, regelmäßige Entwurmung und Gewichtskontrolle.',
      'Sehr gern. Bringen Sie bitte den Impfpass und die Papiere vom Vorbesitzer mit, dann sehen wir, was schon gemacht wurde.',
      'Gern. Neben Impfung und Entwurmung besprechen wir auch Futter, Zahnwechsel, Kastrationszeitpunkt und Sozialkontakte.',
    ]),
    hint(c, 'vaccination') || 'Die Grundimmunisierung startet meist mit 8 Wochen und wird bis etwa 16 Wochen mehrfach wiederholt — dazwischen bitte keine großen Lücken lassen.',
  ] }),
  joints: (c) => ({ texts: [
    c.pick([
      `Gelenkbeschwerden sind gut behandelbar, wenn man früh anfängt. Fällt ${c.D} vor allem das Aufstehen nach dem Liegen schwer?`,
      'Danke für die Beschreibung — das klingt nach einem Gelenkthema. Wir schauen uns den Gang an und tasten die Gelenke durch, oft ergänzt durch ein Röntgen.',
      'Wichtig zu wissen: Steifheit ist Schmerz, auch wenn Ihr Tier nicht jammert. Tiere zeigen das kaum.',
      'Bei Gelenken bringt eine Kombination am meisten: passendes Gewicht, gleichmäßige Bewegung, rutschfeste Böden und bei Bedarf Medikamente von uns.',
    ]),
    hint(c, 'joints') || 'Bitte geben Sie keine Schmerzmittel aus der Hausapotheke — für Tiere sind viele davon giftig. Wir finden etwas Passendes.',
  ], asked: 'since' }),
  weight: (c) => ({ texts: [
    c.pick([
      `Gewicht ist der wichtigste Hebel für ein langes, beschwerdefreies Leben — schön, dass Sie es angehen. Wie viel wiegt ${c.T} aktuell?`,
      'Da helfen wir gern. Am besten kommen Sie zum Wiegen vorbei, dann legen wir ein realistisches Zielgewicht und einen Zeitrahmen fest.',
      'Sehr gute Idee. Wir rechnen die Tagesration konkret aus — inklusive Leckerlis, die machen oft einen großen Teil der Kalorien aus.',
      `Machen wir gemeinsam. Wichtig: langsam abnehmen, nicht hungern lassen. Für ${c.T} planen wir regelmäßige Wiege-Kontrollen ein.`,
    ]),
    hint(c, 'weight'),
  ], asked: 'details' }),
  payment: (c) => ({ texts: [
    c.pick([
      'Sprechen Sie uns da bitte offen an — wir finden fast immer eine Lösung, und niemand muss deswegen auf Behandlung verzichten.',
      'Das lässt sich regeln. Bei größeren Beträgen können wir über eine Anzahlung und Teilzahlungen sprechen.',
      'Danke, dass Sie das ansprechen. Wir sagen Ihnen die Kosten vorher, damit Sie planen können — keine Überraschungen auf der Rechnung.',
      'Wenn es eng ist, sagen Sie es uns bitte VOR der Behandlung — dann überlegen wir gemeinsam, was jetzt wirklich nötig ist und was warten kann.',
    ]),
    'Bezahlen können Sie bei uns bar oder mit Karte. Für Ratenzahlung brauchen wir nur eine kurze Absprache vorab.',
  ] }),
  eyes: (c) => ({ texts: [
    c.pick([
      `Augen sind heikel — da schauen wir lieber einmal zu früh als zu spät. Ist das Auge zugekniffen, und reibt sich ${c.T} daran?`,
      `Bei Augenveränderungen sollten wir ${c.T} zeitnah ansehen. Ist der Ausfluss klar oder eitrig, und ist ein oder sind beide Augen betroffen?`,
      'Das sehen wir uns bitte bald an — am Auge kann sich vieles innerhalb eines Tages verschlechtern. Wann hat es begonnen?',
      `Danke für die Beschreibung. Ist das Auge trüb geworden oder blinzelt ${c.T} auffällig viel? Beides wäre ein Grund, heute noch zu kommen.`,
    ]),
    hint(c, 'eyes') || 'Bitte nichts eintropfen, was noch von früher da ist — manche Augentropfen verschlimmern bestimmte Verletzungen deutlich.',
  ], asked: 'since' }),
  skin: (c) => ({ texts: [
    c.pick([
      `Juckreiz und Hautprobleme haben viele Ursachen — Parasiten, Allergie, Futter, Pilz. Seit wann kratzt sich ${c.T}, und gibt es kahle Stellen?`,
      `Das sehen wir uns am besten direkt an. Ist die Haut gerötet, schuppig oder nässend? Und bekommt ${c.T} einen Floh- und Zeckenschutz?`,
      'Hautsachen klären wir meist mit einem kurzen Abklatsch oder Hautgeschabsel — das geht gleich beim Termin. Seit wann besteht es?',
      `Wichtig für uns: Hat sich am Futter, an Waschmitteln oder an der Umgebung etwas geändert, seit es bei ${c.D} begonnen hat?`,
    ]),
    hint(c, 'skin') || 'Bitte nichts Menschliches auftragen — vieles davon wird abgeleckt und ist für Tiere nicht geeignet.',
  ], asked: 'since' }),
  symptom: (c) => {
    const q = c.pick([
      `Seit wann beobachten Sie das bei ${c.D}? Und frisst und trinkt ${c.T} normal?`,
      `Wie lange geht das schon, und hat sich das Verhalten von ${c.D} sonst verändert (Müdigkeit, Appetit)?`,
      `Ist das plötzlich aufgetreten oder schleichend? Und wirkt ${c.T} sonst munter?`,
      `Wie oft ist das seit gestern vorgekommen? Und wirkt ${c.T} dabei schmerzhaft?`,
    ]);
    const open = c.pick([
      'Danke für die Beschreibung — das sollten wir uns ansehen.',
      'Gut, dass Sie sich melden — das klären wir am besten bei einer kurzen Untersuchung.',
      'Danke, das hilft schon einmal weiter. Eine Ferndiagnose wäre hier unseriös — wir sehen es uns lieber an.',
      'Verstanden. So etwas schauen wir uns lieber einmal zu früh an als zu spät.',
    ]);
    const h = hint(c, 'symptom');
    return { texts: h ? [open + ' ' + q, h] : [open + ' ' + q], asked: 'since' };
  },
  behaviour: (c) => ({ texts: [
    c.pick([
      `Verhaltensprobleme haben oft eine körperliche Ursache — Schmerzen zum Beispiel. Deshalb schauen wir ${c.T} zuerst einmal gründlich an.`,
      `Danke, dass Sie das ansprechen — das lässt sich meist gut in den Griff bekommen. Seit wann zeigt ${c.T} das, und in welchen Situationen genau?`,
      'Das gehen wir strukturiert an: erst Gesundheitscheck, dann Beratung zum Alltag. Bitte schildern Sie mir kurz eine typische Situation.',
      'Verhalten ändert sich selten grundlos. Hat sich zu Hause etwas verändert — Umzug, neues Tier, anderer Tagesablauf?',
    ]),
    hint(c, 'behaviour') || 'Bitte auf keinen Fall mit Strafe arbeiten — das verstärkt Angstverhalten meist. Wir besprechen gern konkrete Alternativen.',
  ], asked: 'details' }),
  pregnancy: (c) => ({ texts: [
    c.pick([
      'Herzlichen Glückwunsch! Wir begleiten das gern — mit Ultraschall lässt sich der Stand gut einschätzen und die Geburt planen.',
      `Da schauen wir am besten frühzeitig einmal nach ${c.D}: Trächtigkeitskontrolle, Ernährung und Vorbereitung auf die Geburt.`,
      'Sehr gern. Wichtig ist der ungefähre Deckzeitpunkt — dann können wir den Termin für die Ultraschallkontrolle festlegen.',
      'Gern begleiten wir das. Ab der zweiten Trächtigkeitshälfte steigt der Futterbedarf deutlich — dazu beraten wir Sie beim Termin.',
    ]),
    `Bitte melden Sie sich sofort${telPart(c)}, wenn die Geburt länger als zwei Stunden ohne Fortschritt dauert oder deutlich Blut kommt.`,
  ] }),
  senior: (c) => ({ texts: [
    c.pick([
      'Sehr gute Idee. Bei älteren Tieren empfehlen wir einmal jährlich einen Check mit Blutbild — vieles lässt sich dann früh und günstig abfangen.',
      `Vorsorge lohnt sich gerade bei Senioren. Für ${c.T} planen wir Untersuchung, Blutdruck und Blutbild ein, das dauert etwa 30 Minuten.`,
      'Gern! Beim Senior-Check schauen wir besonders auf Nieren, Schilddrüse, Gelenke und Zähne.',
      'Viele Alterserkrankungen verlaufen lange unauffällig. Genau deshalb lohnt sich der jährliche Check — je früher, desto einfacher.',
    ]),
    hint(c, 'senior') || 'Für den Check ist nüchtern ideal — also am Morgen bitte nichts füttern.',
  ] }),
  activity: (c) => ({ texts: [
    c.pick([
      `Das hängt davon ab, wie es ${c.D} jetzt geht. Bitte zunächst nur kurze, ruhige Runden an der Leine — kein Toben, Springen oder Rennen. Tritt ${c.T} dabei wieder normal auf, können Sie die Runden langsam steigern.`,
      `Gute Frage — für ${c.T} gilt: langsam steigern. Erst kurze Runden an der Leine, und nur wenn ${c.T} dabei nicht mehr humpelt oder schont, wieder mehr Bewegung.`,
    ]),
    `Am sichersten ist eine kurze Kontrolle bei uns — dann sagen wir Ihnen genau, wie viel ${c.D} wieder guttut. Wird es schlechter, melden Sie sich bitte sofort${telPart(c)}.`,
  ] }),
  recheck: (c) => {
    const slots = c.slots();
    return { texts: [c.pick([
      `Sehr gern — für die Nachkontrolle von ${c.D} planen wir etwa 15 Minuten ein. Passt Ihnen ${c.slotText(slots)}?`,
      `Fäden ziehen wir in der Regel 10–14 Tagen nach dem Eingriff. Ich hätte ${c.slotText(slots)} frei — passt eines davon?`,
      `Klar, das machen wir. Ich hätte ${c.slotText(slots)} — und wie sieht die Wunde aus: trocken und geschlossen, oder gerötet und feucht?`,
    ]).replace('10–14 Tagen', '10–14 Tage'), 'Bringen Sie bitte den bisherigen Befund oder die Medikamentenliste mit.'], asked: 'slot', offer: true };
  },
  insurance: (c) => ({ texts: [
    c.pick([
      'Einen Kostenvoranschlag stellen wir Ihnen gern schriftlich aus — den können Sie direkt bei Ihrer Versicherung einreichen.',
      'Das machen wir oft: Wir schätzen die Kosten vorab realistisch ein und Sie holen die Zusage Ihrer Versicherung ein.',
      'Gern. Für den Kostenvoranschlag brauchen wir nur, um welchen Eingriff es geht, und die Daten Ihrer Versicherung.',
      'Wichtig für Sie: Viele Versicherungen wollen den Kostenvoranschlag VOR der Behandlung sehen — melden Sie sich also lieber zu früh als zu spät.',
    ]),
    'Und falls es finanziell knapp wird: Sprechen Sie uns bitte offen an. Wir finden meist eine Lösung.',
  ] }),
  secondopinion: (c) => ({ texts: [c.pick([
    'Eine Zweitmeinung ist völlig legitim — das nehmen wir niemandem übel. Bringen Sie gern alle bisherigen Befunde mit.',
    'Sehr gern schauen wir noch einmal drauf. Am hilfreichsten sind Röntgen- und Laborbefunde und die aktuelle Medikamentenliste.',
    'Klar, dafür sind wir da. Sagen Sie mir kurz, worum es geht, dann planen wir genug Zeit für ein ausführliches Gespräch ein.',
    'Kein Problem. Falls die Vorbefunde noch nicht bei Ihnen sind: Sie haben ein Recht auf eine Kopie, wir helfen Ihnen gern beim Anfordern.',
  ])], asked: 'details' }),
  reschedule: (c) => {
    const slots = c.slots(true);
    return { texts: [c.pick([
      `Kein Problem, das verschieben wir. Ich hätte stattdessen ${c.slotText(slots)} — passt eines davon?`,
      `Alles klar, danke fürs Bescheidgeben! Neue Vorschläge: ${c.slotText(slots)}. Was ist Ihnen lieber?`,
      `Machen wir. Wie wäre es mit ${c.slotText(slots)}? Oder nennen Sie mir einfach eine Wunschzeit.`,
    ])], asked: 'slot', offer: true };
  },
  appointment: (c) => {
    const slots = c.slots();
    return { texts: [c.pick([
      `Gerne! Ich hätte ${c.slotText(slots)} frei — was passt Ihnen besser für ${c.T}?`,
      `Da finden wir etwas: ${c.slotText(slots)} wären frei. Welcher Termin passt für ${c.T}?`,
      `Sehr gerne. Frei wären ${c.slotText(slots)}. Sagen Sie mir kurz, worum es geht, dann plane ich die passende Dauer ein.`,
      `Klar. Für ${c.T} hätte ich ${c.slotText(slots)} — was wäre Ihnen lieber?`,
    ])], asked: 'slot', offer: true };
  },
  hours: (c) => hoursReply(c),
  price: (c) => priceReply(c),
  vaccination: (c) => ({ texts: [
    c.pick([
      `Impfungen machen wir laufend. Wann war die letzte Impfung von ${c.D}? Bringen Sie zum Termin bitte den Impfpass mit.`,
      'Gern! Für die Impfung bzw. Auffrischung planen wir ca. 15 Minuten ein. Wann würde es Ihnen passen?',
      `Sehr gerne. Wichtig: ${c.T} sollte am Impftag gesund und fieberfrei sein. Wann würde es Ihnen passen?`,
      'Machen wir. Sagen Sie mir kurz Alter und Impfstatus, dann sage ich Ihnen genau, was jetzt ansteht.',
    ]),
    hint(c, 'vaccination'),
  ], asked: 'vacc-details' }),
  castration: (c) => ({ texts: [
    `Eine Kastration ist bei uns Routine. Wir machen vorab ein kurzes Vorgespräch mit Untersuchung von ${c.D} und besprechen Ablauf, Narkose und Nachsorge.`,
    c.pick([
      'Soll ich Ihnen einen Termin fürs Vorgespräch anbieten? Das dauert ca. 20 Minuten.',
      'Wichtig zu wissen: Am OP-Tag muss das Tier nüchtern sein. Wann würde Ihnen ein Vorgespräch passen?',
      'Wenn Sie mögen, planen wir gleich beides — Vorgespräch diese Woche, OP dann kommende Woche.',
    ]),
  ], asked: 'details' }),
  dental: (c) => ({ texts: [
    c.pick([
      `Zahnprobleme sind häufig und werden oft unterschätzt. Starker Maulgeruch oder Zahnstein bei ${c.D} sollten wir uns ansehen — meist reicht zuerst ein kurzer Kontrolltermin.`,
      'Das klingt nach einem Fall für unsere Zahnsprechstunde. Wir schauen uns das Gebiss an und besprechen dann, ob eine Zahnsteinentfernung nötig ist.',
      `Gern. Frisst ${c.T} noch normal, oder fällt Futter aus dem Maul? Das sagt uns schon viel über die Dringlichkeit.`,
      'Zähne schauen wir uns gern an. Eine gründliche Beurteilung geht allerdings nur in Narkose — das besprechen wir vorher in Ruhe.',
    ]),
    hint(c, 'dental'),
  ], asked: 'details' }),
  parasites: (c) => ({ texts: [
    c.pick([
      `Beim Zecken- und Flohschutz beraten wir Sie gern zu Spot-ons, Tabletten oder Halsbändern — was am besten passt, hängt von ${c.D} ab (Gewicht, Freigang).`,
      'Entwurmung empfehlen wir je nach Lebensstil zwei- bis viermal pro Jahr. Die Wurmkur können Sie bei uns abholen oder wir geben sie beim nächsten Termin.',
      'Zeckenschutz sollte lückenlos sein — die meisten Präparate wirken einige Wochen. Welches Mittel passt, besprechen wir kurz mit Ihnen.',
      'Gern. Wichtig ist, dass wir das passende Präparat für die Tierart wählen — da gibt es gefährliche Verwechslungen.',
    ]),
    hint(c, 'parasites'),
  ] }),
  grooming: (c) => {
    if (c.an.toks.some((t) => t.t.indexOf('krall') === 0)) {
      return { texts: [c.pick([
        `Krallenschneiden machen wir gern nebenbei mit — das dauert nur wenige Minuten. Soll ich das beim nächsten Termin für ${c.T} einplanen?`,
        `Kein Problem, die Krallen kürzen wir gern. Wenn ${c.T} dabei sehr unruhig ist, sagen Sie uns bitte vorher Bescheid.`,
        'Machen wir gern. Bitte vorher nicht selbst zu kurz schneiden — in der Kralle sitzen Nerv und Gefäß, das blutet sonst stark.',
      ])] };
    }
    return { texts: [
      c.pick([
        'Fellpflege besprechen wir gern — bei starker Verfilzung ist Scheren manchmal die schonendste Lösung.',
        'Baden ist bei Tieren selten nötig und trocknet die Haut aus. Wenn es sein muss, nur mit tiergeeignetem Shampoo.',
        `Regelmäßiges Bürsten hilft am meisten. Wenn ${c.T} dabei empfindlich reagiert, schauen wir uns die Haut lieber einmal an.`,
        'Sehr gern. Beim Trimmen und Scheren achten wir darauf, dass die Haut geschützt bleibt — zu kurz ist selten gut.',
      ]),
      hint(c, 'grooming'),
    ] };
  },
  nutrition: (c) => ({ texts: [
    c.pick([
      `Ernährungsberatung machen wir gerne — am besten bringen Sie ${c.T} einmal zum Wiegen vorbei, dann erstellen wir einen konkreten Futterplan.`,
      'Gute Frage! Futter ist sehr individuell (Alter, Gewicht, Vorerkrankungen) — das kann ich pauschal nicht freigeben. Sollen wir das bei einem kurzen Beratungstermin durchgehen?',
      `Gern. Wichtig ist zuerst: Wie viel wiegt ${c.T} aktuell, und was bekommt ${c.T} derzeit genau — inklusive Leckerlis?`,
      'Da helfen wir gern weiter. Futterumstellungen machen wir immer langsam über etwa eine Woche, sonst gibt es Durchfall.',
    ]),
    hint(c, 'nutrition') || 'Bitte keine Speisereste, Schokolade, Trauben, Zwiebeln oder Knoblauch füttern — das ist für Tiere giftig.',
  ], asked: 'details' }),
  medication: (c) => ({ texts: [
    'Bitte geben Sie KEINE Medikamente aus der Hausapotheke — vieles, was für Menschen harmlos ist (z. B. Ibuprofen oder Paracetamol), ist für Tiere giftig!',
    c.pick([
      `Rufen Sie uns kurz an${telPart(c)} oder kommen Sie vorbei, dann verordnen wir etwas Passendes für ${c.T}.`,
      `Dosierungen nenne ich im Chat grundsätzlich nicht — das hängt an Gewicht, Alter und Vorerkrankungen von ${c.D}. Kommen Sie bitte kurz vorbei oder rufen Sie an.`,
      'Wenn Sie ein Medikament von uns haben und unsicher sind: Rufen Sie an, wir schauen in die Akte und sagen es Ihnen persönlich.',
    ]),
  ] }),
  travel: (c) => ({ texts: [
    'Für Reisen in der EU brauchen Sie: Mikrochip, gültige Tollwutimpfung (mindestens 21 Tage vor Abreise) und den EU-Heimtierausweis.',
    c.pick([
      'Das alles können wir bei uns erledigen. Wann geht die Reise los? Dann planen wir rechtzeitig.',
      'Für einzelne Länder gelten Zusatzregeln (z. B. Bandwurmbehandlung). Sagen Sie mir das Reiseziel, dann prüfe ich das.',
      'Bitte rechtzeitig planen — die Tollwutimpfung muss 21 Tage vor Abreise erfolgt sein. Wann fahren Sie?',
    ]),
  ], asked: 'travel-date' }),
  address: (c) => {
    const a = c.facts.address;
    return { texts: [a
      ? c.pick([`Sie finden uns hier: ${a}. Über „Route" auf unserer Praxisseite startet die Navigation direkt.`, `Unsere Adresse: ${a}. In der App öffnet „Route" die Karten-App mit Navigation.`])
      : c.pick([
        `Die genaue Adresse von ${c.facts.display} steht auf unserer Praxisseite in der App — mit einem Tipp auf „Route" öffnet sich die Navigation.`,
        'Am einfachsten über die Praxisseite in der App: Dort gibt es Adresse, Telefonnummer und den Knopf für die Navigation.',
      ])] };
  },
  housecall: (c) => ({ texts: [c.pick([
    'Hausbesuche bieten wir an — vor allem für Tiere, die der Transport stark stresst. Sagen Sie uns Adresse und Wunschzeit, wir melden uns mit einem Terminvorschlag.',
    'Ja, wir kommen auch zu Ihnen! Hausbesuche machen wir meist am Nachmittag. Wo wohnen Sie ungefähr?',
    'Grundsätzlich gern. Bitte beachten Sie: Untersuchungen wie Röntgen oder Labor gehen nur in der Praxis. Worum geht es denn?',
  ])], asked: 'details' }),
  contact: (c) => ({ texts: [c.facts.phone
    ? `Sie erreichen uns telefonisch unter ${c.facts.phone}. In Notfällen bitte immer anrufen, nicht nur schreiben.`
    : 'Unsere Telefonnummer finden Sie auf der Praxisseite in der App (Knopf „Anrufen"). In Notfällen bitte immer anrufen, nicht nur schreiben.'] }),
  botinfo: (c) => ({ texts: [`Ich bin der digitale Assistent von ${c.facts.display} und helfe bei Terminen und allgemeinen Fragen. Diagnosen oder Dosierungen gebe ich nicht — bei Beschwerden schaut sich immer unser Team Ihr Tier an, und in Notfällen rufen Sie bitte direkt an${telPart(c)}.`] }),
  complaint: (c) => ({ texts: [c.pick([
    'Das tut mir leid. Magst du — Verzeihung: mögen Sie mir kurz schildern, was genau nicht gepasst hat? Dann kümmern wir uns darum.',
    'Das tut mir leid zu hören. Was genau ist passiert? Wir möchten das gern klären.',
    'Danke für die offene Rückmeldung — das nehmen wir ernst. Was können wir besser machen?',
  ]).replace('Magst du — Verzeihung: mögen Sie', 'Mögen Sie')], asked: 'details' }),
  greeting: (c) => ({ texts: [c.pick([
    `Hallo und willkommen bei ${c.facts.display}! 👋 Wie können wir Ihnen und Ihrem Tier helfen?`,
    'Guten Tag! 👋 Schön, dass Sie sich melden — worum geht es denn?',
    `Hallo! Hier ist das Team von ${c.facts.display}. Was können wir für Sie tun?`,
    'Grüß Sie! 👋 Erzählen Sie gern kurz, worum es geht, dann helfen wir weiter.',
  ])], asked: 'reason' }),
  thanks: (c) => ({ texts: [c.pick([
    `Sehr gerne — gute Besserung für ${c.T}! 🐾`,
    `Gern geschehen! Alles Gute für ${c.T} — melden Sie sich jederzeit wieder. 🐾`,
    `Dafür sind wir da! Alles Gute für ${c.T} und bis bald.`,
    `Sehr gern! Wenn bei ${c.D} noch etwas unklar ist, schreiben Sie einfach.`,
  ])] }),
  bye: (c) => ({ texts: [c.pick([
    'Bis bald und alles Gute! 🐾',
    'Auf Wiedersehen — kommen Sie gut durch den Tag!',
    'Schönen Tag noch und gute Besserung! 🐾',
  ])] }),
  ack: (c) => ({ texts: [c.booked
    ? c.pick([`Alles klar — dann bis ${c.booked.label}! 🐾`, `Prima, wir sehen uns ${c.booked.label}. Bis dann!`])
    : c.pick([
      'Alles klar! Wenn noch etwas ist, schreiben Sie einfach.',
      'Gut! Kann ich sonst noch etwas für Sie tun — zum Beispiel einen Termin ausmachen?',
      'Verstanden. Melden Sie sich jederzeit, wenn Sie Fragen haben.',
    ])] }),
};

/* Kurze Antwort auf eine offene Frage des Bots („seit gestern") → danken + Termin anbieten */
export function followupReply(c) {
  const slots = c.slots();
  return { texts: [c.pick([
    `Danke, das hilft mir weiter. Am besten schauen wir uns ${c.T} zeitnah an — ich hätte ${c.slotText(slots)} frei. Was passt Ihnen?`,
    `Alles klar, danke! Damit können wir gut planen. Ich würde einen zeitnahen Termin empfehlen — ${c.slotText(slots)}?`,
    `Verstanden, danke. Ich würde ${c.T} gern kurz ansehen — passt Ihnen ${c.slotText(slots)}?`,
  ]), 'Sollte es bis dahin schlechter werden, rufen Sie bitte sofort an' + telPart(c) + '.'], asked: 'slot', offer: true };
}

/* Nichts erkannt → gezielt nachfragen, NIE bestätigen */
export function clarifyReply(c, kind) {
  const tel = telPart(c);
  if (kind === 'empty') {
    return { texts: [c.pick([
      `Wie können wir Ihnen helfen? Schreiben Sie gern kurz, worum es geht — Beschwerden, Termin oder eine Frage. Bei einem Notfall rufen Sie bitte sofort an${tel}.`,
      `Hallo! Was können wir für Sie tun? Bei einem Notfall bitte nicht schreiben, sondern sofort anrufen${tel}.`,
    ])], asked: 'reason' };
  }
  if (kind === 'question') {
    return { texts: [c.pick([
      'Dazu möchte ich Ihnen nichts Falsches sagen. Um welches Tier geht es, und worum genau — Beschwerden, Termin, Kosten oder etwas anderes?',
      'Das hängt vom Einzelfall ab. Beschreiben Sie mir kurz mehr Details, dann kann ich Ihnen konkreter antworten.',
      'Dazu sage ich lieber nichts ins Blaue — schildern Sie mir kurz die Situation, dann antworte ich konkret.',
      'Das beantworte ich gern, brauche aber noch etwas Kontext: Um welches Tier geht es, und seit wann?',
    ])], asked: 'reason' };
  }
  if (c.pet || c.species) {
    return { texts: [c.pick([
      `Was ist denn mit ${c.D} los? Geht es um Beschwerden, einen Termin oder eine allgemeine Frage?`,
      `Erzählen Sie gern kurz, was bei ${c.D} los ist — dann kann ich gezielt helfen.`,
    ])], asked: 'reason' };
  }
  return { texts: [c.pick([
    'Danke für Ihre Nachricht! Können Sie mir noch kurz sagen, worum es geht — Termin, Beschwerden oder eine allgemeine Frage?',
    'Alles klar. Damit ich richtig helfen kann: Geht es um einen Termin, um Beschwerden oder um eine Frage zu Kosten?',
    `Verstanden! Beschreiben Sie mir gern kurz, worum es geht. Bei akuten Notfällen bitte zusätzlich immer anrufen${tel}.`,
  ])], asked: 'reason' };
}

/* Terminbestätigung (genau einmal) */
export function bookedReply(c, slot, other) {
  const alt = other ? ` Falls Ihnen ${other.label} lieber ist, sagen Sie einfach Bescheid.` : '';
  return { texts: [
    c.pick([
      `Wunderbar — ${slot.label} ist für ${c.T} eingetragen. ✅${alt}`,
      `Perfekt, ich habe ${slot.label} für ${c.T} eingetragen. ✅${alt}`,
    ]),
    c.pick([
      'Bitte bringen Sie, falls vorhanden, den Impfpass mit. Falls etwas dazwischenkommt, sagen Sie einfach Bescheid.',
      `Bis dann! Sollte es ${c.D} vorher schlechter gehen, rufen Sie bitte gleich an${telPart(c)}.`,
    ]),
  ] };
}

export function proposeReply(c, slot, closed) {
  if (closed) {
    const slots = c.slots(true);
    return { texts: [`${closed} Ich hätte stattdessen ${c.slotText(slots)} — passt eines davon?`], asked: 'slot', offer: true, slotsOverride: slots };
  }
  return { texts: [c.pick([
    `${cap(slot.label)} geht — soll ich den Termin so für ${c.T} eintragen?`,
    `${cap(slot.label)} ist möglich. Darf ich das für ${c.T} fest eintragen?`,
  ])], asked: 'confirm-slot', offer: true, slotsOverride: [slot] };
}

export function whichSlotReply(c, slots) {
  return { texts: [`Gern — welcher Termin soll es sein: ${c.slotText(slots)}?`], asked: 'slot', offer: true, slotsOverride: slots };
}

export function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
