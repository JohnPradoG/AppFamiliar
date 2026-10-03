import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { Button, ErrorText, Muted, Screen, Title } from '../components';
import { shouldLock } from '../lib/chunks';
import { useAuth } from './auth/AuthProvider';

const KEY = 'af_lock_enabled';
type LockState = { enabled: boolean; supported: boolean; setEnabled: (v: boolean) => Promise<string | null> };
const Ctx = createContext<LockState>({ enabled: false, supported: false, setEnabled: async () => null });
export const useLockSetting = () => useContext(Ctx);

// Bloqueo opcional con huella / rostro / PIN del teléfono. Se pide al abrir la app y al volver tras 30 s en segundo plano.
export function AppLock({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [enabled, setEnabledState] = useState(false);
  const [supported, setSupported] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastActive = useRef<number | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const on = (await SecureStore.getItemAsync(KEY)) === '1';
      setSupported((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()));
      setEnabledState(on); enabledRef.current = on;
      if (shouldLock(on, null, Date.now())) setLocked(true);
    })();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') lastActive.current = Date.now();
      else if (s === 'active' && shouldLock(enabledRef.current, lastActive.current, Date.now())) setLocked(true);
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    setError(null);
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear AppFamiliar', cancelLabel: 'Cancelar', disableDeviceFallback: false });
    if (r.success) setLocked(false); else setError('No se pudo verificar. Intente de nuevo.');
  }, []);
  useEffect(() => { if (locked && session) void unlock(); }, [locked, session, unlock]);

  const setEnabled = useCallback(async (v: boolean): Promise<string | null> => {
    if (v) {
      if (!supported) return 'Este teléfono no tiene huella, rostro o PIN configurado.';
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirme para activar el bloqueo' });
      if (!r.success) return 'No se activó el bloqueo.';
    }
    await SecureStore.setItemAsync(KEY, v ? '1' : '0');
    setEnabledState(v); enabledRef.current = v;
    return null;
  }, [supported]);

  if (locked && session) {
    return (
      <Screen>
        <Title>AppFamiliar bloqueada</Title>
        <Muted>Use su huella, rostro o PIN para entrar.</Muted>
        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Desbloquear" onPress={unlock} />
      </Screen>
    );
  }
  return <Ctx.Provider value={{ enabled, supported, setEnabled }}>{children}</Ctx.Provider>;
}
