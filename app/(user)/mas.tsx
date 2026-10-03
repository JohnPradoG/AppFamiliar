import { useRouter } from 'expo-router';
import { Button, Muted, Screen, Title } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function Mas() {
  const { profile, session, signOut } = useAuth();
  const router = useRouter();
  return (
    <Screen>
      <Title>Más</Title>
      <Muted>{profile?.display_name} · {session?.user.email}</Muted>
      <Button label="Cambiar contraseña" onPress={() => router.push('/set-password')} />
      <Button label="Cerrar sesión" kind="ghost" onPress={signOut} />
    </Screen>
  );
}
