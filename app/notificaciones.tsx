import { useEffect } from 'react';
import { Text } from 'react-native';
import { Card, ErrorText, Loading, Muted, ScrollScreen } from '../src/components';
import { useAsync } from '../src/hooks/useAsync';
import { fetchNotifications, friendlyError, markNotificationsRead } from '../src/lib/api';
import { colors } from '../src/lib/theme';

// Al abrir la lista se marcan como leídas (después de mostrarlas, para ver cuáles eran nuevas).
export default function Notificaciones() {
  const { data, error, loading, reload } = useAsync(fetchNotifications, []);
  useEffect(() => { if (data?.some((n) => !n.read_at)) void markNotificationsRead(); }, [data]);
  return (
    <ScrollScreen refreshing={loading && !!data} onRefresh={reload}>
      {error ? <ErrorText>{friendlyError(error)}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.length === 0 && <Muted>No tienes notificaciones.</Muted>}
      {data?.map((n) => (
        <Card key={n.id}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: n.read_at ? '500' : '700' }}>{n.read_at ? '' : '● '}{n.title}</Text>
          <Text style={{ color: colors.muted }}>{n.body}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(n.created_at).toLocaleString('es-CO')}</Text>
        </Card>
      ))}
    </ScrollScreen>
  );
}
