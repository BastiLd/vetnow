/* Start: Hero, Notfall-CTA, Schnellsuche, Ampel-Legende */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { C, S, R } from '../theme';
import { Card, SectionLabel, Notice, LegendMini, Meta, H1, P, ANIMAL_EMOJI } from '../components';
import { useAppState } from '../lib/AdminContext';

const QUICK = [
  { key: 'cat', label: 'Katze' }, { key: 'dog', label: 'Hund' }, { key: 'small', label: 'Kleintiere' },
  { key: 'horse', label: 'Pferd' }, { key: 'bird', label: 'Vogel' }, { key: 'exotic', label: 'Exoten' },
];

export default function HomeScreen({ navigation }) {
  const { filters, setFilters } = useAppState();
  const goQuick = (animal) => { setFilters({ ...filters, animal }); navigation.navigate('Search'); };
  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4, paddingBottom: S.s8 }}>
      <View>
        <Text style={st.eyebrow}>Tierärztliche Soforthilfe · Kärnten</Text>
        <H1 style={{ marginTop: 6 }}>Schnell die richtige Praxis finden — wenn es zählt.</H1>
        <P style={{ marginTop: 8 }}>Finden Sie eine passende tierärztliche Anlaufstelle in Kärnten — mit tagesaktuellem Status, Notfallinfos und direktem Kontakt.</P>
      </View>

      <TouchableOpacity style={st.cta} activeOpacity={0.85} onPress={() => navigation.navigate('Search')}>
        <Text style={{ fontSize: 26 }}>🚨</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.ctaTitle}>Ich brauche jetzt Hilfe</Text>
          <Text style={st.ctaSub}>Notfall-Praxen mit bestätigtem Status finden</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>›</Text>
      </TouchableOpacity>

      <Notice type="warn"><Text style={{ fontWeight: '700' }}>Keine medizinische Beratung.</Text> Bei akuten Notfällen bitte sofort telefonisch Kontakt aufnehmen.</Notice>

      <View>
        <SectionLabel style={{ marginBottom: 10 }}>Schnellsuche nach Tierart</SectionLabel>
        <View style={st.qaGrid}>
          {QUICK.map((q) => (
            <TouchableOpacity key={q.key} style={st.qaTile} activeOpacity={0.7} onPress={() => goQuick(q.key)}>
              <Text style={{ fontSize: 20 }}>{ANIMAL_EMOJI[q.key]}</Text>
              <Text style={st.qaLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <LegendMini />

      <Card>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 18 }}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <SectionLabel>Tagesaktuell bestätigt</SectionLabel>
            <P style={{ marginTop: 5, fontSize: 13.5 }}>
              Praxen bestätigen ihren Status für jeweils 24 Stunden. Ist die Bestätigung älter, wird die Praxis automatisch grau markiert — verlassen Sie sich nie allein auf einen unbestätigten Status.
            </P>
          </View>
        </View>
      </Card>

      <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Messages')}>
        <Card>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 18 }}>💬</Text>
            <View style={{ flex: 1 }}>
              <SectionLabel>Meine Nachrichten</SectionLabel>
              <Meta>Anfragen und Konversationen mit Praxen ansehen.</Meta>
            </View>
            <Text style={{ color: C.ink3, fontSize: 18 }}>›</Text>
          </View>
        </Card>
      </TouchableOpacity>

      <View style={st.footer}>
        <SectionLabel style={{ color: C.ink2, marginBottom: 6 }}>Rechtliche Hinweise</SectionLabel>
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
  ctaTitle: { color: '#fff', fontWeight: '800', fontSize: 17 },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 2 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaTile: { width: '31.5%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', gap: 5 },
  qaLabel: { fontSize: 12.5, fontWeight: '600', color: C.ink },
  footer: { marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  legal: { fontSize: 12.5, color: C.ink3, marginTop: 3, lineHeight: 18 },
});
