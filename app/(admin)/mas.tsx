import { Button, Muted, Screen, Title } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function Mas() {
  const { profile, session, signOut } = useAuth();
  return (
    <Screen>
      <Title>Más</Title>
      <Muted>{profile?.display_name} · {session?.user.email}</Muted>
      <Button label="Cerrar sesión" onPress={signOut} />
    </Screen>
  );
}
