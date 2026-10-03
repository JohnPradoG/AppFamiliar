import { Stack, useRouter } from 'expo-router';
import { Amount, Card, ErrorText, LabelValue, Loading, Muted, ScrollScreen, SectionTitle } from '../../../src/components';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchMyAccount, fetchMySummary, friendlyError } from '../../../src/lib/api';
import { CATEGORY_LABEL, CATEGORY_ORDER, totalsByCategory } from '../../../src/lib/movements';

// "Mi cuenta": de dónde salió el saldo. Cada categoría se puede tocar para ver su detalle.
export default function MiCuenta() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(async () => {
    const acc = await fetchMyAccount();
    return { acc, summary: await fetchMySummary(acc.account_id) };
  }, []);
  const totals = data ? totalsByCategory(data.summary.by_origin) : null;

  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Detalle de mi cuenta' }} />
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && totals && (
        <>
          <Card>
            <Muted>Saldo actual</Muted>
            <Amount value={data.acc.balance} tone={data.acc.balance < 0 ? 'negative' : 'positive'} size={36} />
          </Card>
          <SectionTitle>Origen del saldo</SectionTitle>
          {CATEGORY_ORDER.filter((c) => totals[c] !== 0 || c !== 'correction').map((c) => (
            <Card key={c} onPress={() => router.push({ pathname: '/user/cuenta/[categoria]', params: { categoria: c } })}>
              <LabelValue label={`${CATEGORY_LABEL[c]} ›`}>
                <Amount value={totals[c]} tone={totals[c] < 0 ? 'negative' : 'positive'} size={18} />
              </LabelValue>
            </Card>
          ))}
          {data.summary.opening_balance + Object.values(totals).reduce((a, b) => a + b, 0) !== data.acc.balance && <ErrorText>Los totales no coinciden. Avise a mamá.</ErrorText>}
          <Muted>🔒 Tu información es privada. No puedes ver los movimientos ni los saldos de nadie más.</Muted>
        </>
      )}
    </ScrollScreen>
  );
}
