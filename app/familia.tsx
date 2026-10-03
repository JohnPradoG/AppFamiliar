import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, Switch, Text, View } from 'react-native';
import { Button, Card, ErrorText, Field, Loading, Muted, ScrollScreen, SectionTitle } from '../src/components';
import { useAuth } from '../src/features/auth/AuthProvider';
import { inviteMessage } from '../src/features/auth/links';
import { useAsync } from '../src/hooks/useAsync';
import { fetchMembers, friendlyError, inviteMember, isPendingBalance, renameMember, setHelper, setMemberActive, type Member } from '../src/lib/api';
import { colors } from '../src/lib/theme';

async function shareInvite(args: { ownerKey?: string; email?: string; displayName?: string }) {
  const r = await inviteMember(args);
  await Share.share({ message: inviteMessage(r.display_name, r.link, r.code) });
}
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : 'No se pudo completar la acción.');

function MemberCard({ m, isAdmin, onChanged }: { m: Member; isAdmin: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(m.display_name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); onChanged(); } catch (e) { setError(errText(e)); }
    setBusy(false);
  };
  const remove = async (force: boolean) => {
    try { await setMemberActive(m.user_id!, false, force); onChanged(); }
    catch (e) {
      if (isPendingBalance(e)) {
        Alert.alert(`Quitar a ${m.display_name}`, `${(e as Error).message}\n\nNo se borra nada: ${m.display_name} pierde el acceso y usted conserva todo el historial. Puede reactivarlo cuando quiera.`, [
          { text: 'Cancelar', style: 'cancel' }, { text: 'Quitar', style: 'destructive', onPress: () => void remove(true) },
        ]);
      } else setError(friendlyError(e));
    }
  };

  return (
    <Card>
      <SectionTitle>{m.display_name}{m.active ? '' : ' (sin acceso)'}</SectionTitle>
      {editing ? (
        <View style={{ gap: 10 }}>
          <Field value={name} onChangeText={setName} placeholder="Nombre" />
          <Button label="Guardar nombre" busy={busy} onPress={() => run(async () => { await renameMember(m.user_id!, name); setEditing(false); })} />
        </View>
      ) : null}
      {m.active && isAdmin && m.user_id && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.text, fontSize: 16 }}>Puede ayudar a invitar</Text>
            <Muted>Solo envía invitaciones. No ve dinero ni movimientos de nadie más.</Muted>
          </View>
          <Switch value={m.is_helper} onValueChange={(v) => run(() => setHelper(m.user_id!, v))} />
        </View>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      {m.active && (isAdmin || m.is_me) && <Button label="Enviar enlace nuevo (contraseña olvidada)" kind="ghost" busy={busy} onPress={() => run(() => shareInvite({ ownerKey: m.owner_key }))} />}
      {isAdmin && m.user_id && (
        <View style={{ gap: 4 }}>
          {m.active && <Button label="Cambiar nombre" kind="ghost" onPress={() => setEditing(!editing)} />}
          {m.active
            ? <Button label="Quitar de la familia" kind="ghost" onPress={() => remove(false)} />
            : <Button label="Reactivar" busy={busy} onPress={() => run(() => setMemberActive(m.user_id!, true))} />}
        </View>
      )}
    </Card>
  );
}

function AddPerson({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setError(null);
    try { await shareInvite({ email, displayName: name }); setName(''); setEmail(''); onDone(); }
    catch (e) { setError(errText(e)); }
    setBusy(false);
  };
  return (
    <Card>
      <SectionTitle>Agregar una persona</SectionTitle>
      <Muted>Escriba su nombre y correo. Se abre WhatsApp con un enlace de un solo uso para que cree su propia contraseña.</Muted>
      <Field placeholder="Nombre (ej. Mauricio)" value={name} onChangeText={setName} />
      <Field placeholder="Correo de esa persona" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Crear invitación y enviar por WhatsApp" onPress={submit} busy={busy} />
    </Card>
  );
}

export default function Familia() {
  const { loading: authLoading, profile } = useAuth();
  const allowed = profile?.role === 'admin' || profile?.is_helper === true;
  const { data, loading, reload } = useAsync(() => (allowed ? fetchMembers() : Promise.resolve([] as Member[])), [allowed]);
  if (authLoading) return <Loading />;
  if (!allowed) return <Redirect href="/" />;
  const isAdmin = profile?.role === 'admin';
  return (
    <ScrollScreen>
      <Muted>Cada persona tiene su propia cuenta privada. Nadie conoce la contraseña de otro: cada quien crea la suya con un enlace de un solo uso que vence en 7 días.</Muted>
      {!data && loading ? <Loading /> : (
        <>
          {data?.map((m) => <MemberCard key={m.owner_key + m.display_name + m.active + m.is_helper} m={m} isAdmin={isAdmin} onChanged={reload} />)}
          <AddPerson onDone={reload} />
        </>
      )}
    </ScrollScreen>
  );
}
