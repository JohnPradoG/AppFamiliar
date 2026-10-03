// Edge Function (Deno). Despliegue: supabase functions deploy invite-member
// Secreto opcional: INVITE_BASE_URL (dirección de la página de invitación, ver web/invitacion).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateCode, hashCode } from '../_shared/token.ts';
import { handleInvite, type Deps, type OwnerKey } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const base = Deno.env.get('INVITE_BASE_URL');

const deps: Deps = {
  async getCaller(authHeader) {
    const jwt = authHeader?.replace(/^Bearer\s+/i, '');
    if (!jwt) return null;
    const { data, error } = await admin.auth.getUser(jwt);
    return error || !data.user ? null : { id: data.user.id };
  },
  async canInvite(id) {
    const { data } = await admin.from('profiles').select('role, is_helper').eq('id', id).maybeSingle();
    return data?.role === 'admin' || (data?.role === 'user' && data.is_helper === true);
  },
  async findMember(ownerKey: OwnerKey) {
    const { data } = await admin.from('accounts').select('user_id').eq('owner_key', ownerKey).maybeSingle();
    if (!data) return null;
    const { data: u } = await admin.auth.admin.getUserById(data.user_id);
    const { data: p } = await admin.from('profiles').select('display_name').eq('id', data.user_id).maybeSingle();
    return u.user?.email ? { userId: data.user_id, email: u.user.email, displayName: p?.display_name ?? '' } : null;
  },
  async emailTaken(email) {
    const { data, error } = await admin.rpc('_email_taken', { p_email: email });
    if (error) throw new Error(error.message);
    return Boolean(data);
  },
  async createInvitation(i) {
    // Una sola invitación vigente por hijo: las anteriores quedan anuladas.
    await admin.from('invitations').update({ revoked_at: new Date().toISOString() }).eq('owner_key', i.ownerKey).is('used_at', null).is('revoked_at', null);
    const code = generateCode();
    const { error } = await admin.from('invitations').insert({
      token_hash: await hashCode(code), owner_key: i.ownerKey, kind: i.kind, email: i.email, display_name: i.displayName, created_by: i.createdBy,
    });
    if (error) throw new Error(error.message);
    return code;
  },
};

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });
  const r = await handleInvite(req.headers.get('Authorization'), await req.json().catch(() => null), deps);
  if (r.status === 200) {
    const code = r.json.code as string;
    r.json.link = base ? `${base.replace(/\/$/, '')}/?c=${code}` : `appfamiliar://invitacion?code=${code}`;
  }
  return json(r.status, r.json);
});
