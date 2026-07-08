/* Anfrage senden: Formular mit Validierung + Bestätigungsansicht */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { C, S } from '../theme';
import { Card, Notice, Btn, Field, Input, ChoiceGrid, H2, P, toast } from '../components';
import { VNIcon, ANIMAL_ICON, SERVICE_ICON } from '../icons';
import { ANIMALS, SITUATIONS, DISTRICTS, ANIMAL_LABEL, SERVICE_LABEL } from '../data';
import { useAppState } from '../lib/AdminContext';
import { useChats } from '../lib/ChatContext';
import { callPractice } from './ResultsScreen';

export default function RequestScreen({ route, navigation }) {
  const { data, filters, auth } = useAppState();
  const { createChat } = useChats();
  const p = route.params?.practiceId ? data.PRACTICES.find((x) => x.id === route.params.practiceId) : null;
  const loggedIn = auth && auth.role;
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState({});
  const [chatId, setChatId] = React.useState(null);
  const [form, setForm] = React.useState({
    name: '', phone: '',
    animal: (filters.animals && filters.animals[0]) || null,
    situation: (filters.situations && filters.situations[0]) || null,
    district: (filters.districts && filters.districts[0]) || (p ? p.district : null),
    message: '',
    agree: false,
  });
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErr((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; }); };

  const submit = () => {
    const e = {};
    if (!form.name) e.name = 'Bitte Namen eingeben.';
    if (!form.phone) e.phone = 'Bitte Telefonnummer eingeben.';
    else if ((form.phone.match(/\d/g) || []).length < 6) e.phone = 'Bitte gültige Telefonnummer eingeben (für den Rückruf der Praxis).';
    if (!form.agree) e.agree = 'Bitte bestätigen Sie den Hinweis.';
    setErr(e);
    if (Object.keys(e).length === 0) {
      const parts = [];
      if (form.animal) parts.push(ANIMAL_LABEL[form.animal]);
      if (form.situation) parts.push(SERVICE_LABEL[form.situation]);
      const firstMsg = form.message.trim() || 'Guten Tag, ich hätte gern einen Termin.';
      const id = createChat({
        role: 'owner',
        title: p ? p.name : 'Neue Anfrage',
        sub: [form.district, ...parts].filter(Boolean).join(' · '),
        animal: form.animal || 'other',
        color: '#0f9b8e',
        icon: form.animal ? ANIMAL_ICON[form.animal] : 'chat',
        labels: ['tiere'],
        messages: [{ from: 'owner', text: firstMsg, time: 'jetzt' }],
      });
      setChatId(id);
      setSent(true);
      toast('Anfrage gesendet — als Chat gespeichert.', 'success');
    } else toast('Bitte prüfen Sie die markierten Felder.', 'error');
  };

  if (sent) {
    return (
      <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5 }}>
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <View style={st.okIcon}><VNIcon.check s={30} c={C.green} /></View>
          <H2 style={{ marginTop: 10 }}>Vielen Dank!</H2>
          <P style={{ marginTop: 8, textAlign: 'center' }}>
            Ihre Anfrage{p ? ' an ' + p.name : ''} wurde als <Text style={{ fontWeight: '700' }}>neuer Chat</Text> gespeichert. <Text style={{ fontWeight: '700' }}>Bei akuten Notfällen bitte zusätzlich telefonisch Kontakt aufnehmen.</Text>
          </P>
          <View style={{ gap: 8, marginTop: 20, alignSelf: 'stretch' }}>
            <Btn label="Zum Chat" icon="chat" block onPress={() => navigation.navigate('ChatThread', { chatId })} />
            {p ? <Btn label={p.name + ' anrufen'} icon="phone" variant="secondary" block onPress={() => callPractice(p)} /> : null}
            <Btn label="Zurück zu den Ergebnissen" variant="ghost" block onPress={() => navigation.navigate('Results')} />
          </View>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: C.surface2 }}
      contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s8 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
        <View>
          <H2>Anfrage senden</H2>
          <P style={{ marginTop: 5 }}>
            {p ? <>An <Text style={{ fontWeight: '700', color: C.ink }}>{p.name}</Text>. </> : null}
            Kein Live-Chat — die Praxis meldet sich zurück.
          </P>
        </View>

        {!loggedIn ? (
          <Notice type="info">Bitte anmelden, um Ihre Konversationen zu speichern. Sie können das Formular auch ohne Konto absenden.</Notice>
        ) : null}

        <Field label="Name" req error={err.name}>
          <Input value={form.name} onChangeText={(v) => set('name', v)} placeholder="Ihr Name" hasError={!!err.name} />
        </Field>
        <Field label="Telefonnummer" req error={err.phone}>
          <Input value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="+43 …" keyboardType="phone-pad" hasError={!!err.phone} />
        </Field>
        <Field label="Tierart">
          <ChoiceGrid options={ANIMALS.map((a) => ({ ...a, icon: ANIMAL_ICON[a.key] }))} value={form.animal} onChange={(v) => set('animal', v)} />
        </Field>
        <Field label="Situation">
          <ChoiceGrid options={SITUATIONS.map((s) => ({ ...s, icon: SERVICE_ICON[s.key] }))} value={form.situation} onChange={(v) => set('situation', v)} />
        </Field>
        <Field label="Bezirk / Ort">
          <ChoiceGrid options={DISTRICTS.map((d) => ({ key: d, label: d }))} value={form.district} onChange={(v) => set('district', v)} />
        </Field>
        <Field label="Kurze Nachricht">
          <Input value={form.message} onChangeText={(v) => set('message', v)} placeholder="Was ist passiert? Seit wann? Welche Symptome?" multiline />
        </Field>

        <TouchableOpacity style={st.agreeRow} onPress={() => set('agree', !form.agree)} activeOpacity={0.7}>
          <View style={[st.box, form.agree && st.boxOn]}>{form.agree ? <VNIcon.check s={13} c="#fff" /> : null}</View>
          <Text style={st.agreeText}>Ich verstehe, dass dies keine medizinische Beratung ersetzt und ich bei akuten Notfällen zusätzlich telefonisch Kontakt aufnehmen muss.</Text>
        </TouchableOpacity>
        {err.agree ? <Text style={{ color: C.redInk, fontSize: 12.5 }}>⚠ {err.agree}</Text> : null}

        <Btn label="Anfrage senden" icon="send" size="lg" block onPress={submit} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  okIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  agreeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  boxOn: { backgroundColor: C.teal600, borderColor: C.teal600 },
  agreeText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: C.ink2 },
});
