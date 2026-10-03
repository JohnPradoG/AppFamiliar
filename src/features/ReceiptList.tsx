import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, Muted } from '../components';
import type { Receipt } from '../lib/api';
import { formatSigned } from '../lib/money';
import { colors } from '../lib/theme';

export function ReceiptCard({ r, onRemove }: { r: Receipt; onRemove?: () => void }) {
  const router = useRouter();
  const m = r.movement;
  return (
    <Card onPress={() => router.push({ pathname: '/comprobante', params: { path: r.storage_path, mime: r.mime_type } })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 28 }}>{r.mime_type === 'application/pdf' ? '📄' : '🧾'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{m ? (m.kind === 'transfer' ? 'Transferencia' : 'Movimiento') : 'Comprobante'}{m ? ` · ${formatSigned(m.signed_amount)}` : ''}</Text>
          <Muted>{m?.movement_date ?? r.created_at.slice(0, 10)}{m?.concept ? ` · ${m.concept}` : ''}</Muted>
        </View>
        <Text style={{ color: colors.info, fontWeight: '600' }}>Ver ›</Text>
      </View>
      {onRemove && <Text onPress={onRemove} style={{ color: colors.negative, marginTop: 6 }}>Quitar comprobante</Text>}
    </Card>
  );
}
