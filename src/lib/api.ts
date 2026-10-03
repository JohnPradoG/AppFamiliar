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
