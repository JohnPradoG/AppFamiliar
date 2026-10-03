import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleInvite, slugify, type Deps } from './handler.ts';

function mk(over: Partial<Deps> = {}) {
  const calls: string[] = [];
  const d: Deps = {
    getCaller: async (h) => (['Bearer mama', 'Bearer john', 'Bearer helper'].includes(h ?? '') ? { id: (h as string).slice(7) } : null),
    getRole: async (id) => (id === 'mama' ? 'admin' : id === 'helper' ? 'helper' : null),
    findMember: async () => null,
    ownerKeyExists: async () => false,
    emailTaken: async () => false,
    createInvitation: async (i) => { calls.push(`inv:${i.kind}:${i.ownerKey}:${i.email}:${i.displayName}`); return 'CODE'; },
    ...over,
  };
  return { d, calls };
}
const ok = { email: ' Mauricio@Mail.com ', display_name: 'Mauricio' };

test('slugify', () => {
  assert.equal(slugify('Mauricio Pérez'), 'mauricio-perez');
  assert.equal(slugify('  Ñandú!! '), 'nandu');
  assert.equal(slugify('###'), 'persona');
});
test('sin sesión → 401', async () => assert.equal((await handleInvite(null, ok, mk().d)).status, 401));
test('un hijo común NO puede invitar → 403 y no crea nada', async () => {
  const { d, calls } = mk();
  assert.equal((await handleInvite('Bearer john', ok, d)).status, 403);
  assert.deepEqual(calls, []);
});
test('un ayudante autorizado SÍ puede invitar', async () => {
  const { d, calls } = mk();
  assert.equal((await handleInvite('Bearer helper', ok, d)).status, 200);
  assert.equal(calls.length, 1);
});
test('mamá agrega a una persona nueva: clave desde el nombre, correo normalizado, sin contraseñas', async () => {
  const { d, calls } = mk();
  const r = await handleInvite('Bearer mama', ok, d);
  assert.equal(r.status, 200);
  assert.equal(r.json.code, 'CODE');
  assert.deepEqual(calls, ['inv:new:mauricio:mauricio@mail.com:Mauricio']);
  assert.equal(JSON.stringify(r.json).toLowerCase().includes('password'), false);
});
test('dos personas con el mismo nombre reciben claves distintas', async () => {
  const taken = new Set(['mauricio', 'mauricio-2']);
  const { d, calls } = mk({ ownerKeyExists: async (k) => taken.has(k) });
  await handleInvite('Bearer mama', ok, d);
  assert.deepEqual(calls, ['inv:new:mauricio-3:mauricio@mail.com:Mauricio']);
});
test('validaciones: correo, nombre', async () => {
  const { d } = mk();
  assert.equal((await handleInvite('Bearer mama', { ...ok, email: 'no-es-correo' }, d)).status, 400);
  assert.equal((await handleInvite('Bearer mama', { ...ok, display_name: ' ' }, d)).status, 400);
  assert.equal((await handleInvite('Bearer mama', { ...ok, display_name: 'x'.repeat(61) }, d)).status, 400);
  assert.equal((await handleInvite('Bearer mama', null, d)).status, 400);
  assert.equal((await handleInvite('Bearer mama', { owner_key: 'Mal Formato!' }, d)).status, 400);
});
test('persona existente: enlace nuevo (reset); sin acceso → 409; inexistente → 404', async () => {
  const member = { userId: 'u9', email: 'j@x.com', displayName: 'John', active: true };
  const a = mk({ findMember: async () => member });
  const r = await handleInvite('Bearer mama', { owner_key: 'john' }, a.d);
  assert.equal(r.status, 200); assert.equal(r.json.resent, true);
  assert.deepEqual(a.calls, ['inv:reset:john:j@x.com:John']);
  const b = mk({ findMember: async () => ({ ...member, active: false }) });
  assert.equal((await handleInvite('Bearer mama', { owner_key: 'john' }, b.d)).status, 409);
  assert.deepEqual(b.calls, []);
  assert.equal((await handleInvite('Bearer mama', { owner_key: 'nadie' }, mk().d)).status, 404);
});
test('SEGURIDAD: un ayudante NO puede pedir un enlace nuevo para otra persona (tomaría su cuenta)', async () => {
  const { d, calls } = mk({ findMember: async () => ({ userId: 'u-mauricio', email: 'm@x.com', displayName: 'Mauricio', active: true }) });
  const r = await handleInvite('Bearer helper', { owner_key: 'mauricio' }, d);
  assert.equal(r.status, 403);
  assert.deepEqual(calls, []);
  assert.equal(JSON.stringify(r.json).includes('m@x.com'), false);          // ni siquiera revela el correo
});
test('un ayudante SÍ puede pedir el enlace para sí mismo; mamá para cualquiera', async () => {
  const own = mk({ findMember: async () => ({ userId: 'helper', email: 'h@x.com', displayName: 'John', active: true }) });
  assert.equal((await handleInvite('Bearer helper', { owner_key: 'john' }, own.d)).status, 200);
  const other = mk({ findMember: async () => ({ userId: 'u-mauricio', email: 'm@x.com', displayName: 'Mauricio', active: true }) });
  assert.equal((await handleInvite('Bearer mama', { owner_key: 'mauricio' }, other.d)).status, 200);
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
