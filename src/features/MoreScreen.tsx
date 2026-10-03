import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Card, ErrorText, Muted, ScrollScreen, Title } from '../components';
import { useAsync } from '../hooks/useAsync';
import { fetchUnreadCount } from '../lib/api';
import { colors } from '../lib/theme';
import { useAuth } from './auth/AuthProvider';
import { useLockSetting } from './lock';

// Pantalla "Más" / Perfil, compartida por mamá y los hijos; cada rol agrega lo suyo.
export function MoreScreen() {
  const { profile, session, signOut } = useAuth();
  const router = useRouter();
  const lock = useLockSetting();
  const [lockError, setLockError] = useState<string | null>(null);
  const unread = useAsync(fetchUnreadCount, []);
  const isAdmin = profile?.role === 'admin';
  const n = unread.data ?? 0;

  return (
    <ScrollScreen>
      <Title>{profile?.display_name}</Title>
      <Muted>{session?.user.email}{isAdmin ? ' · Administradora' : ''}</Muted>

      <Button label={n > 0 ? `Notificaciones (${n} nuevas)` : 'Notificaciones'} onPress={() => router.push('/notificaciones')} />
      {isAdmin && <Button label="Historial completo" kind="ghost" onPress={() => router.push('/historial')} />}
      {isAdmin && <Button label="Máquinas" kind="ghost" onPress={() => router.push('/maquinas')} />}
      {(isAdmin || profile?.is_helper) && <Button label="Invitar a la familia" kind="ghost" onPress={() => router.push('/familia')} />}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.text, fontSize: 16 }}>Bloqueo con huella o PIN</Text>
            <Muted>Pide su huella, rostro o PIN al abrir la app.</Muted>
          </View>
          <Switch value={lock.enabled} onValueChange={async (v) => setLockError(await lock.setEnabled(v))} />
        </View>
        {lockError && <ErrorText>{lockError}</ErrorText>}
      </Card>

      <Button label="Cambiar contraseña" kind="ghost" onPress={() => router.push('/set-password')} />
      <Button label="Ayuda" kind="ghost" onPress={() => router.push('/ayuda')} />
      <Button label="Cerrar sesión" kind="ghost" onPress={signOut} />
    </ScrollScreen>
  );
}
