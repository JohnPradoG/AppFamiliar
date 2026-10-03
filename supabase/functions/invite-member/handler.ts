// Lógica pura de la invitación (sin dependencias de Deno) para poder probarla con `npm test`.
export type OwnerKey = 'john' | 'brother';

export type Deps = {
  redirectTo: string;
  getCaller(authHeader: string | null): Promise<{ id: string } | null>;
  isAdmin(userId: string): Promise<boolean>;
  findMember(ownerKey: OwnerKey): Promise<{ userId: string; email: string } | null>;
  generateLink(kind: 'invite' | 'recovery', email: string, redirectTo: string): Promise<{ link: string; userId: string }>;
  createMember(userId: string, ownerKey: OwnerKey, displayName: string, adminId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
};

export type Result = { status: number; json: Record<string, unknown> };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Solo mamá puede invitar. Nunca se envían ni se conocen contraseñas: se devuelve un enlace de un solo uso
// con el que la persona crea la suya. Si el hijo ya fue invitado, se genera un enlace nuevo (reenvío).
export async function handleInvite(authHeader: string | null, body: unknown, d: Deps): Promise<Result> {
  const caller = await d.getCaller(authHeader);
  if (!caller) return { status: 401, json: { error: 'Inicie sesión.' } };
  if (!(await d.isAdmin(caller.id))) return { status: 403, json: { error: 'Solo la administradora puede invitar.' } };

  const b = (body ?? {}) as Record<string, unknown>;
  const ownerKey = b.owner_key;
  if (ownerKey !== 'john' && ownerKey !== 'brother') return { status: 400, json: { error: 'Destinatario inválido.' } };

  const existing = await d.findMember(ownerKey);
  try {
    if (existing) {
      const { link } = await d.generateLink('recovery', existing.email, d.redirectTo);
      return { status: 200, json: { link, email: existing.email, owner_key: ownerKey, resent: true } };
    }

    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const name = typeof b.display_name === 'string' ? b.display_name.trim() : '';
    if (!EMAIL.test(email)) return { status: 400, json: { error: 'Escriba un correo válido.' } };
    if (!name) return { status: 400, json: { error: 'Escriba el nombre.' } };

    let created: { link: string; userId: string };
    try {
      created = await d.generateLink('invite', email, d.redirectTo);
    } catch (e) {
      if (/registered|already|exists/i.test(String((e as Error).message))) return { status: 409, json: { error: 'Ese correo ya está registrado.' } };
      throw e;
    }
    try {
      await d.createMember(created.userId, ownerKey, name, caller.id);
    } catch (e) {
      await d.deleteUser(created.userId); // no dejar un usuario a medias
      throw e;
    }
    return { status: 200, json: { link: created.link, email, owner_key: ownerKey, resent: false } };
  } catch {
    return { status: 500, json: { error: 'No se pudo crear la invitación. Intente de nuevo.' } };
  }
}
