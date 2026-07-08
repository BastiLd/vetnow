/* VetNow Kärnten — Mobile App (Expo / React Navigation) */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppStateProvider, useAppState } from './src/lib/AdminContext';
import { C } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import DetailScreen from './src/screens/DetailScreen';
import RequestScreen from './src/screens/RequestScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import { AuthScreen, LoginScreen, RegisterOwnerScreen, RegisterClinicScreen } from './src/screens/AuthScreens';
import AdminScreen from './src/screens/AdminScreen';

const Stack = createNativeStackNavigator();

function HeaderRight({ navigation }) {
  const { auth } = useAppState();
  if (auth.role === 'clinic') {
    return (
      <TouchableOpacity onPress={() => navigation.navigate('Dashboard')}>
        <Text style={{ color: C.teal700, fontWeight: '700', fontSize: 14 }}>Dashboard</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={() => navigation.navigate(auth.role ? 'Messages' : 'Auth')}>
      <Text style={{ color: C.teal700, fontWeight: '700', fontSize: 14 }}>{auth.role ? 'Konto' : 'Anmelden'}</Text>
    </TouchableOpacity>
  );
}

function Nav() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerTintColor: C.teal700,
          headerTitleStyle: { color: C.ink, fontWeight: '700' },
          headerStyle: { backgroundColor: '#fff' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: C.surface2 },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen}
          options={({ navigation }) => ({ title: 'VetNow Kärnten', headerRight: () => <HeaderRight navigation={navigation} /> })} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Notfall-Suche' }} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Ergebnisse' }} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Praxis-Details' }} />
        <Stack.Screen name="Request" component={RequestScreen} options={{ title: 'Anfrage senden' }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Praxis-Dashboard' }} />
        <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Meine Nachrichten' }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'Willkommen', headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Anmelden' }} />
        <Stack.Screen name="RegisterOwner" component={RegisterOwnerScreen} options={{ title: 'Registrierung' }} />
        <Stack.Screen name="RegisterClinic" component={RegisterClinicScreen} options={{ title: 'Praxis registrieren' }} />
        <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <Nav />
    </AppStateProvider>
  );
}
