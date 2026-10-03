import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, ErrorText, Field, Loading, ScrollScreen } from '../../../src/components';
import { ReceiptPicker } from '../../../src/features/ReceiptPicker';
import { AccountPicker, AmountField, DateField } from '../../../src/features/FormParts';
import { useAsync } from '../../../src/hooks/useAsync';
import { fetchDashboard, friendlyError, isInsufficientFunds, registerTransfer, uploadReceipt, type PickedFile } from '../../../src/lib/api';
import { validateTransfer } from '../../../src/lib/forms';
import { formatCOP } from '../../../src/lib/money';
import { toISODate } from '../../../src/lib/period';

// Una transferencia baja el saldo del hijo (es dinero que mamá ya le envió). El comprobante es opcional.
export default function NuevaTransferencia() {
  const router = useRouter();
  const accounts = useAsync(() => fetchDashboard(null, null).then((d) => d.accounts), []);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [concept, setConcept] = useState('');
  const [receipt, setReceipt] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!accounts.data) return <Loading />;

  const save = async (v: NonNullable<ReturnType<typeof validateTransfer> & { ok: true }>['value'], allowOverdraft: boolean) => {
    setBusy(true); setError(null);
    try {
      const movementId = await registerTransfer(v, allowOverdraft);
      if (receipt) {
        try { await uploadReceipt(v.accountId, movementId, receipt); }
        catch (up) {
          // La transferencia YA quedó guardada; solo falló el comprobante. Se avisa y se puede adjuntar después.
          Alert.alert('Transferencia guardada', `${up instanceof Error ? up.message : 'No se pudo subir el comprobante.'}\nPuede adjuntarlo después desde el detalle de la transferencia.`);
        }
      }
      router.back();
    }
    catch (e) {
      if (isInsufficientFunds(e)) {
        const acc = accounts.data!.find((a) => a.account_id === v.accountId);
        Alert.alert('Saldo insuficiente', `${acc?.display_name} tiene ${formatCOP(acc?.balance ?? 0)} y usted quiere transferir ${formatCOP(v.amount)}. ¿Transferir de todos modos? El saldo quedaría en negativo.`, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Transferir de todos modos', style: 'destructive', onPress: () => void save(v, true) },
        ]);
      } else setError(friendlyError(e));
    }
    setBusy(false);
  };

  const submit = () => {
    const r = validateTransfer({ accountId, amountText: amount, dateText: date, concept });
    if (!r.ok) return setError(r.error);
    void save(r.value, false);
  };

  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: 'Transferir dinero' }} />
      <AccountPicker accounts={accounts.data} value={accountId} onChange={setAccountId} label="Destinatario" />
      <AmountField value={amount} onChange={setAmount} />
      <DateField value={date} onChange={setDate} />
      <Field placeholder="Concepto (ej. Transferencia personal)" value={concept} onChangeText={setConcept} />
      <ReceiptPicker value={receipt} onChange={setReceipt} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Guardar transferencia" onPress={submit} busy={busy} />
    </ScrollScreen>
  );
}
