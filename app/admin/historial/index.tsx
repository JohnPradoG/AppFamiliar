import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Card, Chips, ErrorText, Field, Loading, Muted, MovementRow, ScrollScreen, Title } from '../../../src/components';
import { exportCSV } from '../../../src/features/exportCsv';
import { DateField } from '../../../src/features/FormParts';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchAccountNames, fetchActiveMachines, fetchHistory, friendlyError } from '../../../src/lib/api';
import { filterByAmount, movementsToCSV, ORDERS, sortMovements, type Order } from '../../../src/lib/history';
import { parseCOP, formatInput } from '../../../src/lib/money';
import { parseDate } from '../../../src/lib/forms';
import { PERIODS, periodRange, toISODate, type PeriodKey } from '../../../src/lib/period';
import { colors } from '../../../src/lib/theme';

type PeriodOpt = PeriodKey | 'custom';
const KINDS = [
  { key: 'all', label: 'Todos' }, { key: 'machine_income', label: 'Máquinas' }, { key: 'credit', label: 'Saldo agregado' },
  { key: 'transfer', label: 'Transferencias' }, { key: 'correction', label: 'Correcciones' },
];

export default function Historial() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodOpt>('month');
  const [from, setFrom] = useState(toISODate(new Date()));
  const [to, setTo] = useState(toISODate(new Date()));
  const [kind, setKind] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const [machineId, setMachineId] = useState('all');
  const [order, setOrder] = useState<Order>('recent');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const range = period === 'custom' ? { from: parseDate(from), to: parseDate(to) } : periodRange(period);
  const meta = useAsync(async () => ({ names: await fetchAccountNames(), machines: await fetchActiveMachines() }), []);
  const { data, error, loading, reload } = useAsync(() => fetchHistory({
    from: range.from, to: range.to, kind: kind === 'all' ? null : kind, accountId: accountId === 'all' ? null : accountId,
    machineId: machineId === 'all' ? null : machineId, includeDeleted,
  }), [period, from, to, kind, accountId, machineId, includeDeleted]);

  const list = useMemo(() => (data ? sortMovements(filterByAmount(data, parseCOP(min), parseCOP(max)), order) : []), [data, min, max, order]);
  const names = meta.data?.names ?? {};

  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Title>Historial</Title>
      <Chips options={[...PERIODS, { key: 'custom' as const, label: 'Personalizado' }]} value={period} onChange={setPeriod} />
      {period === 'custom' && (
        <>
          <Muted>Desde</Muted><DateField value={from} onChange={setFrom} />
          <Muted>Hasta</Muted><DateField value={to} onChange={setTo} />
        </>
      )}
      <Chips options={KINDS} value={kind} onChange={setKind} />
      <Chips options={[{ key: 'all', label: 'Todas las cuentas' }, ...Object.entries(names).map(([id, n]) => ({ key: id, label: n }))]} value={accountId} onChange={setAccountId} />
      {(meta.data?.machines.length ?? 0) > 0 && (
        <Chips options={[{ key: 'all', label: 'Todas las máquinas' }, ...meta.data!.machines.map((m) => ({ key: m.id, label: m.name }))]} value={machineId} onChange={setMachineId} />
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field style={{ flex: 1 }} placeholder="Monto mínimo" keyboardType="number-pad" value={min ? `$ ${min}` : ''} onChangeText={(t) => setMin(formatInput(t))} />
        <Field style={{ flex: 1 }} placeholder="Monto máximo" keyboardType="number-pad" value={max ? `$ ${max}` : ''} onChangeText={(t) => setMax(formatInput(t))} />
      </View>
      <Chips options={ORDERS} value={order} onChange={setOrder} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text }}>Mostrar eliminados</Text>
        <Switch value={includeDeleted} onValueChange={setIncludeDeleted} />
      </View>

      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && <Muted>{list.length} movimiento{list.length === 1 ? '' : 's'}{data.length >= 500 ? ' (se muestran los 500 más recientes: afine los filtros)' : ''}</Muted>}
      {data && list.length > 0 && <Button label="Exportar a Excel (CSV)" kind="ghost" onPress={() => void exportCSV(movementsToCSV(list, names))} />}
      {list.map((m) => (
        <Card key={m.id} onPress={() => router.push({ pathname: '/admin/historial/[id]', params: { id: m.id } })}>
          <MovementRow m={m} accountName={names[m.account_id ?? '']} />
        </Card>
      ))}
    </ScrollScreen>
  );
}
