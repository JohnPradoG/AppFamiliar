import { CATEGORY_LABEL, categoryOf, movementTitle, type Movement } from './movements.ts';

export type Order = 'recent' | 'oldest' | 'highest' | 'lowest';
export const ORDERS: { key: Order; label: string }[] = [
  { key: 'recent', label: 'Más reciente' }, { key: 'oldest', label: 'Más antiguo' }, { key: 'highest', label: 'Mayor monto' }, { key: 'lowest', label: 'Menor monto' },
];

// El monto se compara en valor absoluto (una transferencia de -$50.000 "pesa" $50.000).
export function filterByAmount(list: Movement[], min: number | null, max: number | null): Movement[] {
  return list.filter((m) => { const a = Math.abs(m.signed_amount); return (min === null || a >= min) && (max === null || a <= max); });
}

export function sortMovements(list: Movement[], order: Order): Movement[] {
  const byDate = (a: Movement, b: Movement) => b.movement_date.localeCompare(a.movement_date) || (b.created_at ?? '').localeCompare(a.created_at ?? '');
  const copy = [...list];
  switch (order) {
    case 'recent': return copy.sort(byDate);
    case 'oldest': return copy.sort((a, b) => -byDate(a, b));
    case 'highest': return copy.sort((a, b) => Math.abs(b.signed_amount) - Math.abs(a.signed_amount) || byDate(a, b));
    case 'lowest': return copy.sort((a, b) => Math.abs(a.signed_amount) - Math.abs(b.signed_amount) || byDate(a, b));
  }
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

// CSV para Excel (con BOM para que respete las tildes). Para la exportación del historial de mamá.
export function movementsToCSV(rows: Movement[], accountNames: Record<string, string>): string {
  const head = ['Fecha', 'Tipo', 'Origen', 'Cuenta', 'Monto', 'Concepto', 'Estado', 'Modificado'];
  const lines = rows.map((m) => [
    m.movement_date, movementTitle(m), CATEGORY_LABEL[categoryOf(m)], accountNames[m.account_id ?? ''] ?? '',
    m.signed_amount, m.concept ?? m.origin_detail ?? '', m.deleted_at ? 'Eliminado' : 'Activo', m.updated_at.slice(0, 10),
  ].map(csvCell).join(','));
  return '﻿' + [head.map(csvCell).join(','), ...lines].join('\r\n');
}
