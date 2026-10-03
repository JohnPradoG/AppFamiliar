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
