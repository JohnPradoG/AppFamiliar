// Lógica pura de presentación de movimientos (sin React Native) para poder probarla.
export type Kind = 'machine_income' | 'credit' | 'transfer' | 'correction';
export type Origin = 'machine' | 'work' | 'other' | 'custom' | 'transfer' | 'correction';
export type Movement = {
  id: string; kind: Kind; origin: Origin; origin_detail: string | null; signed_amount: number;
  movement_date: string; concept: string | null; updated_at: string; machine: { name: string } | null;
  // Solo las trae la consulta de mamá (el hijo no las necesita):
  account_id?: string; deleted_at?: string | null; created_at?: string;
};
// Categorías que ve el hijo en "Origen del saldo".
export type Category = 'machine' | 'credit' | 'transfer' | 'correction';
export type Tab = 'all' | 'income' | 'transfer';

export function categoryOf(m: { kind: Kind; origin: Origin }): Category {
  if (m.kind === 'transfer') return 'transfer';
  if (m.kind === 'correction') return 'correction';
  return m.origin === 'machine' ? 'machine' : 'credit';
}
export function categoryOfOrigin(origin: Origin): Category {
  return origin === 'machine' ? 'machine' : origin === 'transfer' ? 'transfer' : origin === 'correction' ? 'correction' : 'credit';
}
export const CATEGORY_LABEL: Record<Category, string> = {
  machine: 'Máquinas', credit: 'Saldo agregado', transfer: 'Transferencias', correction: 'Correcciones',
};
export const CATEGORY_ORDER: Category[] = ['machine', 'credit', 'transfer', 'correction'];

const ORIGIN_LABEL: Record<string, string> = { work: 'Trabajo', other: 'Otro', machine: 'Máquina' };

export function movementTitle(m: Movement): string {
  switch (m.kind) {
    case 'machine_income': return m.machine?.name ?? 'Ingreso de máquina';
    case 'transfer': return 'Transferencia recibida';
    case 'correction': return 'Corrección';
    case 'credit': return 'Saldo agregado';
  }
}
export function movementSubtitle(m: Movement): string {
  if (m.concept) return m.concept;
  if (m.kind === 'credit') return m.origin === 'custom' ? (m.origin_detail ?? '') : (m.origin === 'machine' && m.machine ? m.machine.name : ORIGIN_LABEL[m.origin] ?? '');
  return '';
}

export function filterByTab(list: Movement[], tab: Tab): Movement[] {
  if (tab === 'income') return list.filter((m) => m.signed_amount > 0 && m.kind !== 'correction');
  if (tab === 'transfer') return list.filter((m) => m.kind === 'transfer');
  return list;
}

// Suma el desglose por origen (work+other+custom = "Saldo agregado") para la pantalla "Mi cuenta".
export function totalsByCategory(byOrigin: { origin: Origin; total: number }[]): Record<Category, number> {
  const t: Record<Category, number> = { machine: 0, credit: 0, transfer: 0, correction: 0 };
  for (const o of byOrigin) t[categoryOfOrigin(o.origin)] += o.total;
  return t;
}
