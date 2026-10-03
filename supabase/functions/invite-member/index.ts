// Edge Function de Supabase (Deno). Despliegue: supabase functions deploy invite-member
// Usa la llave service_role, que Supabase inyecta como secreto SOLO dentro de la función (nunca llega a la app).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleInvite, type Deps, type OwnerKey } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const deps: Deps = {
  redirectTo: Deno.env.get('APP_REDIRECT_URL') ?? 'appfamiliar://set-password',
  async getCaller(authHeader) {
    const jwt = authHeader?.replace(/^Bearer\s+/i, '');
    if (!jwt) return null;
    const { data, error } = await admin.auth.getUser(jwt);
    return error || !data.user ? null : { id: data.user.id };
  },
  async isAdmin(id) {
    const { data } = await admin.from('profiles').select('role').eq('id', id).maybeSingle();
    return data?.role === 'admin';
  },
  async findMember(ownerKey: OwnerKey) {
    const { data } = await admin.from('accounts').select('user_id').eq('owner_key', ownerKey).maybeSingle();
    if (!data) return null;
    const { data: u } = await admin.auth.admin.getUserById(data.user_id);
    return u.user?.email ? { userId: data.user_id, email: u.user.email } : null;
  },
  async generateLink(kind, email, redirectTo) {
    const { data, error } = await admin.auth.admin.generateLink({ type: kind, email, options: { redirectTo } });
    if (error || !data.properties?.action_link) throw new Error(error?.message ?? 'sin enlace');
    return { link: data.properties.action_link, userId: data.user.id };
  },
  async createMember(userId, ownerKey, displayName, adminId) {
    const p = await admin.from('profiles').insert({ id: userId, role: 'user', display_name: displayName });
    if (p.error) throw new Error(p.error.message);
    const a = await admin.from('accounts').insert({ user_id: userId, owner_key: ownerKey, created_by: adminId });
    if (a.error) throw new Error(a.error.message);
  },
  async deleteUser(id) {
    await admin.from('accounts').delete().eq('user_id', id); // service_role ignora RLS
    await admin.from('profiles').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  },
};

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
  const body = await req.json().catch(() => null);
  const r = await handleInvite(req.headers.get('Authorization'), body, deps);
  return new Response(JSON.stringify(r.json), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
});
