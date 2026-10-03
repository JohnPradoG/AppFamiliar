import { Button, Muted, Screen, Title } from '../src/components';
import { useAuth } from '../src/features/auth/AuthProvider';

export default function SinAcceso() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Title>Cuenta sin permisos</Title>
      <Muted>Su acceso no está activo en este momento. Hable con mamá o con quien administra la app.</Muted>
      <Button label="Cerrar sesión" onPress={signOut} />
    </Screen>
  );
}
