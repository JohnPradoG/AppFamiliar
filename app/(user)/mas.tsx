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
      {profile?.is_helper && <Button label="Invitar a la familia" onPress={() => router.push('/familia')} />}
      <Button label="Cambiar contraseña" kind={profile?.is_helper ? 'ghost' : 'primary'} onPress={() => router.push('/set-password')} />
      <Button label="Cerrar sesión" kind="ghost" onPress={signOut} />
    </Screen>
  );
}
