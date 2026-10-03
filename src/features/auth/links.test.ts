import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractCode, inviteMessage, parseAuthUrl, translateAuthError } from './links.ts';

test('parseAuthUrl lee los tokens del fragmento', () => {
  assert.deepEqual(parseAuthUrl('appfamiliar://set-password#access_token=a.b.c&refresh_token=xyz&type=invite'), { access_token: 'a.b.c', refresh_token: 'xyz' });
  assert.equal(parseAuthUrl('appfamiliar://set-password'), null);
  assert.equal(parseAuthUrl('appfamiliar://x#access_token=a'), null);
  assert.equal(parseAuthUrl('appfamiliar://x#error=access_denied&error_code=otp_expired'), null);
});
test('errores en español, sin filtrar detalles técnicos', () => {
  assert.equal(translateAuthError('Invalid login credentials'), 'Correo o contraseña incorrectos.');
  assert.equal(translateAuthError('weird internal 500 stack'), 'No se pudo completar la operación. Intente de nuevo.');
});
test('mensaje de invitación: un solo enlace y el código', () => {
  const m = inviteMessage('John', 'https://x/?c=AAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA');
  assert.ok(m.includes('Hola John') && m.includes('https://x/?c=') && m.includes('código'));
});
test('extractCode acepta código suelto o enlace', () => {
  const c = 'abcdefghijklmnopqrstuv';
  assert.equal(extractCode(`  ${c} `), c);
  assert.equal(extractCode(`https://host/?c=${c}`), c);
  assert.equal(extractCode(`appfamiliar://invitacion?code=${c}`), c);
});
