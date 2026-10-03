import { useRouter } from 'expo-router';
import { Amount, Button, Card, ErrorText, LabelValue, Loading, Muted, ScrollScreen, Title } from '../../../src/components';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchDashboard, friendlyError } from '../../../src/lib/api';
import { periodRange } from '../../../src/lib/period';

export default function Maquinas() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(() => {
    const { from, to } = periodRange('month');
    return fetchDashboard(from, to);
  }, []);
  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Title>Máquinas</Title>
      <Button label="Crear máquina" onPress={() => router.push('/admin/maquinas/nueva')} />
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.machines.length === 0 && <Muted>Todavía no hay máquinas.</Muted>}
      {data?.machines.map((m) => (
        <Card key={m.id} onPress={() => router.push({ pathname: '/admin/maquinas/[id]', params: { id: m.id } })}>
          <LabelValue label={m.active ? m.name : `${m.name} (desactivada)`}><Amount value={m.total} tone="positive" size={18} /></LabelValue>
          <Muted>Total generado este mes</Muted>
        </Card>
      ))}
    </ScrollScreen>
  );
}
