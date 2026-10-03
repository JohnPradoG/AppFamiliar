import { Stack, useLocalSearchParams } from 'expo-router';
import { Amount, Card, ErrorText, Loading, Muted, MovementRow, ScrollScreen, SectionTitle, LabelValue } from '../../../src/components';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchAccountMovements, fetchDashboard, friendlyError } from '../../../src/lib/api';
import { CATEGORY_LABEL, CATEGORY_ORDER, categoryOf, type Category } from '../../../src/lib/movements';

// Detalle de la cuenta de un hijo (solo mamá): saldo, de dónde viene y todos sus movimientos.
export default function DetalleCuenta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useAsync(async () => {
    const [dash, movements] = await Promise.all([fetchDashboard(null, null), fetchAccountMovements(id)]);
    return { account: dash.accounts.find((a) => a.account_id === id), movements };
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
            {CATEGORY_ORDER.map((c) => (
              <LabelValue key={c} label={CATEGORY_LABEL[c]}><Amount value={totals[c]} tone={totals[c] < 0 ? 'negative' : 'positive'} size={16} /></LabelValue>
            ))}
          </Card>
          <SectionTitle>Movimientos</SectionTitle>
          {data.movements.length === 0 && <Muted>Esta cuenta todavía no tiene movimientos.</Muted>}
          {data.movements.map((m) => <Card key={m.id}><MovementRow m={m} /></Card>)}
        </>
      )}
    </ScrollScreen>
  );
}
