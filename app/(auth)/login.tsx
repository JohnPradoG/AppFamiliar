import { Link } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Field, Muted, Screen, Title } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { isConfigured } from '../../src/lib/supabase';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return setError('Escriba su correo y su contraseña.');
    setBusy(true); setError(null);
    setError(await signIn(email, password));
    setBusy(false);
  };

  return (
    <Screen>
      <Title>AppFamiliar</Title>
      <Muted>Ingrese con su correo y contraseña.</Muted>
      {!isConfigured && <ErrorText>Falta configurar Supabase (.env). Ver README.</ErrorText>}
      <Field placeholder="Correo" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Field placeholder="Contraseña" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Entrar" onPress={submit} busy={busy} />
      <Link href="/forgot-password" style={{ color: '#4DA3FF', fontSize: 16, textAlign: 'center' }}>Olvidé mi contraseña</Link>
      <Link href="/invitacion" style={{ color: '#4DA3FF', fontSize: 16, textAlign: 'center' }}>Tengo una invitación</Link>
    </Screen>
  );
}
