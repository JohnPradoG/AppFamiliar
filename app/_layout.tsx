import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/features/auth/AuthProvider';
import { colors } from '../src/lib/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="familia" options={{ headerShown: true, title: 'Invitar a la familia', headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
      </Stack>
    </AuthProvider>
  );
}
