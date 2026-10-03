import { ErrorText, Loading, Muted, ScrollScreen, Title } from '../../src/components';
import { ReceiptCard } from '../../src/features/ReceiptList';
import { useAsync } from '../../src/hooks/useAsync';
import { fetchReceipts, friendlyError } from '../../src/lib/api';

// Solo llegan los comprobantes de MIS movimientos (la base de datos no entrega ningún otro).
export default function Comprobantes() {
  const { data, error, loading, reload } = useAsync(fetchReceipts, []);
  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      <Title>Mis comprobantes</Title>
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.length === 0 && <Muted>Todavía no tienes comprobantes. Cuando mamá adjunte uno a una transferencia, aparecerá aquí.</Muted>}
      {data?.map((r) => <ReceiptCard key={r.id} r={r} />)}
    </ScrollScreen>
  );
}
