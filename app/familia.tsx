import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { Switch, Text } from 'react-native';
import { Button, Card, ErrorText, Field, Loading, Muted, ScrollScreen, SectionTitle } from '../src/components';
import { inviteMessage } from '../src/features/auth/links';
import { useAuth } from '../src/features/auth/AuthProvider';
import { useAsync } from '../src/hooks/useAsync';
import { fetchMembers, inviteMember, setHelper, type Member } from '../src/lib/api';
import { colors } from '../src/lib/theme';

const SLOTS = [{ key: 'john', label: 'John' }, { key: 'brother', label: 'Hermano' }] as const;

function Slot({ ownerKey, label, registered, member, isAdmin, onDone }: { ownerKey: 'john' | 'brother'; label: string; registered: string | null; member?: Member; isAdmin: boolean; onDone: () => void }) {
  const [name, setName] = useState(label === 'Hermano' ? '' : label);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true); setError(null);
    try {
      const r = await inviteMember(ownerKey, registered ? undefined : email, registered ? undefined : name);
      await Share.share({ message: inviteMessage(r.display_name, r.link, r.code) });
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
          <Muted>Ya tiene cuenta. Si olvidó su contraseña, genere un enlace nuevo y envíeselo: solo sirve una vez y el anterior queda anulado.</Muted>
          {isAdmin && member?.user_id && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <View style={{ flexShrink: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16 }}>Puede ayudar a invitar</Text>
                <Muted>Solo envía invitaciones. No ve dinero ni movimientos de nadie más.</Muted>
              </View>
              <Switch value={member.is_helper} onValueChange={async (v) => { try { await setHelper(member.user_id!, v); onDone(); } catch { setError('No se pudo cambiar el permiso.'); } }} />
            </View>
          )}
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
  const { loading: authLoading, profile } = useAuth();
  const allowed = profile?.role === 'admin' || profile?.is_helper === true;
  const { data, loading, reload } = useAsync(() => (allowed ? fetchMembers() : Promise.resolve([] as Member[])), [allowed]);
  if (authLoading) return <Loading />;
  if (!allowed) return <Redirect href="/" />;
  return (
    <ScrollScreen>
      <Muted>
        Cada persona recibe un enlace de un solo uso, comparte WhatsApp y crea su propia contraseña: nadie la conoce ni tiene que enviarla.
        Cada enlace vence en 7 días.
      </Muted>
      {!data && loading ? <Loading /> : SLOTS.map((s) => {
        const m = data?.find((x) => x.owner_key === s.key);
        return <Slot key={s.key + (m?.display_name ?? '')} ownerKey={s.key} label={s.label} registered={m?.display_name ?? null} member={m}
          isAdmin={profile?.role === 'admin'} onDone={reload} />;
      })}
    </ScrollScreen>
  );
}
