/* Notfall-Suche: Tierart / Situation / Bezirk / Spezialisierungen / Nur-bestätigte */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C, S } from '../theme';
import { SectionLabel, ChoiceGrid, SwitchRow, Btn, H2, P, Meta, ANIMAL_EMOJI, SERVICE_EMOJI } from '../components';
import { ANIMALS, SITUATIONS, DISTRICTS, SPECIALTIES } from '../data';
import { useAppState } from '../lib/AdminContext';

export default function SearchScreen({ navigation }) {
  const { filters, setFilters } = useAppState();
  const set = (k, v) => setFilters({ ...filters, [k]: v });

  const animalOpts = ANIMALS.map((a) => ({ ...a, emoji: ANIMAL_EMOJI[a.key] }));
  const sitOpts = SITUATIONS.map((s) => ({ ...s, emoji: SERVICE_EMOJI[s.key] }));
  const distOpts = DISTRICTS.map((d) => ({ key: d, label: d }));

  const steps = [!!filters.animal, !!filters.situation, !!filters.district, !!(filters.specialties && filters.specialties.length)];
  const doneCount = steps.filter(Boolean).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.surface2 }}>
      <ScrollView contentContainerStyle={{ padding: S.s5, gap: S.s5, paddingBottom: 110 }}>
        <View style={st.progressRow}>
          <Meta>{doneCount === 0 ? 'Auswahl starten' : doneCount + ' von 4 gewählt'}</Meta>
          <View style={st.bar}><View style={[st.fill, { width: `${Math.max(6, (doneCount / 4) * 100)}%` }]} /></View>
        </View>

        <View>
          <H2>Wonach suchen Sie?</H2>
          <P style={{ marginTop: 5 }}>Alle Angaben sind optional. Je genauer, desto besser passen die Ergebnisse.</P>
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Tierart</SectionLabel>
          <ChoiceGrid options={animalOpts} value={filters.animal} onChange={(v) => set('animal', v)} />
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Situation</SectionLabel>
          <ChoiceGrid options={sitOpts} value={filters.situation} onChange={(v) => set('situation', v)} />
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Bezirk</SectionLabel>
          <ChoiceGrid options={distOpts} value={filters.district} onChange={(v) => set('district', v)} />
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Spezialisierungen (Mehrfachauswahl)</SectionLabel>
          <ChoiceGrid options={SPECIALTIES} value={filters.specialties} onChange={(v) => set('specialties', v)} multi />
        </View>

        <SwitchRow
          title="Nur aktuell bestätigte Praxen"
          sub="Blendet graue (nicht bestätigte) Einträge aus."
          on={filters.onlyConfirmed}
          onToggle={(v) => set('onlyConfirmed', v)}
        />
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
