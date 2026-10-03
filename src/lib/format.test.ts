import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCOP, formatSigned, parseCOP } from './money.ts';
import { periodRange } from './period.ts';

test('formatCOP', () => {
  assert.equal(formatCOP(1250000), '$1.250.000');
  assert.equal(formatCOP(0), '$0');
  assert.equal(formatCOP(-100000), '-$100.000');
  assert.equal(formatCOP(999), '$999');
  assert.equal(formatSigned(150000), '+$150.000');
  assert.equal(formatSigned(-50000), '-$50.000');
});
test('parseCOP', () => {
  assert.equal(parseCOP('150.000'), 150000);
  assert.equal(parseCOP('$ 1.250.000'), 1250000);
  assert.equal(parseCOP(''), null);
  assert.equal(parseCOP('0'), null);
  assert.equal(parseCOP('abc'), null);
});
test('periodRange', () => {
  const sat = new Date(2026, 9, 3); // sábado 3-oct-2026
  assert.deepEqual(periodRange('today', sat), { from: '2026-10-03', to: '2026-10-03' });
  assert.deepEqual(periodRange('week', sat), { from: '2026-09-28', to: '2026-10-04' });
  assert.deepEqual(periodRange('month', sat), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(periodRange('prev_month', sat), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(periodRange('prev_month', new Date(2026, 0, 15)), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(periodRange('all', sat), { from: null, to: null });
  assert.deepEqual(periodRange('week', new Date(2026, 9, 5)), { from: '2026-10-05', to: '2026-10-11' }); // lunes
});
