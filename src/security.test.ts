// Pruebas estáticas de seguridad sobre el código de la app (corren con `npm test`).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'node_modules') walk(p, out); }
    else if (/\.(ts|tsx|json|js)$/.test(f)) out.push(p);
  }
  return out;
}
const appFiles = [...walk('app'), ...walk('src')].filter((f) => !f.endsWith('security.test.ts'));

test('la llave service_role NUNCA aparece en el código de la app', () => {
  for (const f of appFiles) assert.ok(!/service[_-]?role/i.test(readFileSync(f, 'utf8')), `${f} menciona service_role`);
});
test('la app solo usa variables públicas EXPO_PUBLIC_* (URL y llave anon)', () => {
  const used = new Set<string>();
  for (const f of appFiles) for (const m of readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(m[1]);
  for (const v of used) assert.ok(v.startsWith('EXPO_PUBLIC_') && !/SERVICE|SECRET|PRIVATE|PASSWORD/.test(v), `variable sospechosa: ${v}`);
});
test('la app no escribe directo en tablas: todo cambio pasa por rpc()', () => {
  for (const f of appFiles) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/\.from\([^)]*\)\s*\.(insert|update|delete|upsert)\(/.test(src.replace(/\s+/g, ' ')), `${f} escribe directo en una tabla`);
  }
});
test('.env no está versionado y .env.example no trae llaves reales', () => {
  assert.ok(readFileSync('.gitignore', 'utf8').split('\n').includes('.env'));
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(readFileSync('.env.example', 'utf8').replace('eyJ...', '')));
});
test('las contraseñas nunca se guardan en el dispositivo por la app', () => {
  for (const f of appFiles) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/(AsyncStorage|SecureStore)\.setItem\([^)]*pass/i.test(src), `${f} guarda una contraseña`);
  }
});
