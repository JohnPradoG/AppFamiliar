// accept-invite — archivo único para el editor de Supabase. GENERADO por scripts/bundle-functions.mjs: no editar a mano.
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


export type Invitation = { id: string; owner_key: string; kind: 'new' | 'reset'; email: string; display_name: string; created_by: string | null };

export const MAX_FAILURES = 20;   // intentos fallidos permitidos en la ventana (10 min); la familia es pequeña, un uso legítimo casi nunca falla

export type AcceptDeps = {
  recentFailures(): Promise<number>;     // fallos en los últimos 10 minutos
  recordFailure(): Promise<void>;
  hashCode(code: string): Promise<string>;
  claim(hash: string): Promise<Invitation | null>;      // atómico: marca used_at solo si estaba vigente y sin usar
  release(id: string): Promise<void>;                   // deshace el canje si algo falla
  findMember(ownerKey: string): Promise<{ userId: string } | null>;
  createUser(email: string, password: string): Promise<{ userId: string }>;   // lanza si el correo ya existe
  setPassword(userId: string, password: string): Promise<void>;
  createMember(userId: string, ownerKey: string, displayName: string, adminId: string | null): Promise<void>;
  deleteUser(userId: string): Promise<void>;
};

export type Result = { status: number; json: Record<string, unknown> };
const TOO_MANY: Result = { status: 429, json: { error: 'Demasiados intentos. Espere unos minutos e intente de nuevo.' } };
const INVALID: Result = { status: 410, json: { error: 'La invitación no es válida, venció o ya fue usada. Pídale a mamá una nueva.' } };

// Pública (sin sesión): la seguridad es el código (128 bits, un solo uso, 7 días).
export async function handleAccept(body: unknown, d: AcceptDeps): Promise<Result> {
  const b = (body ?? {}) as Record<string, unknown>;
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if ((await d.recentFailures()) >= MAX_FAILURES) return TOO_MANY;   // freno global contra adivinar códigos
  if (!CODE_RE.test(code)) { await d.recordFailure(); return INVALID; }   // formato inválido: no se consulta la tabla de invitaciones
  if (password.length < 8 || password.length > 72) return { status: 400, json: { error: 'La contraseña debe tener entre 8 y 72 caracteres.' } };

  const inv = await d.claim(await d.hashCode(code));
  if (!inv) { await d.recordFailure(); return INVALID; }

  try {
    if (inv.kind === 'reset') {
      const m = await d.findMember(inv.owner_key);
      if (!m) throw new Error('cuenta no encontrada');
      await d.setPassword(m.userId, password);
      return { status: 200, json: { email: inv.email } };
    }
    let userId: string;
    try {
      userId = (await d.createUser(inv.email, password)).userId;
    } catch (e) {
      await d.release(inv.id);
      if (/registered|already|exists/i.test(String((e as Error).message))) return { status: 409, json: { error: 'Ese correo ya está registrado.' } };
      throw e;
    }
    try {
      await d.createMember(userId, inv.owner_key, inv.display_name, inv.created_by);
    } catch (e) {
      await d.deleteUser(userId);
      await d.release(inv.id);
      throw e;
    }
    return { status: 200, json: { email: inv.email } };
  } catch {
    await d.release(inv.id).catch(() => {});
    return { status: 500, json: { error: 'No se pudo crear la cuenta. Intente de nuevo.' } };
  }
}

// Edge Function pública (verify_jwt = false). Despliegue: supabase functions deploy accept-invite --no-verify-jwt

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
