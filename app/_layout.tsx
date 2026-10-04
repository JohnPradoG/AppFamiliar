import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/features/auth/AuthProvider';
import { AppLock } from '../src/features/lock';
import { colors } from '../src/lib/theme';

// Sin esto, en el teléfono la app abre en la primera pantalla declarada ("comprobante") en vez del inicio.
export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AppLock>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="comprobante" options={{ headerShown: true, title: 'Comprobante', headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
        <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones', headerShown: true, headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
        <Stack.Screen name="ayuda" options={{ title: 'Ayuda', headerShown: true, headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
        <Stack.Screen name="familia" options={{ headerShown: true, title: 'Invitar a la familia', headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
      </Stack>
      </AppLock>
    </AuthProvider>
  );
}
