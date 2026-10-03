// Edge Function pública (verify_jwt = false). Despliegue: supabase functions deploy accept-invite --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { hashCode } from '../_shared/token.ts';
import { handleAccept, type AcceptDeps, type Invitation } from './handler.ts';

// Supabase inyecta estas variables en la función. Llave nueva (SUPABASE_SECRET_KEY) o la clásica (SERVICE_ROLE) según el proyecto.
const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!secretKey) throw new Error('Falta la llave secreta de Supabase en el entorno de la función');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey, { auth: { persistSession: false } });

const deps: AcceptDeps = {
  hashCode,
  async recentFailures() {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await admin.from('invite_failures').select('id', { count: 'exact', head: true }).gte('at', since);
    return count ?? 0;
  },
  async recordFailure() {
    await admin.from('invite_failures').insert({});
    // limpieza ocasional de registros viejos
    if (Math.random() < 0.05) await admin.from('invite_failures').delete().lt('at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  },
  async claim(hash) {
    const { data } = await admin.from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', hash).is('used_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString())
      .select('id, owner_key, kind, email, display_name, created_by').maybeSingle();
    return (data as Invitation | null) ?? null;
  },
  async release(id) { await admin.from('invitations').update({ used_at: null }).eq('id', id); },
  async findMember(ownerKey) {
    const { data } = await admin.from('accounts').select('user_id').eq('owner_key', ownerKey).maybeSingle();
    return data ? { userId: data.user_id } : null;
  },
  async createUser(email, password) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? 'sin usuario');
    return { userId: data.user.id };
  },
  async setPassword(userId, password) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(error.message);
  },
  async createMember(userId, ownerKey, displayName, adminId) {
    const p = await admin.from('profiles').insert({ id: userId, role: 'user', display_name: displayName });
    if (p.error) throw new Error(p.error.message);
    const a = await admin.from('accounts').insert({ user_id: userId, owner_key: ownerKey, created_by: adminId });
    if (a.error) throw new Error(a.error.message);
  },
  async deleteUser(id) {
    await admin.from('accounts').delete().eq('user_id', id);
    await admin.from('profiles').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  },
};

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: cors });
  const r = await handleAccept(await req.json().catch(() => null), deps);
  return new Response(JSON.stringify(r.json), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
});
