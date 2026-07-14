/* Avocado at Law — Expo-Go-App.
   Lädt die Avocado-Web-App vom VetNow Studio (Port 3000, Pfad /avocado/).
   Die Studio-Adresse wird automatisch aus der Expo-Verbindung abgeleitet —
   dasselbe Gerät, das den QR-Code liefert, serviert auch die Web-App.
   Override möglich über env EXPO_PUBLIC_AVO_URL (in der Studio-App-Konfig). */
import React from 'react';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

function studioUrl() {
  const override = process.env.EXPO_PUBLIC_AVO_URL;
  if (override) return override;
  const hostUri =
    (Constants.expoConfig && Constants.expoConfig.hostUri) ||
    (Constants.manifest2 && Constants.manifest2.extra && Constants.manifest2.extra.expoGo && Constants.manifest2.extra.expoGo.debuggerHost) ||
    '';
  const host = String(hostUri).split(':')[0];
  return host ? `http://${host}:3000/avocado/` : null;
}

export default function App() {
  const [failed, setFailed] = React.useState(false);
  const [tick, setTick] = React.useState(0); // reload key
  const url = studioUrl();

  if (!url || failed) {
    return (
      <SafeAreaView style={[styles.fill, styles.center]}>
        <StatusBar style="dark" />
        <Text style={styles.emoji}>🥑</Text>
        <Text style={styles.title}>Avocado at Law</Text>
        <Text style={styles.msg}>
          {url
            ? `Die App unter\n${url}\nist nicht erreichbar.\n\nIst das Studio gestartet und die Avocado-Web-App gebaut?`
            : 'Studio-Adresse konnte nicht ermittelt werden.'}
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => { setFailed(false); setTick(t => t + 1); }}>
          <Text style={styles.btnTxt}>NOCHMAL VERSUCHEN</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Vollbild-View (keine SafeArea): die Web-App regelt Notch/Home-Bar selbst
  // über env(safe-area-inset-*) — so sieht es wie eine echte App aus.
  return (
    <View style={styles.shell}>
      <StatusBar style="dark" />
      <WebView
        key={tick}
        source={{ uri: url }}
        style={styles.shell}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <ActivityIndicator size="large" color="#58CC02" />
            <Text style={styles.loading}>Avo kommt gleich …</Text>
          </View>
        )}
        allowsBackForwardNavigationGestures={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#1f2421' },
  shell: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2421', padding: 28 },
  emoji: { fontSize: 64, marginBottom: 10 },
  title: { color: '#EAF7CF', fontSize: 26, fontWeight: '800', marginBottom: 10 },
  msg: { color: '#9fb3a5', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
  btn: { backgroundColor: '#58CC02', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 26 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.6 },
  loading: { color: '#9fb3a5', marginTop: 12, fontSize: 15, fontWeight: '600' },
});
