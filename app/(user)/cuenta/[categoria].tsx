import { Stack, useLocalSearchParams } from 'expo-router';
import { Card, ErrorText, Loading, Muted, MovementRow, ScrollScreen } from '../../../src/components';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchMyMovements, friendlyError } from '../../../src/lib/api';
import { CATEGORY_LABEL, categoryOf, type Category } from '../../../src/lib/movements';

export default function DetalleCategoria() {
  const { categoria } = useLocalSearchParams<{ categoria: Category }>();
  const { data, error, loading } = useAsync(fetchMyMovements, []);
  const list = data?.filter((m) => categoryOf(m) === categoria) ?? [];
  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: CATEGORY_LABEL[categoria] ?? 'Detalle' }} />
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && list.length === 0 && <Muted>No hay movimientos en esta categoría.</Muted>}
      {list.map((m) => <Card key={m.id}><MovementRow m={m} /></Card>)}
    </ScrollScreen>
  );
}
