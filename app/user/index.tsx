import { useRouter } from 'expo-router';
import { Amount, Card, ErrorText, LabelValue, Loading, Muted, ScrollScreen, SectionTitle, Title } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { useAsync } from '../../src/hooks/useAsync';
import { fetchMyAccount, fetchMySummary, friendlyError } from '../../src/lib/api';
import { formatSigned } from '../../src/lib/money';

// Inicio del hijo (idéntico para John y el hermano): solo ve SU cuenta; la base de datos no entrega nada más.
export default function UserHome() {
  const { profile } = useAuth();
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(async () => {
    const acc = await fetchMyAccount();
    return { acc, summary: await fetchMySummary(acc.account_id) };
  }, []);

  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Title>Hola, {profile?.display_name}</Title>
      <Muted>Tu cuenta personal</Muted>
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && (
        <>
          <Card onPress={() => router.push('/user/cuenta')}>
            <Muted>Saldo actual</Muted>
            <Amount value={data.acc.balance} tone={data.acc.balance < 0 ? 'negative' : 'positive'} size={36} />
            <Muted>Toca para ver de dónde viene tu saldo ›</Muted>
          </Card>

          <SectionTitle>Resumen de movimientos</SectionTitle>
          <Card>
            <LabelValue label="Total ingresos"><Amount value={data.summary.total_income} tone="positive" size={18} /></LabelValue>
            <LabelValue label="Total transferencias"><Amount value={-data.summary.total_received} tone="negative" size={18} /></LabelValue>
          </Card>

          <SectionTitle>Último movimiento</SectionTitle>
          <Card onPress={() => router.push('/user/historial')}>
            {data.summary.last_movement ? (
              <LabelValue label={data.summary.last_movement.movement_date}>
                <Amount value={data.summary.last_movement.signed_amount} tone={data.summary.last_movement.signed_amount > 0 ? 'positive' : 'negative'} size={18} />
              </LabelValue>
            ) : <Muted>Todavía no hay movimientos.</Muted>}
            {data.summary.last_movement ? <Muted>{formatSigned(data.summary.last_movement.signed_amount)} · ver historial ›</Muted> : null}
          </Card>
        </>
      )}
    </ScrollScreen>
  );
}
