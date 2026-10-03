import { formatCOP, formatSigned } from './money.ts';

export type AuditEntry = {
  id: number; action: 'insert' | 'update' | 'delete';
  old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null;
  reason: string | null; actor_id: string | null; at: string;
};
export type AuditTable = 'account_movements' | 'incomes';

const ACTION_TITLE = { insert: 'Creado', update: 'Modificado', delete: 'Eliminado' } as const;
export const RESTORED = 'Restaurado';

// Convierte una fila de audit_logs en texto para mamá: "Monto: -$50.000 → -$80.000".
export function describeAudit(e: AuditEntry, table: AuditTable): { title: string; lines: string[] } {
  const money = (v: unknown) => (typeof v === 'number' ? (table === 'incomes' ? formatCOP(v) : formatSigned(v)) : '—');
  const amountKey = table === 'incomes' ? 'amount' : 'signed_amount';
  const dateKey = table === 'incomes' ? 'income_date' : 'movement_date';
  const textKey = table === 'incomes' ? 'description' : 'concept';
  const o = e.old_data ?? {}; const n = e.new_data ?? {};
  const lines: string[] = [];

  if (e.action === 'insert') {
    lines.push(`Monto: ${money(n[amountKey])}`, `Fecha: ${String(n[dateKey] ?? '—')}`);
    if (n[textKey]) lines.push(`${table === 'incomes' ? 'Observación' : 'Concepto'}: ${String(n[textKey])}`);
  } else if (e.action === 'delete') {
    lines.push(`Monto: ${money(o[amountKey])}`);
  } else if (o.deleted_at && !n.deleted_at) {
    lines.push(`Monto: ${money(n[amountKey])}`);
    if (e.reason) lines.push(`Motivo: ${e.reason}`);
    return { title: RESTORED, lines };
  } else {
    if (o[amountKey] !== n[amountKey]) lines.push(`Monto: ${money(o[amountKey])} → ${money(n[amountKey])}`);
    if (o[dateKey] !== n[dateKey]) lines.push(`Fecha: ${String(o[dateKey] ?? '—')} → ${String(n[dateKey] ?? '—')}`);
    if ((o[textKey] ?? null) !== (n[textKey] ?? null)) lines.push(`${table === 'incomes' ? 'Observación' : 'Concepto'}: ${String(o[textKey] ?? '—')} → ${String(n[textKey] ?? '—')}`);
    if (lines.length === 0) lines.push('Sin cambios visibles');
  }
  if (e.reason) lines.push(`Motivo: ${e.reason}`);
  return { title: ACTION_TITLE[e.action], lines };
}
