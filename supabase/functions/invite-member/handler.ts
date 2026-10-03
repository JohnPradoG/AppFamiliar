// Lógica pura (sin Deno) para poder probarla con `npm test`.
export type OwnerKey = 'john' | 'brother';

export type Deps = {
  getCaller(authHeader: string | null): Promise<{ id: string } | null>;
  isAdmin(userId: string): Promise<boolean>;
  findMember(ownerKey: OwnerKey): Promise<{ userId: string; email: string; displayName: string } | null>;
  emailTaken(email: string): Promise<boolean>;
  createInvitation(i: { ownerKey: OwnerKey; kind: 'new' | 'reset'; email: string; displayName: string; createdBy: string }): Promise<string>; // devuelve el código
};

export type Result = { status: number; json: Record<string, unknown> };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Solo mamá. Devuelve un código de un solo uso; nunca se envían ni se conocen contraseñas.
// Si el hijo ya tiene cuenta, la invitación es de tipo 'reset' (la persona elige una contraseña nueva).
export async function handleInvite(authHeader: string | null, body: unknown, d: Deps): Promise<Result> {
  const caller = await d.getCaller(authHeader);
  if (!caller) return { status: 401, json: { error: 'Inicie sesión.' } };
  if (!(await d.isAdmin(caller.id))) return { status: 403, json: { error: 'Solo la administradora puede invitar.' } };

  const b = (body ?? {}) as Record<string, unknown>;
  const ownerKey = b.owner_key;
  if (ownerKey !== 'john' && ownerKey !== 'brother') return { status: 400, json: { error: 'Destinatario inválido.' } };

  try {
    const existing = await d.findMember(ownerKey);
    if (existing) {
      const code = await d.createInvitation({ ownerKey, kind: 'reset', email: existing.email, displayName: existing.displayName, createdBy: caller.id });
      return { status: 200, json: { code, email: existing.email, display_name: existing.displayName, resent: true } };
    }
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const name = typeof b.display_name === 'string' ? b.display_name.trim() : '';
    if (!EMAIL.test(email)) return { status: 400, json: { error: 'Escriba un correo válido.' } };
    if (!name) return { status: 400, json: { error: 'Escriba el nombre.' } };
    if (await d.emailTaken(email)) return { status: 409, json: { error: 'Ese correo ya está registrado.' } };
    const code = await d.createInvitation({ ownerKey, kind: 'new', email, displayName: name, createdBy: caller.id });
    return { status: 200, json: { code, email, display_name: name, resent: false } };
  } catch {
    return { status: 500, json: { error: 'No se pudo crear la invitación. Intente de nuevo.' } };
  }
}
