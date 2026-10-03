import { useRouter } from 'expo-router';
import { Amount, Button, Card, ErrorText, LabelValue, Loading, Muted, ScrollScreen, SectionTitle, Title } from '../../../src/components';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchIncomes, friendlyError } from '../../../src/lib/api';
import { formatCOP } from '../../../src/lib/money';

export default function Ingresos() {
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(fetchIncomes, []);
  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Title>Ingresos</Title>
      <Button label="Registrar ingreso de máquina" onPress={() => router.push('/admin/ingresos/nuevo')} />
      <Button label="Agregar saldo a un hijo" kind="ghost" onPress={() => router.push('/admin/ingresos/saldo')} />
      <Button label="Registrar una corrección" kind="ghost" onPress={() => router.push('/admin/ingresos/correccion')} />
      <Button label="Ver máquinas" kind="ghost" onPress={() => router.push('/admin/maquinas')} />
      <SectionTitle>Últimos ingresos de máquinas</SectionTitle>
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.length === 0 && <Muted>Todavía no hay ingresos registrados.</Muted>}
      {data?.map((i) => {
        const assigned = i.allocations.reduce((s, a) => s + a.signed_amount, 0);
        return (
          <Card key={i.id} onPress={() => router.push({ pathname: '/admin/ingresos/[id]', params: { id: i.id } })}>
            <LabelValue label={i.machine?.name ?? 'Máquina'}><Amount value={i.amount} tone="positive" size={18} /></LabelValue>
            <Muted>{i.income_date}{i.description ? ` · ${i.description}` : ''}</Muted>
            <Muted>{assigned === i.amount ? 'Asignado por completo a cuentas' : assigned === 0 ? 'Sin asignar a ninguna cuenta' : `Asignado ${formatCOP(assigned)} · sin asignar ${formatCOP(i.amount - assigned)}`}</Muted>
          </Card>
        );
      })}
    </ScrollScreen>
  );
}
