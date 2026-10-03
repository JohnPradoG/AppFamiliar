import { Button, Muted, Screen, Title } from '../src/components';
import { useAuth } from '../src/features/auth/AuthProvider';

export default function SinAcceso() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Title>Cuenta sin permisos</Title>
      <Muted>Su correo existe pero no fue asignado a la familia. Avise a quien administra la app.</Muted>
      <Button label="Cerrar sesión" onPress={signOut} />
    </Screen>
  );
}
