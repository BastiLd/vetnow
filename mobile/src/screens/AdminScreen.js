/* Admin: Login + Schalter "Testdaten ausblenden" (AsyncStorage, nur dieses Gerät) */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C, S } from '../theme';
import { Card, SectionLabel, Notice, Btn, Field, Input, SwitchRow, H2, P, Meta } from '../components';
import { checkAdminLogin } from '../lib/admin';
import { useAppState } from '../lib/AdminContext';
import { PRACTICES, CONVERSATIONS, OWNER_CONVERSATIONS } from '../data';

export default function AdminScreen({ navigation }) {
  const { hideTestData, setHideTestData, adminLoggedIn, setAdminLoggedIn } = useAppState();
  const [user, setUser] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [err, setErr] = React.useState('');

  const testCount = PRACTICES.filter((p) => p.isTestData).length;
  const chatCount = CONVERSATIONS.filter((c) => c.isTestData).length + OWNER_CONVERSATIONS.filter((c) => c.isTestData).length;

  if (!adminLoggedIn) {
    return (
      <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5 }}>
        <Card>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 22 }}>🔒</Text>
            <View>
              <H2>Admin-Login</H2>
              <Meta>Nur für Betreiber:innen der Plattform.</Meta>
            </View>
          </View>
          <View style={{ gap: 12 }}>
            <Field label="Benutzername">
              <Input value={user} onChangeText={setUser} placeholder="admin" autoCapitalize="none" hasError={!!err} />
            </Field>
            <Field label="Passwort" error={err}>
              <Input value={pw} onChangeText={setPw} placeholder="••••••••" secureTextEntry hasError={!!err} />
            </Field>
            <Btn label="Anmelden" size="lg" block onPress={() => {
              if (checkAdminLogin(user.trim(), pw)) { setErr(''); setAdminLoggedIn(true); }
              else setErr('Benutzername oder Passwort falsch.');
            }} />
          </View>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5, gap: S.s4 }}>
      <View>
        <H2>Admin-Bereich</H2>
        <P style={{ marginTop: 5 }}>Einstellungen für dieses Gerät.</P>
      </View>

      <SwitchRow
        title="Testdaten ausblenden"
        sub={`Blendet alle Demo-Einträge aus (${testCount} Praxen, ${chatCount} Konversationen samt Demo-Terminen).`}
        on={hideTestData}
        onToggle={setHideTestData}
      />

      <Notice type="info">
        Dieser Schalter wirkt nur auf diesem Gerät (AsyncStorage). Andere Nutzer:innen sehen weiterhin die Testdaten.
        Ein globaler Schalter für alle würde ein Backend (z. B. Supabase, kostenloser Tarif, eigenes Konto nötig) erfordern — bewusst nicht eingebaut.
      </Notice>

      <Notice type="warn">Zugangsdaten sind im Code hinterlegt (src/lib/admin.js) — nach dem Testen ändern!</Notice>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Abmelden" variant="secondary" style={{ flex: 1 }} onPress={() => setAdminLoggedIn(false)} />
        <Btn label="Zur Startseite" style={{ flex: 1 }} onPress={() => navigation.navigate('Home')} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({});
