/* Notfall-Suche: Tierart / Situation / Bezirk / Spezialisierungen / Nur-bestätigte */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C, S } from '../theme';
import { SectionLabel, ChoiceGrid, SwitchRow, Btn, H2, P, Meta } from '../components';
import { ANIMAL_ICON, SERVICE_ICON } from '../icons';
import { ANIMALS, SITUATIONS, DISTRICTS, SPECIALTIES } from '../data';
import { useAppState } from '../lib/AdminContext';

export default function SearchScreen({ navigation }) {
  const { filters, setFilters } = useAppState();
  const set = (k, v) => setFilters({ ...filters, [k]: v });

  const animalOpts = ANIMALS.map((a) => ({ ...a, icon: ANIMAL_ICON[a.key] }));
  const sitOpts = SITUATIONS.map((s) => ({ ...s, icon: SERVICE_ICON[s.key] }));
  const distOpts = DISTRICTS.map((d) => ({ key: d, label: d }));

  const chosen = (filters.animals.length ? 1 : 0) + (filters.situations.length ? 1 : 0) + (filters.districts.length ? 1 : 0) + (filters.specialties.length ? 1 : 0);
  const extras = [
    ['onlyConfirmed', 'Nur aktuell bestätigte Praxen', 'Blendet graue (nicht bestätigte) Einträge aus.'],
    ['onlyGreen', 'Nur heute erreichbar (grün)', 'Zeigt nur Praxen, die heute Notfälle annehmen.'],
    ['housecall', 'Bietet Hausbesuche', 'Nur Praxen mit Hausbesuch-Angebot.'],
    ['is24h', 'Rund um die Uhr (24 h)', 'Nur durchgehend erreichbare Praxen.'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.surface2 }}>
      <ScrollView contentContainerStyle={{ padding: S.s5, gap: S.s5, paddingBottom: 110 }}>
        <View style={st.progressRow}>
          <Meta>{chosen === 0 ? 'Auswahl starten' : chosen + ' von 4 Kategorien gewählt'}</Meta>
          <View style={st.bar}><View style={[st.fill, { width: `${Math.max(6, (chosen / 4) * 100)}%` }]} /></View>
        </View>

        <View>
          <H2>Wonach suchen Sie?</H2>
          <P style={{ marginTop: 5 }}>Alle Angaben sind optional und mehrfach wählbar. Je genauer, desto besser passen die Ergebnisse.</P>
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Tierart (Mehrfachauswahl)</SectionLabel>
          <ChoiceGrid options={animalOpts} value={filters.animals} onChange={(v) => set('animals', v)} multi />
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Situation (Mehrfachauswahl)</SectionLabel>
          <ChoiceGrid options={sitOpts} value={filters.situations} onChange={(v) => set('situations', v)} multi />
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Bezirk (Mehrfachauswahl)</SectionLabel>
          <ChoiceGrid options={distOpts} value={filters.districts} onChange={(v) => set('districts', v)} multi />
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Spezialisierungen (Mehrfachauswahl)</SectionLabel>
          <ChoiceGrid options={SPECIALTIES} value={filters.specialties} onChange={(v) => set('specialties', v)} multi />
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Weitere Filter</SectionLabel>
          {extras.map(([key, title, sub]) => (
            <SwitchRow key={key} title={title} sub={sub} on={filters[key]} onToggle={(v) => set(key, v)} />
          ))}
        </View>
      </ScrollView>

      <View style={st.sticky}>
        <Btn label="Ergebnisse anzeigen ›" size="lg" block onPress={() => navigation.navigate('Results')} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  progressRow: { gap: 8 },
  bar: { height: 6, backgroundColor: C.surface3, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: C.teal600, borderRadius: 3 },
  sticky: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: S.s4, paddingBottom: S.s6, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line },
});
