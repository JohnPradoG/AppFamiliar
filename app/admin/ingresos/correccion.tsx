import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Chips, ErrorText, Field, Loading, Muted, ScrollScreen } from '../../../src/components';
import { AccountPicker, AmountField, DateField } from '../../../src/features/FormParts';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchDashboard, friendlyError, registerCorrection } from '../../../src/lib/api';
import { validateCorrection } from '../../../src/lib/forms';
import { toISODate } from '../../../src/lib/period';

// Una corrección ajusta un saldo sin tocar movimientos anteriores. Queda marcada como "corrección" en todo el historial.
export default function Correccion() {
  const router = useRouter();
  const accounts = useAsync(() => fetchDashboard(null, null).then((d) => d.accounts), []);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [negative, setNegative] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [concept, setConcept] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!accounts.data) return <Loading />;

  const submit = async () => {
    const r = validateCorrection({ accountId, amountText: amount, negative, dateText: date, concept });
    if (!r.ok) return setError(r.error);
    setBusy(true); setError(null);
    try { await registerCorrection(r.value); router.back(); } catch (e) { setError(friendlyError(e)); }
    setBusy(false);
  };
  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: 'Registrar corrección' }} />
      <Muted>Use esto solo para arreglar un saldo. Si fue un error de digitación, es mejor editar el movimiento original.</Muted>
      <AccountPicker accounts={accounts.data} value={accountId} onChange={setAccountId} label="Cuenta a corregir" />
      <Chips options={[{ key: 'plus', label: 'Suma al saldo' }, { key: 'minus', label: 'Resta al saldo' }]} value={negative ? 'minus' : 'plus'} onChange={(k) => setNegative(k === 'minus')} />
      <AmountField value={amount} onChange={setAmount} />
      <DateField value={date} onChange={setDate} />
      <Field placeholder="¿Por qué? (obligatorio)" value={concept} onChangeText={setConcept} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Guardar corrección" onPress={submit} busy={busy} />
    </ScrollScreen>
  );
}
