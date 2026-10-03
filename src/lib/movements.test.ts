import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categoryOf, filterByTab, movementSubtitle, movementTitle, totalsByCategory, type Movement } from './movements.ts';

const base = { origin_detail: null, concept: null, movement_date: '2026-10-03', updated_at: '2026-10-03T10:00:00Z', machine: null };
const mv = (o: Partial<Movement>): Movement => ({ id: 'x', kind: 'credit', origin: 'work', signed_amount: 1000, ...base, ...o });

test('categorías', () => {
  assert.equal(categoryOf({ kind: 'machine_income', origin: 'machine' }), 'machine');
  assert.equal(categoryOf({ kind: 'credit', origin: 'machine' }), 'machine');
  assert.equal(categoryOf({ kind: 'credit', origin: 'work' }), 'credit');
  assert.equal(categoryOf({ kind: 'credit', origin: 'custom' }), 'credit');
  assert.equal(categoryOf({ kind: 'transfer', origin: 'transfer' }), 'transfer');
  assert.equal(categoryOf({ kind: 'correction', origin: 'correction' }), 'correction');
});
test('títulos y subtítulos', () => {
  assert.equal(movementTitle(mv({ kind: 'machine_income', origin: 'machine', machine: { name: 'Máquina 1' } })), 'Máquina 1');
  assert.equal(movementTitle(mv({ kind: 'transfer', origin: 'transfer', signed_amount: -5 })), 'Transferencia recibida');
  assert.equal(movementSubtitle(mv({ origin: 'custom', origin_detail: 'Venta de bicicleta' })), 'Venta de bicicleta');
  assert.equal(movementSubtitle(mv({ concept: 'Dinero del trabajo' })), 'Dinero del trabajo');
  assert.equal(movementSubtitle(mv({ origin: 'work' })), 'Trabajo');
});
test('pestañas del historial', () => {
  const list = [mv({ id: 'a' }), mv({ id: 'b', kind: 'transfer', origin: 'transfer', signed_amount: -50 }), mv({ id: 'c', kind: 'correction', origin: 'correction', signed_amount: 20 })];
  assert.deepEqual(filterByTab(list, 'all').map((m) => m.id), ['a', 'b', 'c']);
  assert.deepEqual(filterByTab(list, 'income').map((m) => m.id), ['a']);       // la corrección no es "ingreso"
  assert.deepEqual(filterByTab(list, 'transfer').map((m) => m.id), ['b']);
});
test('origen del saldo agrupa work/other/custom como "Saldo agregado"', () => {
  const t = totalsByCategory([{ origin: 'machine', total: 350000 }, { origin: 'work', total: 150000 }, { origin: 'other', total: 50000 }, { origin: 'transfer', total: -100000 }]);
  assert.deepEqual(t, { machine: 350000, credit: 200000, transfer: -100000, correction: 0 });
  assert.equal(Object.values(t).reduce((a, b) => a + b, 0), 450000);            // coincide con el saldo
});
