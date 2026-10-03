import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDate, validateCredit, validateIncome, validateTransfer } from './forms.ts';
import { formatInput } from './money.ts';

test('formatInput mientras se escribe', () => {
  assert.equal(formatInput('1250000'), '1.250.000');
  assert.equal(formatInput('1.250.0000'), '12.500.000');
  assert.equal(formatInput('abc'), '');
  assert.equal(formatInput('007'), '7');
});
test('parseDate solo acepta fechas reales', () => {
  assert.equal(parseDate('2026-10-03'), '2026-10-03');
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('03/10/2026'), null);
  assert.equal(parseDate('2026-13-01'), null);
  assert.equal(parseDate('2028-02-29'), '2028-02-29');
  assert.equal(parseDate('2027-02-29'), null);
});
const inc = { machineId: 'm1', amountText: '150.000', dateText: '2026-10-03', description: ' Ingreso M1 ', allocations: [{ accountId: 'john', amountText: '' }, { accountId: 'bro', amountText: '' }] };
test('ingreso: sin asignar es válido (no toca saldos)', () => {
  const r = validateIncome(inc);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.value.amount, 150000); assert.deepEqual(r.value.allocations, []); assert.equal(r.value.description, 'Ingreso M1'); }
});
test('ingreso: reparto distinto a cada hijo', () => {
  const r = validateIncome({ ...inc, allocations: [{ accountId: 'john', amountText: '100.000' }, { accountId: 'bro', amountText: '50.000' }] });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.allocations, [{ account_id: 'john', amount: 100000 }, { account_id: 'bro', amount: 50000 }]);
});
test('ingreso: errores', () => {
  assert.equal(validateIncome({ ...inc, machineId: null }).ok, false);
  assert.equal(validateIncome({ ...inc, amountText: '0' }).ok, false);
  assert.equal(validateIncome({ ...inc, dateText: '2026-99-99' }).ok, false);
  const over = validateIncome({ ...inc, allocations: [{ accountId: 'john', amountText: '100.000' }, { accountId: 'bro', amountText: '60.000' }] });
  assert.ok(!over.ok && over.error.includes('supera'));
  assert.equal(validateIncome({ ...inc, allocations: [{ accountId: 'john', amountText: 'abc' }] }).ok, false);
});
test('agregar saldo', () => {
  const base = { accountId: 'john', amountText: '200.000', dateText: '2026-10-03', origin: 'work' as const, detail: '', description: '' };
  const r = validateCredit(base);
  assert.ok(r.ok && r.value.amount === 200000 && r.value.detail === null && r.value.description === null);
  assert.equal(validateCredit({ ...base, accountId: null }).ok, false);
  assert.equal(validateCredit({ ...base, origin: 'custom' }).ok, false);
  const c = validateCredit({ ...base, origin: 'custom', detail: ' Venta ' });
  assert.ok(c.ok && c.value.detail === 'Venta');
  const w = validateCredit({ ...base, detail: 'ignorado' });
  assert.ok(w.ok && w.value.detail === null);
});
test('transferencia', () => {
  const r = validateTransfer({ accountId: 'john', amountText: '50.000', dateText: '2026-10-03', concept: 'Transferencia personal' });
  assert.ok(r.ok && r.value.amount === 50000);
  assert.equal(validateTransfer({ accountId: null, amountText: '5', dateText: '2026-10-03', concept: '' }).ok, false);
  assert.equal(validateTransfer({ accountId: 'john', amountText: '-5', dateText: '2026-10-03', concept: '' }).ok, true); // "-" se ignora: solo dígitos
});

import { validateMovementEdit } from './forms.ts';
test('editar movimiento', () => {
  const base = { kind: 'transfer' as const, amountText: '80.000', negative: false, dateText: '2026-10-03', concept: ' x ' };
  const r = validateMovementEdit(base);
  assert.ok(r.ok && r.value.amount === 80000 && r.value.concept === 'x');
  const neg = validateMovementEdit({ ...base, kind: 'transfer', negative: true });          // el signo solo aplica a correcciones
  assert.ok(neg.ok && neg.value.amount === 80000);
  const c = validateMovementEdit({ ...base, kind: 'correction', negative: true });
  assert.ok(c.ok && c.value.amount === -80000);
  assert.equal(validateMovementEdit({ ...base, kind: 'correction', concept: '' }).ok, false);
  assert.equal(validateMovementEdit({ ...base, amountText: '' }).ok, false);
  assert.equal(validateMovementEdit({ ...base, dateText: '2026-02-31' }).ok, false);
});

import { validateCorrection } from './forms.ts';
test('corrección: signo y explicación obligatoria', () => {
  const base = { accountId: 'john', amountText: '5.000', negative: true, dateText: '2026-10-03', concept: ' Ajuste ' };
  const r = validateCorrection(base);
  assert.ok(r.ok && r.value.signedAmount === -5000 && r.value.concept === 'Ajuste');
  const p = validateCorrection({ ...base, negative: false });
  assert.ok(p.ok && p.value.signedAmount === 5000);
  assert.equal(validateCorrection({ ...base, concept: ' ' }).ok, false);
  assert.equal(validateCorrection({ ...base, accountId: null }).ok, false);
});
