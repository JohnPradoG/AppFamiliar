import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Amount, Button, Card, Chips, ErrorText, Field, Loading, Muted, MovementRow, ScrollScreen, SectionTitle, LabelValue } from '../../../src/components';
import { AmountField } from '../../../src/features/FormParts';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchAccountMovements, fetchDashboard, fetchMySummary, friendlyError, setOpeningBalance } from '../../../src/lib/api';
import { validateOpening } from '../../../src/lib/forms';
import { formatInput } from '../../../src/lib/money';
import { CATEGORY_LABEL, CATEGORY_ORDER, categoryOf, type Category } from '../../../src/lib/movements';

// Detalle de la cuenta de un hijo (solo mamá): saldo, de dónde viene y todos sus movimientos.
function OpeningForm({ accountId, current, onSaved }: { accountId: string; current: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(current ? formatInput(String(Math.abs(current))) : '');
  const [negative, setNegative] = useState(current < 0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open) return <Button label="Cambiar saldo inicial" kind="ghost" onPress={() => setOpen(true)} />;
  const save = async () => {
    const r = validateOpening({ amountText: amount, negative });
    if (!r.ok) return setError(r.error);
    setBusy(true); setError(null);
    try { await setOpeningBalance(accountId, r.value.amount, reason.trim() || null); setOpen(false); onSaved(); } catch (e) { setError(friendlyError(e)); }
    setBusy(false);
  };
  return (
    <Card>
      <Muted>El saldo inicial es lo que la cuenta ya tenía antes de usar la app. Se suma al saldo.</Muted>
      <Chips options={[{ key: 'plus', label: 'A favor' }, { key: 'minus', label: 'En contra' }]} value={negative ? 'minus' : 'plus'} onChange={(k) => setNegative(k === 'minus')} />
      <AmountField label="Saldo inicial" value={amount} onChange={setAmount} />
      <Field placeholder="Motivo (opcional)" value={reason} onChangeText={setReason} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Guardar saldo inicial" onPress={save} busy={busy} />
    </Card>
  );
}

export default function DetalleCuenta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(async () => {
    const [dash, movements, summary] = await Promise.all([fetchDashboard(null, null), fetchAccountMovements(id), fetchMySummary(id)]);
    return { account: dash.accounts.find((a) => a.account_id === id), movements, opening: summary.opening_balance };
  }, [id]);

  const totals: Record<Category, number> = { machine: 0, credit: 0, transfer: 0, correction: 0 };
  data?.movements.forEach((m) => { totals[categoryOf(m)] += m.signed_amount; });

  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Stack.Screen options={{ title: data?.account ? `Cuenta de ${data.account.display_name}` : 'Cuenta' }} />
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data?.account && (
        <>
          <Card>
            <Muted>Saldo actual</Muted>
            <Amount value={data.account.balance} tone={data.account.balance < 0 ? 'negative' : 'positive'} size={36} />
          </Card>
          <SectionTitle>Origen del saldo</SectionTitle>
          <Card>
            {data.opening !== 0 && <LabelValue label="Saldo inicial"><Amount value={data.opening} tone={data.opening < 0 ? 'negative' : 'positive'} size={16} /></LabelValue>}
            {CATEGORY_ORDER.map((c) => (
              <LabelValue key={c} label={CATEGORY_LABEL[c]}><Amount value={totals[c]} tone={totals[c] < 0 ? 'negative' : 'positive'} size={16} /></LabelValue>
            ))}
          </Card>
          <OpeningForm accountId={id} current={data.opening} onSaved={reload} />
          <SectionTitle>Movimientos</SectionTitle>
          {data.movements.length === 0 && <Muted>Esta cuenta todavía no tiene movimientos.</Muted>}
          {data.movements.map((m) => <Card key={m.id} onPress={() => router.push({ pathname: '/admin/historial/[id]', params: { id: m.id } })}><MovementRow m={m} /></Card>)}
        </>
      )}
    </ScrollScreen>
  );
}
