// Validación pura de los formularios de mamá (sin React Native) para poder probarla.
import { formatCOP, parseCOP } from './money.ts';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

// "2026-10-03" → "2026-10-03" solo si es una fecha real del calendario.
export function parseDate(text: string): string | null {
  const m = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? m[0] : null;
}

const clean = (s: string) => (s.trim() ? s.trim() : null);

export type IncomeInput = { machineId: string | null; amountText: string; dateText: string; description: string; allocations: { accountId: string; amountText: string }[] };
export type IncomeValue = { machineId: string; amount: number; date: string; description: string | null; allocations: { account_id: string; amount: number }[] };

export function validateIncome(i: IncomeInput): Result<IncomeValue> {
  if (!i.machineId) return fail('Elija la máquina.');
  const amount = parseCOP(i.amountText);
  if (!amount) return fail('Escriba un monto mayor que cero.');
  const date = parseDate(i.dateText);
  if (!date) return fail('La fecha debe ser válida, con el formato AAAA-MM-DD.');
  const allocations: { account_id: string; amount: number }[] = [];
  for (const a of i.allocations) {
    if (!a.amountText.trim()) continue;                       // vacío = no se asigna a esa cuenta
    const n = parseCOP(a.amountText);
    if (!n) return fail('Los montos asignados deben ser mayores que cero.');
    allocations.push({ account_id: a.accountId, amount: n });
  }
  const assigned = allocations.reduce((s, a) => s + a.amount, 0);
  if (assigned > amount) return fail(`Lo asignado (${formatCOP(assigned)}) supera el ingreso (${formatCOP(amount)}).`);
  return { ok: true, value: { machineId: i.machineId, amount, date, description: clean(i.description), allocations } };
}

export type Origin = 'work' | 'machine' | 'other' | 'custom';
export type CreditInput = { accountId: string | null; amountText: string; dateText: string; origin: Origin; detail: string; description: string };
export type CreditValue = { accountId: string; amount: number; date: string; origin: Origin; detail: string | null; description: string | null };

export function validateCredit(i: CreditInput): Result<CreditValue> {
  if (!i.accountId) return fail('Elija a quién se le agrega el saldo.');
  const amount = parseCOP(i.amountText);
  if (!amount) return fail('Escriba un monto mayor que cero.');
  const date = parseDate(i.dateText);
  if (!date) return fail('La fecha debe ser válida, con el formato AAAA-MM-DD.');
  if (i.origin === 'custom' && !i.detail.trim()) return fail('Escriba cuál es el origen personalizado.');
  return { ok: true, value: { accountId: i.accountId, amount, date, origin: i.origin, detail: i.origin === 'custom' ? i.detail.trim() : null, description: clean(i.description) } };
}

export type TransferInput = { accountId: string | null; amountText: string; dateText: string; concept: string };
export type TransferValue = { accountId: string; amount: number; date: string; concept: string | null };

export function validateTransfer(i: TransferInput): Result<TransferValue> {
  if (!i.accountId) return fail('Elija a quién se transfiere.');
  const amount = parseCOP(i.amountText);
  if (!amount) return fail('Escriba un monto mayor que cero.');
  const date = parseDate(i.dateText);
  if (!date) return fail('La fecha debe ser válida, con el formato AAAA-MM-DD.');
  return { ok: true, value: { accountId: i.accountId, amount, date, concept: clean(i.concept) } };
}
