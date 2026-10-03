import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Text, View } from 'react-native';
import { Button, Chips, Field, Muted } from '../components';
import { formatCOP, formatInput } from '../lib/money';
import { parseDate } from '../lib/forms';
import { toISODate } from '../lib/period';
import { colors } from '../lib/theme';
import type { DashboardAccount } from '../lib/api';

export function AmountField({ value, onChange, label = 'Monto' }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Muted>{label}</Muted>
      <Field placeholder="$ 0" keyboardType="number-pad" value={value ? `$ ${value}` : ''} onChangeText={(t) => onChange(formatInput(t))} />
    </View>
  );
}

export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const openPicker = () => {
    const current = parseDate(value);
    const base = current ? new Date(Number(current.slice(0, 4)), Number(current.slice(5, 7)) - 1, Number(current.slice(8, 10))) : today;
    DateTimePickerAndroid.open({ value: base, mode: 'date', onValueChange: (_e, d) => onChange(toISODate(d)) });
  };
  return (
    <View style={{ gap: 6 }}>
      <Muted>Fecha</Muted>
      {Platform.OS === 'android' && <Button label={`📅 ${value || 'Elegir fecha'}`} kind="ghost" onPress={openPicker} />}
      {Platform.OS !== 'android' && <Field placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" value={value} onChangeText={onChange} />}
      <Chips options={[{ key: 'today', label: 'Hoy' }, { key: 'yesterday', label: 'Ayer' }]} value={value === toISODate(today) ? 'today' : value === toISODate(yesterday) ? 'yesterday' : ('' as 'today')}
        onChange={(k) => onChange(toISODate(k === 'today' ? today : yesterday))} />
    </View>
  );
}

export function AccountPicker({ accounts, value, onChange, label }: { accounts: DashboardAccount[]; value: string | null; onChange: (id: string) => void; label: string }) {
  const selected = accounts.find((a) => a.account_id === value);
  return (
    <View style={{ gap: 6 }}>
      <Muted>{label}</Muted>
      <Chips options={accounts.map((a) => ({ key: a.account_id, label: a.display_name }))} value={value ?? ''} onChange={onChange} />
      {selected && <Text style={{ color: colors.muted }}>Saldo actual de {selected.display_name}: <Text style={{ color: colors.positive, fontWeight: '700' }}>{formatCOP(selected.balance)}</Text></Text>}
    </View>
  );
}
