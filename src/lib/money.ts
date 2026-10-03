// Pesos enteros con punto de miles: 1250000 → "$1.250.000"; negativos: "-$100.000".
export function formatCOP(n: number): string {
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$${digits}`;
}
export function formatSigned(n: number): string {
  return `${n > 0 ? '+' : ''}${formatCOP(n)}`;
}
// "150.000" / "150000" / "$ 150.000" → 150000 (null si no es un entero positivo)
export function parseCOP(text: string): number | null {
  const clean = text.replace(/[^\d]/g, '');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
