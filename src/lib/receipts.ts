// Reglas de comprobantes (puras, sin React Native). Deben coincidir con la BD y el bucket: JPG/PNG/PDF, máx. 10 MB.
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RECEIPT_MIMES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export type ReceiptMime = (typeof RECEIPT_MIMES)[number];

const EXT_BY_MIME: Record<ReceiptMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

export function mimeFromName(name: string): ReceiptMime | null {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'pdf') return 'application/pdf';
  return null;
}

export function validateReceipt(f: { name: string; mime: string | null | undefined; size: number | null | undefined }): { ok: true; mime: ReceiptMime; size: number } | { ok: false; error: string } {
  const mime = (RECEIPT_MIMES as readonly string[]).includes(f.mime ?? '') ? (f.mime as ReceiptMime) : mimeFromName(f.name);
  if (!mime) return { ok: false, error: 'El comprobante debe ser una imagen JPG o PNG, o un PDF.' };
  if (!f.size || f.size <= 0) return { ok: false, error: 'No se pudo leer el archivo.' };
  if (f.size > MAX_RECEIPT_BYTES) return { ok: false, error: 'El archivo es muy pesado (máximo 10 MB).' };
  return { ok: true, mime, size: f.size };
}

// <account_id>/<movement_id>/<uuid>.<ext> — el primer tramo es la cuenta; la BD y el bucket lo exigen.
export function receiptPath(accountId: string, movementId: string, id: string, mime: ReceiptMime): string {
  return `${accountId}/${movementId}/${id}.${EXT_BY_MIME[mime]}`;
}
