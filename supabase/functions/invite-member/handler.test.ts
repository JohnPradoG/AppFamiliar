import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleInvite, type Deps } from './handler.ts';

function mk(over: Partial<Deps> = {}) {
  const calls: string[] = [];
  const d: Deps = {
    getCaller: async (h) => (h === 'Bearer mama' || h === 'Bearer john' ? { id: h.slice(7) } : null),
    isAdmin: async (id) => id === 'mama',
    findMember: async () => null,
    emailTaken: async () => false,
    createInvitation: async (i) => { calls.push(`inv:${i.kind}:${i.ownerKey}:${i.email}:${i.displayName}`); return 'CODE'; },
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
test('mamá invita: correo normalizado y sin contraseñas en la respuesta', async () => {
  const { d, calls } = mk();
  const r = await handleInvite('Bearer mama', ok, d);
  assert.equal(r.status, 200);
  assert.equal(r.json.code, 'CODE');
  assert.deepEqual(calls, ['inv:new:john:john@mail.com:John']);
  assert.equal(JSON.stringify(r.json).toLowerCase().includes('password'), false);
});
test('validaciones: destinatario, correo y nombre', async () => {
  const { d } = mk();
  assert.equal((await handleInvite('Bearer mama', { ...ok, owner_key: 'mama' }, d)).status, 400);
  assert.equal((await handleInvite('Bearer mama', { ...ok, email: 'no-es-correo' }, d)).status, 400);
  assert.equal((await handleInvite('Bearer mama', { ...ok, display_name: ' ' }, d)).status, 400);
  assert.equal((await handleInvite('Bearer mama', null, d)).status, 400);
});
test('si el hijo ya tiene cuenta: invitación de reemplazo de contraseña (reset)', async () => {
  const { d, calls } = mk({ findMember: async () => ({ userId: 'u9', email: 'j@x.com', displayName: 'John' }) });
  const r = await handleInvite('Bearer mama', { owner_key: 'john' }, d);
  assert.equal(r.status, 200);
  assert.equal(r.json.resent, true);
  assert.deepEqual(calls, ['inv:reset:john:j@x.com:John']);
});
test('correo ya registrado → 409 y no se crea invitación', async () => {
  const { d, calls } = mk({ emailTaken: async () => true });
  assert.equal((await handleInvite('Bearer mama', ok, d)).status, 409);
  assert.deepEqual(calls, []);
});
test('error interno → 500 genérico', async () => {
  const { d } = mk({ createInvitation: async () => { throw new Error('db secret detail'); } });
  const r = await handleInvite('Bearer mama', ok, d);
  assert.equal(r.status, 500);
  assert.equal(JSON.stringify(r.json).includes('secret'), false);
});
