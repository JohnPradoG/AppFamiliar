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

// ───────── Componentes de la Fase 2 ─────────
import { RefreshControl, ScrollView } from 'react-native';
import { formatCOP } from './lib/format-reexport';

export function ScrollScreen({ children, refreshing, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.info} /> : undefined}>
      {children}
    </ScrollView>
  );
}
export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const body = <View style={cardStyles.card}>{children}</View>;
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}
export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={cardStyles.section}>{children}</Text>;
}
export function Amount({ value, tone = 'neutral', size = 20 }: { value: number; tone?: 'positive' | 'negative' | 'info' | 'neutral'; size?: number }) {
  const color = tone === 'positive' ? colors.positive : tone === 'negative' ? colors.negative : tone === 'info' ? colors.info : colors.text;
  return <Text style={{ color, fontSize: size, fontWeight: '700' }}>{formatCOP(value)}</Text>;
}
export function LabelValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
      <Text style={[styles.muted, { flexShrink: 1 }]}>{label}</Text>
      {children}
    </View>
  );
}
export function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={[cardStyles.chip, o.key === value && cardStyles.chipOn]}>
          <Text style={{ color: o.key === value ? '#06122B' : colors.muted, fontWeight: '600' }}>{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
const cardStyles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.border },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: space.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.info, borderColor: colors.info },
});

// ───────── Movimientos (Fase 3) ─────────
import { formatSigned } from './lib/money';
import { movementSubtitle, movementTitle, type Movement } from './lib/movements';

export function MovementRow({ m, accountName }: { m: Movement; accountName?: string }) {
  const positive = m.signed_amount > 0;
  const color = positive ? colors.positive : colors.negative;
  const sub = movementSubtitle(m);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color, fontSize: 20, fontWeight: '700' }}>{m.kind === 'correction' ? '±' : positive ? '↓' : '↑'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', textDecorationLine: m.deleted_at ? 'line-through' : 'none' }}>{movementTitle(m)}{accountName ? ` → ${accountName}` : ''}{m.kind === 'correction' ? '  · corrección' : ''}{m.deleted_at ? '  · eliminado' : ''}</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{m.movement_date}{sub ? ` · ${sub}` : ''}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Registrado por Mamá · modificado {m.updated_at.slice(0, 10)}</Text>
      </View>
      <Text style={{ color, fontSize: 17, fontWeight: '700' }}>{formatSigned(m.signed_amount)}</Text>
    </View>
  );
}
