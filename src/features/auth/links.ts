// Funciones puras de autenticación (sin React Native) para poder probarlas.
export function parseAuthUrl(url: string): { access_token: string; refresh_token: string } | null {
  const frag = url.split('#')[1];
  if (!frag) return null;
  const p = new URLSearchParams(frag);
  const access_token = p.get('access_token');
  const refresh_token = p.get('refresh_token');
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}

export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espere unos minutos.';
  if (m.includes('network') || m.includes('fetch')) return 'Sin conexión. Revise su internet.';
  if (m.includes('password') && m.includes('characters')) return 'La contraseña debe tener al menos 8 caracteres.';
  if (m.includes('same') && m.includes('password')) return 'La nueva contraseña debe ser distinta a la anterior.';
  return 'No se pudo completar la operación. Intente de nuevo.';
}

// Texto que mamá comparte por WhatsApp. Primero se instala la app, después se abre el enlace para crear la contraseña.
export function inviteMessage(name: string, apkUrl: string | undefined, link: string): string {
  const lines = [`Hola ${name}, te invito a AppFamiliar, la app de la familia para llevar el dinero.`, ''];
  if (apkUrl) lines.push(`1) Descarga e instala la app (Android): ${apkUrl}`, '');
  lines.push(`${apkUrl ? '2)' : '1)'} Con la app instalada, abre este enlace para crear TU contraseña (solo sirve una vez):`, link);
  return lines.join('\n');
}
