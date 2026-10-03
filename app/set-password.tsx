import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Field, Loading, Muted, Screen, Title } from '../src/components';
import { useAuth } from '../src/features/auth/AuthProvider';

// Pantalla a la que se llega desde el enlace de invitación o de recuperación: aquí cada quien crea SU contraseña.
export default function SetPassword() {
  const { loading, session, setPassword } = useAuth();
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (!session) {
    return (
      <Screen>
        <Title>Enlace no válido</Title>
        <Muted>El enlace venció o ya fue usado. Solicite uno nuevo desde "Olvidé mi contraseña".</Muted>
        <Button label="Ir al inicio" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  const submit = async () => {
    if (pw.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (pw !== pw2) return setError('Las contraseñas no coinciden.');
    setBusy(true); setError(null);
    const err = await setPassword(pw);
    setBusy(false);
    if (err) setError(err); else router.replace('/');
  };

  return (
    <Screen>
      <Title>Cree su contraseña</Title>
      <Muted>Mínimo 8 caracteres. Solo usted la conocerá.</Muted>
      <Field placeholder="Nueva contraseña" secureTextEntry value={pw} onChangeText={setPw} />
      <Field placeholder="Repita la contraseña" secureTextEntry value={pw2} onChangeText={setPw2} onSubmitEditing={submit} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Guardar contraseña" onPress={submit} busy={busy} />
    </Screen>
  );
}
