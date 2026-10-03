import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleInvite, type Deps } from './handler.ts';

function mk(over: Partial<Deps> = {}) {
  const calls: string[] = [];
  const d: Deps = {
    redirectTo: 'appfamiliar://set-password',
    getCaller: async (h) => (h === 'Bearer mama' || h === 'Bearer john' ? { id: h.slice(7) } : null),
    isAdmin: async (id) => id === 'mama',
    findMember: async () => null,
    generateLink: async (kind, email) => { calls.push(`link:${kind}:${email}`); return { link: 'https://x/verify?token=1', userId: 'u1' }; },
    createMember: async (u, k, n) => { calls.push(`member:${u}:${k}:${n}`); },
    deleteUser: async (u) => { calls.push(`delete:${u}`); },
    ...over,
  };
  return { d, calls };
}
const ok = { owner_key: 'john', email: ' John@Mail.com ', display_name: 'John' };

test('sin sesión → 401', async () => assert.equal((await handleInvite(null, ok, mk().d)).status, 401));
test('un hijo NO puede invitar → 403 y no crea nada', async () => {
  const { d, calls } = mk();
  assert.equal((await handleInvite('Bearer john', ok, d)).status, 403);
  assert.deepEqual(calls, []);
});
test('mamá invita: crea enlace de invitación y miembro (correo normalizado)', async () => {
  const { d, calls } = mk();
  const r = await handleInvite('Bearer mama', ok, d);
  assert.equal(r.status, 200);
  assert.equal(r.json.link, 'https://x/verify?token=1');
  assert.equal(r.json.resent, false);
  assert.deepEqual(calls, ['link:invite:john@mail.com', 'member:u1:john:John']);
  assert.equal(JSON.stringify(r.json).includes('password'), false);
});
test('validaciones: destinatario, correo y nombre', async () => {
  const { d } = mk();
  assert.equal((await handleInvite('Bearer mama', { ...ok, owner_key: 'mama' }, d)).status, 400);
  assert.equal((await handleInvite('Bearer mama', { ...ok, email: 'no-es-correo' }, d)).status, 400);
  assert.equal((await handleInvite('Bearer mama', { ...ok, display_name: ' ' }, d)).status, 400);
  assert.equal((await handleInvite('Bearer mama', null, d)).status, 400);
});
test('si el hijo ya existe: reenvía con enlace de recuperación (sin tocar datos)', async () => {
  const { d, calls } = mk({ findMember: async () => ({ userId: 'u9', email: 'j@x.com' }) });
  const r = await handleInvite('Bearer mama', { owner_key: 'john' }, d);
  assert.equal(r.status, 200);
  assert.equal(r.json.resent, true);
  assert.deepEqual(calls, ['link:recovery:j@x.com']);
});
test('correo ya registrado → 409', async () => {
  const { d } = mk({ generateLink: async () => { throw new Error('User already registered'); } });
  assert.equal((await handleInvite('Bearer mama', ok, d)).status, 409);
});
test('si falla guardar el perfil, se borra el usuario creado (sin usuarios a medias)', async () => {
  const { d, calls } = mk({ createMember: async () => { throw new Error('boom'); } });
  const r = await handleInvite('Bearer mama', ok, d);
  assert.equal(r.status, 500);
  assert.ok(calls.includes('delete:u1'));
});
