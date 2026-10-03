import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Field, Loading, Muted, ScrollScreen, SectionTitle, Chips } from '../../../src/components';
import { AmountField, DateField } from '../../../src/features/FormParts';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchActiveMachines, fetchDashboard, friendlyError, registerIncome } from '../../../src/lib/api';
import { validateIncome } from '../../../src/lib/forms';
import { toISODate } from '../../../src/lib/period';

// Un ingreso de máquina NO se reparte solo: mamá decide cuánto (si algo) va a cada cuenta. Lo no asignado no toca ningún saldo.
export default function NuevoIngreso() {
  const router = useRouter();
  const machines = useAsync(fetchActiveMachines, []);
  const accounts = useAsync(() => fetchDashboard(null, null).then((d) => d.accounts), []);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [description, setDescription] = useState('');
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!machines.data || !accounts.data) return <Loading />;

  const submit = async () => {
    const r = validateIncome({ machineId, amountText: amount, dateText: date, description,
      allocations: accounts.data!.map((a) => ({ accountId: a.account_id, amountText: alloc[a.account_id] ?? '' })) });
    if (!r.ok) return setError(r.error);
    setBusy(true); setError(null);
    try { await registerIncome(r.value); router.back(); }
    catch (e) { setError(friendlyError(e)); }
    setBusy(false);
  };

  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: 'Nuevo ingreso de máquina' }} />
      {machines.data.length === 0 ? <ErrorText>Primero cree una máquina (Ingresos → Ver máquinas).</ErrorText> : (
        <>
          <Muted>Máquina</Muted>
          <Chips options={machines.data.map((m) => ({ key: m.id, label: m.name }))} value={machineId ?? ''} onChange={setMachineId} />
        </>
      )}
      <AmountField value={amount} onChange={setAmount} />
      <DateField value={date} onChange={setDate} />
      <Field placeholder="Observación (opcional)" value={description} onChangeText={setDescription} />
      <SectionTitle>¿A quién se le asigna?</SectionTitle>
      <Muted>Es opcional y puede ser distinto para cada hijo. Lo que no asigne queda como ingreso general y no cambia ningún saldo.</Muted>
      {accounts.data.map((a) => (
        <AmountField key={a.account_id} label={`Para ${a.display_name}`} value={alloc[a.account_id] ?? ''} onChange={(v) => setAlloc({ ...alloc, [a.account_id]: v })} />
      ))}
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Guardar ingreso" onPress={submit} busy={busy} />
    </ScrollScreen>
  );
}
