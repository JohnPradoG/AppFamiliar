import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

export type Role = 'admin' | 'user';
export type Profile = { id: string; role: Role; display_name: string };

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  recovering: boolean; // true cuando el usuario llegó desde un enlace de invitación / recuperación
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<string | null>;
  setPassword: (password: string) => Promise<string | null>;
};

const Ctx = createContext<AuthState | null>(null);

// Los enlaces de Supabase traen los tokens en el fragmento (#access_token=...&refresh_token=...).
export function parseAuthUrl(url: string): { access_token: string; refresh_token: string } | null {
  const frag = url.split('#')[1];
  if (!frag) return null;
  const p = new URLSearchParams(frag);
  const access_token = p.get('access_token');
  const refresh_token = p.get('refresh_token');
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}

export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espere unos minutos.';
  if (m.includes('network') || m.includes('fetch')) return 'Sin conexión. Revise su internet.';
  if (m.includes('password') && m.includes('characters')) return 'La contraseña debe tener al menos 8 caracteres.';
  return 'No se pudo completar la operación. Intente de nuevo.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) return setProfile(null);
    // RLS: solo devuelve el perfil del propio usuario (o todos si es mamá; por eso se filtra por id).
    const { data } = await supabase.from('profiles').select('id, role, display_name').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      // No hacer llamadas a supabase dentro del callback (puede bloquear): se difiere.
      setTimeout(() => void loadProfile(s), 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  // Enlaces de invitación / recuperación (Android abre appfamiliar://...#access_token=...).
  useEffect(() => {
    const handle = async (url: string | null) => {
      const tokens = url ? parseAuthUrl(url) : null;
      if (!tokens) return;
      const { error } = await supabase.auth.setSession(tokens);
      if (!error) setRecovering(true);
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => void handle(e.url));
    return () => sub.remove();
  }, []);

  const value = useMemo<AuthState>(() => ({
    loading, session, profile, recovering,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? translateAuthError(error.message) : null;
    },
    signOut: async () => { setRecovering(false); await supabase.auth.signOut(); },
    sendReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL('/set-password') });
      return error ? translateAuthError(error.message) : null;
    },
    setPassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return translateAuthError(error.message);
      setRecovering(false);
      return null;
    },
  }), [loading, session, profile, recovering]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}
