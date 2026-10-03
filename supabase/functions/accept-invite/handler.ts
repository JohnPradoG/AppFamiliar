import { CODE_RE } from '../_shared/token.ts';

export type Invitation = { id: string; owner_key: string; kind: 'new' | 'reset'; email: string; display_name: string; created_by: string | null };

export type AcceptDeps = {
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
const INVALID: Result = { status: 410, json: { error: 'La invitación no es válida, venció o ya fue usada. Pídale a mamá una nueva.' } };

// Pública (sin sesión): la seguridad es el código (128 bits, un solo uso, 7 días).
export async function handleAccept(body: unknown, d: AcceptDeps): Promise<Result> {
  const b = (body ?? {}) as Record<string, unknown>;
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (!CODE_RE.test(code)) return INVALID;                       // formato inválido: ni siquiera se consulta la BD
  if (password.length < 8 || password.length > 72) return { status: 400, json: { error: 'La contraseña debe tener entre 8 y 72 caracteres.' } };

  const inv = await d.claim(await d.hashCode(code));
  if (!inv) return INVALID;

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
