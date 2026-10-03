import { useRouter } from 'expo-router';
import { Amount, Card, ErrorText, LabelValue, Loading, Muted, ScrollScreen, Title } from '../../../src/components';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchDashboard, friendlyError } from '../../../src/lib/api';

export default function Cuentas() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(() => fetchDashboard(null, null), []);
  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Title>Cuentas</Title>
      <Muted>Cada hijo tiene su propia cuenta, independiente de la otra. Toque una para ver su detalle.</Muted>
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data?.accounts.map((a) => (
        <Card key={a.account_id} onPress={() => router.push({ pathname: '/admin/cuentas/[id]', params: { id: a.account_id } })}>
          <Title>{a.display_name} ›</Title>
          <LabelValue label="Saldo actual"><Amount value={a.balance} tone={a.balance < 0 ? 'negative' : 'positive'} size={26} /></LabelValue>
          <LabelValue label="Total asignado"><Amount value={a.assigned} size={16} /></LabelValue>
          <LabelValue label="Total transferido"><Amount value={a.transferred} tone="negative" size={16} /></LabelValue>
        </Card>
      ))}
    </ScrollScreen>
  );
}
