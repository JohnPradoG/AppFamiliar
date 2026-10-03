import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeAudit } from './audit.ts';
import { filterByAmount, movementsToCSV, sortMovements } from './history.ts';
import type { Movement } from './movements.ts';

const mv = (o: Partial<Movement>): Movement => ({ id: 'x', kind: 'credit', origin: 'work', origin_detail: null, signed_amount: 1000, movement_date: '2026-10-03', concept: null, updated_at: '2026-10-03T10:00:00Z', machine: null, account_id: 'a1', deleted_at: null, created_at: '2026-10-03T10:00:00Z', ...o });

test('filtro por monto usa valor absoluto', () => {
  const l = [mv({ id: 'a', signed_amount: 100 }), mv({ id: 'b', signed_amount: -500 }), mv({ id: 'c', signed_amount: 900 })];
  assert.deepEqual(filterByAmount(l, 400, 800).map((m) => m.id), ['b']);
  assert.deepEqual(filterByAmount(l, null, 100).map((m) => m.id), ['a']);
  assert.equal(filterByAmount(l, null, null).length, 3);
});
test('orden', () => {
  const l = [mv({ id: 'a', movement_date: '2026-10-01', signed_amount: 300 }), mv({ id: 'b', movement_date: '2026-10-05', signed_amount: -900 }), mv({ id: 'c', movement_date: '2026-10-03', signed_amount: 100 })];
  assert.deepEqual(sortMovements(l, 'recent').map((m) => m.id), ['b', 'c', 'a']);
  assert.deepEqual(sortMovements(l, 'oldest').map((m) => m.id), ['a', 'c', 'b']);
  assert.deepEqual(sortMovements(l, 'highest').map((m) => m.id), ['b', 'a', 'c']);
  assert.deepEqual(sortMovements(l, 'lowest').map((m) => m.id), ['c', 'a', 'b']);
  assert.equal(l[0].id, 'a');                       // no muta la lista original
});
test('CSV: comillas escapadas, BOM, estado', () => {
  const csv = movementsToCSV([mv({ concept: 'Dijo "hola", ok', deleted_at: '2026-10-04T00:00:00Z' })], { a1: 'John' });
  assert.ok(csv.startsWith('﻿"Fecha"'));
  assert.ok(csv.includes('"Dijo ""hola"", ok"'));
  assert.ok(csv.includes('"John"') && csv.includes('"Eliminado"'));
  assert.equal(csv.split('\r\n').length, 2);
});
test('auditoría: restauración', () => {
  const e = { id: 9, action: 'update' as const, old_data: { signed_amount: -1000, deleted_at: '2026-10-04T00:00:00Z' }, new_data: { signed_amount: -1000, deleted_at: null }, reason: 'era correcto', actor_id: 'm', at: '2026-10-05T00:00:00Z' };
  const d = describeAudit(e, 'account_movements');
  assert.equal(d.title, 'Restaurado');
  assert.deepEqual(d.lines, ['Monto: -$1.000', 'Motivo: era correcto']);
});
test('auditoría: valor anterior y nuevo, y motivo', () => {
  const e = { id: 1, action: 'update' as const, old_data: { signed_amount: -50000, concept: 'a', movement_date: '2026-10-03' }, new_data: { signed_amount: -80000, concept: 'a', movement_date: '2026-10-03' }, reason: 'Error de digitación', actor_id: 'm', at: '2026-10-03T10:00:00Z' };
  const d = describeAudit(e, 'account_movements');
  assert.equal(d.title, 'Modificado');
  assert.deepEqual(d.lines, ['Monto: -$50.000 → -$80.000', 'Motivo: Error de digitación']);
  const inc = describeAudit({ ...e, old_data: { amount: 150000 }, new_data: { amount: 180000 }, reason: null }, 'incomes');
  assert.deepEqual(inc.lines, ['Monto: $150.000 → $180.000']);
  assert.equal(describeAudit({ ...e, action: 'delete', new_data: null }, 'account_movements').title, 'Eliminado');
  assert.deepEqual(describeAudit({ ...e, reason: null, action: 'insert', old_data: null, new_data: { signed_amount: 200000, movement_date: '2026-10-03', concept: 'Trabajo' } }, 'account_movements').lines, ['Monto: +$200.000', 'Fecha: 2026-10-03', 'Concepto: Trabajo']);
});
