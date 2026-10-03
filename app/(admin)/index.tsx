import { Muted, Screen, Title } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function AdminHome() {
  const { profile } = useAuth();
  return (
    <Screen>
      <Title>Hola, {profile?.display_name}</Title>
      <Muted>Administradora. El dashboard llega en la Fase 2.</Muted>
    </Screen>
  );
}
