import { Stack } from 'expo-router';
import { colors } from '../lib/theme';

export function StackLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>;
}
