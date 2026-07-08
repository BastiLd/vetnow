/* Start: Hero, Notfall-CTA, Schnellsuche, Ampel-Legende */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { C, S, R } from '../theme';
import { Card, SectionLabel, Notice, LegendMini, Meta, H1, P } from '../components';
import { VNIcon, ANIMAL_ICON } from '../icons';
import { useAppState } from '../lib/AdminContext';

const QUICK = [
  { key: 'cat', label: 'Katze' }, { key: 'dog', label: 'Hund' }, { key: 'small', label: 'Kleintiere' },
  { key: 'horse', label: 'Pferd' }, { key: 'bird', label: 'Vogel' }, { key: 'exotic', label: 'Exoten' },
];

export default function HomeScreen({ navigation }) {
  const { filters, setFilters } = useAppState();
  const goQuick = (animal) => {
    setFilters({ ...filters, animals: [animal] });
    navigation.navigate('SuchenTab', { screen: 'Search' });
  };
  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s7 }}>
      <View>
        <Text style={st.eyebrow}>Tierärztliche Soforthilfe · Kärnten</Text>
        <H1 style={{ marginTop: 6 }}>Schnell die richtige Praxis finden — wenn es zählt.</H1>
        <P style={{ marginTop: 8 }}>Finden Sie eine passende tierärztliche Anlaufstelle in Kärnten — mit tagesaktuellem Status, Notfallinfos und direktem Kontakt.</P>
      </View>

      <TouchableOpacity style={st.cta} activeOpacity={0.85} onPress={() => navigation.navigate('SuchenTab', { screen: 'Search' })}>
        <View style={st.ctaIcon}><VNIcon.siren s={24} c="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.ctaTitle}>Ich brauche jetzt Hilfe</Text>
          <Text style={st.ctaSub}>Notfall-Praxen mit bestätigtem Status finden</Text>
        </View>
        <VNIcon.chevronR s={20} c="#fff" />
      </TouchableOpacity>

      <Notice type="warn"><Text style={{ fontWeight: '700' }}>Keine medizinische Beratung.</Text> Bei akuten Notfällen bitte sofort telefonisch Kontakt aufnehmen.</Notice>

      <View>
        <SectionLabel style={{ marginBottom: 10 }}>Schnellsuche nach Tierart</SectionLabel>
        <View style={st.qaGrid}>
          {QUICK.map((q) => {
            const I = VNIcon[ANIMAL_ICON[q.key]];
            return (
              <TouchableOpacity key={q.key} style={st.qaTile} activeOpacity={0.7} onPress={() => goQuick(q.key)}>
                <View style={st.qaIc}><I s={19} c={C.teal700} /></View>
                <Text style={st.qaLabel}>{q.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <LegendMini />

      <Card>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={st.trustIc}><VNIcon.shield s={18} c={C.teal700} /></View>
          <View style={{ flex: 1 }}>
            <SectionLabel>Tagesaktuell bestätigt</SectionLabel>
            <P style={{ marginTop: 5, fontSize: 13.5 }}>
              Praxen bestätigen ihren Status für jeweils 24 Stunden. Ist die Bestätigung älter, wird die Praxis automatisch grau markiert — verlassen Sie sich nie allein auf einen unbestätigten Status.
            </P>
          </View>
        </View>
      </Card>

      <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('NachrichtenTab')}>
        <Card>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={st.trustIc}><VNIcon.chat s={18} c={C.teal700} /></View>
            <View style={{ flex: 1 }}>
              <SectionLabel>Meine Nachrichten</SectionLabel>
              <Meta>Anfragen und Konversationen mit Praxen ansehen.</Meta>
            </View>
            <VNIcon.chevronR s={16} c={C.ink3} />
          </View>
        </Card>
      </TouchableOpacity>

      <View style={st.footer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <VNIcon.shield s={14} c={C.ink3} />
          <SectionLabel style={{ color: C.ink2 }}>Rechtliche Hinweise</SectionLabel>
        </View>
        {['Diese Plattform ersetzt keine medizinische Beratung.', 'Angaben ohne Gewähr.', 'Bitte bei Notfällen immer telefonisch bestätigen.', 'Nur aktiv bestätigte Praxen werden als aktuell erreichbar markiert.'].map((t) => (
          <Text key={t} style={st.legal}>• {t}</Text>
        ))}
        <Text style={[st.legal, { fontWeight: '700' }]}>• Bei lebensbedrohlichen Notfällen sofort anrufen.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Admin')} style={{ marginTop: 10 }}>
          <Text style={{ color: C.ink3, fontSize: 12.5, textDecorationLine: 'underline' }}>Admin</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: C.teal700 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.teal700, borderRadius: R.xl, padding: 18 },
  ctaIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { color: '#fff', fontWeight: '800', fontSize: 17 },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 2 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaTile: { width: '31.5%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingVertical: 13, alignItems: 'center', gap: 6 },
  qaIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.teal50, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 12.5, fontWeight: '600', color: C.ink },
  trustIc: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.teal50, alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  legal: { fontSize: 12.5, color: C.ink3, marginTop: 3, lineHeight: 18 },
});
