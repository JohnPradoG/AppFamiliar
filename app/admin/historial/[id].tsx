import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Amount, Button, Card, Chips, ErrorText, Field, LabelValue, Loading, Muted, ScrollScreen, SectionTitle } from '../../../src/components';
import { AuditList } from '../../../src/features/AuditList';
import { AmountField, DateField } from '../../../src/features/FormParts';
import { ReceiptPicker } from '../../../src/features/ReceiptPicker';
import { ReceiptCard } from '../../../src/features/ReceiptList';
import { useAsync } from '../../../src/hooks/useAsync';
import { deleteMovement, deleteReceipt, fetchAccountNames, fetchAudit, fetchMovement, fetchMovementReceipts, fetchProfileNames, friendlyError, updateMovement, uploadReceipt, type AdminMovement, type PickedFile } from '../../../src/lib/api';
import { validateMovementEdit } from '../../../src/lib/forms';
import { formatCOP, formatInput } from '../../../src/lib/money';
import { CATEGORY_LABEL, categoryOf, movementTitle } from '../../../src/lib/movements';

function EditForm({ m, onSaved }: { m: AdminMovement; onSaved: () => void }) {
  const kind = m.kind as 'credit' | 'transfer' | 'correction';
  const [amount, setAmount] = useState(formatInput(String(Math.abs(m.signed_amount))));
  const [negative, setNegative] = useState(m.signed_amount < 0);
  const [date, setDate] = useState(m.movement_date);
  const [concept, setConcept] = useState(m.concept ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const r = validateMovementEdit({ kind, amountText: amount, negative, dateText: date, concept });
    if (!r.ok) return setError(r.error);
    setBusy(true); setError(null);
    try { await updateMovement(m.id, r.value.amount, r.value.date, r.value.concept, reason.trim() || null); onSaved(); }
    catch (e) { setError(friendlyError(e)); }
    setBusy(false);
  };

  return (
    <>
      <SectionTitle>Editar movimiento</SectionTitle>
      {kind === 'correction' && <Chips options={[{ key: 'plus', label: 'Suma' }, { key: 'minus', label: 'Resta' }]} value={negative ? 'minus' : 'plus'} onChange={(k) => setNegative(k === 'minus')} />}
      <AmountField value={amount} onChange={setAmount} />
      <DateField value={date} onChange={setDate} />
      <Field placeholder="Concepto" value={concept} onChangeText={setConcept} />
      <Field placeholder="Motivo del cambio (opcional, queda en el registro)" value={reason} onChangeText={setReason} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Guardar cambios" onPress={save} busy={busy} />
    </>
  );
}

export default function DetalleMovimiento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error: loadError, loading, reload } = useAsync(async () => {
    const [m, names, receipts, audit, actors] = await Promise.all([fetchMovement(id), fetchAccountNames(), fetchMovementReceipts(id), fetchAudit('account_movements', id), fetchProfileNames()]);
    return { m, names, receipts, audit, actors };
  }, [id]);

  if (!data) return <ScrollScreen>{loadError ? <ErrorText>{friendlyError(loadError)}</ErrorText> : <Loading />}</ScrollScreen>;
  const { m, names, receipts, audit, actors } = data;
  const deleted = m.deleted_at !== null;
  const who = names[m.account_id ?? ''] ?? '';

  const confirmDelete = () => Alert.alert(
    '¿Está segura de que desea eliminar este movimiento?',
    `Tipo: ${CATEGORY_LABEL[categoryOf(m)]}\nMonto: ${formatCOP(Math.abs(m.signed_amount))}\n${m.kind === 'transfer' ? 'Destinatario' : 'Cuenta'}: ${who}\n\nEl saldo se recalcula solo y el movimiento queda en el registro.`,
    [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => {
      setBusy(true); setError(null);
      try { await deleteMovement(m.id, reason.trim() || null); router.back(); } catch (e) { setError(friendlyError(e)); }
      setBusy(false);
    } }],
  );

  const attach = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try { await uploadReceipt(m.account_id!, m.id, file); setFile(null); reload(); } catch (e) { setError(e instanceof Error ? e.message : friendlyError(e)); }
    setBusy(false);
  };
  const removeReceipt = (rid: string) => Alert.alert('¿Quitar este comprobante?', 'Se conserva en el registro, pero ya no se mostrará.', [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Quitar', style: 'destructive', onPress: async () => { try { await deleteReceipt(rid); reload(); } catch (e) { setError(friendlyError(e)); } } },
  ]);

  return (
    <ScrollScreen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ title: movementTitle(m) }} />
      <Card>
        <LabelValue label={CATEGORY_LABEL[categoryOf(m)]}><Amount value={m.signed_amount} tone={m.signed_amount < 0 ? 'negative' : 'positive'} size={26} /></LabelValue>
        <Muted>{m.kind === 'transfer' ? 'Destinatario' : 'Cuenta'}: {who}</Muted>
        <Muted>Fecha: {m.movement_date}{m.concept ? ` · ${m.concept}` : ''}</Muted>
        {deleted && <ErrorText>Este movimiento fue eliminado y ya no cuenta en el saldo.</ErrorText>}
      </Card>

      {!deleted && m.income_id && (
        <Card>
          <Muted>Este movimiento viene de un ingreso de máquina. Para cambiar el monto o el reparto, edite el ingreso.</Muted>
          <Button label="Editar el ingreso" onPress={() => router.push({ pathname: '/admin/ingresos/[id]', params: { id: m.income_id! } })} />
        </Card>
      )}
      {!deleted && !m.income_id && <EditForm m={m} onSaved={() => router.back()} />}

      <SectionTitle>Comprobantes</SectionTitle>
      {receipts.length === 0 && <Muted>Sin comprobantes.</Muted>}
      {receipts.map((r) => <ReceiptCard key={r.id} r={r} onRemove={deleted ? undefined : () => removeReceipt(r.id)} />)}
      {!deleted && (
        <>
          <ReceiptPicker value={file} onChange={setFile} />
          {file && <Button label="Subir comprobante" onPress={attach} busy={busy} />}
        </>
      )}

      {!deleted && !m.income_id && (
        <>
          <SectionTitle>Eliminar</SectionTitle>
          <Field placeholder="Motivo (opcional)" value={reason} onChangeText={setReason} />
          <Button label="Eliminar movimiento" kind="ghost" onPress={confirmDelete} busy={busy} />
        </>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      <AuditList entries={audit} table="account_movements" actors={actors} />
    </ScrollScreen>
  );
}
