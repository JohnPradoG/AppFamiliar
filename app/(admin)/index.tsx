import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Amount, Button, Card, Chips, ErrorText, LabelValue, Loading, Muted, ScrollScreen, SectionTitle, Title } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { useAsync } from '../../src/hooks/useAsync';
import { fetchDashboard, friendlyError } from '../../src/lib/api';
import { PERIODS, periodRange, type PeriodKey } from '../../src/lib/period';

export default function AdminHome() {
  const { profile } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const { data, error, loading, reload } = useAsync(() => {
    const { from, to } = periodRange(period);
    return fetchDashboard(from, to);
  }, [period]);

  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Title>Hola, {profile?.display_name}</Title>
      <Button label="Registrar ingreso" onPress={() => router.push('/ingresos/nuevo')} />
      <Button label="Agregar saldo" kind="ghost" onPress={() => router.push('/ingresos/saldo')} />
      <Button label="Registrar transferencia" kind="ghost" onPress={() => router.push('/transferencias/nueva')} />
      <Button label="Ver historial completo" kind="ghost" onPress={() => router.push('/historial')} />
      <Chips options={PERIODS} value={period} onChange={setPeriod} />
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && (
        <>
          <Card>
            <SectionTitle>Resumen general</SectionTitle>
            <LabelValue label="Ingresos de máquinas"><Amount value={data.total_machine_income} tone="positive" /></LabelValue>
            <LabelValue label="Total transferido"><Amount value={data.total_transferred} tone="negative" /></LabelValue>
            {data.unassigned_income > 0 && <LabelValue label="Ingresos sin asignar a una cuenta"><Amount value={data.unassigned_income} tone="info" size={16} /></LabelValue>}
            <LabelValue label="Saldo administrado (hoy)"><Amount value={data.managed_balance} tone="info" size={24} /></LabelValue>
          </Card>

          <SectionTitle>Cuentas</SectionTitle>
          {data.accounts.map((a) => (
            <Card key={a.account_id}>
              <LabelValue label={a.display_name}><Amount value={a.balance} tone={a.balance < 0 ? 'negative' : 'positive'} size={24} /></LabelValue>
              <LabelValue label="Asignado en el período"><Amount value={a.assigned} size={16} /></LabelValue>
              <LabelValue label="Transferido en el período"><Amount value={a.transferred} tone="negative" size={16} /></LabelValue>
            </Card>
          ))}

          <SectionTitle>Ingresos por máquina</SectionTitle>
          {data.machines.filter((m) => m.active || m.total > 0).length === 0 && <Muted>Aún no hay máquinas. Créelas en la pestaña Máquinas.</Muted>}
          {data.machines.filter((m) => m.active || m.total > 0).map((m) => (
            <Card key={m.id}>
              <LabelValue label={m.name}><Amount value={m.total} tone="positive" size={18} /></LabelValue>
            </Card>
          ))}
        </>
      )}
    </ScrollScreen>
  );
}
