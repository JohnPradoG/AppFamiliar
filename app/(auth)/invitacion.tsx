import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Field, Muted, Screen, Title } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { extractCode } from '../../src/features/auth/links';
import { acceptInvite } from '../../src/lib/api';

// Se llega desde el enlace de mamá (appfamiliar://invitacion?code=...) o pegando el código a mano.
export default function Invitacion() {
  const { code: fromLink } = useLocalSearchParams<{ code?: string }>();
  const { signIn } = useAuth();
  const [code, setCode] = useState(fromLink ?? '');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const c = extractCode(code);
    if (!c) return setError('Escriba el código de la invitación.');
    if (pw.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (pw !== pw2) return setError('Las contraseñas no coinciden.');
    setBusy(true); setError(null);
    try {
      const { email } = await acceptInvite(c, pw);
      const err = await signIn(email, pw); // entra directo; al haber sesión la app lo lleva a su pantalla
      if (err) setError(err);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo crear la cuenta.');
    }
    setBusy(false);
  };

  return (
    <Screen>
      <Title>Bienvenido</Title>
      <Muted>Cree su contraseña para entrar a AppFamiliar. Solo usted la conocerá.</Muted>
      {!fromLink && <Field placeholder="Código de invitación" autoCapitalize="none" autoCorrect={false} value={code} onChangeText={setCode} />}
      <Field placeholder="Nueva contraseña (mínimo 8)" secureTextEntry value={pw} onChangeText={setPw} />
      <Field placeholder="Repita la contraseña" secureTextEntry value={pw2} onChangeText={setPw2} onSubmitEditing={submit} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Crear mi cuenta" onPress={submit} busy={busy} />
    </Screen>
  );
}
