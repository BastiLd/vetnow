/* Konto-Übersicht (eingeloggt): Rolle, Schnellzugriffe, Abmelden.
   Nicht eingeloggt wird stattdessen AuthScreen gezeigt (siehe App.js). */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C, S, R } from '../theme';
import { Card, SectionLabel, Btn, H2, Meta, toast } from '../components';
import { VNIcon } from '../icons';
import { useAppState } from '../lib/AdminContext';

export default function KontoScreen({ navigation }) {
  const { auth, setAuth } = useAppState();
  const initials = (auth.name || (auth.role === 'clinic' ? 'Praxis' : 'Konto')).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4 }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={st.avatar}><Text style={st.avatarText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <H2>{auth.name}</H2>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={st.dot} />
              <Meta style={{ marginTop: 0 }}>{auth.role === 'clinic' ? 'Praxis' : 'Tierhalter:in'} · eingeloggt</Meta>
            </View>
          </View>
        </View>
      </Card>

      <SectionLabel>Schnellzugriff</SectionLabel>
      {auth.role === 'clinic' ? (
        <Btn label="Zum Praxis-Dashboard" icon="building" size="lg" block onPress={() => navigation.navigate('Dashboard')} />
      ) : null}
      <Btn label="Meine Nachrichten" icon="chat" variant={auth.role === 'clinic' ? 'secondary' : 'primary'} size="lg" block
        onPress={() => navigation.navigate('NachrichtenTab')} />
      <Btn label="Praxis suchen" icon="siren" variant="secondary" size="lg" block
        onPress={() => navigation.navigate('SuchenTab')} />

      <View style={{ marginTop: 10 }}>
        <Btn label="Abmelden" icon="logout" variant="secondary" block
          onPress={() => { setAuth({ role: null, name: '' }); toast('Abgemeldet.', 'info'); }} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.teal100, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: C.teal900 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
});
