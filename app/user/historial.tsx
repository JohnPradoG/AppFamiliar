import { useState } from 'react';
import { Card, Chips, ErrorText, Loading, Muted, MovementRow, ScrollScreen, Title } from '../../src/components';
import { useAsync } from '../../src/hooks/useAsync';
import { fetchMyMovements, friendlyError } from '../../src/lib/api';
import { filterByTab, type Tab } from '../../src/lib/movements';

const TABS: { key: Tab; label: string }[] = [{ key: 'all', label: 'Todos' }, { key: 'income', label: 'Ingresos' }, { key: 'transfer', label: 'Transferencias' }];

export default function Historial() {
  const [tab, setTab] = useState<Tab>('all');
  const { data, error, loading, reload } = useAsync(fetchMyMovements, []);
  const list = data ? filterByTab(data, tab) : [];
  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Title>Mi historial</Title>
      <Chips options={TABS} value={tab} onChange={setTab} />
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && list.length === 0 && <Muted>No hay movimientos para mostrar.</Muted>}
      {list.map((m) => <Card key={m.id}><MovementRow m={m} /></Card>)}
    </ScrollScreen>
  );
}
