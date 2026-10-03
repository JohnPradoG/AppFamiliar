import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inviteMessage, parseAuthUrl, translateAuthError } from './links.ts';

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
test('mensaje de invitación', () => {
  const m = inviteMessage('John', 'https://apk', 'https://link');
  assert.ok(m.includes('Hola John') && m.includes('1) Descarga') && m.includes('2) Con la app') && m.includes('https://link'));
  assert.ok(!inviteMessage('John', undefined, 'https://link').includes('Descarga'));
});
