import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, ErrorText, Field, Loading, Muted, ScrollScreen, SectionTitle } from '../../../src/components';
import { AuditList } from '../../../src/features/AuditList';
import { AmountField, DateField } from '../../../src/features/FormParts';
import { useAsync } from '../../../src/hooks/useAsync';
import { deleteIncome, fetchAudit, fetchDashboard, fetchIncome, fetchProfileNames, friendlyError, updateIncome, type DashboardAccount, type IncomeDetail } from '../../../src/lib/api';
import { validateIncome } from '../../../src/lib/forms';
import { formatCOP, formatInput } from '../../../src/lib/money';

function IncomeForm({ income, accounts, onDone }: { income: IncomeDetail; accounts: DashboardAccount[]; onDone: () => void }) {
  const [amount, setAmount] = useState(formatInput(String(income.amount)));
  const [date, setDate] = useState(income.income_date);
  const [description, setDescription] = useState(income.description ?? '');
  const [alloc, setAlloc] = useState<Record<string, string>>(() =>
    Object.fromEntries(income.allocations.map((a) => [a.account_id, formatInput(String(a.signed_amount))])));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const r = validateIncome({ machineId: income.machine_id, amountText: amount, dateText: date, description,
      allocations: accounts.map((a) => ({ accountId: a.account_id, amountText: alloc[a.account_id] ?? '' })) });
    if (!r.ok) return setError(r.error);
    setBusy(true); setError(null);
    try { await updateIncome({ id: income.id, amount: r.value.amount, date: r.value.date, description: r.value.description, allocations: r.value.allocations, reason: reason.trim() || null }); onDone(); }
    catch (e) { setError(friendlyError(e)); }
    setBusy(false);
  };
  const remove = () => Alert.alert('¿Está segura de que desea eliminar este ingreso?',
    `Máquina: ${income.machine?.name ?? ''}\nMonto: ${formatCOP(income.amount)}\n\nTambién se quitará lo asignado a las cuentas y sus saldos se recalcularán.`,
    [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => {
      setBusy(true);
      try { await deleteIncome(income.id, reason.trim() || null); onDone(); } catch (e) { setError(friendlyError(e)); }
      setBusy(false);
    } }]);

  return (
    <>
      <Muted>Máquina: {income.machine?.name}</Muted>
      <AmountField value={amount} onChange={setAmount} />
      <DateField value={date} onChange={setDate} />
      <Field placeholder="Observación (opcional)" value={description} onChangeText={setDescription} />
      <SectionTitle>Asignación a cuentas</SectionTitle>
      <Muted>Si el ingreso cambia y solo estaba asignado a una cuenta por completo, revise que el monto asignado siga siendo el correcto.</Muted>
      {accounts.map((a) => <AmountField key={a.account_id} label={`Para ${a.display_name}`} value={alloc[a.account_id] ?? ''} onChange={(v) => setAlloc({ ...alloc, [a.account_id]: v })} />)}
      <Field placeholder="Motivo del cambio (opcional, queda en el registro)" value={reason} onChangeText={setReason} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Guardar cambios" onPress={save} busy={busy} />
      <Button label="Eliminar ingreso" kind="ghost" onPress={remove} busy={busy} />
    </>
  );
}

export default function EditarIngreso() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useAsync(async () => {
    const [income, dash, audit, actors] = await Promise.all([fetchIncome(id), fetchDashboard(null, null), fetchAudit('incomes', id), fetchProfileNames()]);
    return { income, accounts: dash.accounts, audit, actors };
  }, [id]);
  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: 'Ingreso de máquina' }} />
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data ? <Loading /> : data.income.deleted_at ? <ErrorText>Este ingreso fue eliminado.</ErrorText> : (
        <IncomeForm income={data.income} accounts={data.accounts} onDone={() => router.back()} />
      )}
      {data && <AuditList entries={data.audit} table="incomes" actors={data.actors} />}
    </ScrollScreen>
  );
}
