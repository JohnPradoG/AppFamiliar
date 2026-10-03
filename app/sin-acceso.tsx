import { Redirect } from 'expo-router';
import { Button, Loading, Muted, Screen, Title } from '../src/components';
import { useAuth } from '../src/features/auth/AuthProvider';

export default function SinAcceso() {
  const { signOut, loading, profile } = useAuth();
  if (loading) return <Loading />;
  if (profile) return <Redirect href="/" />;   // si el perfil llegó tarde, no dejar a nadie aquí
  return (
    <Screen>
      <Title>Cuenta sin permisos</Title>
      <Muted>Su acceso no está activo en este momento. Hable con mamá o con quien administra la app.</Muted>
      <Button label="Cerrar sesión" onPress={signOut} />
    </Screen>
  );
}
