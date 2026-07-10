/* Admin: Login + Schalter "Testdaten ausblenden" (AsyncStorage, nur dieses Gerät) */
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { C, S } from '../theme';
import { Card, Notice, Btn, Field, Input, SwitchRow, SectionLabel, H2, P, Meta, toast } from '../components';
import { VNIcon } from '../icons';
import { checkAdminLogin } from '../lib/admin';
import { useAppState } from '../lib/AdminContext';
import { useChats } from '../lib/ChatContext';
import { PRACTICES, CHATS_SEED } from '../data';

export default function AdminScreen({ navigation }) {
  const { hideTestData, setHideTestData, adminLoggedIn, setAdminLoggedIn, isClean } = useAppState();
  const { settings, setSetting } = useChats();
  const [user, setUser] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [err, setErr] = React.useState('');

  const testCount = PRACTICES.filter((p) => p.isTestData).length;
  const chatCount = CHATS_SEED.filter((c) => c.isTestData).length;

  if (!adminLoggedIn) {
    return (
      <ScrollView style={{ backgroundColor: C.surface2 }} contentContainerStyle={{ padding: S.s5 }} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
        <Card>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <View style={st.lockIc}><VNIcon.lock s={20} c={C.teal700} /></View>
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
              if (checkAdminLogin(user.trim(), pw)) { setErr(''); setAdminLoggedIn(true); toast('Als Admin angemeldet.', 'success'); }
              else { setErr('Benutzername oder Passwort falsch.'); toast('Login fehlgeschlagen.', 'error'); }
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

      {isClean ? (
        <Notice type="info">Dies ist die <Text style={{ fontWeight: '700' }}>saubere Version</Text> — Testdaten sind fest deaktiviert (Demo-Version über das Studio auf Port 8082).</Notice>
      ) : (
        <SwitchRow
          title="Testdaten ausblenden"
          sub={`Blendet alle Demo-Einträge aus (${testCount} Praxen, ${chatCount} Konversationen samt Demo-Terminen).`}
          on={hideTestData}
          onToggle={(v) => { setHideTestData(v); toast(v ? 'Testdaten werden ausgeblendet.' : 'Testdaten werden wieder angezeigt.', 'success'); }}
        />
      )}

      <Notice type="info">
        Dieser Schalter wirkt nur auf diesem Gerät (AsyncStorage). Andere Nutzer:innen sehen weiterhin die Testdaten.
        Ein globaler Schalter für alle würde ein Backend (z. B. Supabase, kostenloser Tarif, eigenes Konto nötig) erfordern — bewusst nicht eingebaut.
      </Notice>

      <View style={{ gap: 10 }}>
        <SectionLabel>Auto-Antwort-Bot (Demo)</SectionLabel>
        <SwitchRow title="Automatische Antworten" sub="Wenn du schreibst, antwortet die Gegenseite automatisch (mit Tipp-Animation)." on={settings.botEnabled} onToggle={(v) => { setSetting('botEnabled', v); toast(v ? 'Bot aktiviert.' : 'Bot deaktiviert.', 'success'); }} />
        <SwitchRow title="Tipp-Animation (3 Punkte)" sub={'Zeigt Punkte, während die Gegenseite tippt.'} on={settings.botTyping} onToggle={(v) => setSetting('botTyping', v)} />
        <SwitchRow title="Begrüßung beim ersten Öffnen" sub="Leerer Chat wird automatisch begrüßt." on={settings.botGreeting} onToggle={(v) => setSetting('botGreeting', v)} />
      </View>

      <Notice type="warn">Zugangsdaten sind im Code hinterlegt (src/lib/admin.js) — nach dem Testen ändern!</Notice>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Abmelden" icon="logout" variant="secondary" style={{ flex: 1 }} onPress={() => { setAdminLoggedIn(false); toast('Abgemeldet.', 'info'); }} />
        <Btn label="Zur Startseite" style={{ flex: 1 }} onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  lockIc: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.teal50, alignItems: 'center', justifyContent: 'center' },
});
