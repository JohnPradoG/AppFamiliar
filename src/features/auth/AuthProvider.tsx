import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { parseAuthUrl, translateAuthError } from './links';

export type Role = 'admin' | 'user';
export type Profile = { id: string; role: Role; display_name: string; is_helper: boolean };

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) return setProfile(null);
    // RLS: solo devuelve el perfil del propio usuario (o todos si es mamá; por eso se filtra por id).
    const { data } = await supabase.from('profiles').select('id, role, display_name, is_helper').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  // Enlaces de invitación / recuperación (Android abre appfamiliar://...#access_token=...&refresh_token=...).
  const handleUrl = useCallback(async (url: string | null) => {
    const tokens = url ? parseAuthUrl(url) : null;
    if (!tokens) return;
    const { error } = await supabase.auth.setSession(tokens);
    if (!error) setRecovering(true);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      // El enlace inicial se procesa antes de dejar de "cargar": así /set-password no muestra "enlace no válido" por error.
      await handleUrl(await Linking.getInitialURL());
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      // No hacer llamadas a supabase dentro del callback (puede bloquear): se difiere.
      setTimeout(() => void loadProfile(s), 0);
    });
    const linkSub = Linking.addEventListener('url', (e) => void handleUrl(e.url));
    return () => { active = false; sub.subscription.unsubscribe(); linkSub.remove(); };
  }, [loadProfile, handleUrl]);

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
