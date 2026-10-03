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
      <Button label="Historial completo" onPress={() => router.push('/historial')} />
      <Button label="Máquinas" kind="ghost" onPress={() => router.push('/maquinas')} />
      <Button label="Invitar a la familia" kind="ghost" onPress={() => router.push('/familia')} />
      <Button label="Cambiar contraseña" kind="ghost" onPress={() => router.push('/set-password')} />
      <Button label="Cerrar sesión" kind="ghost" onPress={signOut} />
    </Screen>
  );
}
