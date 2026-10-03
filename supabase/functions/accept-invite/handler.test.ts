import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateCode, hashCode } from '../_shared/token.ts';
import { handleAccept, type AcceptDeps, type Invitation } from './handler.ts';

const inv: Invitation = { id: 'i1', owner_key: 'john', kind: 'new', email: 'j@x.com', display_name: 'John', created_by: 'mama' };

// Simula la BD: el código solo se puede canjear UNA vez.
function mk(over: Partial<AcceptDeps> = {}, invitation: Invitation = inv) {
  const calls: string[] = [];
  let used = false;
  const code = generateCode();
  const d: AcceptDeps = {
    hashCode,
    claim: async (h) => { if (used || h !== (await hashCode(code))) return null; used = true; return invitation; },
    release: async () => { used = false; calls.push('release'); },
    findMember: async () => ({ userId: 'u-john' }),
    createUser: async (e) => { calls.push(`create:${e}`); return { userId: 'u1' }; },
    setPassword: async (u) => { calls.push(`setpw:${u}`); },
    createMember: async (u, k, n, a) => { calls.push(`member:${u}:${k}:${n}:${a}`); },
    deleteUser: async (u) => { calls.push(`delete:${u}`); },
    ...over,
  };
  return { d, calls, code };
}

test('generateCode: 22 caracteres, distintos cada vez', () => {
  const a = generateCode(), b = generateCode();
  assert.match(a, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(a, b);
});
test('crea la cuenta con la contraseña elegida', async () => {
  const { d, calls, code } = mk();
  const r = await handleAccept({ code, password: 'clave-segura' }, d);
  assert.equal(r.status, 200);
  assert.equal(r.json.email, 'j@x.com');
  assert.deepEqual(calls, ['create:j@x.com', 'member:u1:john:John:mama']);
});
test('UN SOLO USO: el segundo intento con el mismo código falla', async () => {
  const { d, code } = mk();
  assert.equal((await handleAccept({ code, password: 'clave-segura' }, d)).status, 200);
  assert.equal((await handleAccept({ code, password: 'otra-clave-1' }, d)).status, 410);
});
test('código inventado o mal formado → 410 sin tocar la BD', async () => {
  let touched = false;
  const { d } = mk({ claim: async () => { touched = true; return null; } });
  assert.equal((await handleAccept({ code: 'corto', password: 'clave-segura' }, d)).status, 410);
  assert.equal(touched, false);
  assert.equal((await handleAccept({ code: generateCode(), password: 'clave-segura' }, d)).status, 410);
});
test('contraseña débil → 400 y NO gasta el código', async () => {
  const { d, code } = mk();
  assert.equal((await handleAccept({ code, password: '1234' }, d)).status, 400);
  assert.equal((await handleAccept({ code, password: 'clave-segura' }, d)).status, 200);
});
test('correo ya registrado → 409 y el código se libera', async () => {
  const { d, calls, code } = mk({ createUser: async () => { throw new Error('User already registered'); } });
  assert.equal((await handleAccept({ code, password: 'clave-segura' }, d)).status, 409);
  assert.deepEqual(calls, ['release']);
});
test('si falla crear el perfil: se borra el usuario y se libera el código', async () => {
  const { d, calls, code } = mk({ createMember: async () => { throw new Error('boom'); } });
  assert.equal((await handleAccept({ code, password: 'clave-segura' }, d)).status, 500);
  assert.ok(calls.includes('delete:u1') && calls.includes('release'));
});
test('reset: cambia la contraseña de la cuenta existente, sin crear usuario', async () => {
  const { d, calls, code } = mk({}, { ...inv, kind: 'reset' });
  assert.equal((await handleAccept({ code, password: 'clave-nueva-1' }, d)).status, 200);
  assert.deepEqual(calls, ['setpw:u-john']);
});
