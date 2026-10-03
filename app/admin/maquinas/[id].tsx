import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Amount, Card, ErrorText, LabelValue, Loading, Muted, ScrollScreen, SectionTitle } from '../../../src/components';
import { MachineForm } from '../../../src/features/MachineForm';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchMachine, fetchMachineIncomes, friendlyError, updateMachine } from '../../../src/lib/api';

export default function DetalleMaquina() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const machine = useAsync(() => fetchMachine(id), [id]);
  const incomes = useAsync(() => fetchMachineIncomes(id), [id]);

  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: machine.data?.name ?? 'Máquina' }} />
      {machine.error ? <ErrorText>{friendlyError(machine.error)}</ErrorText> : null}
      {!machine.data ? <Loading /> : (
        <MachineForm initial={{ name: machine.data.name, description: machine.data.description ?? '', active: machine.data.active }}
          showActive submitLabel="Guardar cambios"
          onSubmit={async (v) => {
            try { await updateMachine(id, v.name, v.description.trim() || null, v.active); router.back(); return null; }
            catch (e) { return friendlyError(e); }
          }} />
      )}
      <SectionTitle>Historial de ingresos</SectionTitle>
      {incomes.error ? <ErrorText>{friendlyError(incomes.error)}</ErrorText> : null}
      {incomes.data?.length === 0 && <Muted>Esta máquina todavía no tiene ingresos.</Muted>}
      {incomes.data?.map((i) => (
        <Card key={i.id}>
          <LabelValue label={i.income_date}><Amount value={i.amount} tone="positive" size={18} /></LabelValue>
          {i.description ? <Muted>{i.description}</Muted> : null}
        </Card>
      ))}
    </ScrollScreen>
  );
}
