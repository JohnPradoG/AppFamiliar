import { Muted, Screen, Title } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function UserHome() {
  const { profile } = useAuth();
  return (
    <Screen>
      <Title>Hola, {profile?.display_name}</Title>
      <Muted>Su cuenta llega en la Fase 3.</Muted>
    </Screen>
  );
}
