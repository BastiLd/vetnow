/* VetNow Kärnten — Mobile App.
   Navigation: Bottom-Tabs (Start / Suchen / Nachrichten / Konto) wie ein Dock,
   darüber ein Root-Stack für Chat-Threads und Admin (Zurück per Wisch-Geste). */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppStateProvider, useAppState } from './src/lib/AdminContext';
import { C } from './src/theme';
import { ToastHost } from './src/components';
import { VNIcon } from './src/icons';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import DetailScreen from './src/screens/DetailScreen';
import RequestScreen from './src/screens/RequestScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import KontoScreen from './src/screens/KontoScreen';
import ChatThreadScreen from './src/screens/ChatThreadScreen';
import { AuthScreen, LoginScreen, RegisterOwnerScreen, RegisterClinicScreen } from './src/screens/AuthScreens';
import AdminScreen from './src/screens/AdminScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const StartStack = createNativeStackNavigator();
const SuchenStack = createNativeStackNavigator();
const NachrichtenStack = createNativeStackNavigator();
const KontoStack = createNativeStackNavigator();

const stackOptions = {
  headerTintColor: C.teal700,
  headerTitleStyle: { color: C.ink, fontWeight: '700' },
  headerStyle: { backgroundColor: '#fff' },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: C.surface2 },
  fullScreenGestureEnabled: true, // Zurück per Wisch von überall (iOS)
};

function StartStackNav() {
  return (
    <StartStack.Navigator screenOptions={stackOptions}>
      <StartStack.Screen name="Home" component={HomeScreen} options={{ title: 'VetNow Kärnten' }} />
    </StartStack.Navigator>
  );
}

function SuchenStackNav() {
  return (
    <SuchenStack.Navigator screenOptions={stackOptions}>
      <SuchenStack.Screen name="Search" component={SearchScreen} options={{ title: 'Notfall-Suche' }} />
      <SuchenStack.Screen name="Results" component={ResultsScreen} options={{ title: 'Ergebnisse' }} />
      <SuchenStack.Screen name="Detail" component={DetailScreen} options={{ title: 'Praxis-Details' }} />
      <SuchenStack.Screen name="Request" component={RequestScreen} options={{ title: 'Anfrage senden' }} />
    </SuchenStack.Navigator>
  );
}

function NachrichtenStackNav() {
  return (
    <NachrichtenStack.Navigator screenOptions={stackOptions}>
      <NachrichtenStack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Meine Nachrichten' }} />
    </NachrichtenStack.Navigator>
  );
}

function KontoHome(props) {
  const { auth } = useAppState();
  return auth.role ? <KontoScreen {...props} /> : <AuthScreen {...props} />;
}

function KontoStackNav() {
  const { auth } = useAppState();
  return (
    <KontoStack.Navigator screenOptions={stackOptions}>
      <KontoStack.Screen name="KontoHome" component={KontoHome} options={{ title: auth.role ? 'Konto' : 'Willkommen', headerShown: !!auth.role }} />
      <KontoStack.Screen name="Login" component={LoginScreen} options={{ title: 'Anmelden' }} />
      <KontoStack.Screen name="RegisterOwner" component={RegisterOwnerScreen} options={{ title: 'Registrierung' }} />
      <KontoStack.Screen name="RegisterClinic" component={RegisterClinicScreen} options={{ title: 'Praxis registrieren' }} />
      <KontoStack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Praxis-Dashboard' }} />
    </KontoStack.Navigator>
  );
}

/* ---- Bottom-Tabs: immer sichtbares Dock ---- */
function Tabs() {
  const { auth, ownerUnread } = useAppState();
  const unread = Object.values(ownerUnread).reduce((a, b) => a + b, 0);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.teal700,
        tabBarInactiveTintColor: C.ink3,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: C.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="StartTab" component={StartStackNav}
        options={{ title: 'Start', tabBarIcon: ({ color, size }) => <VNIcon.home s={size - 2} c={color} /> }} />
      <Tab.Screen name="SuchenTab" component={SuchenStackNav}
        options={{ title: 'Suchen', tabBarIcon: ({ color, size }) => <VNIcon.siren s={size - 2} c={color} /> }} />
      <Tab.Screen name="NachrichtenTab" component={NachrichtenStackNav}
        options={{
          title: 'Nachrichten',
          tabBarIcon: ({ color, size }) => <VNIcon.chat s={size - 2} c={color} />,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: C.teal600, color: '#fff', fontSize: 10.5, fontWeight: '800' },
        }} />
      <Tab.Screen name="KontoTab" component={KontoStackNav}
        options={{ title: auth.role ? 'Konto' : 'Anmelden', tabBarIcon: ({ color, size }) => <VNIcon.user s={size - 2} c={color} /> }} />
    </Tab.Navigator>
  );
}

function Nav() {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={stackOptions}>
        <RootStack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <RootStack.Screen name="ChatThread" component={ChatThreadScreen} options={{ title: 'Chat' }} />
        <RootStack.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin' }} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <Nav />
      <ToastHost />
    </AppStateProvider>
  );
}
