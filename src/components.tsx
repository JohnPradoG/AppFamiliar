import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, space } from './lib/theme';

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}
export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}
export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}
export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}
export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}
export function Button({ label, onPress, busy, kind = 'primary' }: { label: string; onPress: () => void; busy?: boolean; kind?: 'primary' | 'ghost' }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={[styles.btn, kind === 'ghost' && styles.btnGhost, busy && { opacity: 0.6 }]}>
      {busy ? <ActivityIndicator color={colors.text} /> : <Text style={[styles.btnText, kind === 'ghost' && { color: colors.info }]}>{label}</Text>}
    </Pressable>
  );
}
export function Loading() {
  return <View style={[styles.screen, { justifyContent: 'center' }]}><ActivityIndicator color={colors.info} size="large" /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 16 },
  error: { color: colors.negative, fontSize: 15 },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.button, color: colors.text, fontSize: 17, paddingHorizontal: space.md, paddingVertical: 14 },
  btn: { backgroundColor: colors.info, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { color: '#06122B', fontSize: 17, fontWeight: '700' },
});
