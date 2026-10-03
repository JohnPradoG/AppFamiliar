import { Text, View } from 'react-native';
import { Card, Muted, SectionTitle } from '../components';
import { describeAudit, type AuditEntry, type AuditTable } from '../lib/audit';
import { colors } from '../lib/theme';

// Línea de tiempo de quién hizo qué y cuándo (solo la ve mamá).
export function AuditList({ entries, table, actors }: { entries: AuditEntry[]; table: AuditTable; actors: Record<string, string> }) {
  return (
    <View style={{ gap: 12 }}>
      <SectionTitle>Registro de cambios</SectionTitle>
      {entries.length === 0 && <Muted>Sin registros.</Muted>}
      {entries.map((e) => {
        const d = describeAudit(e, table);
        return (
          <Card key={e.id}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{d.title} por {e.actor_id ? (actors[e.actor_id] ?? 'Usuario') : 'el sistema'}</Text>
            <Muted>{new Date(e.at).toLocaleString('es-CO')}</Muted>
            {d.lines.map((l, i) => <Text key={i} style={{ color: colors.muted }}>{l}</Text>)}
          </Card>
        );
      })}
    </View>
  );
}
