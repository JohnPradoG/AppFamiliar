import { Stack } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { Button, Card, ErrorText, Field, Loading, Muted, ScrollScreen, SectionTitle } from '../../src/components';
import { inviteMessage } from '../../src/features/auth/links';
import { useAsync } from '../../src/hooks/useAsync';
import { fetchMembers, inviteMember } from '../../src/lib/api';

const APK_URL = process.env.EXPO_PUBLIC_APK_URL;
const SLOTS = [{ key: 'john', label: 'John' }, { key: 'brother', label: 'Hermano' }] as const;

function Slot({ ownerKey, label, registered, onDone }: { ownerKey: 'john' | 'brother'; label: string; registered: string | null; onDone: () => void }) {
  const [name, setName] = useState(label === 'Hermano' ? '' : label);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true); setError(null);
    try {
      const r = await inviteMember(ownerKey, registered ? undefined : email, registered ? undefined : name);
      await Share.share({ message: inviteMessage(registered ?? name.trim(), APK_URL, r.link) });
      onDone();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo crear la invitación.');
    }
    setBusy(false);
  };

  return (
    <Card>
      <SectionTitle>{registered ?? label}</SectionTitle>
      {registered ? (
        <>
          <Muted>Ya tiene cuenta. Si olvidó su contraseña o no alcanzó a crearla, genere un enlace nuevo y envíeselo.</Muted>
          {error && <ErrorText>{error}</ErrorText>}
          <Button label="Enviar enlace nuevo" onPress={send} busy={busy} kind="ghost" />
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <Field placeholder="Nombre" value={name} onChangeText={setName} />
          <Field placeholder="Correo de esa persona" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          {error && <ErrorText>{error}</ErrorText>}
          <Button label="Crear invitación y enviar por WhatsApp" onPress={send} busy={busy} />
        </View>
      )}
    </Card>
  );
}

export default function Familia() {
  const { data, loading, reload } = useAsync(fetchMembers, []);
  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: 'Invitar a la familia' }} />
      <Muted>
        Usted crea la invitación y la comparte por WhatsApp. Cada persona crea su propia contraseña: usted nunca la conoce ni tiene que enviarla.
        El enlace sirve una sola vez.
      </Muted>
      {!data && loading ? <Loading /> : SLOTS.map((s) => (
        <Slot key={s.key + (data?.find((m) => m.owner_key === s.key)?.display_name ?? '')} ownerKey={s.key} label={s.label}
          registered={data?.find((m) => m.owner_key === s.key)?.display_name ?? null} onDone={reload} />
      ))}
    </ScrollScreen>
  );
}
