import { Redirect, Stack } from 'expo-router';
import { Loading } from '../../src/components';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function AuthLayout() {
  const { loading, session } = useAuth();
  if (loading) return <Loading />;
  if (session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1630' } }} />;
}
