import { Redirect, Tabs } from 'expo-router';
import { Loading } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { colors } from '../../src/lib/theme';

// Guardia de ruta. La seguridad real está en la base de datos (RLS); esto solo evita pantallas equivocadas.
export default function UserLayout() {
  const { loading, session, profile } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/login" />;
  if (profile?.role !== 'user') return <Redirect href="/" />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border }, tabBarActiveTintColor: colors.info, tabBarInactiveTintColor: colors.muted }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial' }} />
      <Tabs.Screen name="comprobantes" options={{ title: 'Comprobantes' }} />
      <Tabs.Screen name="cuenta" options={{ href: null }} />
      <Tabs.Screen name="mas" options={{ title: 'Más' }} />
    </Tabs>
  );
}
