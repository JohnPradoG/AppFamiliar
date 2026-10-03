import type { Movement, Origin } from './movements';
import { supabase } from './supabase';

export type DashboardAccount = { account_id: string; owner_key: 'john' | 'brother'; display_name: string; balance: number; assigned: number; transferred: number };
export type DashboardMachine = { id: string; name: string; description: string | null; active: boolean; total: number };
export type Dashboard = {
  total_machine_income: number; unassigned_income: number; total_transferred: number; managed_balance: number;
  accounts: DashboardAccount[]; machines: DashboardMachine[];
};
export type MachineIncome = { id: string; income_date: string; amount: number; description: string | null };

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
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

export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (m.includes('duplicate key') || m.includes('machines_name_unique')) return 'Ya existe una máquina con ese nombre.';
  if (m.includes('No autorizado')) return 'No tiene permiso para esta acción.';
  if (m.toLowerCase().includes('fetch') || m.toLowerCase().includes('network')) return 'Sin conexión. Revise su internet.';
  return 'Ocurrió un error. Intente de nuevo.';
}

export type Member = { owner_key: 'john' | 'brother'; display_name: string; is_helper: boolean; user_id: string | null };
// Estado de registro de la familia, sin dinero. Lo pueden pedir mamá y los ayudantes.
export async function fetchMembers(): Promise<Member[]> {
  return unwrap(await supabase.rpc('family_status')) as Member[];
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
// Mamá pide una invitación de un solo uso (o una nueva si el hijo ya tiene cuenta). Nunca se manejan contraseñas.
export function inviteMember(ownerKey: 'john' | 'brother', email?: string, displayName?: string): Promise<Invite> {
  return callFunction('invite-member', { owner_key: ownerKey, email, display_name: displayName });
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
