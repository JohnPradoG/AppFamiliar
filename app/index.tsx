import { Redirect } from 'expo-router';
import { Loading } from '../src/components';
import { useAuth } from '../src/features/auth/AuthProvider';

// Punto de entrada: decide a dónde va cada persona según sesión y rol.
export default function Index() {
  const { loading, session, profile, recovering } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/login" />;
  if (recovering) return <Redirect href="/set-password" />;
  if (!profile) return <Redirect href="/sin-acceso" />;
  return <Redirect href={profile.role === 'admin' ? '/(admin)' : '/(user)'} />;
}
