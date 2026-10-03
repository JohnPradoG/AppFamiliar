import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinChunks, shouldLock, splitChunks } from './chunks.ts';

test('troceo y unión sin pérdida', () => {
  const big = 'x'.repeat(5000) + 'ñ€🙂' + 'y'.repeat(1234);
  const parts = splitChunks(big, 1800);
  assert.ok(parts.length >= 4 && parts.every((p) => p.length <= 1800));
  assert.equal(joinChunks(parts), big);
  assert.equal(joinChunks(splitChunks('')), '');
  assert.equal(joinChunks(['a', null]), null);        // si falta un trozo, no se devuelve una sesión corrupta
});
test('bloqueo de la app', () => {
  assert.equal(shouldLock(false, null, 1000), false);
  assert.equal(shouldLock(true, null, 1000), true);                 // al abrir
  assert.equal(shouldLock(true, 1000, 1000 + 10_000), false);       // volvió rápido
  assert.equal(shouldLock(true, 1000, 1000 + 30_000), true);        // pasó el tiempo
});
