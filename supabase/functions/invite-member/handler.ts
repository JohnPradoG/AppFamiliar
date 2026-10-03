// Lógica pura (sin Deno) para poder probarla con `npm test`.
export type Deps = {
  getCaller(authHeader: string | null): Promise<{ id: string } | null>;
  canInvite(userId: string): Promise<boolean>;   // mamá (admin) o un hijo con permiso de ayudante
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
  if (!(await d.canInvite(caller.id))) return { status: 403, json: { error: 'No tiene permiso para invitar.' } };

  const b = (body ?? {}) as Record<string, unknown>;
  try {
    if (b.owner_key !== undefined && b.owner_key !== null) {
      if (typeof b.owner_key !== 'string' || !KEY.test(b.owner_key)) return { status: 400, json: { error: 'Persona inválida.' } };
      const existing = await d.findMember(b.owner_key);
      if (!existing) return { status: 404, json: { error: 'Esa persona no existe.' } };
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
