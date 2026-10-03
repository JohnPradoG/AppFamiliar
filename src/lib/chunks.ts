// SecureStore limita cada valor (~2 KB) y el token de sesión es más grande: se guarda en trozos.
export const CHUNK_SIZE = 1800;
export function splitChunks(value: string, size = CHUNK_SIZE): string[] {
  if (value.length === 0) return [''];
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size) out.push(value.slice(i, i + size));
  return out;
}
export function joinChunks(chunks: (string | null)[]): string | null {
  return chunks.some((c) => c === null) ? null : chunks.join('');
}

// ¿Hay que pedir huella/PIN? Al abrir la app, o al volver tras `timeoutMs` en segundo plano.
export function shouldLock(enabled: boolean, lastActiveAt: number | null, now: number, timeoutMs = 30_000): boolean {
  if (!enabled) return false;
  if (lastActiveAt === null) return true;
  return now - lastActiveAt >= timeoutMs;
}
