import { supabase } from './supabase';

export interface DepositRow {
  id: number;
  team: 'red' | 'blue';
  amount: number;
  createdAt: string;
}

export async function loadRecentDeposits(limit = 50): Promise<DepositRow[]> {
  const { data, error } = await supabase
    .from('deposits')
    .select('id,team,amount,created_at')
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows: DepositRow[] = [];
  for (const r of data ?? []) {
    if (r.team !== 'red' && r.team !== 'blue') continue;
    rows.push({
      id: Number(r.id),
      team: r.team,
      amount: Number(r.amount) || 0,
      createdAt: String(r.created_at),
    });
  }
  return rows;
}
