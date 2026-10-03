import { File } from 'expo-file-system';
import { receiptPath, validateReceipt, type ReceiptMime } from './receipts';
import type { AuditEntry, AuditTable } from './audit';
import type { Movement, Origin } from './movements';
import { supabase } from './supabase';

export type DashboardAccount = { account_id: string; owner_key: string; display_name: string; balance: number; assigned: number; transferred: number };
export type DashboardMachine = { id: string; name: string; description: string | null; active: boolean; total: number };
export type Dashboard = {
  total_machine_income: number; unassigned_income: number; total_transferred: number; managed_balance: number;
  accounts: DashboardAccount[]; machines: DashboardMachine[];
};
export type MachineIncome = { id: string; income_date: string; amount: number; description: string | null };

function unwrap<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data as T;
}

export async function fetchDashboard(from: string | null, to: string | null): Promise<Dashboard> {
  return unwrap(await supabase.rpc('admin_dashboard', { p_from: from, p_to: to })) as Dashboard;
}
export async function createMachine(name: string, description: string | null): Promise<void> {
  unwrap(await supabase.rpc('create_machine', { p_name: name, p_description: description }));
}
export async function updateMachine(id: string, name: string, description: string | null, active: boolean): Promise<void> {
  unwrap(await supabase.rpc('update_machine', { p_id: id, p_name: name, p_description: description, p_active: active }));
}
export type Machine = { id: string; name: string; description: string | null; active: boolean };
export async function fetchMachine(id: string): Promise<Machine> {
  return unwrap(await supabase.from('machines').select('id, name, description, active').eq('id', id).single()) as Machine;
}
export async function fetchMachineIncomes(machineId: string): Promise<MachineIncome[]> {
  return unwrap(await supabase.from('incomes').select('id, income_date, amount, description')
    .eq('machine_id', machineId).is('deleted_at', null).order('income_date', { ascending: false }).limit(100)) as MachineIncome[];
}

export function isInsufficientFunds(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith('Saldo insuficiente');
}

export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  // Las reglas de negocio de la base de datos (RAISE EXCEPTION) ya están escritas en español para mamá.
  if ((e as { code?: string } | null)?.code === 'P0001' && m && !m.startsWith('Saldo insuficiente') && !m.startsWith('Saldo pendiente')) return m;
  if (m.includes('duplicate key') || m.includes('machines_name_unique')) return 'Ya existe una máquina con ese nombre.';
  if (m.includes('No autorizado')) return 'No tiene permiso para esta acción.';
  if (m.toLowerCase().includes('fetch') || m.toLowerCase().includes('network')) return 'Sin conexión. Revise su internet.';
  return 'Ocurrió un error. Intente de nuevo.';
}

export type Member = { owner_key: string; display_name: string; is_helper: boolean; active: boolean; is_me: boolean; user_id: string | null };
// Estado de registro de la familia, sin dinero. Lo pueden pedir mamá y los ayudantes.
export async function fetchMembers(): Promise<Member[]> {
  return unwrap(await supabase.rpc('family_status')) as Member[];
}
export async function renameMember(userId: string, name: string): Promise<void> {
  unwrap(await supabase.rpc('rename_member', { p_user: userId, p_name: name }));
}
export async function setMemberActive(userId: string, active: boolean, force = false): Promise<void> {
  unwrap(await supabase.rpc('set_member_active', { p_user: userId, p_active: active, p_force: force }));
}
export function isPendingBalance(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith('Saldo pendiente');
}
export async function setHelper(userId: string, value: boolean): Promise<void> {
  unwrap(await supabase.rpc('set_helper', { p_user: userId, p_value: value }));
}

async function callFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    throw new Error(detail?.error ?? error.message);
  }
  return data as T;
}

export type Invite = { code: string; link: string; email: string; display_name: string; resent: boolean };
// Sin ownerKey: agrega una persona nueva (nombre + correo). Con ownerKey: enlace nuevo para alguien que ya existe. Nunca se manejan contraseñas.
export function inviteMember(args: { ownerKey?: string; email?: string; displayName?: string }): Promise<Invite> {
  return callFunction('invite-member', { owner_key: args.ownerKey, email: args.email, display_name: args.displayName });
}
// Pantalla pública: canjea el código y crea la cuenta con la contraseña que elige la persona.
export function acceptInvite(code: string, password: string): Promise<{ email: string }> {
  return callFunction('accept-invite', { code, password });
}

// ───────── Cuenta propia del hijo (RLS garantiza que solo existe SU cuenta) ─────────
export type MyAccount = { account_id: string; balance: number };
export type MySummary = {
  balance: number; opening_balance: number; total_income: number; total_received: number;
  by_origin: { origin: Origin; total: number }[];
  last_movement: { id: string; kind: string; signed_amount: number; movement_date: string } | null;
};
export async function fetchMyAccount(): Promise<MyAccount> {
  return unwrap(await supabase.from('account_balances').select('account_id, balance').single()) as MyAccount;
}
export async function fetchMySummary(accountId: string): Promise<MySummary> {
  return unwrap(await supabase.rpc('account_summary', { p_account: accountId })) as MySummary;
}
export async function fetchMyMovements(): Promise<Movement[]> {
  return unwrap(await supabase.from('account_movements')
    .select('id, kind, origin, origin_detail, signed_amount, movement_date, concept, updated_at, machine:machines(name)')
    .order('movement_date', { ascending: false }).order('created_at', { ascending: false }).limit(300)) as unknown as Movement[];
}

// ───────── Mamá: registrar dinero (Fase 5) ─────────
export type Income = {
  id: string; income_date: string; amount: number; description: string | null;
  machine: { name: string } | null; allocations: { account_id: string; signed_amount: number; deleted_at: string | null }[];
};
export async function fetchIncomes(): Promise<Income[]> {
  const rows = unwrap(await supabase.from('incomes')
    .select('id, income_date, amount, description, machine:machines(name), allocations:account_movements(account_id, signed_amount, deleted_at)')
    .is('deleted_at', null).order('income_date', { ascending: false }).order('created_at', { ascending: false }).limit(100)) as unknown as Income[];
  return rows.map((r) => ({ ...r, allocations: r.allocations.filter((a) => a.deleted_at === null) }));
}
export async function fetchActiveMachines(): Promise<{ id: string; name: string }[]> {
  return unwrap(await supabase.from('machines').select('id, name').eq('active', true).order('name')) as { id: string; name: string }[];
}
export async function registerIncome(v: { machineId: string; amount: number; date: string; description: string | null; allocations: { account_id: string; amount: number }[] }): Promise<void> {
  unwrap(await supabase.rpc('register_income', { p_machine: v.machineId, p_date: v.date, p_amount: v.amount, p_description: v.description, p_allocations: v.allocations }));
}
export async function addBalance(v: { accountId: string; amount: number; date: string; origin: string; detail: string | null; description: string | null }): Promise<void> {
  unwrap(await supabase.rpc('add_balance', { p_account: v.accountId, p_amount: v.amount, p_date: v.date, p_origin: v.origin, p_origin_detail: v.detail, p_concept: v.description }));
}
export async function registerTransfer(v: { accountId: string; amount: number; date: string; concept: string | null }, allowOverdraft = false): Promise<string> {
  return unwrap(await supabase.rpc('register_transfer', { p_account: v.accountId, p_amount: v.amount, p_date: v.date, p_concept: v.concept, p_allow_overdraft: allowOverdraft })) as string;
}
export type AdminTransfer = { id: string; account_id: string; signed_amount: number; movement_date: string; concept: string | null };
export async function fetchTransfers(): Promise<AdminTransfer[]> {
  return unwrap(await supabase.from('account_movements').select('id, account_id, signed_amount, movement_date, concept')
    .eq('kind', 'transfer').is('deleted_at', null).order('movement_date', { ascending: false }).order('created_at', { ascending: false }).limit(100)) as AdminTransfer[];
}
export async function fetchAccountMovements(accountId: string): Promise<Movement[]> {
  return unwrap(await supabase.from('account_movements')
    .select('id, kind, origin, origin_detail, signed_amount, movement_date, concept, updated_at, machine:machines(name)')
    .eq('account_id', accountId).is('deleted_at', null)
    .order('movement_date', { ascending: false }).order('created_at', { ascending: false }).limit(300)) as unknown as Movement[];
}

// ───────── Comprobantes (Fase 6) ─────────
export type Receipt = {
  id: string; storage_path: string; mime_type: ReceiptMime; size_bytes: number; created_at: string;
  movement: { id: string; kind: string; account_id: string; signed_amount: number; movement_date: string; concept: string | null } | null;
};
const RECEIPT_SELECT = 'id, storage_path, mime_type, size_bytes, created_at, movement:account_movements(id, kind, account_id, signed_amount, movement_date, concept)';

// RLS: el hijo solo recibe los comprobantes de SUS movimientos; mamá, todos.
export async function fetchReceipts(): Promise<Receipt[]> {
  return unwrap(await supabase.from('receipts').select(RECEIPT_SELECT).is('deleted_at', null).order('created_at', { ascending: false }).limit(200)) as unknown as Receipt[];
}
export async function fetchMovementReceipts(movementId: string): Promise<Receipt[]> {
  return unwrap(await supabase.from('receipts').select(RECEIPT_SELECT).eq('movement_id', movementId).is('deleted_at', null).order('created_at')) as unknown as Receipt[];
}
// Enlace temporal (2 min) para ver el archivo. Storage lo concede solo si la persona puede ver ese comprobante.
export async function receiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 120);
  if (error || !data) throw new Error('No se pudo abrir el comprobante.');
  return data.signedUrl;
}

export type PickedFile = { uri: string; name: string; mime: string | null | undefined; size: number | null | undefined };

// 1) valida, 2) sube a Storage, 3) registra en la BD. Si el paso 3 falla, se borra el archivo (no quedan huérfanos).
export async function uploadReceipt(accountId: string, movementId: string, file: PickedFile): Promise<void> {
  const v = validateReceipt(file);
  if (!v.ok) throw new Error(v.error);
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = receiptPath(accountId, movementId, id, v.mime);
  const bytes = await new File(file.uri).arrayBuffer();
  const up = await supabase.storage.from('receipts').upload(path, bytes, { contentType: v.mime, upsert: false });
  if (up.error) throw new Error('No se pudo subir el archivo. Revise su internet.');
  const att = await supabase.rpc('attach_receipt', { p_movement: movementId, p_path: path, p_mime: v.mime, p_size: v.size });
  if (att.error) {
    await supabase.storage.from('receipts').remove([path]);
    throw Object.assign(new Error(att.error.message), { code: att.error.code });
  }
}
export async function deleteReceipt(id: string, reason?: string): Promise<void> {
  unwrap(await supabase.rpc('delete_receipt', { p_id: id, p_reason: reason ?? null }));
}

// ───────── Mamá: historial, edición, eliminación y auditoría (Fase 7) ─────────
const ADMIN_MOVEMENT_SELECT = 'id, account_id, kind, origin, origin_detail, income_id, signed_amount, movement_date, concept, created_at, updated_at, deleted_at, machine_id, machine:machines(name)';
export type AdminMovement = Movement & { income_id: string | null; machine_id: string | null };

export type HistoryFilters = { from: string | null; to: string | null; kind: string | null; accountId: string | null; machineId: string | null; includeDeleted: boolean };
export async function fetchHistory(f: HistoryFilters): Promise<AdminMovement[]> {
  let q = supabase.from('account_movements').select(ADMIN_MOVEMENT_SELECT);
  if (f.from) q = q.gte('movement_date', f.from);
  if (f.to) q = q.lte('movement_date', f.to);
  if (f.kind) q = q.eq('kind', f.kind);
  if (f.accountId) q = q.eq('account_id', f.accountId);
  if (f.machineId) q = q.eq('machine_id', f.machineId);
  if (!f.includeDeleted) q = q.is('deleted_at', null);
  return unwrap(await q.order('movement_date', { ascending: false }).order('created_at', { ascending: false }).limit(500)) as unknown as AdminMovement[];
}
export async function fetchMovement(id: string): Promise<AdminMovement> {
  return unwrap(await supabase.from('account_movements').select(ADMIN_MOVEMENT_SELECT).eq('id', id).single()) as unknown as AdminMovement;
}
// Nombres de TODAS las cuentas (también las de personas quitadas), para mostrar el destinatario.
export async function fetchAccountNames(): Promise<Record<string, string>> {
  const rows = unwrap(await supabase.from('accounts').select('id, profile:profiles(display_name)')) as unknown as { id: string; profile: { display_name: string } | null }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.profile?.display_name ?? '']));
}
export async function fetchProfileNames(): Promise<Record<string, string>> {
  const rows = unwrap(await supabase.from('profiles').select('id, display_name')) as { id: string; display_name: string }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.display_name]));
}
export async function updateMovement(id: string, amount: number, date: string, concept: string | null, reason: string | null): Promise<void> {
  unwrap(await supabase.rpc('update_movement', { p_id: id, p_amount: amount, p_date: date, p_concept: concept, p_reason: reason }));
}
export async function deleteMovement(id: string, reason: string | null): Promise<void> {
  unwrap(await supabase.rpc('delete_movement', { p_id: id, p_reason: reason }));
}
export async function fetchAudit(table: AuditTable, recordId: string): Promise<AuditEntry[]> {
  return unwrap(await supabase.from('audit_logs').select('id, action, old_data, new_data, reason, actor_id, at')
    .eq('table_name', table).eq('record_id', recordId).order('at').order('id')) as unknown as AuditEntry[];
}

export type IncomeDetail = {
  id: string; machine_id: string; income_date: string; amount: number; description: string | null; deleted_at: string | null;
  machine: { name: string } | null; allocations: { id: string; account_id: string; signed_amount: number; deleted_at: string | null }[];
};
export async function fetchIncome(id: string): Promise<IncomeDetail> {
  const r = unwrap(await supabase.from('incomes')
    .select('id, machine_id, income_date, amount, description, deleted_at, machine:machines(name), allocations:account_movements(id, account_id, signed_amount, deleted_at)')
    .eq('id', id).single()) as unknown as IncomeDetail;
  return { ...r, allocations: r.allocations.filter((a) => a.deleted_at === null) };
}
export async function updateIncome(v: { id: string; amount: number; date: string; description: string | null; allocations: { account_id: string; amount: number }[]; reason: string | null }): Promise<void> {
  unwrap(await supabase.rpc('update_income', { p_id: v.id, p_date: v.date, p_amount: v.amount, p_description: v.description, p_allocations: v.allocations, p_reason: v.reason }));
}
export async function deleteIncome(id: string, reason: string | null): Promise<void> {
  unwrap(await supabase.rpc('delete_income', { p_id: id, p_reason: reason }));
}

export async function registerCorrection(v: { accountId: string; signedAmount: number; date: string; concept: string }): Promise<void> {
  unwrap(await supabase.rpc('register_correction', { p_account: v.accountId, p_signed_amount: v.signedAmount, p_date: v.date, p_concept: v.concept }));
}

// ───────── Notificaciones (Fase 9) ─────────
export type AppNotification = { id: string; title: string; body: string; created_at: string; read_at: string | null };
export async function fetchNotifications(): Promise<AppNotification[]> {
  return unwrap(await supabase.from('notifications').select('id, title, body, created_at, read_at').order('created_at', { ascending: false }).limit(100)) as AppNotification[];
}
export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
export async function markNotificationsRead(): Promise<void> {
  unwrap(await supabase.rpc('mark_notifications_read'));
}
