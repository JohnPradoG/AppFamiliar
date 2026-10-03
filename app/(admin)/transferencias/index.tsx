import { useRouter } from 'expo-router';
import { Amount, Button, Card, ErrorText, LabelValue, Loading, Muted, ScrollScreen, SectionTitle, Title } from '../../../src/components';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchDashboard, fetchTransfers, friendlyError } from '../../../src/lib/api';

export default function Transferencias() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(async () => {
    const [transfers, dash] = await Promise.all([fetchTransfers(), fetchDashboard(null, null)]);
    return { transfers, names: Object.fromEntries(dash.accounts.map((a) => [a.account_id, a.display_name])) };
  }, []);
  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Title>Transferencias</Title>
      <Button label="Registrar transferencia" onPress={() => router.push('/transferencias/nueva')} />
      <SectionTitle>Últimas transferencias</SectionTitle>
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.transfers.length === 0 && <Muted>Todavía no hay transferencias.</Muted>}
      {data?.transfers.map((t) => (
        <Card key={t.id}>
          <LabelValue label={`A ${data.names[t.account_id] ?? ''}`}><Amount value={t.signed_amount} tone="negative" size={18} /></LabelValue>
          <Muted>{t.movement_date}{t.concept ? ` · ${t.concept}` : ''}</Muted>
        </Card>
      ))}
    </ScrollScreen>
  );
}
