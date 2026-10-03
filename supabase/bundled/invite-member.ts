// invite-member — archivo único para el editor de Supabase. GENERADO por scripts/bundle-functions.mjs: no editar a mano.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Códigos de invitación: 128 bits aleatorios en base64url (22 caracteres). En la BD solo se guarda su SHA-256.
export const CODE_RE = /^[A-Za-z0-9_-]{22}$/;

export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Lógica pura (sin Deno) para poder probarla con `npm test`.
export type Deps = {
  getCaller(authHeader: string | null): Promise<{ id: string } | null>;
  getRole(userId: string): Promise<'admin' | 'helper' | null>;   // mamá, un hijo con permiso de ayudante, o nadie
  findMember(ownerKey: string): Promise<{ userId: string; email: string; displayName: string; active: boolean } | null>;
  ownerKeyExists(ownerKey: string): Promise<boolean>;
  emailTaken(email: string): Promise<boolean>;
  createInvitation(i: { ownerKey: string; kind: 'new' | 'reset'; email: string; displayName: string; createdBy: string }): Promise<string>; // devuelve el código
};

export type Result = { status: number; json: Record<string, unknown> };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;

// "Mauricio Pérez" → "mauricio-perez"
export function slugify(name: string): string {
  const s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  return s || 'persona';
}

// Solo mamá o un ayudante autorizado (nunca un hijo común).
// - Con owner_key de alguien que YA existe: genera un enlace nuevo (para recuperar la contraseña).
// - Sin owner_key: agrega una persona nueva (nombre + correo) y genera su primera invitación.
// Devuelve un código de un solo uso; nunca se envían ni se conocen contraseñas.
export async function handleInvite(authHeader: string | null, body: unknown, d: Deps): Promise<Result> {
  const caller = await d.getCaller(authHeader);
  if (!caller) return { status: 401, json: { error: 'Inicie sesión.' } };
  const role = await d.getRole(caller.id);
  if (!role) return { status: 403, json: { error: 'No tiene permiso para invitar.' } };

  const b = (body ?? {}) as Record<string, unknown>;
  try {
    if (b.owner_key !== undefined && b.owner_key !== null) {
      if (typeof b.owner_key !== 'string' || !KEY.test(b.owner_key)) return { status: 400, json: { error: 'Persona inválida.' } };
      const existing = await d.findMember(b.owner_key);
      if (!existing) return { status: 404, json: { error: 'Esa persona no existe.' } };
      // SEGURIDAD: quien recibe el enlace puede entrar a esa cuenta. Un ayudante NO puede pedir enlaces para otra persona
      // (se apropiaría de su cuenta y vería su dinero); solo mamá, o la propia persona para sí misma.
      if (role !== 'admin' && existing.userId !== caller.id) return { status: 403, json: { error: 'Solo mamá puede enviar un enlace nuevo a otra persona.' } };
      if (!existing.active) return { status: 409, json: { error: 'Esa persona está sin acceso. Reactívela primero.' } };
      const code = await d.createInvitation({ ownerKey: b.owner_key, kind: 'reset', email: existing.email, displayName: existing.displayName, createdBy: caller.id });
      return { status: 200, json: { code, email: existing.email, display_name: existing.displayName, resent: true } };
    }

    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const name = typeof b.display_name === 'string' ? b.display_name.trim() : '';
    if (!name) return { status: 400, json: { error: 'Escriba el nombre.' } };
    if (name.length > 60) return { status: 400, json: { error: 'El nombre es demasiado largo.' } };
    if (!EMAIL.test(email)) return { status: 400, json: { error: 'Escriba un correo válido.' } };
    if (await d.emailTaken(email)) return { status: 409, json: { error: 'Ese correo ya está registrado.' } };

    const base = slugify(name);
    let ownerKey = base;
    for (let n = 2; await d.ownerKeyExists(ownerKey); n++) ownerKey = `${base}-${n}`;
    const code = await d.createInvitation({ ownerKey, kind: 'new', email, displayName: name, createdBy: caller.id });
    return { status: 200, json: { code, email, display_name: name, resent: false } };
  } catch {
    return { status: 500, json: { error: 'No se pudo crear la invitación. Intente de nuevo.' } };
  }
}

// Edge Function (Deno). Despliegue: supabase functions deploy invite-member
// Secreto opcional: INVITE_BASE_URL (dirección de la página de invitación, ver web/invitacion).

// Supabase inyecta estas variables en la función. Llave nueva (SUPABASE_SECRET_KEY) o la clásica (SERVICE_ROLE) según el proyecto.
const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!secretKey) throw new Error('Falta la llave secreta de Supabase en el entorno de la función');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey, { auth: { persistSession: false } });
const base = Deno.env.get('INVITE_BASE_URL');

const deps: Deps = {
  async getCaller(authHeader) {
    const jwt = authHeader?.replace(/^Bearer\s+/i, '');
    if (!jwt) return null;
    const { data, error } = await admin.auth.getUser(jwt);
    return error || !data.user ? null : { id: data.user.id };
  },
  async getRole(id) {
    const { data } = await admin.from('profiles').select('role, is_helper, active').eq('id', id).maybeSingle();
    if (data?.role === 'admin') return 'admin';
    return data?.role === 'user' && data.is_helper === true && data.active !== false ? 'helper' : null;
  },
  async findMember(ownerKey) {
    const { data } = await admin.from('accounts').select('user_id').eq('owner_key', ownerKey).maybeSingle();
    if (!data) return null;
    const { data: u } = await admin.auth.admin.getUserById(data.user_id);
    const { data: p } = await admin.from('profiles').select('display_name, active').eq('id', data.user_id).maybeSingle();
    return u.user?.email ? { userId: data.user_id, email: u.user.email, displayName: p?.display_name ?? '', active: p?.active !== false } : null;
  },
  async ownerKeyExists(ownerKey) {
    const a = await admin.from('accounts').select('id').eq('owner_key', ownerKey).maybeSingle();
    const i = await admin.from('invitations').select('id').eq('owner_key', ownerKey).is('used_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
    return Boolean(a.data || i.data);
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
