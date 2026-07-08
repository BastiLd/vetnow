/* Auth: Rolle wählen, Login, Registrierung Tierhalter (1 Schritt) & Praxis (2 Schritte).
   Lebt im Konto-Tab-Stack; nach Login zeigt KontoHome die Konto-Übersicht. */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { C, S, R } from '../theme';
import { Card, Btn, Field, Input, ChoiceGrid, H2, P, Meta, toast } from '../components';
import { VNIcon, ANIMAL_ICON } from '../icons';
import { ANIMALS, DISTRICTS, SERVICE_LABEL, SPECIALTIES } from '../data';
import { useAppState } from '../lib/AdminContext';

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const scrollProps = { automaticallyAdjustKeyboardInsets: true, keyboardShouldPersistTaps: 'handled' };

function Hero() {
  return (
    <View style={st.hero}>
      <View style={st.brandMark}><VNIcon.paw2 s={24} c="#fff" /></View>
      <Text style={st.brandName}>VetNow <Text style={{ color: C.teal100 }}>Kärnten</Text></Text>
    </View>
  );
}

export function AuthScreen({ navigation }) {
  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ paddingBottom: S.s7 }} {...scrollProps}>
      <Hero />
      <View style={{ padding: S.s5, gap: S.s3 }}>
        <View style={{ alignItems: 'center', marginBottom: 6 }}>
          <H2>Willkommen</H2>
          <P style={{ marginTop: 5 }}>Wie möchten Sie VetNow nutzen?</P>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('RegisterOwner')}>
          <Card>
            <View style={st.roleRow}>
              <View style={[st.roleIc, { backgroundColor: C.teal50 }]}><VNIcon.user s={24} c={C.teal700} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.roleTitle}>Ich bin Tierhalter:in</Text>
                <Meta>Praxis finden, anfragen, Nachrichten verwalten</Meta>
              </View>
              <VNIcon.chevronR s={18} c={C.ink3} />
            </View>
          </Card>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('RegisterClinic')}>
          <Card>
            <View style={st.roleRow}>
              <View style={[st.roleIc, { backgroundColor: C.blueBg }]}><VNIcon.building s={24} c={C.blueInk} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.roleTitle}>Ich bin eine Praxis</Text>
                <Meta>Status pflegen, Termine & Nachrichten verwalten</Meta>
              </View>
              <VNIcon.chevronR s={18} c={C.ink3} />
            </View>
          </Card>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={st.switchLink}>Schon registriert? <Text style={{ color: C.teal700, fontWeight: '700' }}>Jetzt anmelden</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export function LoginScreen({ navigation }) {
  const { setAuth } = useAppState();
  const [role, setRole] = React.useState('owner');
  const [f, setF] = React.useState({ id: '', pw: '' });
  const [err, setErr] = React.useState({});
  const submit = () => {
    const e = {};
    if (!f.id) e.id = 'Bitte E-Mail oder Telefonnummer eingeben.';
    if (!f.pw) e.pw = 'Bitte Passwort eingeben.';
    setErr(e);
    if (Object.keys(e).length === 0) {
      setAuth({ role, name: role === 'clinic' ? 'Tierarztpraxis Drautal' : 'Mein Konto' });
      toast('Erfolgreich angemeldet.', 'success');
      navigation.popToTop();
      if (role === 'clinic') navigation.navigate('Dashboard');
    } else {
      toast('Bitte E-Mail und Passwort prüfen.', 'error');
    }
  };
  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ paddingBottom: S.s7 }} {...scrollProps}>
      <Hero />
      <View style={{ padding: S.s5, gap: S.s4 }}>
        <View style={{ alignItems: 'center' }}>
          <H2>Anmelden</H2>
          <P style={{ marginTop: 4 }}>Schön, Sie wiederzusehen.</P>
        </View>
        <View style={st.seg}>
          {[['owner', 'Tierhalter:in'], ['clinic', 'Praxis']].map(([k, l]) => (
            <TouchableOpacity key={k} style={[st.segBtn, role === k && st.segOn]} onPress={() => setRole(k)}>
              <Text style={[st.segText, role === k && { color: C.teal700 }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="E-Mail oder Telefonnummer" req error={err.id}>
          <Input value={f.id} onChangeText={(v) => setF({ ...f, id: v })} placeholder="name@beispiel.at" autoCapitalize="none" hasError={!!err.id} />
        </Field>
        <Field label="Passwort" req error={err.pw}>
          <Input value={f.pw} onChangeText={(v) => setF({ ...f, pw: v })} placeholder="••••••••" secureTextEntry hasError={!!err.pw} />
        </Field>
        <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: -6 }} onPress={() => toast('Link zum Zurücksetzen wurde versendet.', 'success')}>
          <Text style={{ color: C.teal700, fontSize: 13, fontWeight: '600' }}>Passwort vergessen?</Text>
        </TouchableOpacity>
        <Btn label="Anmelden" size="lg" block onPress={submit} />
        <TouchableOpacity onPress={() => navigation.popToTop()} style={{ alignItems: 'center' }}>
          <Text style={st.switchLink}>Noch kein Konto? <Text style={{ color: C.teal700, fontWeight: '700' }}>Registrieren</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function AuthSuccess({ title, text, cta, onGo }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.surface2, padding: S.s5, justifyContent: 'center' }}>
      <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
        <View style={st.okIcon}><VNIcon.check s={32} c={C.green} /></View>
        <H2 style={{ marginTop: 12 }}>{title}</H2>
        <P style={{ marginTop: 8, textAlign: 'center' }}>{text}</P>
        <Btn label={cta} size="lg" block style={{ marginTop: 20 }} onPress={onGo} />
      </Card>
    </View>
  );
}

export function RegisterOwnerScreen({ navigation }) {
  const { setAuth } = useAppState();
  const [done, setDone] = React.useState(false);
  const [f, setF] = React.useState({ name: '', phone: '', email: '', pw: '', animals: [] });
  const [err, setErr] = React.useState({});
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErr((e) => { const n = { ...e }; delete n[k]; return n; }); };
  const submit = () => {
    const e = {};
    if (!f.name) e.name = 'Bitte Namen eingeben.';
    if (!f.phone) e.phone = 'Bitte Telefonnummer eingeben.';
    if (!f.email) e.email = 'Bitte E-Mail eingeben.'; else if (!emailOk(f.email)) e.email = 'Bitte gültige E-Mail eingeben.';
    if (!f.pw) e.pw = 'Bitte Passwort wählen.'; else if (f.pw.length < 6) e.pw = 'Mindestens 6 Zeichen.';
    setErr(e);
    if (Object.keys(e).length === 0) {
      setAuth({ role: 'owner', name: f.name });
      toast('Konto erstellt — willkommen!', 'success');
      setDone(true);
    } else {
      toast('Bitte prüfen Sie die markierten Felder.', 'error');
    }
  };
  if (done) {
    return <AuthSuccess title="Konto erstellt" text="Ihr Tierhalter-Konto ist startklar. Sie können jetzt Praxen finden und anfragen." cta="Praxis suchen"
      onGo={() => { navigation.popToTop(); navigation.navigate('SuchenTab', { screen: 'Search' }); }} />;
  }
  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s8 }} {...scrollProps}>
      <View>
        <Text style={st.eyebrow}>Registrierung · Tierhalter:in</Text>
        <H2 style={{ marginTop: 4 }}>Konto erstellen</H2>
      </View>
      <Field label="Name" req error={err.name}><Input value={f.name} onChangeText={(v) => set('name', v)} placeholder="Vor- und Nachname" hasError={!!err.name} /></Field>
      <Field label="Telefonnummer" req error={err.phone}><Input value={f.phone} onChangeText={(v) => set('phone', v)} placeholder="+43 …" keyboardType="phone-pad" hasError={!!err.phone} /></Field>
      <Field label="E-Mail" req error={err.email}><Input value={f.email} onChangeText={(v) => set('email', v)} placeholder="name@beispiel.at" autoCapitalize="none" keyboardType="email-address" hasError={!!err.email} /></Field>
      <Field label="Passwort" req error={err.pw}><Input value={f.pw} onChangeText={(v) => set('pw', v)} placeholder="Mindestens 6 Zeichen" secureTextEntry hasError={!!err.pw} /></Field>
      <Field label="Tierarten">
        <ChoiceGrid options={ANIMALS.map((a) => ({ ...a, icon: ANIMAL_ICON[a.key] }))} value={f.animals} onChange={(v) => set('animals', v)} multi />
      </Field>
      <Btn label="Konto erstellen" size="lg" block onPress={submit} />
      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ alignItems: 'center' }}>
        <Text style={st.switchLink}>Schon registriert? <Text style={{ color: C.teal700, fontWeight: '700' }}>Anmelden</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export function RegisterClinicScreen({ navigation }) {
  const { setAuth } = useAppState();
  const [step, setStep] = React.useState(1);
  const [done, setDone] = React.useState(false);
  const [f, setF] = React.useState({ name: '', address: '', district: null, hours: '', phone: '', email: '', pw: '', services: [], specialties: [], specialtiesOther: '' });
  const [err, setErr] = React.useState({});
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErr((e) => { const n = { ...e }; delete n[k]; return n; }); };
  const next = () => {
    const e = {};
    if (!f.name) e.name = 'Bitte Praxisname eingeben.';
    if (!f.address) e.address = 'Bitte Adresse eingeben.';
    if (!f.district) e.district = 'Bitte Bezirk wählen.';
    if (!f.hours) e.hours = 'Bitte Öffnungszeiten angeben.';
    if (!f.phone) e.phone = 'Bitte Telefonnummer eingeben.';
    setErr(e);
    if (Object.keys(e).length === 0) setStep(2);
    else toast('Bitte prüfen Sie die markierten Felder.', 'error');
  };
  const submit = () => {
    const e = {};
    if (!f.email) e.email = 'Bitte E-Mail eingeben.'; else if (!emailOk(f.email)) e.email = 'Bitte gültige E-Mail eingeben.';
    if (!f.pw) e.pw = 'Bitte Passwort wählen.'; else if (f.pw.length < 6) e.pw = 'Mindestens 6 Zeichen.';
    if (!f.services.length) e.services = 'Bitte mindestens eine Leistung auswählen.';
    setErr(e);
    if (Object.keys(e).length === 0) {
      setAuth({ role: 'clinic', name: f.name });
      toast('Praxis registriert — willkommen!', 'success');
      setDone(true);
    } else {
      toast('Bitte prüfen Sie die markierten Felder.', 'error');
    }
  };
  if (done) {
    return <AuthSuccess title="Praxis registriert" text="Ihre Praxis ist angelegt. Pflegen Sie jetzt Ihren Status, damit Tierhalter:innen Sie aktuell erreichen." cta="Zum Dashboard"
      onGo={() => { navigation.popToTop(); navigation.navigate('Dashboard'); }} />;
  }
  const serviceOpts = Object.entries(SERVICE_LABEL).map(([key, label]) => ({ key, label }));
  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s8 }} {...scrollProps}>
      <View>
        <Text style={st.eyebrow}>Registrierung · Praxis</Text>
        <H2 style={{ marginTop: 4 }}>{step === 1 ? 'Praxisdaten' : 'Zugang & Leistungen'}</H2>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <View style={[st.stepBar, { backgroundColor: C.teal600 }]} />
          <View style={[st.stepBar, { backgroundColor: step === 2 ? C.teal600 : C.surface3 }]} />
          <Meta style={{ marginTop: 0, marginLeft: 4 }}>Schritt {step} von 2</Meta>
        </View>
      </View>

      {step === 1 ? (
        <>
          <Field label="Praxisname" req error={err.name}><Input value={f.name} onChangeText={(v) => set('name', v)} placeholder="z. B. Tierarztpraxis Drautal" hasError={!!err.name} /></Field>
          <Field label="Adresse" req error={err.address}><Input value={f.address} onChangeText={(v) => set('address', v)} placeholder="Straße, PLZ Ort" hasError={!!err.address} /></Field>
          <Field label="Bezirk" req error={err.district}>
            <ChoiceGrid options={DISTRICTS.map((d) => ({ key: d, label: d }))} value={f.district} onChange={(v) => set('district', v)} />
          </Field>
          <Field label="Öffnungszeiten" req error={err.hours}><Input value={f.hours} onChangeText={(v) => set('hours', v)} placeholder="z. B. Mo–Fr 8–18, Sa 9–12" hasError={!!err.hours} /></Field>
          <Field label="Telefonnummer" req error={err.phone}><Input value={f.phone} onChangeText={(v) => set('phone', v)} placeholder="+43 …" keyboardType="phone-pad" hasError={!!err.phone} /></Field>
          <Btn label="Weiter" size="lg" block onPress={next} />
        </>
      ) : (
        <>
          <Field label="E-Mail" req error={err.email}><Input value={f.email} onChangeText={(v) => set('email', v)} placeholder="praxis@beispiel.at" autoCapitalize="none" keyboardType="email-address" hasError={!!err.email} /></Field>
          <Field label="Passwort" req error={err.pw}><Input value={f.pw} onChangeText={(v) => set('pw', v)} placeholder="Mindestens 6 Zeichen" secureTextEntry hasError={!!err.pw} /></Field>
          <Field label="Angebotene Leistungen" req error={err.services}>
            <Meta style={{ marginBottom: 4 }}>Bitte mindestens eine Option auswählen.</Meta>
            <ChoiceGrid options={serviceOpts} value={f.services} onChange={(v) => set('services', v)} multi />
          </Field>
          <Field label="Spezialgebiete & Zusatzleistungen">
            <Meta style={{ marginBottom: 4 }}>Optional — Mehrfachauswahl möglich.</Meta>
            <ChoiceGrid options={SPECIALTIES} value={f.specialties} onChange={(v) => set('specialties', v)} multi />
            <Input style={{ marginTop: 8 }} value={f.specialtiesOther} onChangeText={(v) => set('specialtiesOther', v)} placeholder="Sonstige / weitere Spezialgebiete" />
          </Field>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn label="Zurück" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => setStep(1)} />
            <Btn label="Registrieren" size="lg" style={{ flex: 1 }} onPress={submit} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { backgroundColor: C.teal700, paddingTop: 28, paddingBottom: 30, alignItems: 'center', gap: 8 },
  brandMark: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  brandName: { color: '#fff', fontWeight: '800', fontSize: 19 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleIc: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: 15.5, fontWeight: '700', color: C.ink },
  switchLink: { fontSize: 13.5, color: C.ink2 },
  seg: { flexDirection: 'row', backgroundColor: C.surface3, borderRadius: R.pill, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: R.pill, alignItems: 'center' },
  segOn: { backgroundColor: C.surface, shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 13.5, fontWeight: '700', color: C.ink2 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: C.teal700 },
  stepBar: { width: 26, height: 6, borderRadius: 3 },
  okIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' },
});
