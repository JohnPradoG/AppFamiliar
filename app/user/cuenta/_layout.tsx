import { Stack } from 'expo-router';
import { colors } from '../../../src/lib/theme';

export default function CuentaLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg } }} />;
}
