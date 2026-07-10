/* VetNow Mobile — Build-Konfiguration.
   EXPO_PUBLIC_VN_CLEAN=true  -> "saubere" Version ohne Testdaten (zum Weitergeben).
   Ohne Flag                  -> Demo-Version mit Testdaten.
   Das Studio startet beide Varianten als getrennte Expo-Server (Port 8081/8082). */
export const IS_CLEAN = process.env.EXPO_PUBLIC_VN_CLEAN === 'true' || process.env.EXPO_PUBLIC_VN_CLEAN === '1';
export const APP_MODE = IS_CLEAN ? 'clean' : 'demo';
