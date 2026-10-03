import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, ErrorText, Field, Muted } from '../components';
import { colors } from '../lib/theme';

export type MachineFormValues = { name: string; description: string; active: boolean };

export function MachineForm({ initial, showActive, submitLabel, onSubmit }: {
  initial: MachineFormValues; showActive: boolean; submitLabel: string;
  onSubmit: (v: MachineFormValues) => Promise<string | null>;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!v.name.trim()) return setError('Escriba el nombre de la máquina.');
    setBusy(true); setError(null);
    setError(await onSubmit({ ...v, name: v.name.trim() }));
    setBusy(false);
  };

  return (
    <View style={{ gap: 16 }}>
      <Field placeholder="Nombre (ej. Máquina 1)" value={v.name} onChangeText={(name) => setV({ ...v, name })} />
      <Field placeholder="Descripción (opcional)" value={v.description} onChangeText={(description) => setV({ ...v, description })} />
      {showActive && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.text, fontSize: 17 }}>Máquina activa</Text>
            <Muted>Si la desactiva, no podrá registrar ingresos nuevos, pero el historial se conserva.</Muted>
          </View>
          <Switch value={v.active} onValueChange={(active) => setV({ ...v, active })} />
        </View>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      <Button label={submitLabel} onPress={submit} busy={busy} />
    </View>
  );
}
