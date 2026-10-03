import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Chips, ErrorText, Field, Loading, Muted, ScrollScreen } from '../../../src/components';
import { AccountPicker, AmountField, DateField } from '../../../src/features/FormParts';
import { useAsync } from '../../../src/hooks/useAsync';
import { addBalance, fetchDashboard, friendlyError } from '../../../src/lib/api';
import { validateCredit, type Origin } from '../../../src/lib/forms';
import { toISODate } from '../../../src/lib/period';

const ORIGINS: { key: Origin; label: string }[] = [
  { key: 'work', label: 'Trabajo' }, { key: 'machine', label: 'Máquina' }, { key: 'other', label: 'Otro' }, { key: 'custom', label: 'Personalizado' },
];

// Agrega saldo DIRECTO a un hijo (aumenta solo su cuenta; la del hermano no cambia).
export default function AgregarSaldo() {
  const router = useRouter();
  const accounts = useAsync(() => fetchDashboard(null, null).then((d) => d.accounts), []);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [origin, setOrigin] = useState<Origin>('work');
  const [detail, setDetail] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!accounts.data) return <Loading />;

  const submit = async () => {
    const r = validateCredit({ accountId, amountText: amount, dateText: date, origin, detail, description });
    if (!r.ok) return setError(r.error);
    setBusy(true); setError(null);
    try { await addBalance(r.value); router.back(); }
    catch (e) { setError(friendlyError(e)); }
    setBusy(false);
  };

  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: 'Agregar saldo' }} />
      <AccountPicker accounts={accounts.data} value={accountId} onChange={setAccountId} label="Agregar saldo a" />
      <AmountField value={amount} onChange={setAmount} />
      <Muted>Origen</Muted>
      <Chips options={ORIGINS} value={origin} onChange={setOrigin} />
      {origin === 'custom' && <Field placeholder="¿Cuál origen? (ej. Venta de bicicleta)" value={detail} onChangeText={setDetail} />}
      <DateField value={date} onChange={setDate} />
      <Field placeholder="Observación (opcional)" value={description} onChangeText={setDescription} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Guardar" onPress={submit} busy={busy} />
    </ScrollScreen>
  );
}
