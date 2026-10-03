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

// Texto que mamá comparte por WhatsApp: UN enlace de un solo uso (descarga + registro) y el código por si hiciera falta.
export function inviteMessage(name: string, link: string, code: string): string {
  return [
    `Hola ${name}, te invito a AppFamiliar, la app de la familia para llevar el dinero.`,
    '',
    'Abre este enlace desde tu celular Android: descargas la app y luego creas TU contraseña. Solo sirve una vez:',
    link,
    '',
    `Si la app te pide un código, es este: ${code}`,
  ].join('\n');
}

// Acepta el código pegado a mano o un enlace completo (…?c=CODE / …?code=CODE) y devuelve solo el código.
export function extractCode(text: string): string {
  const t = text.trim();
  const m = t.match(/[?&](?:c|code)=([A-Za-z0-9_-]{22})/);
  return m ? m[1] : t;
}
