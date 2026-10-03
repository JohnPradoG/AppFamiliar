import { Stack } from 'expo-router';
import { colors } from '../../../src/lib/theme';

export default function MaquinasLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" options={{ title: 'Máquinas' }} />
    </Stack>;
}
