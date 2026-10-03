import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Field, Muted, Screen, Title } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function ForgotPassword() {
  const { sendReset } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) return setMsg({ ok: false, text: 'Escriba su correo.' });
    setBusy(true);
    const err = await sendReset(email);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Si el correo está registrado, recibirá un enlace para crear una nueva contraseña.' });
    setBusy(false);
  };

  return (
    <Screen>
      <Title>Recuperar contraseña</Title>
      <Muted>Le enviaremos un enlace a su correo.</Muted>
      <Field placeholder="Correo" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      {msg && (msg.ok ? <Muted>{msg.text}</Muted> : <ErrorText>{msg.text}</ErrorText>)}
      <Button label="Enviar enlace" onPress={submit} busy={busy} />
      <Button label="Volver" kind="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
