export type PeriodKey = 'today' | 'week' | 'month' | 'prev_month' | 'all';
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'prev_month', label: 'Mes anterior' },
  { key: 'all', label: 'Todo' },
];

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Rango inclusivo [from, to] en fecha local. La semana empieza el lunes. 'all' = sin límites.
export function periodRange(key: PeriodKey, now: Date = new Date()): { from: string | null; to: string | null } {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case 'today':
      return { from: toISODate(day), to: toISODate(day) };
    case 'week': {
      const monday = new Date(day);
      monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: toISODate(monday), to: toISODate(sunday) };
    }
    case 'month':
      return { from: toISODate(new Date(day.getFullYear(), day.getMonth(), 1)), to: toISODate(new Date(day.getFullYear(), day.getMonth() + 1, 0)) };
    case 'prev_month':
      return { from: toISODate(new Date(day.getFullYear(), day.getMonth() - 1, 1)), to: toISODate(new Date(day.getFullYear(), day.getMonth(), 0)) };
    case 'all':
      return { from: null, to: null };
  }
}
